import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api, assetUrl } from '../lib/api';
import { Input, Select, Textarea, Button } from './FormComponents';

// --- Constants ---
const CATEGORY_OPTIONS = [
  { label: 'Todas', value: '' },
  { label: 'Alimentos', value: 'ALIMENTOS' },
  { label: 'Accesorios', value: 'ACCESORIOS' },
  { label: 'Medicamentos', value: 'MEDICAMENTOS' },
  { label: 'Higiene', value: 'HIGIENE' },
  { label: 'Otro', value: 'OTRO' },
];

// --- Product Form ---
export default function ProductForm({ initial = null, onSaved, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [invima, setInvima] = useState(initial?.invima_registration || '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initial?.image_url || initial?.imageUrl || null);
  const firstInput = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setCategory(initial?.category || '');
    setPrice(initial?.price ?? '');
    setStock(initial?.stock ?? 0);
    setInvima(initial?.invima_registration || '');
    setActive(initial?.active ?? true);
  setPreviewUrl(initial?.image_url || initial?.imageUrl || null);
    setImageFile(null);
  }, [initial]);

  useEffect(() => { if (firstInput.current) firstInput.current.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('El nombre es obligatorio');
    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) return setError('Precio inválido: debe ser mayor a 0');
    if (!category) return setError('Seleccione una categoría');
  if (!description || description.trim().length < 100) return setError('La descripción es obligatoria y debe tener al menos 100 caracteres');
    if (Number(stock) <= 0) return setError('Stock inválido: debe ser mayor a 0');

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category,
      price: Number(price),
      stock: Number(stock) || 0,
      invima_registration: invima || null,
      active: active ? 1 : 0,
      provider_id: user?.id
    };

    setLoading(true);
    try {
      let saved;
      if (initial && initial.id) {
        saved = await api(`/products/${initial.id}`, { method: 'PUT', body: payload });
      } else {
        saved = await api('/products', { method: 'POST', body: payload });
      }

      // Subir imagen si corresponde
      let product = saved.product ?? saved;
      if ((initial?.id || product?.id) && imageFile) {
        const productId = initial?.id || product?.id;
        const formData = new FormData();
        formData.append('image', imageFile);
        try {
          const up = await api(`/products/${productId}/image`, { method: 'POST', body: formData });
          product = { ...(product || {}), image_url: up?.imageUrl || product?.image_url };
          if (up?.imageUrl) setPreviewUrl(up.imageUrl);
        } catch (uploadErr) {
          console.warn('Error subiendo imagen del producto:', uploadErr);
        }
      }

      // backend may return { product } or the created object directly
      product = product?.product ?? product;
      if (onSaved) onSaved(product);
    } catch (err) {
      console.error('ProductForm error:', err);
      setError(err.message || 'Error guardando producto');
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
      <h2 className="text-xl font-semibold">{initial?.id ? 'Editar producto' : 'Nuevo producto'}</h2>

      <Input label="Nombre" value={name} onChange={setName} placeholder="Nombre del producto" />

      <div>
        {/* Mostrar error/estilo rojo si la descripción es demasiado corta */}
        <Textarea label="Descripción" value={description} onChange={setDescription} rows={3} placeholder="Describe el producto" error={(description || '').trim().length > 0 && (description || '').trim().length < 100 ? 'La descripción debe tener al menos 100 caracteres' : undefined} />
        <div className={`mt-1 text-xs ${((description || '').trim().length > 0 && (description || '').trim().length < 100) ? 'text-rose-600' : 'text-slate-500'}`}>Actualmente tiene {(description || '').trim().length} caracteres. Mínimo requerido: 100</div>
      </div>

      <Select
        label="Categoría"
        value={category}
        onChange={setCategory}
        options={[{ label: '-- Seleccione --', value: '' }, ...CATEGORY_OPTIONS.filter(c => c.value !== '').map(c => ({ label: c.label, value: c.value }))]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Precio" value={price} onChange={setPrice} inputMode="numeric" placeholder="0.00" min="0.01" step="0.01" />
          <Input label="Stock" value={stock} onChange={setStock} type="number" min="1" />
      </div>

      <Input label="Registro INVIMA (opcional)" value={invima} onChange={setInvima} placeholder="Opcional" />

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
            id="product-image-input"
          />
          <label htmlFor="product-image-input" className="text-sm text-slate-600">
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

      {/* Mostrar errores de formulario justo antes de los botones */}
      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Guardando...' : initial?.id ? 'Actualizar' : 'Crear'}</Button>
      </div>
    </form>
  );
}
