import React, { useState, useEffect, useRef } from "react";
import { api, assetUrl } from "../lib/api";
import { Input, Select, Textarea, Button } from "./FormComponents";
import { useAuth } from "../auth/AuthProvider";

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
	const firstInput = useRef(null);
	const {user} = useAuth();

	useEffect(() => {
		// si se reusa el componente con otro initial, actualizar campos
		setTitle(initial?.title || "");
		setDescription(initial?.description || "");
		setCategory(initial?.category ?? "");
		setPrice(initial?.price ?? "");
		setPreviewUrl(initial?.image_url || initial?.imageUrl || null);
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
		if (!price || Number.isNaN(Number(price))) return setError("Precio inválido");
		if (!description || description.trim().length < 100) return setError('La descripción es obligatoria y debe tener al menos 100 caracteres');

		setLoading(true);
		try {
			const payload = {
				title: title.trim(),
				description: description.trim(),
				category: category.trim(),
				price: Number(price),
				userId: user.id
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

			<div>
				<label className="block text-sm font-medium">Título</label>
				<Input type="text" ref={firstInput} value={title} onChange={setTitle} placeholder="Corte de pelo, paseo, consulta vets..." />
			</div>

			<div>
				<label className="block text-sm font-medium">Descripción</label>
				<Textarea value={description} onChange={setDescription} rows={3} placeholder="Describe el servicio" />
				<div className="mt-1 text-xs text-slate-500">Actualmente tiene {(description || '').trim().length} caracteres. Mínimo requerido: 100</div>
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
				<Input value={price} onChange={setPrice} inputMode="numeric" placeholder="0.00" />
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
