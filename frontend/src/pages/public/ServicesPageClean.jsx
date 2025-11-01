import React, { useEffect, useMemo, useState } from 'react';
import { api, assetUrl } from '../../lib/api';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Modal from '../../components/Modal';
import ServiceForm from '../../components/ServiceForm';
import { Input, Select, Button } from '../../components/FormComponents';
import { useAuth } from '../../auth/AuthProvider';

const CATEGORY_OPTIONS = [
  { label: 'Todas', value: '' },
  { label: 'Paseo', value: 'PASEO' },
  { label: 'Veterinaria', value: 'VETERINARIA' },
  { label: 'Entrenamiento', value: 'ENTRENAMIENTO' },
  { label: 'Estética', value: 'ESTETICA' },
  { label: 'Guardería', value: 'GUARDERIA' },
  { label: 'Otro', value: 'OTRO' },
];

const SORT_OPTIONS = [
  { label: 'Relevancia', value: 'relevance' },
  { label: 'Precio: menor a mayor', value: 'price_asc' },
  { label: 'Precio: mayor a menor', value: 'price_desc' },
  { label: 'Rating', value: 'rating_desc' },
];

export default function ServicesPageClean() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('relevance');

  const [imgModal, setImgModal] = useState({ open: false, src: null });
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalMsg, setRoleModalMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api('/services');
        if (!mounted) return;
        setServices(Array.isArray(res.services) ? res.services : res.services || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Error cargando servicios');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleQuickReserve = (s) => {
    if (!auth.user) return navigate('/login', { state: { from: location.pathname } });
    if (auth.user.role === 'PROVIDER') { setRoleModalMsg('Los proveedores no pueden reservar. Crea una cuenta Cliente.'); setShowRoleModal(true); return; }
    navigate(`/services/${s.id}/book`);
  };

  function canManage(s) {
    if (!auth.user) return false;
    if (auth.user.role !== 'PROVIDER') return false;
    // owner check (provider_id field from API)
    return String(auth.user.id) === String(s.provider_id) || String(auth.user.id) === String(s.providerId);
  }

  async function deleteService(serviceId) {
    const ok = window.confirm('¿Eliminar este servicio? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      await api(`/services/${serviceId}`, { method: 'DELETE' });
      setServices((prev) => prev.filter((x) => String(x.id) !== String(serviceId)));
    } catch (err) {
      console.error('deleteService error:', err);
      alert(err.message || 'No se pudo eliminar el servicio');
    }
  }

  const filtered = useMemo(() => {
    let list = Array.isArray(services) ? services.slice() : [];
    if (category) list = list.filter((s) => s.category === category);
    if (minPrice) list = list.filter((s) => Number(s.price || 0) >= Number(minPrice));
    if (maxPrice) list = list.filter((s) => Number(s.price || 0) <= Number(maxPrice));
    if (search) list = list.filter((s) => (s.title + ' ' + (s.description || '')).toLowerCase().includes(search.toLowerCase()));
    if (sortBy === 'price_asc') list.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sortBy === 'price_desc') list.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortBy === 'rating_desc') list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
    return list;
  }, [services, category, minPrice, maxPrice, search, sortBy]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="text-sm text-gray-500">Explora servicios y reserva fácilmente.</p>
        </div>
        <div className="flex items-center gap-2">
          {(auth.user && auth.user.role === 'PROVIDER') && <Button onClick={() => setOpen(true)}>Nuevo servicio</Button>}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <div className="p-4 border rounded bg-white space-y-3">
            <Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
            <Input label="Precio mínimo" type="number" value={minPrice} onChange={setMinPrice} />
            <Input label="Precio máximo" type="number" value={maxPrice} onChange={setMaxPrice} />
            <Input label="Buscar" value={search} onChange={setSearch} />
            <Select label="Ordenar" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
            <div className="flex gap-2">
              <Button onClick={() => { /* apply handled by memo */ }}>Aplicar</Button>
              <Button variant="outline" onClick={() => { setCategory(''); setMinPrice(''); setMaxPrice(''); setSearch(''); setSortBy('relevance'); }}>Resetear</Button>
            </div>
          </div>
        </aside>

        <main className="md:col-span-3">
          {loading && <p>Cargando servicios...</p>}
          {error && <p className="text-red-600">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <div key={s.id} className="p-4 border rounded bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="text-sm text-gray-500">{s.category}</p>
                  </div>
                  {canManage(s) && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditing(s); setOpen(true); }} className="border border-gray-200 bg-white text-gray-700 px-2 py-1 rounded hover:bg-gray-50 text-sm">Editar</button>
                      <button onClick={() => deleteService(s.id)} className="border border-red-200 bg-white text-red-700 px-2 py-1 rounded hover:bg-red-50 text-sm">Eliminar</button>
                    </div>
                  )}
                </div>

                <div className="h-40 my-2 bg-slate-50 flex items-center justify-center relative" onClick={() => s.image_url && setImgModal({ open: true, src: assetUrl(s.image_url) })} role={s.image_url ? 'button' : undefined} aria-label={s.image_url ? 'Abrir imagen' : undefined} style={{ cursor: s.image_url ? 'zoom-in' : 'default' }}>
                  {s.image_url ? <img src={assetUrl(s.image_url)} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-gray-400">Sin imagen</span>}
                  {s.image_url && <div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">Haz clic para ampliar</div>}
                </div>

                <p className="text-sm line-clamp-2">{s.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-lg font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(s.price || 0))}</div>
                  <div className="flex gap-2">
                    <Link to={`/services/${s.id}`} className="text-violet-700">Ver</Link>
                    <button className="border border-gray-200 bg-white text-gray-700 px-3 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => handleQuickReserve(s)}>Reservar ahora</button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && !loading && <p>No hay servicios.</p>}
          </div>
        </main>
      </div>

      <Modal isOpen={imgModal.open} onClose={() => setImgModal({ open: false, src: null })} ariaLabel="Imagen">
        {imgModal.src && <img src={imgModal.src} alt="" className="max-h-[80vh] mx-auto" />}
      </Modal>

      <Modal isOpen={open} onClose={() => { setOpen(false); setEditing(null); }} ariaLabel="Formulario servicio">
        <ServiceForm initial={editing} onSaved={(saved) => { setServices((p) => [saved, ...p]); setOpen(false); }} onCancel={() => setOpen(false)} />
      </Modal>

      <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} ariaLabel="Acción no permitida">
        <div className="p-4 text-center">
          <p className="mb-3">{roleModalMsg}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => navigate('/register')}>Crear cuenta de cliente</Button>
            <Button variant="outline" onClick={() => setShowRoleModal(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
