import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const UserManagement = () => {
  const [roleFilter, setRoleFilter] = useState('ALL'); // ALL | CLIENT | PROVIDER | ADMIN
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingProviders, setPendingProviders] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [verifiedProviders, setVerifiedProviders] = useState([]);
  const [rejectedProviders, setRejectedProviders] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // pending | verified | rejected

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await api(`/users/admin/list${params.toString() ? `?${params}` : ''}`);
      setUsers(res.users || []);
    } catch (e) {
      setError(e?.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* initial or when filters change */ }, [roleFilter, statusFilter]);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  const toggleStatus = async (u) => {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api(`/users/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: next } });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: next } : x));
    } catch (e) {
      alert(e?.message || 'No se pudo actualizar el estado');
    }
  };

  const loadPendingProviders = async () => {
    setLoadingPending(true);
    try {
      // use admin list endpoint (returns all providers) to split into tabs
      const res = await api('/providers/admin/list');
      const providers = res.providers || [];
      // split into categories
      // Pendientes: todos los no verificados
      const pending = providers.filter(p => !p.verified);
      const verified = providers.filter(p => p.verified);
      // Rechazados: por ahora ninguno (no hay flag explícito), guardamos los no verificados sin docs si necesitas diferenciarlos
      const rejected = providers.filter(p => false);
      setPendingProviders(pending);
      setVerifiedProviders(verified);
      setRejectedProviders(rejected);
    } catch (e) {
      alert(e?.message || 'No se pudo cargar proveedores pendientes');
    } finally {
      setLoadingPending(false);
    }
  };

  // Load providers lists on mount so admin sees them immediately
  useEffect(() => {
    loadPendingProviders();
  }, []);

  const verifyProvider = async (providerUserId, verified) => {
    try {
      await api(`/providers/admin/verify/${providerUserId}`, { method: 'PATCH', body: { verified } });
      // Optimistically update users list so UI reflects change immediately
      setUsers(prev => prev.map(u => u.id === providerUserId ? { ...u, provider_verified: verified ? 1 : 0 } : u));
      // Refresh server data for full consistency
      await load();
      await loadPendingProviders();
    } catch (e) {
      alert(e?.message || 'No se pudo actualizar verificación');
    }
  };

  const setUserStatus = async (userId, nextStatus) => {
    try {
      await api(`/users/admin/users/${userId}/status`, { method: 'PATCH', body: { status: nextStatus } });
      // Update users list
      setUsers(prev => prev.map(x => x.id === userId ? { ...x, status: nextStatus } : x));
      // Also remove from pending list if deactivated
      setPendingProviders(prev => prev.map(p => p.user_id === userId ? { ...p } : p));
    } catch (e) {
      alert(e?.message || 'No se pudo actualizar el estado del usuario');
    }
  };

  const rows = useMemo(() => users.map((u) => (
    <tr key={u.id}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{u.name}</div>
        <div className="text-sm text-gray-500">{u.email}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{u.role}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {u.role === 'PROVIDER' ? (
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.provider_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{u.provider_verified ? 'Verificado' : 'No verificado'}</span>
        ) : (
          <span className="text-sm text-gray-500">—</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-3">
          {u.role === 'PROVIDER' && (
            u.provider_verified ? (
              <button onClick={() => verifyProvider(u.id, false)} className="text-sm text-gray-600 hover:underline">Anular verificación</button>
            ) : (
              <button onClick={() => verifyProvider(u.id, true)} className="text-sm text-green-600 hover:underline">Verificar</button>
            )
          )}
          <button onClick={() => toggleStatus(u)} className={`text-sm ${u.status === 'ACTIVE' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
            {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </td>
    </tr>
  )), [users]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h1>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </header>

        {/* Filtros y búsqueda */}
        <form onSubmit={onSearch} className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Buscar por nombre o email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border rounded-lg p-2 min-w-[240px]"
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="border rounded-lg p-2">
              <option value="ALL">Todos los roles</option>
              <option value="CLIENT">Clientes</option>
              <option value="PROVIDER">Proveedores</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg p-2">
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
            <button type="submit" className="px-4 py-2 rounded-lg bg-violet-700 text-white hover:bg-violet-800">Buscar</button>
            <button type="button" onClick={() => { setSearchTerm(''); setRoleFilter('ALL'); setStatusFilter('ALL'); load(); }} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300">Limpiar</button>
            
          </div>
        </form>

        {/* Unified users table will include provider verification actions */}

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verificado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-6 text-center text-gray-500">Cargando…</td></tr>
              ) : rows.length ? rows : (
                <tr><td colSpan={5} className="px-6 py-6 text-center text-gray-500">Sin resultados</td></tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;