import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
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
      {error && <div className="text-sm text-rose-600">{error}</div>}

      <Input label="Nombre" value={name} onChange={setName} placeholder="Nombre del producto" />

      <Textarea label="Descripción" value={description} onChange={setDescription} rows={3} placeholder="Describe el producto" />

      <Select
        label="Categoría"
        value={category}
        onChange={setCategory}
        options={[{ label: '-- Seleccione --', value: '' }, ...CATEGORY_OPTIONS.filter(c => c.value !== '').map(c => ({ label: c.label, value: c.value }))]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Precio" value={price} onChange={setPrice} inputMode="numeric" placeholder="0.00" />
        <Input label="Stock" value={stock} onChange={setStock} type="number" min="0" />
      </div>

      <Input label="Registro INVIMA (opcional)" value={invima} onChange={setInvima} placeholder="Opcional" />

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Guardando...' : initial?.id ? 'Actualizar' : 'Crear'}</Button>
      </div>
    </form>
  );
}
