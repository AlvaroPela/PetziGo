import React, { useEffect, useMemo, useState } from "react";
import { api, assetUrl } from "../../lib/api";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Modal from "../../components/Modal";
import ServiceForm from "../../components/ServiceForm";
import { Input, Select, Button } from "../../components/FormComponents";
import { useAuth } from "../../auth/AuthProvider";

const CATEGORY_OPTIONS = [
	{ label: "Todas", value: "" },
	{ label: "Paseo", value: "PASEO" },
	{ label: "Veterinaria", value: "VETERINARIA" },
	{ label: "Entrenamiento", value: "ENTRENAMIENTO" },
	{ label: "Estética", value: "ESTETICA" },
	{ label: "Guardería", value: "GUARDERIA" },
	{ label: "Otro", value: "OTRO" },
];

const RATING_OPTIONS = [
	{ label: "Cualquiera", value: "" },
	{ label: "1+", value: "1" },
	{ label: "2+", value: "2" },
	{ label: "3+", value: "3" },
	{ label: "4+", value: "4" },
	{ label: "5", value: "5" },
];


const SORT_OPTIONS = [
		{ label: "Relevancia", value: "relevance" },
		{ label: "Precio: menor a mayor", value: "price_asc" },
		{ label: "Precio: mayor a menor", value: "price_desc" },
		{ label: "Rating", value: "rating_desc" },
	];

const ServicesPage = () => {
	const [services, setServices] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const auth = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	// modal state
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState(null); // servicio a editar o null para crear

	// filtros
	const [category, setCategory] = useState("");
	const [minPrice, setMinPrice] = useState("");
	const [maxPrice, setMaxPrice] = useState("");
	const [rating, setRating] = useState("");
	const [search, setSearch] = useState("");
	const [providerId, setProviderId] = useState("");
	const [sortBy, setSortBy] = useState("relevance");
	const [page, setPage] = useState(1);
	const pageSize = 12;

	// Modal imagen ampliada
	const [imgModal, setImgModal] = useState({ open: false, src: null, alt: '' });

	// errores locales de validación de filtros
	const [filterError, setFilterError] = useState(null);

	// efecto inicial: carga todo (sin filtros)
	useEffect(() => {
		let mounted = true;
		const loadAll = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await api("/services"); // sin queries -> devuelve todo
				if (!mounted) return;
				setServices(Array.isArray(res.services) ? res.services : res.services || []);
			} catch (err) {
				console.error("ServicesPage load error:", err);
				setError(err.message || "Error cargando servicios");
			} finally {
				if (mounted) setLoading(false);
			}
		};
		loadAll();
		return () => {
			mounted = false;
		};
	}, []);

	async function loadWithFilters() {
		// validaciones básicas antes de llamar
		setFilterError(null);

		// convertir a floats si vinieron
		const min = minPrice === "" ? null : parseFloat(minPrice);
		const max = maxPrice === "" ? null : parseFloat(maxPrice);

		if (min !== null && Number.isNaN(min)) {
			setFilterError("Precio mínimo inválido");
			return;
		}
		if (max !== null && Number.isNaN(max)) {
			setFilterError("Precio máximo inválido");
			return;
		}
		if (min !== null && max !== null && min > max) {
			setFilterError("El precio mínimo no puede ser mayor que el máximo");
			return;
		}

		// build query string only with filled filters
		const params = new URLSearchParams();
		if (category) params.append("category", category);
		if (min !== null) params.append("min_price", String(min));
		if (max !== null) params.append("max_price", String(max));
		if (rating) params.append("rating", rating);
		if (search) params.append("search", search);
		if (providerId) params.append("provider_id", providerId);

		const qs = params.toString();
		const path = qs ? `/services?${qs}` : "/services";

		setLoading(true);
		setError(null);
		try {
			const res = await api(path);
			setServices(Array.isArray(res.services) ? res.services : res.services || []);
				setPage(1);
			} catch (err) {
			console.error("ServicesPage loadWithFilters error:", err);
			setError(err.message || "Error cargando servicios");
		} finally {
			setLoading(false);
		}
	}

	function resetFilters() {
		setCategory("");
		setMinPrice("");
		setMaxPrice("");
		setRating("");
		setSearch("");
		setProviderId("");
		setFilterError(null);
		// recargar todo
		loadAllWithoutMountFlag();
	}

	// helper: recarga todo sin depender del mounted flag del useEffect original
	async function loadAllWithoutMountFlag() {
		setLoading(true);
		setError(null);
		try {
			const res = await api("/services");
			setServices(Array.isArray(res.services) ? res.services : res.services || []);
		} catch (err) {
			console.error("ServicesPage loadAllWithoutMountFlag error:", err);
			setError(err.message || "Error cargando servicios");
		} finally {
			setLoading(false);
		}
	}

	function openCreate() {
			if (!auth.user) {
				navigate('/login', { state: { from: location.pathname } });
				return;
			}
			if (auth.user.role !== 'PROVIDER') {
	 			window.alert('Solo proveedores pueden crear servicios.');
	 			return;
	 		}
			setEditing(null);
			setOpen(true);
		}

	function openEdit(service) {
	 		if (!auth.user) {
	 			navigate('/login', { state: { from: location.pathname } });
	 			return;
	 		}
	 		if (auth.user.role !== 'PROVIDER') {
	 			window.alert('No tienes permisos para editar este servicio.');
	 			return;
	 		}
			setEditing(service);
			setOpen(true);
		}

	// callback que pasa ServiceForm al guardar
	function handleSaved(savedService) {
		// actualizar lista localmente: si ya existía, reemplazar; si no, añadir al inicio
		setServices((prev) => {
			console.log("servicio guardado:", savedService);
			console.log("lista previa:", prev);
			const exists = prev.find((s) => String(s.id) === String(savedService.id));
			if (exists) {
				return prev.map((s) => (String(s.id) === String(savedService.id) ? savedService : s));
			} else {
				return [savedService, ...prev];
			}
		});
		setOpen(false);
		setEditing(null);
	}

	async function deleteService(serviceId) {
		const ok = window.confirm("¿Eliminar este servicio? Esta acción marcará el servicio como eliminado.");
		if (!ok) return;

		try {
			const resFetch = await api(`/services/${serviceId}`, { method: "DELETE" });		

			// actualizar UI localmente (remover el servicio)
			setServices((prev) => prev.filter((s) => String(s.id) !== String(serviceId)));
			loadWithFilters(); // recargar con filtros actuales
		} catch (err) {
			console.error("deleteService error:", err);
			alert(err.message || "No se pudo eliminar el servicio");
		}
	}

	function formatCurrency(value) {
		try {
			return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
		} catch {
			return `$ ${value}`;
		}
	}

	function RatingStars({ value = 0 }) {
		const v = Math.max(0, Math.min(5, Number(value || 0)));
		const full = Math.floor(v);
		const half = v - full >= 0.5;
		const empty = 5 - full - (half ? 1 : 0);
		return (
			<div className="flex items-center gap-0.5" aria-label={`Rating ${v}`}>
				{Array.from({ length: full }).map((_, i) => (
					<span key={`f-${i}`} className="text-amber-500">★</span>
				))}
				{half && <span className="text-amber-500">☆</span>}
				{Array.from({ length: empty }).map((_, i) => (
					<span key={`e-${i}`} className="text-gray-300">★</span>
				))}
				<span className="ml-1 text-xs text-gray-500">{v.toFixed(1)}</span>
			</div>
		);
	}

	const sortedServices = useMemo(() => {
		const list = Array.isArray(services) ? [...services] : [];
		switch (sortBy) {
			case 'price_asc':
				return list.sort((a, b) => (a.price || 0) - (b.price || 0));
			case 'price_desc':
				return list.sort((a, b) => (b.price || 0) - (a.price || 0));
			case 'rating_desc':
				return list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
			default:
				return list; // relevancia (orden original del backend)
		}
	}, [services, sortBy]);

	const totalPages = Math.max(1, Math.ceil(sortedServices.length / pageSize));
	const pageClamped = Math.min(page, totalPages);
	const visible = useMemo(() => {
		const start = (pageClamped - 1) * pageSize;
		return sortedServices.slice(start, start + pageSize);
	}, [sortedServices, pageClamped]);

	return (
		<div className="container mx-auto p-4">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h1 className="text-2xl font-bold">Servicios</h1>
					<p className="text-sm text-gray-500">Explora y filtra servicios de proveedores verificados.</p>
				</div>
				<div className="flex items-center gap-2">
					{(auth.user && auth.user.role === 'PROVIDER') && (
						<Button onClick={openCreate}>
							Nuevo servicio
						</Button>
					)}
				</div>
			</div>

			{/* --- Panel de filtros --- */}
			<div className="mb-4 p-4 border rounded-2xl bg-white">
				<div className="flex items-center justify-between mb-2">
					<h2 className="font-semibold">Filtros</h2>
					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-500 hidden md:inline">{sortedServices.length} resultados</span>
						<Select label="Ordenar" value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} options={SORT_OPTIONS} />
					</div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div>
						<Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
					</div>

					<div>
						<Input label="Precio mínimo" type="number" min="0" step="0.01" value={minPrice} onChange={setMinPrice} placeholder="0" />
					</div>

					<div>
						<Input label="Precio máximo" type="number" min="0" step="0.01" value={maxPrice} onChange={setMaxPrice} placeholder="∞" />
					</div>

					{/* <div>
						<label className="block text-sm font-medium">Rating</label>
						<select value={rating} onChange={(e) => setRating(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
							{RATING_OPTIONS.map((opt) => (
								<option key={opt.value || "any"} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div> */}

					<div>
						<Input label="Buscar" value={search} onChange={setSearch} placeholder="palabra clave en título o descripción" />
					</div>

					<div>
						<Input label="Provider ID (opcional)" value={providerId} onChange={setProviderId} placeholder="id del proveedor" />
					</div>
				</div>

				{filterError && <p className="text-red-600 mt-2">{filterError}</p>}

				<div className="mt-3 flex items-center gap-2">
					<Button onClick={() => { setPage(1); loadWithFilters(); }} disabled={loading}>Aplicar filtros</Button>
					<Button onClick={() => { resetFilters(); setSortBy('relevance'); setPage(1); }} variant="outline" disabled={loading}>Resetear</Button>
				</div>
			</div>

			{loading && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="rounded-lg border p-4 bg-white animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
							<div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
							<div className="h-40 bg-gray-100 rounded mb-4" />
							<div className="h-4 bg-gray-200 rounded w-1/3" />
						</div>
					))}
				</div>
			)}
			{error && <p className="text-red-600">{error}</p>}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{visible.map((s) => (
					<div key={s.id} className="rounded-lg border p-4 bg-white">
						<div className="flex items-start justify-between">
							<h3 className="font-semibold text-lg line-clamp-1">{s.title}</h3>
							<span className="ml-2 inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">{s.category}</span>
						</div>
						<div
							className="mt-2 h-36 w-full overflow-hidden rounded bg-slate-50 flex items-center justify-center relative"
							onClick={() => { if (s.image_url) setImgModal({ open: true, src: assetUrl(s.image_url), alt: s.title }); }}
							role={s.image_url ? 'button' : undefined}
							aria-label={s.image_url ? 'Abrir imagen' : undefined}
							style={{ cursor: s.image_url ? 'zoom-in' : 'default' }}
						>
							{s.image_url ? (
								<>
									<img src={assetUrl(s.image_url)} alt={s.title} className="h-full w-full object-cover" />
									<div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">
										Haz clic para ampliar
									</div>
								</>
							) : (
								<div className="text-xs text-slate-500">Sin imagen</div>
							)}
						</div>
						<p className="mt-2 text-sm text-gray-600 line-clamp-2">{s.description}</p>
						<div className="mt-3 flex items-center justify-between">
							<div className="text-sm text-gray-500">
								<div className="font-medium text-gray-700">{s.provider_name}</div>
								<RatingStars value={s.average_rating} />
							</div>
							<div className="text-right">
								<div className="text-lg font-semibold text-petzi">{formatCurrency(s.price)}</div>
							</div>
						</div>
						<div className="mt-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Link to={`/services/${s.id}`} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50 text-sm">Ver</Link>
								{(auth.user && auth.user.role === 'PROVIDER') && (
									<>
										<Button onClick={() => openEdit(s)} className="!px-3 !py-1.5 !text-sm" variant="soft">Editar</Button>
										<Button onClick={() => deleteService(s.id)} className="!px-3 !py-1.5 !text-sm" variant="danger">Eliminar</Button>
									</>
								)}
							</div>
						</div>
					</div>
				))}
				{sortedServices.length === 0 && !loading && <p>No se encontraron servicios</p>}
			</div>

			{/* Paginación */}
			{sortedServices.length > pageSize && (
				<div className="mt-6 flex items-center justify-center gap-2">
					<Button variant="outline" disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
					<span className="text-sm text-gray-600">Página {pageClamped} de {totalPages}</span>
					<Button variant="outline" disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
				</div>
			)}

			{/* Modal de imagen ampliada */}
			<Modal
				isOpen={imgModal.open}
				onClose={() => setImgModal({ open: false, src: null, alt: '' })}
				ariaLabel="Imagen del servicio"
			>
				<div className="max-w-3xl mx-auto">
					{imgModal.src ? (
						<img src={imgModal.src} alt={imgModal.alt} className="max-h-[80vh] w-auto mx-auto rounded" />
					) : (
						<div className="text-slate-500 text-sm">Sin imagen</div>
					)}
				</div>
			</Modal>

			<Modal
				isOpen={open}
				onClose={() => {
					setOpen(false);
					setEditing(null);
				}}
				ariaLabel="Formulario servicio"
			>
				<ServiceForm
					initial={editing}
					onSaved={handleSaved}
					onCancel={() => {
						setOpen(false);
						setEditing(null);
					}}
				/>
			</Modal>
		</div>
	);
};

export default ServicesPage;
