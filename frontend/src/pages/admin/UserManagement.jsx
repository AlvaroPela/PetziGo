import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const UserManagement = () => {
  const [roleFilter, setRoleFilter] = useState('ALL'); // ALL | CLIENT | PROVIDER | ADMIN
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => { load(); /* initial */ }, []);

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
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onClick={() => toggleStatus(u)} className={`text-sm ${u.status === 'ACTIVE' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
          {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
        </button>
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

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-500">Cargando…</td></tr>
              ) : rows.length ? rows : (
                <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-500">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;