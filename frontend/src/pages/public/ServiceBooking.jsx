import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button, Input, Textarea, Select, Card } from "../../components/FormComponents";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";

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
	const [petsLoading, setPetsLoading] = useState(false);
	const { user, loading: authLoading } = useAuth();
	const location = useLocation();



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

			const body = {
				itemType: "SERVICE",
				itemId: Number(id),
				quantity: Number(quantity) || 1,
				notes: notes || undefined,
				service_date: parsed.toISOString(),
				petId: petId ? Number(petId) : undefined,
			};

				const res = await api("/orders", { method: "POST", body });

			// Respuesta esperada: { id: <orderId>, status: 'PENDING' }
			if (res?.id) {
				// Crear preferencia de MercadoPago para redirigir al checkout
					try {
						const prefBody = {
							title: service.title || `Reserva #${res.id}`,
							quantity: Number(quantity) || 1,
							unit_price: Number(service.price) || 0,
							external_reference: res.id
						};
						const pref = await api("/payments/create-preference", { method: "POST", body: prefBody });
						// pref debe traer init_point (o sandbox_init_point)
						const redirectUrl = pref?.init_point || pref?.sandbox_init_point;
						if (redirectUrl) {
							// Redirigir al checkout de MercadoPago
							window.location.href = redirectUrl;
							return;
						}
						// Si no hay redirectUrl, mostrar error y quedarse en la página
						setError('No se pudo iniciar el pago con MercadoPago. Por favor intenta de nuevo más tarde.');
						return;
					} catch (pErr) {
						// No redirigir; mostrar mensaje amigable al usuario
						const message = pErr?.message || 'Error al crear la preferencia de pago';
						setError(`No se pudo iniciar el pago: ${message}`);
						return;
					}
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
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="md:col-span-1">
							<div className="space-y-3">
								<div className="text-sm text-slate-600">Precio</div>
								<div className="text-2xl font-semibold">${Number(service.price).toFixed(2)}</div>
								{service.location_lat && service.location_lng && <div className="text-sm text-slate-500">Ubicación registrada</div>}
								<div className="pt-4">
									<div className="text-sm text-slate-500">Detalles</div>
									<p className="text-sm text-slate-700">{service.short_description || service.description?.slice(0, 200)}</p>
								</div>
							</div>
						</div>

						<div className="md:col-span-2">
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<Input label="Cantidad" type="number" value={quantity} onChange={setQuantity} className="w-full" />
									<Input label="Fecha" type="date" value={serviceDay} onChange={setServiceDay} className="w-full" />
									<Input label="Hora" type="time" value={serviceTime} onChange={setServiceTime} className="w-full" step="300" />
								</div>

								<div>
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
								</div>

								<Textarea label="Notas (opcional)" value={notes} onChange={setNotes} rows={4} />

								{error && <div className="text-rose-600">{error}</div>}

								<div className="flex gap-2">
									<Button type="submit" variant="primary" disabled={submitting}>
										{submitting ? "Reservando…" : "Confirmar reserva"}
									</Button>
									<Button type="button" variant="outline" onClick={() => navigate(-1)}>
										Volver
									</Button>
								</div>
							</form>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default ServiceBooking;
