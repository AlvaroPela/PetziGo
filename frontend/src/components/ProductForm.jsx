import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

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
  }, [initial]);

  useEffect(() => { if (firstInput.current) firstInput.current.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('El nombre es obligatorio');
    if (!price || Number.isNaN(Number(price))) return setError('Precio inválido');
    if (!category) return setError('Seleccione una categoría');

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

      // backend may return { product } or the created object directly
      const product = saved.product ?? saved;
      if (onSaved) onSaved(product);
    } catch (err) {
      console.error('ProductForm error:', err);
      setError(err.message || 'Error guardando producto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{initial?.id ? 'Editar producto' : 'Nuevo producto'}</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div>
        <label className="block text-sm font-medium">Nombre</label>
        <input ref={firstInput} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" rows={3} />
      </div>

      <div>
        <label className="block text-sm font-medium">Categoría</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
          <option value="">-- Seleccione --</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Precio</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="mt-1 block w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Stock</label>
          <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" min="0" className="mt-1 block w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Registro INVIMA (opcional)</label>
        <input value={invima} onChange={(e) => setInvima(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded border">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-petzi text-white disabled:opacity-60">{loading ? 'Guardando...' : initial?.id ? 'Actualizar' : 'Crear'}</button>
      </div>
    </form>
  );
}
