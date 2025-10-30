import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Input, Select, Textarea, Button } from "./FormComponents";
import { useAuth } from "../auth/AuthProvider";

export default function ServiceForm({ initial = null, onSaved, onCancel }) {
	const [title, setTitle] = useState(initial?.title || "");
	const [description, setDescription] = useState(initial?.description || "");
	const [category, setCategory] = useState(initial?.price ?? "");
	const [price, setPrice] = useState(initial?.price ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [errors, setErrors] = useState([]);
	const [imageFile, setImageFile] = useState(null);
	const firstInput = useRef(null);
	const {user} = useAuth();

	useEffect(() => {
		// si se reusa el componente con otro initial, actualizar campos
		setTitle(initial?.title || "");
		setDescription(initial?.description || "");
		setCategory(initial?.category ?? "");
		setPrice(initial?.price ?? "");
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
		if (!price || Number.isNaN(Number(price))) return setError("Precio inválido");

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
			if (imageFile) {
				const serviceId = saved?.service?.id || initial?.id;
				if (serviceId) {
					const formData = new FormData();
					formData.append('image', imageFile);
					try {
						await api(`/services/${serviceId}/image`, { method: 'POST', body: formData });
					} catch (uploadErr) {
						console.warn('Error subiendo imagen, se guarda el servicio sin imagen:', uploadErr);
					}
				}
			}

			// onSaved puede recibir el servicio creado/actualizado
			if (onSaved) onSaved(saved.service ?? saved);
		} catch (err) {
			console.error("ServiceForm error:", err);
			setError(err.message || "Error guardando servicio");
			setErrors(err.body.errors || []);
		} finally {
			setLoading(false);
		}
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
			</div>

			<div>
				<label className="block text-sm font-medium">Categoría</label>
				<Select
					value={category}
					onChange={setCategory}
					options={[
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
				<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="mt-1 block text-sm" />
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
