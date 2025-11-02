import React, { useState, useEffect, useRef } from "react";
import { api, assetUrl } from "../lib/api";
import { Input, Select, Textarea, Button } from "./FormComponents";
import { useAuth } from "../auth/AuthProvider";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapClickHandler({ setLocation, setCity, setGeoLoading }) {
	useMapEvents({
		async click(e) {
			const { lat, lng } = e.latlng || {};
			if (lat && lng) {
				setLocation({ lat, lng });
				if (setGeoLoading) setGeoLoading(true);
				try {
					const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`;
					const resp = await fetch(url);
					if (resp.ok) {
						const data = await resp.json();
						const addr = data.address || {};
						const found = addr.city || addr.town || addr.village || addr.county || addr.state || '';
						if (found && setCity) setCity(found);
					} else {
						console.warn('Nominatim returned non-ok', resp.status);
					}
				} catch (err) {
					console.warn('Reverse geocode error:', err);
				} finally {
					if (setGeoLoading) setGeoLoading(false);
				}
			}
		}
	});
	return null;
}

export default function ServiceForm({ initial = null, onSaved, onCancel }) {
	const [title, setTitle] = useState(initial?.title || "");
	const [description, setDescription] = useState(initial?.description || "");
	// Fix: categoría no se seteaba cuando no se movía el select
	const [category, setCategory] = useState(initial?.category ?? "");
	const [price, setPrice] = useState(initial?.price ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [errors, setErrors] = useState([]);
	const [imageFile, setImageFile] = useState(null);
	const [previewUrl, setPreviewUrl] = useState(initial?.image_url || initial?.imageUrl || null);
	const [location, setLocation] = useState({ lat: initial?.location_lat || null, lng: initial?.location_lng || null });
	const [city, setCity] = useState(initial?.city || '');
	const [geoLoading, setGeoLoading] = useState(false);
	const firstInput = useRef(null);
	const {user} = useAuth();

	useEffect(() => {
		// si se reusa el componente con otro initial, actualizar campos
		setTitle(initial?.title || "");
		setDescription(initial?.description || "");
		setCategory(initial?.category ?? "");
		setPrice(initial?.price ?? "");
		setPreviewUrl(initial?.image_url || initial?.imageUrl || null);
		setLocation({ lat: initial?.location_lat || null, lng: initial?.location_lng || null });
		setCity(initial?.city || '');
		setImageFile(null);
	}, [initial]);

	useEffect(() => {
		// focus al abrir
		if (firstInput.current) firstInput.current.focus();
	}, []);

	async function handleSubmit(e) {
		e.preventDefault();
		setError(null);

		// validaciones simples
		if (!title.trim()) return setError("El título es obligatorio");
		if (!category) return setError("Seleccione una categoría");
		if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) return setError("Precio inválido: debe ser mayor a 0");
		if (!description || description.trim().length < 100) return setError('La descripción es obligatoria y debe tener al menos 100 caracteres');

		// Validar ubicación: obligatoria al crear servicio
		if (!location || location.lat == null || location.lng == null) return setError('La ubicación del servicio es obligatoria. Selecciona un punto en el mapa.');

		setLoading(true);
		try {
			const payload = {
				title: title.trim(),
				description: description.trim(),
				category: category.trim(),
				price: Number(price),
				userId: user.id,
				location_lat: Number(location.lat),
				location_lng: Number(location.lng),
				city: city || null
			};

			let saved;
			if (initial && initial.id) {
				// editar
				saved = await api(`/services/${initial.id}`, { method: "PUT", body: payload });
			} else {
				// crear
				saved = await api("/services", { method: "POST", body: payload });
			}

			// Si hay imagen, subirla en segundo paso
			let serviceObj = saved?.service ?? saved;
			if (imageFile) {
				const serviceId = saved?.service?.id || initial?.id;
				if (serviceId) {
					const formData = new FormData();
					formData.append('image', imageFile);
					try {
						const up = await api(`/services/${serviceId}/image`, { method: 'POST', body: formData });
						// actualizar preview y objeto guardado con el path del backend
						if (up?.imageUrl) {
							setPreviewUrl(up.imageUrl);
							serviceObj = { ...(serviceObj || {}), image_url: up.imageUrl };
						}
					} catch (uploadErr) {
						console.warn('Error subiendo imagen, se guarda el servicio sin imagen:', uploadErr);
					}
				}
			}

			// onSaved recibe el servicio creado/actualizado (incluida image_url si aplicó)
			if (onSaved) onSaved(serviceObj);
		} catch (err) {
			console.error("ServiceForm error:", err);
			setError(err.message || "Error guardando servicio");
			setErrors(err.body.errors || []);
		} finally {
			setLoading(false);
		}
	}

	function onFileChange(file) {
		if (!file) {
			setImageFile(null);
			setPreviewUrl(initial?.image_url || null);
			return;
		}
		const valid = /image\/(jpeg|jpg|png|webp)/.test(file.type);
		if (!valid) {
			setError('Formato no soportado. Usa JPG, PNG o WEBP.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			setError('La imagen debe ser menor a 5MB.');
			return;
		}
		setError(null);
		setImageFile(file);
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<h2 className="text-xl font-semibold">{initial?.id ? "Editar servicio" : "Nuevo servicio"}</h2>



			<div>
				<label className="block text-sm font-medium">Título</label>
				<Input type="text" ref={firstInput} value={title} onChange={setTitle} placeholder="Corte de pelo, paseo, consulta vets..." />
			</div>

				<div>
					<label className="block text-sm font-medium">Ubicación del servicio</label>
					<div className="mt-2 text-sm text-slate-600">Selecciona en el mapa la ubicación exacta donde prestas este servicio. Obligatorio.</div>
					<div className="mt-3 rounded border overflow-hidden" style={{ height: 260 }}>
						{ /* Mapa interactivo */ }
						<MapContainer center={location.lat && location.lng ? [Number(location.lat), Number(location.lng)] : [6.2442, -75.5812]} zoom={13} style={{ height: '100%', width: '100%' }}>
							<TileLayer
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
							/>
							{location.lat && location.lng && (
								<Marker position={[Number(location.lat), Number(location.lng)]} />
							)}
							{
								// componente para capturar clicks y colocar marcador (también intenta obtener la ciudad)
							}
							<MapClickHandler setLocation={setLocation} setCity={setCity} setGeoLoading={setGeoLoading} />
						</MapContainer>
					</div>
					<div className="mt-2 flex items-center gap-3">
						<div className="text-xs text-slate-600">Coordenadas:</div>
						<div className="text-sm font-mono">{location.lat ? Number(location.lat).toFixed(6) : '—'} , {location.lng ? Number(location.lng).toFixed(6) : '—'}</div>
					</div>
					<div className="mt-2">
						<label className="block text-sm font-medium">Ciudad (opcional)</label>
											<div className="relative">
												<Input
													value={city}
													onChange={setCity}
													placeholder="Ciudad"
													className={geoLoading ? 'pr-10 border-violet-200/70 ring-1 ring-violet-50' : ''}
												/>
												{geoLoading && (
													<div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
														<svg className="h-4 w-4 text-violet-600 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
															<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
															<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
														</svg>
													</div>
												)}
											</div>

					</div>
				</div>

			<div>
				<label className="block text-sm font-medium">Descripción</label>
				{/* Mostrar error/estilo rojo si la descripción es demasiado corta */}
				<Textarea value={description} onChange={setDescription} rows={3} placeholder="Describe el servicio" error={(description || '').trim().length > 0 && (description || '').trim().length < 100 ? 'La descripción debe tener al menos 100 caracteres' : undefined} />
				<div className={`mt-1 text-xs ${((description || '').trim().length > 0 && (description || '').trim().length < 100) ? 'text-rose-600' : 'text-slate-500'}`}>Actualmente tiene {(description || '').trim().length} caracteres. Mínimo requerido: 100</div>
			</div>

			<div>
				<label className="block text-sm font-medium">Categoría</label>
				<Select
					value={category}
					onChange={setCategory}
					options={[
						{ label: "-- Seleccione --", value: "" },
						{ label: "Paseo", value: "PASEO" },
						{ label: "Veterinaria", value: "VETERINARIA" },
						{ label: "Entrenamiento", value: "ENTRENAMIENTO" },
						{ label: "Estética", value: "ESTETICA" },
						{ label: "Guardería", value: "GUARDERIA" },
						{ label: "Otro", value: "OTRO" },
					]}
				/>
			</div>

			<div>
				<label className="block text-sm font-medium">Precio</label>
				<Input value={price} onChange={setPrice} inputMode="numeric" placeholder="0.00" min="0.01" step="0.01" />
			</div>

			<div>
				<label className="block text-sm font-medium">Imagen (opcional)</label>
				<div
					className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-slate-50 p-4 text-center"
					onDragOver={(e) => e.preventDefault()}
					onDrop={(e) => {
						e.preventDefault();
						const f = e.dataTransfer.files?.[0];
						onFileChange(f);
					}}
				>
					<input
						type="file"
						accept="image/*"
						onChange={(e) => onFileChange(e.target.files?.[0] || null)}
						className="hidden"
						id="service-image-input"
					/>
					<label htmlFor="service-image-input" className="text-sm text-slate-600">
						Haz clic o arrastra una imagen aquí
					</label>
					{previewUrl && (
						<div className="mt-3 w-full">
							<img src={assetUrl(previewUrl)} alt="Previsualización" className="mx-auto h-40 w-auto rounded object-cover" />
							<div className="mt-2 flex items-center justify-center gap-3 text-xs text-slate-600">
								{imageFile && <span>{imageFile.name} · {((imageFile.size || 0) / 1024 / 1024).toFixed(1)} MB</span>}
								<button type="button" className="underline" onClick={() => { setImageFile(null); setPreviewUrl(initial?.image_url || initial?.imageUrl || null); }}>Quitar imagen</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Mostrar errores de validación justo antes de los botones (requerimiento UX) */}
			{error && <div className="text-sm text-red-600">{error}</div>}
			{errors.length > 0 && (
				<div className="text-sm text-red-600">
					<ul className="list-disc list-inside">
						{errors.map((err, idx) => (
							<li key={idx}>{err.msg}</li>
						))}
					</ul>
				</div>
			)}

			<div className="flex items-center justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button type="submit" variant="primary" disabled={loading}>
					{loading ? "Guardando..." : initial?.id ? "Actualizar" : "Crear"}
				</Button>
			</div>
		</form>
	);
}
