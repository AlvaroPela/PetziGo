import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import { Input, Button } from '../../components/FormComponents';

export default function ClientProfile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const me = await api('/users/me');
        if (!mounted) return;
        setForm({ name: me.name || '', phone: me.phone || '', address: me.address || '' });
      } catch (err) {
        console.error('ClientProfile load error', err);
        setError(err.message || 'No se pudo cargar tu perfil');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Client-side basic validation for phone to avoid backend 400 from strict E.164 check
      if (form.phone && !/^\+?[1-9]\d{1,14}$/.test(form.phone)) {
        throw new Error('Teléfono inválido. Use el formato internacional, por ejemplo: +573001234567');
      }
      // Build payload removing empty strings so express-validator optional() works as expected
      const payload = {};
      if (form.name && String(form.name).trim() !== '') payload.name = form.name;
      if (form.phone && String(form.phone).trim() !== '') payload.phone = form.phone;
      if (form.address && String(form.address).trim() !== '') payload.address = form.address;
      if (Object.keys(payload).length === 0) {
        throw new Error('No hay cambios para guardar');
      }
      await api('/users/profile', { method: 'PUT', body: payload });
      // refresh local user
      try { const me = await api('/users/me'); setUser && setUser(me); } catch {}
      alert('Perfil actualizado');
    } catch (err) {
      console.error('save profile error', err);
      // If backend returned validation errors via express-validator, show them
      if (err && err.body && Array.isArray(err.body.errors)) {
        const msg = err.body.errors.map((x) => x.msg).join('; ');
        setError(msg || (err.message || 'No se pudo guardar'));
      } else {
        setError(err.message || 'No se pudo guardar');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Mi perfil</h1>
      <p className="text-sm text-gray-500 mb-4">Actualiza tus datos de contacto.</p>

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <form onSubmit={handleSave} className="max-w-xl bg-white p-4 rounded shadow-sm">
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <Input label="Nombre" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          <Input label="Teléfono" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          <Input label="Dirección" value={form.address} onChange={(v) => setForm((p) => ({ ...p, address: v }))} />
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            <Button variant="outline" type="button" onClick={() => { setForm({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' }); }}>Resetear</Button>
          </div>
        </form>
      )}
    </div>
  );
}
