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
  const [petModal, setPetModal] = useState({ open: false, data: null });
  const [clientModal, setClientModal] = useState({ open: false, data: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Si el usuario autenticado es PROVIDER, indicamos al backend que es petición del owner
        // usando el parámetro idp=<providerId> (owner-fastpath)
        let path = '/services';
        if (auth && auth.user && auth.user.role === 'PROVIDER' && auth.user.id) {
          const id = encodeURIComponent(String(auth.user.id));
          path = `/services?idp=${id}`;
        }
        const res = await api(path);
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
  }, [auth.user]);

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
                  {s.image_url ? <img src={assetUrl(s.image_url)} alt="" className="h-full w-full object-cover" /> : (
                    <div className="flex flex-col items-center justify-center text-xs text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                      </svg>
                      <div>Sin imagen</div>
                    </div>
                  )}
                  {s.image_url && <div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">Haz clic para ampliar</div>}
                </div>

                <p className="text-sm line-clamp-2">{s.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-lg font-semibold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(s.price || 0))}</div>
                  <div className="flex gap-2 items-center">
                    <Link to={`/services/${s.id}`} className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm">Ver</Link>
                    {(s.pet || s.pet_id || s.pet_name) && (
                      <button className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm" onClick={() => setPetModal({ open: true, data: s })}>Mascota</button>
                    )}
                    {(s.client || s.client_id || s.client_name) && (
                      <button className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm" onClick={() => setClientModal({ open: true, data: s })}>Cliente</button>
                    )}
                    <button className="px-3 py-1 rounded-md bg-violet-500 text-white shadow-sm hover:bg-violet-600 transition text-sm" onClick={() => handleQuickReserve(s)}>Reservar ahora</button>
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

      {/* Pet modal */}
      <Modal isOpen={petModal.open} onClose={() => setPetModal({ open: false, data: null })} ariaLabel="Mascota asociada">
        {(() => {
          const s = petModal.data;
          if (!s) return null;
          const pet = s.pet || {};
          const name = pet.name || s.pet_name || 'Mascota';
          const species = pet.species || s.pet_species;
          const breed = pet.breed || s.pet_breed;
          const age = pet.age || s.pet_age;
          const weight = pet.weight || s.pet_weight;
          const image = pet.image_url || s.pet_image_url;
          return (
            <div className="max-w-md mx-auto p-4">
              <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-4">
                <div className="flex-shrink-0">
                  {image ? (
                    <img src={assetUrl(image)} alt={name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-xl font-semibold">{(name || 'M')[0]}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{name}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    {species && <div>Especie: {species}</div>}
                    {breed && <div>Raza: {breed}</div>}
                    {age != null && <div>Edad: {age}</div>}
                    {weight != null && <div>Peso: {weight} kg</div>}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setPetModal({ open: false, data: null })} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Client modal */}
      <Modal isOpen={clientModal.open} onClose={() => setClientModal({ open: false, data: null })} ariaLabel="Cliente">
        {(() => {
          const s = clientModal.data;
          if (!s) return null;
          const c = s.client || {};
          const name = c.name || s.client_name || 'Cliente';
          const email = c.email || s.client_email;
          const phone = c.phone || s.client_phone;
          const avatar = c.avatar || s.client_avatar;
          return (
            <div className="max-w-md mx-auto p-4">
              <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-4">
                <div className="flex-shrink-0">
                  {avatar ? (
                    <img src={assetUrl(avatar)} alt={name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-xl font-semibold">{(name || 'C')[0]}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{name}</h3>
                  <div className="text-sm text-gray-600 mt-1 space-y-1">
                    {email && <div>Email: <a className="text-violet-700 underline" href={`mailto:${email}`}>{email}</a></div>}
                    {phone && <div>Teléfono: {phone}</div>}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setClientModal({ open: false, data: null })} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={open} onClose={() => { setOpen(false); setEditing(null); }} ariaLabel="Formulario servicio">
        <ServiceForm
          initial={editing}
          onSaved={(saved) => {
            setServices((prev) => {
              if (!saved) return prev;
              const idStr = saved.id != null ? String(saved.id) : null;
              if (!idStr) return prev;
              const idx = prev.findIndex((s) => String(s.id) === idStr);
              if (idx >= 0) {
                // Merge para no perder campos no devueltos por el backend (image_url, provider_id, etc.)
                const existing = prev[idx] || {};
                const merged = { ...existing, ...saved };
                const next = prev.slice();
                next[idx] = merged;
                return next;
              }
              // Nuevo servicio: inyectar campos base para que se mantengan botones y datos visuales
              const baseOwner = auth?.user?.id ? {
                provider_id: auth.user.id,
                providerId: auth.user.id,
                provider_name: auth.user.name,
              } : {};
              const newItem = { image_url: null, ...baseOwner, ...saved };
              return [newItem, ...prev];
            });
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
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
