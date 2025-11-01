import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import ProductForm from '../../components/ProductForm';
import { api, assetUrl } from '../../lib/api';
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

const SORT_OPTIONS = [
  { label: 'Relevancia', value: 'relevance' },
  { label: 'Precio: menor a mayor', value: 'price_asc' },
  { label: 'Precio: mayor a menor', value: 'price_desc' },
  { label: 'Rating', value: 'rating_desc' },
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
  const [sortBy, setSortBy] = useState('relevance');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  // Modal imagen ampliada
  const [imgModal, setImgModal] = useState({ open: false, src: null, alt: '' });

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
      setPage(1);
    } catch (err) {
      console.error('ProductsPage loadWithFilters error:', err);
      setError(err.message || 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value) {
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
    } catch {
      return `$ ${value}`;
    }
  }

  function RatingStars({ value = 0 }) {
    const v = Math.max(0, Math.min(5, Number(value || 0)));
    const full = Math.floor(v);
    const half = v - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <div className="flex items-center gap-0.5" aria-label={`Rating ${v}`}>
        {Array.from({ length: full }).map((_, i) => (
          <span key={`f-${i}`} className="text-amber-500">★</span>
        ))}
        {half && <span className="text-amber-500">☆</span>}
        {Array.from({ length: empty }).map((_, i) => (
          <span key={`e-${i}`} className="text-gray-300">★</span>
        ))}
        <span className="ml-1 text-xs text-gray-500">{v.toFixed(1)}</span>
      </div>
    );
  }

  const sortedProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    switch (sortBy) {
      case 'price_asc':
        return list.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'price_desc':
        return list.sort((a, b) => (b.price || 0) - (a.price || 0));
      case 'rating_desc':
        return list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      default:
        return list;
    }
  }, [products, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const visible = useMemo(() => {
    const start = (pageClamped - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, pageClamped]);

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
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-gray-500">Busca y filtra productos de proveedores.</p>
        </div>
        <div className="flex items-center gap-2">
            {auth.user && auth.user.role === 'PROVIDER' && (
              <Button onClick={openCreate}>Nuevo producto</Button>
            )}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <div className="p-4 border rounded bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Filtros</h2>
              <span className="text-sm text-gray-500 hidden md:inline">{sortedProducts.length} resultados</span>
            </div>
            <Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
            <Input label="Precio mínimo" type="number" min="0" step="0.01" value={minPrice} onChange={setMinPrice} placeholder="0" />
            <Input label="Precio máximo" type="number" min="0" step="0.01" value={maxPrice} onChange={setMaxPrice} placeholder="∞" />
            <Input label="Buscar" value={search} onChange={setSearch} placeholder="palabra clave en nombre o descripción" />
            <Input label="Provider ID (opcional)" value={providerId} onChange={setProviderId} placeholder="id del proveedor" />
            <Select label="Ordenar" value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} options={SORT_OPTIONS} />
            {filterError && <p className="text-red-600 mt-2">{filterError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => { setPage(1); loadWithFilters(); }} disabled={loading}>Aplicar filtros</Button>
              <Button onClick={() => { setCategory(''); setMinPrice(''); setMaxPrice(''); setSearch(''); setProviderId(''); setFilterError(null); setSortBy('relevance'); setPage(1); (async () => { setLoading(true); try { const res = await api('/products'); setProducts(Array.isArray(res.products) ? res.products : res.products || []); } catch (e) { setError(e.message || 'Error'); } finally { setLoading(false); } })(); }} variant="outline" disabled={loading}>Resetear</Button>
            </div>
          </div>
        </aside>

        <main className="md:col-span-3">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4 bg-white animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
                  <div className="h-40 bg-gray-100 rounded mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-red-600">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visible.map((p) => (
              <div key={p.id} className="rounded-lg border p-4 bg-white">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg line-clamp-1">{p.name}</h3>
                  <span className="ml-2 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">{p.category}</span>
                </div>
                <div
                  className="mt-2 h-36 w-full overflow-hidden rounded bg-slate-50 flex items-center justify-center relative"
                  onClick={() => { if (p.image_url) setImgModal({ open: true, src: assetUrl(p.image_url), alt: p.name }); }}
                  role={p.image_url ? 'button' : undefined}
                  aria-label={p.image_url ? 'Abrir imagen' : undefined}
                  style={{ cursor: p.image_url ? 'zoom-in' : 'default' }}
                >
                  {p.image_url ? (
                    <>
                      <img src={assetUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" />
                      <div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">
                        Haz clic para ampliar
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">Sin imagen</div>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    <div className="font-medium text-gray-700">{p.provider_name}</div>
                    <RatingStars value={p.average_rating} />
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-petzi">{formatCurrency(p.price)}</div>
                    {typeof p.stock === 'number' && (
                      <div className="text-xs text-gray-500">Stock: {p.stock}</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link to={`/products/${p.id}`} className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm">Ver</Link>
                    {auth.user && auth.user.role === 'CLIENT' && <Link to={`/products/${p.id}/buy`} className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm">Comprar</Link>}
                    {auth.user && auth.user.role === 'PROVIDER' && (
                      <>
                        <button onClick={() => openEdit(p)} className="border border-gray-200 bg-white text-gray-700 px-2 py-1 rounded hover:bg-gray-50 text-sm">Editar</button>
                        <button onClick={() => deleteProduct(p.id)} className="border border-red-200 bg-white text-red-700 px-2 py-1 rounded hover:bg-red-50 text-sm">Eliminar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sortedProducts.length === 0 && !loading && <p>No se encontraron productos</p>}
          </div>

          {sortedProducts.length > pageSize && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button variant="outline" disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <span className="text-sm text-gray-600">Página {pageClamped} de {totalPages}</span>
              <Button variant="outline" disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
            </div>
          )}
        </main>
      </div>

      {/* Modal de imagen ampliada */}
      <Modal isOpen={imgModal.open} onClose={() => setImgModal({ open: false, src: null, alt: '' })} ariaLabel="Imagen del producto">
        <div className="max-w-3xl mx-auto">
          {imgModal.src ? (
            <img src={imgModal.src} alt={imgModal.alt} className="max-h-[80vh] w-auto mx-auto rounded" />
          ) : (
            <div className="text-slate-500 text-sm">Sin imagen</div>
          )}
        </div>
      </Modal>

      <Modal isOpen={open} onClose={() => { setOpen(false); setEditing(null); }} ariaLabel="Formulario producto">
        <ProductForm initial={editing} onSaved={handleSaved} onCancel={() => { setOpen(false); setEditing(null); }} />
      </Modal>
    </div>
  );
}
