import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
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
                          {/* timing label: if serviceDate is in the future -> A tiempo; else -> En proceso / Finalizado */}
                          <div className="text-xs text-slate-600">
                            {(() => {
                              try {
                                const svcDate = new Date(o.serviceDate);
                                const now = new Date();
                                if (isNaN(svcDate.getTime())) return null;
                                // Asumimos: si la fecha es mayor o igual a ahora => "A tiempo"; si es pasada, mostrar según status
                                if (svcDate.getTime() >= now.getTime()) {
                                  return <span className="text-emerald-600 font-medium">A tiempo</span>;
                                }
                                // fecha en el pasado: si el pedido está COMPLETED -> Finalizado, si no -> En proceso
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
                      <div className="mt-2">
                        {((o.serviceCategory || '').toUpperCase() === 'PASEO') ? (
                          <Link to={`/client/walk/${o.id}`} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Ver ubicación en vivo</Link>
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