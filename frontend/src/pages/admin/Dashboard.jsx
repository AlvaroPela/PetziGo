import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const StatCard = ({ title, value, color = 'text-gray-700' }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState({ users: 0, providersPending: 0, servicesActive: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingProviders, setPendingProviders] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [usersRes, providersListRes, servicesRes] = await Promise.all([
          api('/users/admin/list').catch(() => ({ users: [] })),
          api('/providers/admin/list').catch(() => ({ providers: [] })),
          api('/services').catch(() => ({ services: [] })),
        ]);

        if (!mounted) return;
        const users = usersRes?.users || [];
        const providersAll = providersListRes?.providers || [];
        const services = servicesRes?.services || [];

        // Pending providers should include not-verified providers regardless of user.status
        const providers = providersAll.filter(p => !p.verified);
        setPendingProviders(providers);
        setStats({
          users: users.length,
          providersPending: providers.length,
          servicesActive: services.length,
          reviews: 0,
        });
      } catch (e) {
        setError(e?.message || 'Error cargando datos');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const onVerify = async (providerId, verified) => {
    try {
      await api(`/providers/admin/verify/${providerId}`, { method: 'PATCH', body: { verified } });
      setPendingProviders(prev => prev.filter(p => p.user_id !== providerId));
      setStats(s => ({ ...s, providersPending: Math.max(0, s.providersPending - 1) }));
    } catch (e) {
      alert(e?.message || 'Error al actualizar verificación');
    }
  };

  const providerRows = useMemo(() => (
    pendingProviders.map((p) => (
      <tr key={p.user_id}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">{p.name}</div>
          <div className="text-sm text-gray-500">{p.email}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm">{p.pending_certifications || 0} pendientes</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {/* Placeholder: created_at no está en el select del endpoint */}
          —
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
          <button onClick={() => onVerify(p.user_id, true)} className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">Verificar</button>
          <button onClick={() => onVerify(p.user_id, false)} className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700">Rechazar</button>
        </td>
      </tr>
    ))
  ), [pendingProviders]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Panel de Administración</h1>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-3">
            <a href="/admin/users" className="px-3 py-1 rounded bg-violet-600 text-white hover:bg-violet-700">Ir a Gestión de Usuarios</a>
          </div>
        </header>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Usuarios Totales" value={loading ? '…' : stats.users} color="text-blue-600" />
          <StatCard title="Proveedores Pendientes" value={loading ? '…' : stats.providersPending} color="text-yellow-600" />
          <StatCard title="Servicios Activos" value={loading ? '…' : stats.servicesActive} color="text-green-600" />
          <StatCard title="Reseñas Totales" value={loading ? '…' : stats.reviews} color="text-purple-600" />
        </div>

        {/* Proveedores Pendientes de Verificación */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Proveedores Pendientes de Verificación</h2>
            <span className="text-sm text-gray-500">{pendingProviders.length} en espera</span>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documentos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Solicitud</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-500">Cargando…</td></tr>
                ) : (
                  providerRows.length ? providerRows : (
                    <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-500">No hay proveedores pendientes</td></tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* removed 'Últimas Reseñas' per request */}
      </div>
    </div>
  );
};

export default AdminDashboard;