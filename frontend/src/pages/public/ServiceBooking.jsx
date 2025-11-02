import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button, Input, Textarea, Select, Card } from "../../components/FormComponents";
import { api, assetUrl } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import Modal from "../../components/Modal";

const ServiceBooking = () => {
	const { id } = useParams();
	const navigate = useNavigate();

	const [service, setService] = useState(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(null);

	const [quantity, setQuantity] = useState(1);
	const [notes, setNotes] = useState("");
	const [serviceDate, setServiceDate] = useState("");
	const [serviceDay, setServiceDay] = useState("");
	const [serviceTime, setServiceTime] = useState("");
	const [pets, setPets] = useState([]);
	const [petId, setPetId] = useState("");
	const [address, setAddress] = useState("");
	const [petsLoading, setPetsLoading] = useState(false);
	const { user, loading: authLoading } = useAuth();
	const location = useLocation();

	const [imgModal, setImgModal] = useState({ open: false, src: null, alt: '' });

	const fmtCOP = (n) => {
		try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n||0)); } catch { return `$ ${n}`; }
	};

	const unitPrice = useMemo(() => Number(service?.price || 0), [service]);
	const qty = useMemo(() => Math.max(1, Number(quantity || 1)), [quantity]);
	const total = useMemo(() => unitPrice * qty, [unitPrice, qty]);



	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			try {
				const data = await api(`/services/${id}`);
				if (!cancelled) setService(data?.service || null);
			} catch (err) {
				if (!cancelled) setError(err.message || "No se pudo cargar el servicio");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [id]);

	// Si no está autenticado, redirigimos al login (preservando la ruta de retorno)
		// No redirigir automáticamente: mostrar CTA para login en la UI en lugar de forzar navegación
		// Esto evita remounts/redirects repetidos que pueden producir "pegado" en la UI.

	// Cargar mascotas del usuario si existe (para seleccionar a quien va dirigida la reserva)
	useEffect(() => {
		let canceled = false;
		async function loadPets() {
			if (!user) return;
			setPetsLoading(true);
			try {
				const myPets = await api("/users/pets");
				// El endpoint devuelve { pets: [...] } según backend; soportamos ambos formatos
				const list = Array.isArray(myPets) ? myPets : myPets && Array.isArray(myPets.pets) ? myPets.pets : [];
				if (!canceled) setPets(list);
			} catch (err) {
				// Silenciar error de pets; no es crítico
				if (!canceled) {
					// no mostrar logs en consola para evitar ruido
				}
			} finally {
				if (!canceled) setPetsLoading(false);
			}
		}
		loadPets();
		return () => {
			canceled = true;
		};
	}, [user]);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError(null);
		if (!service) return setError("Servicio inválido");
		setSubmitting(true);
		try {
			// Construir ISO a partir de fecha y hora separados (date + time)
			if (!serviceDay || !serviceTime) {
				setError("Por favor selecciona fecha y hora del servicio");
				setSubmitting(false);
				return;
			}

			const combined = `${serviceDay}T${serviceTime}`; // ejemplo: 2025-10-28T14:30
			const parsed = new Date(combined);
			if (isNaN(parsed.getTime())) {
				setError("Fecha u hora inválida");
				setSubmitting(false);
				return;
			}

			// Validar dirección (requerida y mínimo 5 caracteres)
			if (!address || (address || '').trim().length < 10) {
				setError('La dirección es obligatoria y debe tener al menos 10 caracteres');
				setSubmitting(false);
				return;
			}

			const body = {
				itemType: "SERVICE",
				itemId: Number(id),
				quantity: Number(quantity) || 1,
				notes: notes || undefined,
				service_date: parsed.toISOString(),
				petId: petId ? Number(petId) : undefined,
				address: address || undefined,
			};

				const res = await api("/orders", { method: "POST", body });

			// Respuesta esperada: { id: <orderId>, status: 'PENDING' }
			if (res?.id) {
				// Guardar un resumen local del pedido para mostrar en la página de confirmación
				try {
				  const summary = {
					itemType: 'SERVICE',
					title: service.title || `Reserva #${res.id}`,
					unit_price: unitPrice,
					quantity: qty,
					total: unitPrice * qty
				  };
				  localStorage.setItem(`order_summary_${res.id}`, JSON.stringify(summary));
				} catch {}
				// Redirigir a página de confirmación de solicitud (pendiente de aceptación del proveedor)
				navigate(`/services/${id}/booked?orderId=${encodeURIComponent(res.id)}`);
				return;
			} else {
				setError("Reserva creada pero sin id de pedido en la respuesta");
			}
		} catch (err) {
			setError(err.message || "Error al crear la reserva");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
	if (error && !service) return <div className="min-h-screen flex items-center justify-center text-rose-600">Error: {error}</div>;
	if (!service) return <div className="min-h-screen flex items-center justify-center">Servicio no encontrado</div>;

	return (
		<div className="min-h-screen bg-gray-50 p-6">
			<div className="max-w-4xl mx-auto">
				<Card title={`Reservar: ${service.title}`} description={`Proveedor: ${service.provider_name || service.providerName || ""}`} actions={null}>
					<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
						{/* Columna izquierda: imagen + info + formulario */}
						<div className="md:col-span-8">
							<div
								className="relative mx-auto w-full md:max-w-md h-40 md:h-48 overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center"
								onClick={() => { if (service.image_url) setImgModal({ open: true, src: assetUrl(service.image_url), alt: service.title }); }}
								role={service.image_url ? 'button' : undefined}
								aria-label={service.image_url ? 'Abrir imagen' : undefined}
								style={{ cursor: service.image_url ? 'zoom-in' : 'default' }}
							>
								{service.image_url ? (
									<>
										<img src={assetUrl(service.image_url)} alt={service.title} className="h-full w-full object-cover" />
										<div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">Haz clic para ampliar</div>
									</>
								) : (
									<div className="flex flex-col items-center justify-center text-xs text-slate-500">
										<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
											<path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
										</svg>
										<div>Sin imagen</div>
									</div>
								)}
							</div>
							<div className="mt-3 text-sm text-slate-600 space-y-1">
								<div>Precio unitario: <span className="font-medium">{fmtCOP(unitPrice)}</span></div>
								{service.location_lat && service.location_lng && <div>Ubicación registrada</div>}
								<div className="pt-2">
									<div className="text-sm text-slate-500">Detalles</div>
									<p className="text-sm text-slate-700">{service.short_description || service.description?.slice(0, 260)}</p>
								</div>
							</div>

							{/* Formulario principal (no en el panel sticky) */}
							<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
								<Input label="Fecha" type="date" value={serviceDay} onChange={setServiceDay} className="w-full" />
								<Input label="Hora" type="time" value={serviceTime} onChange={setServiceTime} className="w-full" step="300" />
								<Select
									label="Mascota"
									value={petId}
									onChange={setPetId}
									options={
										petsLoading
											? [{ value: "", label: "Cargando mascotas..." }]
											: [
												{ value: "", label: "Seleccionar (opcional)" },
												...pets.map((p) => ({ value: String(p.id), label: `${p.name} — ${p.species || ""}` })),
											]
									}
								/>
																<Textarea label="Notas (opcional)" value={notes} onChange={setNotes} rows={3} />
																	<div>
																		<label className="block text-sm font-medium">Dirección del servicio</label>
																		{/* Mostrar borde y mensaje en rojo si la dirección es inválida (menos de 10 caracteres) */}
																		<Input placeholder="Calle, barrio y número" value={address} onChange={setAddress} className="w-full" error={(address || '').trim().length > 0 && (address || '').trim().length < 10 ? 'La dirección debe tener al menos 10 caracteres' : undefined} />
																		<div className={`mt-1 text-xs ${((address || '').trim().length > 0 && (address || '').trim().length < 10) ? 'text-rose-600' : 'text-slate-500'}`}>Actualmente tiene {(address || '').trim().length} caracteres. Mínimo requerido: 10</div>
																	</div>
							</div>
						</div>

						{/* Columna derecha: panel de reserva sticky */}
						<aside className="md:col-span-4">
							<div className="bg-gray-50 rounded-lg p-4 sticky top-4">
								<div className="grid grid-cols-1 gap-3">
									<div>
										<label className="block text-sm font-medium text-slate-700">Cantidad</label>
										<div className="mt-1 inline-flex items-center gap-2">
											<Button type="button" variant="outline" onClick={() => setQuantity(q => Math.max(1, Number(q||1) - 1))} className="!px-3">-</Button>
											<Input type="number" value={quantity} onChange={(v) => {
												const n = Math.max(1, parseInt(v || '1', 10));
												setQuantity(n);
											}} min="1" className="w-24 text-center" />
											<Button type="button" variant="outline" onClick={() => setQuantity(q => Math.max(1, Number(q||1) + 1))} className="!px-3">+</Button>
										</div>
									</div>
								</div>

								<div className="mt-4 border-t pt-3 flex items-center justify-between">
									<div className="text-sm text-slate-600">Total</div>
									<div className="text-2xl font-semibold text-petzi">{fmtCOP(total)}</div>
								</div>

								{error && <div className="mt-2 text-rose-600">{error}</div>}

								<div className="mt-4 flex gap-2">
									<Button type="submit" variant="primary" disabled={submitting}>
										{submitting ? "Reservando…" : "Confirmar reserva"}
									</Button>
									<Button type="button" variant="outline" onClick={() => navigate(-1)}>
										Volver
									</Button>
								</div>
							</div>
						</aside>
					</form>
				</Card>

				{/* Modal imagen */}
				<Modal isOpen={imgModal.open} onClose={() => setImgModal({ open: false, src: null, alt: '' })} ariaLabel="Imagen del servicio">
					<div className="max-w-3xl mx-auto">
						{imgModal.src ? (
							<img src={imgModal.src} alt={imgModal.alt} className="max-h-[80vh] w-auto mx-auto rounded" />
						) : (
							<div className="flex flex-col items-center justify-center text-sm text-slate-500">
								<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
								</svg>
								<div>Sin imagen</div>
							</div>
						)}
					</div>
				</Modal>
			</div>
		</div>
	);
};

export default ServiceBooking;
