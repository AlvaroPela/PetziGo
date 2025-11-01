import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

const fmtMoney = (n) => {
  const num = Number(n || 0);
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(num); } catch {
    return `$${num.toFixed(2)}`;
  }
};

const ProviderDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [myServices, setMyServices] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('SERVICIOS'); // 'SERVICIOS' | 'PRODUCTOS'
  const [serviceQuery, setServiceQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled([
          api('/orders/me'),
          api('/services/provider/mine'),
          api('/products/mine'),
          api('/providers/certifications')
        ]);
        if (!mounted) return;
        if (results[0].status === 'fulfilled') setOrders(Array.isArray(results[0].value) ? results[0].value : (results[0].value || []));
        if (results[1].status === 'fulfilled') setMyServices(results[1].value?.services || []);
        if (results[2].status === 'fulfilled') setMyProducts(results[2].value || []);
        if (results[3].status === 'fulfilled') setCerts(results[3].value?.certifications || []);
        // handle errors softly
        const errs = results.filter(r => r.status === 'rejected');
        if (errs.length) console.warn('ProviderDashboard partial errors:', errs.map(e => e.reason?.message || e.reason));
      } catch (err) {
        console.error('provider dashboard load error', err);
        if (!mounted) return;
        setError(err?.message || 'Error cargando datos');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // Servicios activos/disponibles
  const isActive = (v) => {
    if (v === 1 || v === true) return true;
    if (typeof v === 'string') {
      const t = v.trim().toLowerCase();
      if (t === '1' || t === 'true') return true;
    }
    // coerción numérica segura
    return Number(v) === 1;
  };
  const activeServicesCount = useMemo(() => myServices.filter(s => isActive(s.active)).length, [myServices]);
  const activeProductsCount = useMemo(() => myProducts.filter(p => isActive(p.active)).length, [myProducts]);

  // Pendientes según reglas solicitadas (separados por tipo)
  const servicePending = useMemo(() => {
    const up = (s) => (s||'').toUpperCase();
    // Mostrar sólo PENDING (solicitudes por aprobar), nunca CREATED
    return orders.filter(o => up(o.itemType) === 'SERVICE' && up(o.status) === 'PENDING');
  }, [orders]);
  const productPending = useMemo(() => {
    const up = (s) => (s||'').toUpperCase();
    return orders.filter(o => up(o.itemType) === 'PRODUCT' && up(o.status) !== 'DELIVERED' && up(o.status) !== 'CANCELLED');
  }, [orders]);
  const serviceActive = useMemo(() => {
    const up = (s) => (s||'').toUpperCase();
    return orders.filter(o => up(o.itemType) === 'SERVICE' && ['ACCEPTED','IN_PROGRESS'].includes(up(o.status)));
  }, [orders]);
  const serviceCompleted = useMemo(() => {
    const up = (s) => (s||'').toUpperCase();
    return orders.filter(o => up(o.itemType) === 'SERVICE' && up(o.status) === 'COMPLETED');
  }, [orders]);
  const monthlyRevenue = useMemo(() => {
    const up = (s) => (s||'').toUpperCase();
    return orders
      .filter(o => {
        const isServiceCompleted = up(o.itemType) === 'SERVICE' && up(o.status) === 'COMPLETED';
        const isProductDelivered = up(o.itemType) === 'PRODUCT' && up(o.status) === 'DELIVERED';
        // Solo contar si además el pago está completado (evita contabilizar entregas sin pago)
        const paid = up(o.paymentStatus) === 'COMPLETED';
        return paid && (isServiceCompleted || isProductDelivered);
      })
      .filter(o => {
        const dateRef = (up(o.itemType) === 'PRODUCT' ? (o.deliveredAt || o.updatedAt) : o.updatedAt) || o.requestedAt || o.createdAt;
        const d = new Date(dateRef);
        return !isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  }, [orders, month, year]);

  const certCounts = useMemo(() => {
    const acc = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    certs.forEach(c => { const s = (c.status||'').toUpperCase(); if (acc[s] != null) acc[s]++; });
    return acc;
  }, [certs]);
  
  // Filtros locales de búsqueda
  const matchesServiceQuery = (o) => {
    if (!serviceQuery) return true;
    const q = serviceQuery.toLowerCase();
    return (
      (o.buyerName || '').toLowerCase().includes(q) ||
      (o.serviceTitle || '').toLowerCase().includes(q) ||
      (o.status || '').toLowerCase().includes(q)
    );
  };
  const matchesProductQuery = (o) => {
    if (!productQuery) return true;
    const q = productQuery.toLowerCase();
    return (
      (o.buyerName || '').toLowerCase().includes(q) ||
      (o.productName || '').toLowerCase().includes(q) ||
      (o.status || '').toLowerCase().includes(q)
    );
  };

  const patchOrderStatus = async (id, status) => {
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o));
    } catch (err) {
      alert(err?.message || 'No se pudo actualizar el estado');
    }
  };

  // Se elimina envío de GPS manual desde este panel

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel del Proveedor</h1>
            <p className="text-sm text-gray-600">Gestión de reservas, ventas y certificaciones</p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-xs font-medium">Acciones</h4>
              <div className="mt-2 flex flex-col text-xs">
                <Link to="/services" className="text-violet-700">Ver servicios</Link>
                <Link to="/products" className="text-violet-700">Ver productos</Link>
                <Link to="/provider/profile" className="text-violet-700">Editar perfil</Link>
              </div>
            </div>
          </div>
        </header>

        {loading && <div className="mb-4">Cargando…</div>}
        {error && <div className="mb-4 text-rose-600">{error}</div>}

        {/* KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-500">Por aprobar (servicios)</div>
            <div className="text-2xl font-bold text-slate-800">{servicePending.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-500">En curso (servicios)</div>
            <div className="text-2xl font-bold text-slate-800">{serviceActive.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-500">Entregas pendientes (productos)</div>
            <div className="text-2xl font-bold text-slate-800">{productPending.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-xs text-slate-500">Ingresos del mes</div>
            <div className="text-2xl font-bold text-emerald-700">{fmtMoney(monthlyRevenue)}</div>
          </div>
        </div>

        {/* Tabs Servicios / Productos */}
        <div className="mb-4 flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded text-sm border ${activeTab==='SERVICIOS' ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('SERVICIOS')}
          >Servicios</button>
          <button
            className={`px-3 py-1.5 rounded text-sm border ${activeTab==='PRODUCTOS' ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('PRODUCTOS')}
          >Productos</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna principal */}
          <section className="lg:col-span-2">
            {activeTab === 'SERVICIOS' ? (
              <>
                {/* Buscador */}
                <div className="mb-3">
                  <input
                    type="text"
                    className="w-full md:w-1/2 px-3 py-2 rounded border border-slate-300 text-sm"
                    placeholder="Buscar por cliente, servicio o estado..."
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                  />
                </div>

                {/* Por aprobar */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
                  <div className="px-3 py-2 bg-slate-50 text-sm font-medium">Por aprobar</div>
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Cliente</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Servicio</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Fecha</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Estado</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {servicePending.filter(matchesServiceQuery).slice(0, 10).map(o => (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-sm text-slate-700">{o.buyerName || 'Cliente'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.serviceTitle || 'Servicio'}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{(o.serviceDate ? new Date(o.serviceDate).toLocaleString() : (o.requestedAt ? new Date(o.requestedAt).toLocaleString() : '—'))}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-600">{(o.status||'').toUpperCase()}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => patchOrderStatus(o.id, 'ACCEPTED')} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Aceptar</button>
                              <button onClick={() => patchOrderStatus(o.id, 'CANCELLED')} className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100">Rechazar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {servicePending.filter(matchesServiceQuery).length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No hay servicios pendientes</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* En curso y completados */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-sm font-medium">En curso y completados</div>
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Cliente</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Servicio</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Fecha</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Estado</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...serviceActive, ...serviceCompleted].filter(matchesServiceQuery).slice(0, 10).map(o => (
                        <tr key={o.id}>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.buyerName || 'Cliente'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.serviceTitle || 'Servicio'}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{(o.serviceDate ? new Date(o.serviceDate).toLocaleString() : (o.requestedAt ? new Date(o.requestedAt).toLocaleString() : '—'))}</td>
                          <td className="px-3 py-2 text-[11px] text-emerald-700">{(o.status||'').toUpperCase()}</td>
                          <td className="px-3 py-2 text-right">
                            {((o.status||'').toUpperCase() === 'COMPLETED') && (
                              <span className="inline-block text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700">Completado</span>
                            )}
                            {((o.status||'').toUpperCase() === 'ACCEPTED') && ((o.paymentStatus||'').toUpperCase() !== 'COMPLETED') && (
                              <span className="inline-block text-xs px-2 py-1 rounded bg-amber-50 text-amber-700">Pendiente de pago</span>
                            )}
                            {((o.status||'').toUpperCase() === 'IN_PROGRESS') && (
                              <button onClick={() => patchOrderStatus(o.id, 'COMPLETED')} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Finalizar servicio</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {[...serviceActive, ...serviceCompleted].filter(matchesServiceQuery).length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No hay servicios en curso</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {/* Buscador */}
                <div className="mb-3">
                  <input
                    type="text"
                    className="w-full md:w-1/2 px-3 py-2 rounded border border-slate-300 text-sm"
                    placeholder="Buscar por cliente, producto o estado..."
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                  />
                </div>

                {/* Pendientes de entrega */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
                  <div className="px-3 py-2 bg-slate-50 text-sm font-medium">Pendientes de entrega</div>
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Cliente</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Producto</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Solicitado</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Estado</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productPending.filter(matchesProductQuery).slice(0, 10).map(o => (
                        <tr key={o.id}>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.buyerName || 'Cliente'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.productName || 'Producto'}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{o.requestedAt ? new Date(o.requestedAt).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-600">{(o.status||'').toUpperCase()}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => patchOrderStatus(o.id, 'DELIVERED')} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Marcar entregado</button>
                          </td>
                        </tr>
                      ))}
                      {productPending.filter(matchesProductQuery).length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No hay productos pendientes</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Entregados recientes */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-sm font-medium">Entregados recientes</div>
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Cliente</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Producto</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Entregado</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.filter(o => (o.itemType === 'PRODUCT' || (o.itemType||'').toUpperCase() === 'PRODUCT') && (o.status||'').toUpperCase() === 'DELIVERED').filter(matchesProductQuery).slice(0, 10).map(o => (
                        <tr key={o.id}>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.buyerName || 'Cliente'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{o.productName || 'Producto'}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{(o.deliveredAt || o.updatedAt) ? new Date(o.deliveredAt || o.updatedAt).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2 text-sm text-right text-slate-700">{fmtMoney(o.totalAmount)}</td>
                        </tr>
                      ))}
                      {orders.filter(o => (o.itemType === 'PRODUCT' || (o.itemType||'').toUpperCase() === 'PRODUCT') && (o.status||'').toUpperCase() === 'DELIVERED').filter(matchesProductQuery).length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">No tienes entregas registradas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* Sidebar */}
          <aside>
            <h3 className="text-lg font-semibold mb-3">Certificaciones</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Aprobadas</span>
                <span className="text-emerald-700 font-semibold">{certCounts.APPROVED}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Pendientes</span>
                <span className="text-amber-700 font-semibold">{certCounts.PENDING}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Rechazadas</span>
                <span className="text-rose-700 font-semibold">{certCounts.REJECTED}</span>
              </div>
              <div className="mt-3 text-xs">
                <Link to="/provider/profile" className="text-violet-700">Gestionar certificaciones</Link>
              </div>
            </div>

            <div className="mt-4 bg-white rounded-lg p-3 shadow-sm">
              <h4 className="text-sm font-medium mb-2">Mis activos</h4>
              <div className="text-xs text-slate-600">Servicios activos: <span className="font-semibold text-slate-800">{activeServicesCount}</span></div>
              <div className="text-xs text-slate-600">Productos activos: <span className="font-semibold text-slate-800">{activeProductsCount}</span></div>
              <div className="mt-2 flex gap-2">
                <Link to="/services" className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Ver servicios</Link>
                <Link to="/products" className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">Ver productos</Link>
              </div>
            </div>
          </aside>
        </div>

        
      </div>
    </div>
  );
};

export default ProviderDashboard;