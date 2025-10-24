import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';

const RegisterPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CLIENT' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await auth.register({ name: form.name, email: form.email, password: form.password, role: form.role });
      navigate('/login');
    } catch (err) {
      console.error('register error', err);
      setError(err.message || 'Error registrando');
    } finally { setLoading(false); }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Crear cuenta</h1>
      <form onSubmit={submit} className="space-y-3 bg-white p-4 rounded-lg shadow">
        <label className="block">
          <span className="text-sm">Nombre</span>
          <input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">Email</span>
          <input required type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">Contraseña</span>
          <input required type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">Rol</span>
          <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} className="mt-1 w-full rounded border px-3 py-2">
            <option value="CLIENT">Cliente</option>
            <option value="PROVIDER">Proveedor</option>
          </select>
        </label>

        {error && <p className="text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-petzi text-white py-2 rounded">{loading ? 'Registrando...' : 'Crear cuenta'}</button>
      </form>
    </div>
  );
};

export default RegisterPage;
