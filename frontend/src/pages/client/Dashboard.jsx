import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, assetUrl } from '../../lib/api';
import Modal from '../../components/Modal';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

const statusBadge = (status) => {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'DELIVERED' || s === 'ACCEPTED') return 'bg-emerald-100 text-emerald-700';
  if (s === 'PROCESSING' || s === 'PENDING' || s === 'IN_PROGRESS' || s === 'CREATED') return 'bg-amber-100 text-amber-700';
  if (s === 'FAILED') return 'bg-rose-100 text-rose-700';
  if (s === 'CANCELLED') return 'bg-slate-100 text-slate-400';
  return 'bg-slate-100 text-slate-700';
};

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const PetRow = ({ pet }) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-4">
      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-sm text-slate-600">
        {pet.name ? pet.name.charAt(0).toUpperCase() : 'M'}
      </div>
      <div className="flex-1">
        <div className="font-medium text-lg">{pet.name || 'Sin nombre'}</div>
        <div className="text-sm text-slate-500">{pet.species || 'Especie desconocida'}{pet.breed ? ` · ${pet.breed}` : ''}</div>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/client/pets" className="text-sm text-violet-700">Ver</Link>
      </div>
    </div>
  );
};

const ClientDashboard = () => {
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]); // listado completo
  const [products, setProducts] = useState([]); // listado completo
  const [selectedTab, setSelectedTab] = useState('services'); // 'services' | 'products' | 'pets'
  const [svcLimit, setSvcLimit] = useState(5);
  const [prodLimit, setProdLimit] = useState(5);
  const [gpsModal, setGpsModal] = useState({ open: false, orderId: null, points: [] });
  const [providerModal, setProviderModal] = useState({ open: false, data: null });
  const [petModal, setPetModal] = useState({ open: false, data: null });
  const [notesModal, setNotesModal] = useState({ open: false, data: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          api('/users/pets'),
          api('/orders/me')
        ]);
        if (!mounted) return;
        // pets
        if (results[0].status === 'fulfilled') {
          const petsRes = results[0].value;
          const petList = Array.isArray(petsRes) ? petsRes : (petsRes && Array.isArray(petsRes.pets) ? petsRes.pets : []);
          setPets(petList);
        } else {
          const err = results[0].reason;
          console.warn('No se pudieron cargar mascotas:', err);
        }
        // orders (services + products)
        if (results[1].status === 'fulfilled') {
          const ordersRes = results[1].value;
          const orders = Array.isArray(ordersRes) ? ordersRes : (ordersRes || []);
          const svc = orders.filter(o => (o.itemType === 'SERVICE' || o.itemType === 'service'));
          const prods = orders.filter(o => (o.itemType === 'PRODUCT' || o.itemType === 'product'));
          setServices(svc);
          setProducts(prods);
        } else {
          const err = results[1].reason;
          console.warn('No se pudieron cargar órdenes:', err);
          // Mensaje más amable si es auth
          if (err && (err.status === 401 || err.status === 403)) {
            setError('No autorizado. Inicia sesión nuevamente.');
          } else {
            setError(err?.message || 'No se pudieron cargar tus órdenes');
          }
        }
      } catch (err) {
        console.error('Dashboard load error', err);
        if (!mounted) return;
        setError(err.message || 'Error cargando datos');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Helper: abrir modal de proveedor y hacer fetch del perfil público si tenemos providerId
  const openProviderModal = async (o) => {
    const providerId = o?.providerId || o?.provider_id || o?.providerId || (o?.provider && (o.provider.id || o.provider.user_id));
    if (!providerId) {
      // no tenemos id, mostrar lo que venga en el orden
      setProviderModal({ open: true, data: o });
      return;
    }
    try {
      const res = await api(`/providers/${providerId}`);
      // API devuelve { provider: {...} }
      const provider = res?.provider || res;
      setProviderModal({ open: true, data: provider });
    } catch (err) {
      // fallback a los datos del pedido si falla
      console.warn('No se pudo cargar perfil del proveedor, mostrando datos del pedido', err);
      setProviderModal({ open: true, data: o });
    }
  };

  // Helper: abrir modal de mascota buscando en el estado local `pets` o consultando la API si es necesario
  const openPetModal = async (o) => {
    const petId = o?.petId || o?.pet_id || o?.petId;
    if (petId) {
      const found = pets.find(p => String(p.id) === String(petId));
      if (found) {
        setPetModal({ open: true, data: found });
        return;
      }
      try {
        const res = await api('/users/pets');
        const list = Array.isArray(res) ? res : (res?.pets || []);
        const f2 = list.find(p => String(p.id) === String(petId));
        if (f2) {
          setPetModal({ open: true, data: f2 });
          return;
        }
      } catch (err) {
        console.warn('No se pudo cargar mascotas al abrir modal', err);
      }
    }
    // fallback: mostrar lo que venga en el orden
    setPetModal({ open: true, data: o });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mi panel</h1>
            <p className="text-sm text-gray-600">Resumen rápido de tus reservas y mascotas</p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-medium">Atajos</h4>
              <div className="mt-2 flex flex-col text-xs">
                <Link to="/products" className="text-violet-700">Ver productos</Link>
                <Link to="/services" className="text-violet-700">Ver servicios</Link>
                <Link to="/client/pets" className="text-violet-700">Mis mascotas</Link>
              </div>
            </div>
          </div>
        </header>

        {loading && <div className="mb-4">Cargando...</div>}
        {error && <div className="mb-4 text-rose-600">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {/* Tabs para reducir scroll */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={() => setSelectedTab('services')} className={`px-3 py-1.5 rounded-full text-sm ${selectedTab==='services' ? 'bg-violet-600 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                Servicios <span className="ml-1 text-xs opacity-90">({services.length})</span>
              </button>
              <button onClick={() => setSelectedTab('products')} className={`px-3 py-1.5 rounded-full text-sm ${selectedTab==='products' ? 'bg-violet-600 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                Productos <span className="ml-1 text-xs opacity-90">({products.length})</span>
              </button>
              <button onClick={() => setSelectedTab('pets')} className={`px-3 py-1.5 rounded-full text-sm ${selectedTab==='pets' ? 'bg-violet-600 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                Mascotas <span className="ml-1 text-xs opacity-90">({pets.length})</span>
              </button>
            </div>

            {/* Panel contenido con altura controlada para evitar scroll infinito */}
            {selectedTab === 'services' && (
              <section className="mb-6">
                <h2 className="sr-only">Próximas reservas / Servicios</h2>
                <div className="space-y-2.5 max-h-[420px] overflow-auto pr-1">
                  {services.length === 0 && !loading && (
                    <div className="bg-white rounded-lg p-3 text-sm text-slate-600">No tienes reservas activas</div>
                  )}
                  {services.slice(0, svcLimit).map(o => {
                    const isCancelled = (o.status || '').toUpperCase() === 'CANCELLED';
                    return (
                      <div key={o.id} className={`bg-white rounded-lg p-3 ${isCancelled ? 'opacity-60 bg-slate-50' : 'shadow-sm'} flex items-start justify-between`}>
                        <div>
                          <div className="text-xs text-slate-500">{o.providerName || o.providerDescription || ''}</div>
                          <div className="text-base font-semibold">{o.serviceTitle || 'Servicio'}</div>
                          <div className="text-xs text-slate-600">Solicitado: {o.requestedAt ? formatDate(o.requestedAt) : '—'}</div>
                          {o.serviceDate && (
                            <div className="mt-2 flex items-center gap-3">
                              <div className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">{formatDate(o.serviceDate)}</div>
                              <div className="text-xs text-slate-600">
                                {(() => {
                                  try {
                                    const svcDate = new Date(o.serviceDate);
                                    const now = new Date();
                                    if (isNaN(svcDate.getTime())) return null;
                                    if (svcDate.getTime() >= now.getTime()) {
                                      return <span className="text-emerald-600 font-medium">A tiempo</span>;
                                    }
                                    if ((o.status || '').toUpperCase() === 'COMPLETED') {
                                      return <span className="text-slate-600">Finalizado</span>;
                                    }
                                    return <span className="text-amber-600">En proceso</span>;
                                  } catch (err) {
                                    return null;
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                          {o.petName && (
                            <div className="text-xs text-slate-600">Mascota: {o.petName}</div>
                          )}
                          {o.totalAmount != null && (
                            <div className="text-xs text-slate-600">Total: ${Number(o.totalAmount).toFixed(2)}</div>
                          )}

                          <div className="mt-2 flex items-center gap-2">
                            {((o.serviceCategory || '').toUpperCase() === 'PASEO') ? (
                              <Link to={`/client/walk/${o.id}`} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Ver ubicación</Link>
                            ) : (
                              <button
                                className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                onClick={async () => {
                                  try {
                                    const data = await api(`/orders/${o.id}/gps`);
                                    const pts = Array.isArray(data?.points) ? data.points : [];
                                    setGpsModal({ open: true, orderId: o.id, points: pts });
                                  } catch (err) {
                                    alert(err?.message || 'No se pudo cargar la ubicación');
                                  }
                                }}
                              >Ver ubicación</button>
                            )}
                            {(o.providerName || o.providerId || o.provider) && (
                              <button onClick={() => openProviderModal(o)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Proveedor</button>
                            )}
                            {(o.petName || o.pet || o.pet_id) && (
                              <button onClick={() => openPetModal(o)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Mascota</button>
                            )}
                            {(o.notes || o.order_notes) && (
                              <button onClick={() => setNotesModal({ open: true, data: o })} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Ver notas</button>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`inline-block px-3 py-0.5 rounded-full text-xs ${statusBadge(o.status)}`}>
                            {(o.itemType === 'SERVICE' || o.item_type === 'SERVICE') && ['PENDING'].includes((o.status||'').toUpperCase())
                              ? 'Pendiente de aprobación'
                              : o.status}
                          </div>
                          <div className="text-xs text-slate-400 mt-2">Actualizado: {o.updatedAt ? formatDate(o.updatedAt) : '—'}</div>
                          {(o.paymentStatus) && (
                            (o.paymentStatus || '').toUpperCase() === 'COMPLETED'
                              ? <div className="text-xs text-slate-500 mt-1">Pago: Confirmado</div>
                              : <div className="text-xs text-slate-500 mt-1">Pago: {o.paymentStatus}</div>
                          )}
                          {/* Mensaje para servicios en curso y pagados: pago recibido, pendiente de finalización por el proveedor */}
                          {((o.itemType || o.item_type) === 'SERVICE') && (o.status || '').toUpperCase() === 'IN_PROGRESS' && (o.paymentStatus || '').toUpperCase() === 'COMPLETED' && (
                            <div className="mt-2 text-sm rounded border border-emerald-100 bg-emerald-50 text-emerald-700 p-2">
                              Pago recibido — Reserva confirmada ✨¡Te esperamos!✨.
                            </div>
                          )}
                          {/* Botón de pagar solo para servicios aceptados y pago pendiente */}
                          {((o.itemType || o.item_type) === 'SERVICE') && (o.status || '').toUpperCase() === 'ACCEPTED' && (o.paymentStatus || '').toUpperCase() === 'PENDING' && (
                            <div className="mt-2">
                              <button
                                className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700"
                                onClick={async () => {
                                  try {
                                    const title = o.serviceTitle || `Servicio #${o.id}`;
                                    const quantity = o.quantity || 1;
                                    const unit_price = Number(o.servicePrice || o.totalAmount || 0) / quantity || 0;
                                    // Guardar resumen para recibo local
                                    try { localStorage.setItem('currentOrderId', String(o.id)); } catch {}
                                    try { localStorage.setItem(`mp_order_summary_${o.id}`, JSON.stringify({ title, quantity, unit_price, total: unit_price * quantity })); } catch {}
                                    const pref = await api('/payments/create-preference', { method: 'POST', body: { title, quantity, unit_price, external_reference: o.id } });
                                    const redirectUrl = pref?.init_point || pref?.sandbox_init_point;
                                    if (redirectUrl) {
                                      try {
                                        const popup = window.open(redirectUrl, 'mp_checkout', 'width=900,height=700');
                                        window.__mpPopupRef = popup;
                                        window.__mpCurrentOrderId = String(o.id);
                                        localStorage.setItem(`mp_init_point_${o.id}`, redirectUrl);
                                        const deadline = Date.now() + 1 * 60 * 1000;
                                        localStorage.setItem(`mp_wait_deadline_${o.id}`, String(deadline));
                                      } catch {}
                                      window.location.assign(`/payments/wait?external_reference=${encodeURIComponent(o.id)}`);
                                    } else {
                                      alert('No se pudo iniciar el pago. Intenta más tarde.');
                                    }
                                  } catch (err) {
                                    alert(err?.message || 'Error al iniciar pago');
                                  }
                                }}
                              >Pagar ahora</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {services.length > svcLimit && (
                  <div className="mt-3 flex justify-center">
                    <button className="text-sm text-violet-700 hover:underline" onClick={() => setSvcLimit(l => l + 5)}>Ver más</button>
                  </div>
                )}
                {services.length > 0 && svcLimit > 5 && (
                  <div className="mt-1 flex justify-center">
                    <button className="text-xs text-slate-500 hover:underline" onClick={() => setSvcLimit(5)}>Ver menos</button>
                  </div>
                )}
              </section>
            )}

            {selectedTab === 'products' && (
              <section className="mb-6">
                <h2 className="sr-only">Compras recientes / Productos</h2>
                <div className="space-y-2.5 max-h-[420px] overflow-auto pr-1">
                  {products.length === 0 && !loading && (
                    <div className="bg-white rounded-lg p-3 text-sm text-slate-600">No tienes compras recientes</div>
                  )}
                  {products.slice(0, prodLimit).map(o => {
                  const isCancelled = (o.status || '').toUpperCase() === 'CANCELLED';
                  return (
                    <div key={o.id} className={`bg-white rounded-lg p-3 ${isCancelled ? 'opacity-60 bg-slate-50' : 'shadow-sm'} flex items-start justify-between`}>
                      <div>
                        <div className="text-xs text-slate-500">{o.providerName || o.providerCompany || ''}</div>
                        <div className="text-base font-semibold">{o.productName || 'Producto'}</div>
                          {(o.notes || o.order_notes) && (
                            <div className="text-xs text-slate-500 mt-1 max-w-prose truncate">{((o.notes || o.order_notes) || '').toString().substring(0,120)}{((o.notes || o.order_notes) || '').toString().length>120?'…':''}</div>
                          )}
                        <div className="text-xs text-slate-600">Cantidad: {o.quantity ?? 1}</div>
                        <div className="text-xs text-slate-600">Solicitado: {o.requestedAt ? formatDate(o.requestedAt) : '—'}</div>
                        {o.address && (
                          <div className="mt-2">
                            <div className="inline-block bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-xs font-medium">Dirección de entrega</div>
                            <div className="text-xs text-slate-600 mt-1">{o.address}</div>
                          </div>
                        )}
                        {o.totalAmount != null && (
                          <div className="text-xs text-slate-600">Total: ${Number(o.totalAmount).toFixed(2)}</div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          {(o.providerName || o.providerId || o.provider) && (
                            <button onClick={() => openProviderModal(o)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Proveedor</button>
                          )}
                          {(o.petName || o.pet || o.pet_id) && (
                            <button onClick={() => openPetModal(o)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Mascota</button>
                          )}
                          {(o.notes || o.order_notes) && (
                            <button onClick={() => setNotesModal({ open: true, data: o })} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Ver notas</button>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-block px-3 py-0.5 rounded-full text-xs ${statusBadge(o.status)}`}>
                          {(o.itemType === 'PRODUCT' || o.item_type === 'PRODUCT') && ['CREATED','PENDING','ACCEPTED','IN_PROGRESS'].includes((o.status||'').toUpperCase()) && (o.paymentStatus||'').toUpperCase() === 'COMPLETED'
                            ? 'Pendiente de despacho'
                            : o.status}
                        </div>
                        <div className="text-xs text-slate-400 mt-2">Actualizado: {o.updatedAt ? formatDate(o.updatedAt) : '—'}</div>
                        {(o.paymentStatus) && (
                          (o.paymentStatus || '').toUpperCase() === 'COMPLETED'
                            ? <div className="text-xs text-slate-500 mt-1">Pago: Confirmado</div>
                            : <div className="text-xs text-slate-500 mt-1">Pago: {o.paymentStatus}</div>
                        )}
                        <div className="mt-2 flex flex-col items-end gap-2">
                          {(o.providerName || o.providerId || o.provider) && (
                            <button onClick={() => openProviderModal(o)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Proveedor</button>
                          )}
                          {(o.petName || o.pet || o.pet_id) && (
                            <button onClick={() => openPetModal(o)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Mascota</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
                {products.length > prodLimit && (
                  <div className="mt-3 flex justify-center">
                    <button className="text-sm text-violet-700 hover:underline" onClick={() => setProdLimit(l => l + 5)}>Ver más</button>
                  </div>
                )}
                {products.length > 0 && prodLimit > 5 && (
                  <div className="mt-1 flex justify-center">
                    <button className="text-xs text-slate-500 hover:underline" onClick={() => setProdLimit(5)}>Ver menos</button>
                  </div>
                )}
              </section>
            )}

            {selectedTab === 'pets' && (
              <section className="mb-6">
                <h2 className="sr-only">Mis mascotas</h2>
                {pets.length === 0 && !loading ? (
                  <div className="bg-white rounded-lg p-4 text-sm text-slate-600">No tienes mascotas registradas</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pets.map((p) => (
                      <PetRowSmall pet={p} key={p.id} />
                    ))}
                  </div>
                )}
                <div className="mt-3 text-right">
                  <Link to="/client/pets" className="text-sm text-violet-700 hover:underline">Gestionar mascotas</Link>
                </div>
              </section>
            )}
          </div>

          <aside>
            <section className="mb-6">
              <h3 className="text-base font-semibold mb-3">Mis mascotas</h3>
              <div className="space-y-3">
                {pets.length === 0 && !loading && <div className="bg-white rounded-lg p-3 text-sm text-slate-600">No tienes mascotas registradas</div>}
                {pets.map(p => (
                  <PetRowSmall pet={p} key={p.id} />
                ))}
              </div>
              <div className="mt-3 text-right">
                <Link to="/client/pets" className="text-xs text-violet-700 hover:underline">Ver todas</Link>
              </div>
            </section>
          </aside>
        </div>
        {/* Modal de ubicación para servicios */}
        <Modal isOpen={gpsModal.open} onClose={() => setGpsModal({ open: false, orderId: null, points: [] })} ariaLabel="Ubicación del servicio">
          <h3 className="text-base font-semibold mb-2">Ubicación del servicio</h3>
          {gpsModal.points.length > 0 ? (
            <div className="rounded overflow-hidden" style={{ height: 320 }}>
              <MapContainer center={[gpsModal.points[0].latitude, gpsModal.points[0].longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[gpsModal.points[0].latitude, gpsModal.points[0].longitude]} />
              </MapContainer>
              <div className="mt-2 text-xs text-slate-600">Última actualización: {formatDate(gpsModal.points[0].at)}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">No hay ubicaciones registradas aún para este servicio.</div>
          )}
        </Modal>
        {/* Provider modal */}
        <Modal isOpen={providerModal.open} onClose={() => setProviderModal({ open: false, data: null })} ariaLabel="Proveedor">
          {(() => {
            const src = providerModal.data || {};
            const p = src.provider || src || {};
            const name = p.name || src.providerName || src.provider_name || 'Proveedor';
            const desc = p.business_description || p.description || src.providerDescription || src.provider_description || '';
            const email = p.email || src.provider_email || src.email;
            const phone = p.phone || src.provider_phone || src.phone;
            const avatar = p.avatar || p.photo_url || src.provider_avatar || src.providerAvatar;
            // prefer city or a textual address; never show raw coordinates in the modal
            const address = p.address || src.address || p.location || src.provider_location || src.providerLocation || null;
            const certifications = p.certifications || [];
            const reviews = p.reviews || [];
            const servicesList = p.services || src.services || [];
            const servicesCount = servicesList.length || src.services_count || src.services_total_active || src.services_total_any || p.services_total_active || p.services_total_any || 0;
            const city = p.city || p.location_city || p.city_name || (servicesList && servicesList[0] && servicesList[0].city) || src.provider_city || null;
            const avgRating = p.average_rating || p.avg_rating || (p.total_reviews ? p.average_rating : null) || src.average_rating || null;
            return (
              <div className="max-w-md mx-auto p-4">
                <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {avatar ? (
                      <img src={assetUrl(avatar)} alt={name} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-xl font-semibold">{(name || 'P')[0]}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate">{name}</h3>
                    {desc && <div className="text-sm text-gray-600 mt-1">{desc}</div>}
                    <div className="text-sm text-gray-600 mt-2 space-y-1">
                        {email ? (
                          <div><span className="font-semibold">Email:</span> <a className="font-semibold text-violet-700 underline" href={`mailto:${email}`}>{email}</a></div>
                        ) : (
                          <div className="text-xs text-slate-500">Email no disponible públicamente.</div>
                        )}
                        {phone ? (
                          <div><span className="font-semibold">Teléfono:</span> <span className="font-semibold">{phone}</span></div>
                        ) : (
                          <div className="text-xs text-slate-500">Teléfono no registrado públicamente.</div>
                        )}
                        {city ? (
                          <div><span className="font-semibold">Ciudad:</span> <span className="font-semibold">{city}</span></div>
                        ) : address ? (
                          <div><span className="font-semibold">Dirección:</span> <span className="font-semibold">{address}</span></div>
                        ) : (
                          <div>
                            <div><span className="font-semibold">Ubicación:</span> <span className="font-semibold">No registrada</span></div>
                            <div className="text-xs text-slate-500">Este proveedor no registró ciudad ni dirección pública. Contactalo para coordinar la ubicación del servicio.</div>
                          </div>
                        )}
                      <div><span className="font-semibold">Servicios:</span> <span className="font-semibold">{servicesCount}</span></div>
                      {servicesList && servicesList.length > 0 && (
                        <div className="pt-1">
                          <div className="text-xs text-slate-500">Servicios (ejemplos):</div>
                          <ul className="text-xs list-disc ml-4 mt-1 text-slate-600">
                            {servicesList.slice(0,3).map(s => (
                              <li key={s.id || s.title}><span className="font-semibold">{s.title || s.name || s}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {certifications.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-500">Certificaciones ({certifications.length}):</div>
                          <ul className="text-xs list-disc ml-4 mt-1 text-slate-600">
                            {certifications.map(c => (
                              <li key={c.id || c.document_name}>
                                <span className="font-semibold">{c.document_name}</span> {c.file_url && (<a className="text-violet-700 underline ml-1" href={assetUrl(c.file_url)} target="_blank" rel="noreferrer">ver</a>)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reviews.length > 0 && (
                        <div>
                          <div className="text-xs text-slate-500">Reseñas ({reviews.length}) — promedio: {avgRating ? Number(avgRating).toFixed(1) : '—'}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {reviews.slice(0,2).map((r, idx) => (
                              <div key={idx} className="mt-1">
                                <div className="font-semibold">{r.client_name || r.clientName || 'Usuario'}</div>
                                <div className="text-xs text-slate-500"><span className="font-semibold">{r.rating} ★</span> — {r.comment ? `${r.comment.substring(0,80)}${r.comment.length>80?'…':''}` : 'Sin comentario'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setProviderModal({ open: false, data: null })} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* Pet modal */}
        <Modal isOpen={petModal.open} onClose={() => setPetModal({ open: false, data: null })} ariaLabel="Mascota">
          {(() => {
            const src = petModal.data || {};
            const p = src.pet || src || {};
            const name = p.name || src.petName || src.pet_name || 'Mascota';
            const species = p.species || src.pet_species;
            const breed = p.breed || src.pet_breed;
            const birth = p.birth_date || p.birthDate || src.birth_date || src.pet_birth_date;
            const special = p.special_needs || p.specialNeeds || src.special_needs;
            const ownerName = p.owner_name || p.ownerName || src.ownerName || src.buyerName || src.buyer_name || null;
            const ownerEmail = p.owner_email || p.ownerEmail || src.ownerEmail || src.buyerEmail || null;
            const img = p.photo_url || p.image_url || p.avatar || src.pet_image_url;
            const computeAge = (d) => {
              if (!d) return null;
              const bd = new Date(d);
              if (isNaN(bd.getTime())) return null;
              const diff = Date.now() - bd.getTime();
              const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
              return years > 0 ? `${years} año${years>1?'s':''}` : null;
            };
            const ageStr = computeAge(birth) || (p.age || src.pet_age || null);
            return (
              <div className="max-w-md mx-auto p-4">
                <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {img ? (
                      <img src={assetUrl(img)} alt={name} className="w-28 h-28 rounded-lg object-cover" />
                    ) : (
                      <div className="w-28 h-28 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate">{name}</h3>
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      {species && <div><span className="font-semibold">Especie:</span> <span className="font-semibold">{species}</span></div>}
                      {breed && <div><span className="font-semibold">Raza:</span> <span className="font-semibold">{breed}</span></div>}
                      {birth && <div><span className="font-semibold">Fecha de nacimiento:</span> <span className="font-semibold">{new Date(birth).toLocaleDateString()}</span></div>}
                      {ageStr && <div><span className="font-semibold">Edad aproximada:</span> <span className="font-semibold">{ageStr}</span></div>}
                      {special && <div><span className="font-semibold">Necesidades:</span> <span className="font-semibold">{special}</span></div>}
                      {(ownerName || ownerEmail) && (
                        <div>
                          <div className="text-xs text-slate-500">Dueño:</div>
                          <div className="text-sm text-slate-700"><span className="font-semibold">{ownerName || '-'}</span></div>
                          {ownerEmail && <div className="text-xs text-slate-500">Email: <a className="font-semibold text-violet-700 underline" href={`mailto:${ownerEmail}`}>{ownerEmail}</a></div>}
                        </div>
                      )}
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
        {/* Notes modal */}
        <Modal isOpen={notesModal.open} onClose={() => setNotesModal({ open: false, data: null })} ariaLabel="Notas de la orden">
          {(() => {
            const o = notesModal.data;
            if (!o) return null;
            const notes = o.notes || o.order_notes || o.orderNotes || null;
            return (
              <div className="max-w-md mx-auto p-4">
                <h3 className="text-lg font-semibold mb-2">Notas de la orden {o.id ? `#${o.id}` : ''}</h3>
                {notes ? (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</div>
                ) : (
                  <div className="text-sm text-slate-500">No hay notas para esta orden.</div>
                )}
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setNotesModal({ open: false, data: null })} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>
    </div>
  );
};

// versión compacta de PetRow para el sidebar
const PetRowSmall = ({ pet }) => {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-xs text-slate-600">
        {pet.name ? pet.name.charAt(0).toUpperCase() : 'M'}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{pet.name || 'Sin nombre'}</div>
        <div className="text-xs text-slate-500">{pet.species || 'Especie desconocida'}{pet.breed ? ` · ${pet.breed}` : ''}</div>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/client/pets" className="text-xs text-violet-700">Ver</Link>
      </div>
    </div>
  );
};

export default ClientDashboard;