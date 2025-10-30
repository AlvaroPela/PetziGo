import React, { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import ProductForm from '../../components/ProductForm';
import { api } from '../../lib/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Input, Select, Button } from '../../components/FormComponents';
import { useAuth } from '../../auth/AuthProvider';
// --- Constants ---
const CATEGORY_OPTIONS = [
  { label: 'Todas', value: '' },
  { label: 'Alimentos', value: 'ALIMENTOS' },
  { label: 'Accesorios', value: 'ACCESORIOS' },
  { label: 'Medicamentos', value: 'MEDICAMENTOS' },
  { label: 'Higiene', value: 'HIGIENE' },
  { label: 'Otro', value: 'OTRO' },
];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // filters
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [search, setSearch] = useState('');
  const [providerId, setProviderId] = useState('');
  const [filterError, setFilterError] = useState(null);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const res = await api('/products');
        if (!mounted) return;
        setProducts(Array.isArray(res.products) ? res.products : res.products || []);
      } catch (err) {
        console.error('ProductsPage load error:', err);
        setError(err.message || 'Error cargando productos');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, []);

  async function loadWithFilters() {
    setFilterError(null);
    const min = minPrice === '' ? null : parseFloat(minPrice);
    const max = maxPrice === '' ? null : parseFloat(maxPrice);
    if (min !== null && Number.isNaN(min)) return setFilterError('Precio mínimo inválido');
    if (max !== null && Number.isNaN(max)) return setFilterError('Precio máximo inválido');
    if (min !== null && max !== null && min > max) return setFilterError('El precio mínimo no puede ser mayor que el máximo');

    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (min !== null) params.append('min_price', String(min));
    if (max !== null) params.append('max_price', String(max));
    if (search) params.append('search', search);
    if (providerId) params.append('provider_id', providerId);

    const path = params.toString() ? `/products?${params.toString()}` : '/products';

    setLoading(true);
    setError(null);
    try {
      const res = await api(path);
      setProducts(Array.isArray(res.products) ? res.products : res.products || []);
    } catch (err) {
      console.error('ProductsPage loadWithFilters error:', err);
      setError(err.message || 'Error cargando productos');
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
      window.alert('Solo proveedores pueden crear productos.');
      return;
    }
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p) {
    if (!auth.user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (auth.user.role !== 'PROVIDER') {
      window.alert('No tienes permisos para editar productos.');
      return;
    }
    setEditing(p);
    setOpen(true);
  }

  function handleSaved(savedProduct) {
    setProducts((prev) => {
      const exists = prev.find((x) => String(x.id) === String(savedProduct.id));
      if (exists) return prev.map((x) => (String(x.id) === String(savedProduct.id) ? savedProduct : x));
      return [savedProduct, ...prev];
    });
    setOpen(false);
    setEditing(null);
  }

  async function deleteProduct(productId) {
    const ok = window.confirm('¿Eliminar este producto? Esta acción eliminará el producto.');
    if (!ok) return;
    try {
      await api(`/products/${productId}`, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(productId)));
      loadWithFilters();
    } catch (err) {
      console.error('deleteProduct error:', err);
      alert(err.message || 'No se pudo eliminar el producto');
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-2">
            {auth.user && auth.user.role === 'PROVIDER' && (
              <Button onClick={openCreate}>Nuevo producto</Button>
            )}
        </div>
      </div>

      <div className="mb-4 p-4 border rounded-2xl bg-white">
        <h2 className="font-semibold mb-2">Filtros</h2>
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

          <div>
            <Input label="Buscar" value={search} onChange={setSearch} placeholder="palabra clave en nombre o descripción" />
          </div>

          <div>
            <Input label="Provider ID (opcional)" value={providerId} onChange={setProviderId} placeholder="id del proveedor" />
          </div>
        </div>

        {filterError && <p className="text-red-600 mt-2">{filterError}</p>}

        <div className="mt-3 flex items-center gap-2">
          <Button onClick={loadWithFilters} disabled={loading}>Aplicar filtros</Button>
          <Button onClick={() => { setCategory(''); setMinPrice(''); setMaxPrice(''); setSearch(''); setProviderId(''); setFilterError(null); (async () => { setLoading(true); try { const res = await api('/products'); setProducts(Array.isArray(res.products) ? res.products : res.products || []); } catch (e) { setError(e.message || 'Error'); } finally { setLoading(false); } })(); }} variant="outline" disabled={loading}>Resetear</Button>
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="rounded-lg border p-4 bg-white">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm text-gray-600">{p.description}</p>
            <p className="text-sm text-gray-500">Categoria: {p.category}</p>
            <span className="text-sm font-medium text-petzi">$ {p.price}</span>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link to={`/products/${p.id}`} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50 text-sm">Ver</Link>
                <Link to={`/products/${p.id}/buy`} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50 text-sm">Comprar</Link>
                {auth.user && auth.user.role === 'PROVIDER' && (
                  <>
                    <Button onClick={() => openEdit(p)} className="!px-3 !py-1.5 !text-sm" variant="soft">Editar</Button>
                    <Button onClick={() => deleteProduct(p.id)} className="!px-3 !py-1.5 !text-sm" variant="danger">Eliminar</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && !loading && <p>No se encontraron productos</p>}
      </div>

      <Modal isOpen={open} onClose={() => { setOpen(false); setEditing(null); }} ariaLabel="Formulario producto">
        <ProductForm initial={editing} onSaved={handleSaved} onCancel={() => { setOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
