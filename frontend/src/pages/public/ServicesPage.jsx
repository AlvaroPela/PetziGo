import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Link } from "react-router-dom";
import Modal from "../../components/Modal";
import ServiceForm from "../../components/ServiceForm";

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

const ServicesPage = () => {
	const [services, setServices] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

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

	// errores locales de validación de filtros
	const [filterError, setFilterError] = useState(null);

	// efecto inicial: carga todo (sin filtros)
	useEffect(() => {
		let mounted = true;
		const loadAll = async () => {
			setLoading(true);
			setError(null);
			try {
				debugger;
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
		setEditing(null);
		setOpen(true);
	}

	function openEdit(service) {
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

	return (
		<div className="container mx-auto p-4">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold">Servicios</h1>
				<div className="flex items-center gap-2">
					<button onClick={openCreate} className="px-4 py-2 rounded bg-petzi text-white">
						Nuevo servicio
					</button>
				</div>
			</div>

			{/* --- Panel de filtros --- */}
			<div className="mb-4 p-4 border rounded bg-white">
				<h2 className="font-semibold mb-2">Filtros</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div>
						<label className="block text-sm font-medium">Categoría</label>
						<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
							{CATEGORY_OPTIONS.map((opt) => (
								<option key={opt.value || "all"} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium">Precio mínimo</label>
						<input
							type="number"
							min="0"
							step="0.01"
							value={minPrice}
							onChange={(e) => setMinPrice(e.target.value)}
							className="mt-1 block w-full border rounded px-3 py-2"
							placeholder="0"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium">Precio máximo</label>
						<input
							type="number"
							min="0"
							step="0.01"
							value={maxPrice}
							onChange={(e) => setMaxPrice(e.target.value)}
							className="mt-1 block w-full border rounded px-3 py-2"
							placeholder="∞"
						/>
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
						<label className="block text-sm font-medium">Buscar</label>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="mt-1 block w-full border rounded px-3 py-2"
							placeholder="palabra clave en título o descripción"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium">Provider ID (opcional)</label>
						<input
							type="text"
							value={providerId}
							onChange={(e) => setProviderId(e.target.value)}
							className="mt-1 block w-full border rounded px-3 py-2"
							placeholder="id del proveedor"
						/>
					</div>
				</div>

				{filterError && <p className="text-red-600 mt-2">{filterError}</p>}

				<div className="mt-3 flex items-center gap-2">
					<button onClick={loadWithFilters} className="px-4 py-2 rounded bg-petzi text-white" disabled={loading}>
						Aplicar filtros
					</button>
					<button onClick={resetFilters} className="px-4 py-2 rounded border" disabled={loading}>
						Resetear
					</button>
				</div>
			</div>

			{loading && <p>Cargando...</p>}
			{error && <p className="text-red-600">{error}</p>}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{services.map((s) => (
					<div key={s.id} className="rounded-lg border p-4 bg-white">
						<h3 className="font-semibold">{s.title}</h3>
						<p className="text-sm text-gray-600">{s.description}</p>
						<p className="text-sm text-gray-500">Categoria: {s.category}</p>
						<span className="text-sm font-medium text-petzi">$ {s.price}</span>
						<div className="mt-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Link to={`/services/${s.id}`} className="text-sm px-2 py-1 border rounded bg-green-400 text-white hover:bg-green-700">
									Ver
								</Link>

								<button onClick={() => openEdit(s)} className="text-sm px-2 py-1 border rounded bg-blue-400 text-white hover:bg-blue-700">
									Editar
								</button>

								<button onClick={() => deleteService(s.id)} className="text-sm px-2 py-1 border rounded text-white bg-red-400 hover:bg-red-700">
									Eliminar
								</button>
							</div>
						</div>
					</div>
				))}
				{services.length === 0 && !loading && <p>No se encontraron servicios</p>}
			</div>

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
