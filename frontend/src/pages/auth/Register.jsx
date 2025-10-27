import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Button } from '../../components/FormComponents';

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
      <form onSubmit={submit} className="space-y-3 bg-white p-6 rounded-2xl shadow border">
        <Input label="Nombre" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Input label="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Input label="Contraseña" type="password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        <Select
          label="Rol"
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v })}
          options={[{ value: 'CLIENT', label: 'Cliente' }, { value: 'PROVIDER', label: 'Proveedor' }]}
        />

        {error && <p className="text-rose-600">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Registrando...' : 'Crear cuenta'}</Button>
      </form>
    </div>
  );
};

export default RegisterPage;
