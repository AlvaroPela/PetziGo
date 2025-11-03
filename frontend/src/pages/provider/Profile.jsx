import React, { useEffect, useState, useRef } from 'react';
import { api, assetUrl } from '../../lib/api';
import { Input, Button } from '../../components/FormComponents';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { petIcon } from '../../components/Map';

const DEFAULT_CENTER = [4.6097, -74.0817];

function LocationPicker({ position, onChange }) {
  // allow clicking on the map to set marker
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onChange([lat, lng]);
    }
  });
  return null;
}

const ProviderProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '', phone: '', address: '', business_description: '', location: { lat: null, lng: null }
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [userRes, provRes] = await Promise.allSettled([api('/users/me'), api('/providers/me')]);
        console.log('[provider page] /users/me result:', userRes, '/providers/me result:', provRes);
        if (!mounted) return;
        const u = userRes.status === 'fulfilled' ? userRes.value : {};
        const p = provRes.status === 'fulfilled' ? (provRes.value?.profile || {}) : {};
        setForm({
          name: u.name || '',
          phone: u.phone || '',
          address: u.address || '',
          business_description: p.business_description || '',
          location: {
            lat: p.location_lat != null ? Number(p.location_lat) : DEFAULT_CENTER[0],
            lng: p.location_lng != null ? Number(p.location_lng) : DEFAULT_CENTER[1]
          }
        });
      } catch (err) {
        console.error('Error cargando provider profile', err);
        setError(err.message || 'No se pudo cargar el perfil');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // validate
      if (!form.business_description || String(form.business_description).trim() === '') throw new Error('La descripción del negocio es requerida');
      const lat = Number(form.location.lat);
      const lng = Number(form.location.lng);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) throw new Error('Latitud inválida');
      if (Number.isNaN(lng) || lng < -180 || lng > 180) throw new Error('Longitud inválida');

      // build payloads
      const userPayload = {};
      if (form.name && String(form.name).trim() !== '') userPayload.name = form.name;
      if (form.phone && String(form.phone).trim() !== '') userPayload.phone = form.phone;
      if (form.address && String(form.address).trim() !== '') userPayload.address = form.address;

      const providerPayload = { business_description: form.business_description, location_lat: lat, location_lng: lng };

      // send requests (users first)
      if (Object.keys(userPayload).length > 0) await api('/users/profile', { method: 'PUT', body: userPayload });
      await api('/providers/profile', { method: 'PUT', body: providerPayload });

      // refresh data after save to reflect persisted values
      try {
        const [userRes, provRes] = await Promise.allSettled([api('/users/me'), api('/providers/me')]);
        console.log('[provider page] after save - /users/me:', userRes, '/providers/me:', provRes);
        // update form with latest values
        const u = userRes.status === 'fulfilled' ? userRes.value : {};
        const p = provRes.status === 'fulfilled' ? (provRes.value?.profile || {}) : {};
        setForm(f => ({
          ...f,
          name: u.name || f.name,
          phone: u.phone || f.phone,
          address: u.address || f.address,
          business_description: p.business_description || f.business_description,
          location: {
            lat: p.location_lat != null ? Number(p.location_lat) : f.location.lat,
            lng: p.location_lng != null ? Number(p.location_lng) : f.location.lng
          }
        }));
      } catch (err) {
        console.warn('No se pudo recargar perfil tras guardar', err);
      }
      alert('Perfil actualizado');
    } catch (err) {
      console.error('Error saving provider profile', err);
      if (err && err.body && Array.isArray(err.body.errors)) {
        setError(err.body.errors.map(x => x.msg).join('; '));
      } else {
        setError(err.message || 'No se pudo guardar');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Perfil del proveedor</h1>
      <p className="text-sm text-gray-500 mb-4">Actualiza el nombre, contacto, descripción y la ubicación de tu negocio (mueve el marcador para ajustar).</p>

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <form onSubmit={handleSave} className="max-w-3xl bg-white p-4 rounded shadow-sm space-y-4">
          {error && <div className="text-red-600">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nombre (o nombre del negocio)" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} />
            <Input label="Teléfono" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} />
            <Input label="Dirección" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción del negocio</label>
            <textarea value={form.business_description} onChange={(e) => setForm(f => ({ ...f, business_description: e.target.value }))} className="w-full border rounded p-2" rows={4} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación (haz click en el mapa o arrastra el marcador)</label>
            <div style={{ height: 360 }} className="rounded overflow-hidden">
              <MapContainer center={[form.location.lat || DEFAULT_CENTER[0], form.location.lng || DEFAULT_CENTER[1]]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                <Marker
                  icon={petIcon}
                  draggable={true}
                  position={[form.location.lat, form.location.lng]}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const pos = marker.getLatLng();
                      setForm(f => ({ ...f, location: { lat: pos.lat, lng: pos.lng } }));
                    }
                  }}
                />
                <LocationPicker position={[form.location.lat, form.location.lng]} onChange={(pos) => setForm(f => ({ ...f, location: { lat: pos[0], lng: pos[1] } }))} />
              </MapContainer>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            <Button variant="outline" type="button" onClick={() => window.location.reload()}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ProviderProfile;