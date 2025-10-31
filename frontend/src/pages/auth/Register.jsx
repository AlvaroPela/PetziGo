import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Button } from '../../components/FormComponents';
import Modal from '../../components/Modal';
import LocationPickerMap from '../../components/LocationPickerMap';

const RegisterPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'CLIENT' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locModal, setLocModal] = useState(false);
  const [picked, setPicked] = useState(null); // {lat, lng}

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.password || form.password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres');
    }
    if (!form.confirmPassword || form.password !== form.confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }

    // Si es proveedor, exigir ubicación; si no la tenemos aún, abrir modal
    if (form.role === 'PROVIDER' && !picked) {
      setLocModal(true);
      return;
    }

    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, confirmPassword: form.confirmPassword, role: form.role };
      if (form.role === 'PROVIDER' && picked) {
        payload.location_lat = picked.lat;
        payload.location_lng = picked.lng;
      }
      await auth.register(payload);
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
        <Input label="Confirmar contraseña" type="password" required value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />
        <Select
          label="Rol"
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v })}
          options={[{ value: 'CLIENT', label: 'Cliente' }, { value: 'PROVIDER', label: 'Proveedor' }]}
        />

        {error && <p className="text-rose-600">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Registrando...' : 'Crear cuenta'}</Button>
      </form>

      <Modal isOpen={locModal} onClose={() => setLocModal(false)} ariaLabel="Ubicación del proveedor">
        <h2 className="text-lg font-semibold mb-2">Selecciona tu ubicación</h2>
        <p className="text-sm text-slate-600 mb-3">Esta ubicación es necesaria para publicar servicios de paseo y aparecer en búsquedas por mapa.</p>
        <div className="rounded overflow-hidden">
          <LocationPickerMap value={picked ? [picked.lat, picked.lng] : null} onChange={setPicked} height={320} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setLocModal(false)}>Cancelar</Button>
          <Button onClick={async () => {
            if (!picked) return alert('Por favor marca tu ubicación');
            // Reintentar submit ahora con ubicación
            setLocModal(false);
            setLoading(true); setError(null);
            try {
              const payload = { name: form.name, email: form.email, password: form.password, confirmPassword: form.confirmPassword, role: form.role, location_lat: picked.lat, location_lng: picked.lng };
              await auth.register(payload);
              navigate('/login');
            } catch (err) {
              console.error('register error', err);
              setError(err.message || 'Error registrando');
            } finally { setLoading(false); }
          }}>Confirmar ubicación y registrar</Button>
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPage;
