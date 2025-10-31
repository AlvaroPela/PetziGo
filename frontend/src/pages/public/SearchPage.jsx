import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Select, Button } from '../../components/FormComponents';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { api } from '../../lib/api';

// Alinear categorías con backend services.js (ES)
const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'PASEO', label: 'Paseo' },
  { value: 'VETERINARIA', label: 'Veterinaria' },
  { value: 'ENTRENAMIENTO', label: 'Entrenamiento' },
  { value: 'ESTETICA', label: 'Estética' },
  { value: 'GUARDERIA', label: 'Guardería' },
  { value: 'OTRO', label: 'Otro' },
];

const DEFAULT_CENTER = { lat: 4.6097, lng: -74.0817, label: 'Bogotá' };

function kmDistance(a, b) {
  if (!a || !b) return null;
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

function RecenterOn({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng]);
    }
  }, [center, map]);
  return null;
}

const SearchPage = () => {
  const [view, setView] = useState('list'); // 'map' | 'list' (por defecto: lista)
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState(10); // UI únicamente; el endpoint simple no usa radio
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [usingDefault, setUsingDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [services, setServices] = useState([]);

  // pedir ubicación al usuario en el primer render
  useEffect(() => {
    let done = false;
    const ask = () => {
      if (!navigator.geolocation) {
        // usar Bogotá
        setCenter(DEFAULT_CENTER);
        setUsingDefault(true);
  fetchServices(category, query);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Mi ubicación' };
          setCenter(c);
          setUsingDefault(false);
          fetchServices(category, query);
        },
        () => {
          if (done) return;
          setCenter(DEFAULT_CENTER);
          setUsingDefault(true);
          fetchServices(category, query);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    ask();
    return () => { done = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchServices(cat, q) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cat) params.append('category', cat);
      if (q) params.append('search', q);
      const qs = params.toString();
      const path = qs ? `/services?${qs}` : '/services';
      const res = await api(path);
      const list = Array.isArray(res.services) ? res.services : (res.services || []);
      setServices(list);
      // Si estamos usando el centro por defecto (Bogotá) y hay resultados con coordenadas,
      // centramos el mapa al primer resultado para garantizar que se vean los puntos.
      const firstWithCoords = list.find((s) => Number.isFinite(Number(s.location_lat)) && Number.isFinite(Number(s.location_lng)));
      if (view === 'map' && usingDefault && firstWithCoords) {
        setCenter({
          lat: Number(firstWithCoords.location_lat),
          lng: Number(firstWithCoords.location_lng),
          label: firstWithCoords.title || 'Resultado'
        });
      }
    } catch (err) {
      console.error('fetchServices error:', err);
      setError(err.message || 'No se pudieron cargar servicios');
    } finally {
      setLoading(false);
    }
  }

  function onApplyFilters() {
    fetchServices(category, query);
  }

  function onUseMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Mi ubicación' };
        setCenter(c);
        setUsingDefault(false);
        fetchServices(category, query);
      },
      () => {
        setCenter(DEFAULT_CENTER);
        setUsingDefault(true);
        fetchServices(category, query);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      const title = String(s.title || '').toLowerCase();
      const desc = String(s.description || '').toLowerCase();
      const provider = String(s.provider_name || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || provider.includes(q);
    });
  }, [services, query]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra superior de búsqueda y filtros */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="container mx-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <Input label="Buscar" placeholder="servicio o proveedor" value={query} onChange={setQuery} />
            </div>
            <div className="md:col-span-3">
              <Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
            </div>
            <div className="md:col-span-2">
              <Select label="Radio" value={String(radius)} onChange={(v) => setRadius(Number(v))} options={[
                { value: '5', label: '5 km' },
                { value: '10', label: '10 km' },
                { value: '20', label: '20 km' },
                { value: '30', label: '30 km' },
                { value: '50', label: '50 km' },
              ]} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={onApplyFilters} disabled={loading}>Buscar</Button>
              <Button variant="outline" onClick={onUseMyLocation}>Mi ubicación</Button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {usingDefault ? 'Usando ubicación por defecto: Bogotá.' : 'Usando tu ubicación actual.'} {filtered.length} resultados.
          </div>
          {loading && (
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"></span>
              Cargando servicios...
            </div>
          )}
          {error && <div className="mt-2 text-rose-600 text-sm">{error}</div>}
        </div>
      </div>

      {/* Toggle de vista */}
      <div className="container mx-auto px-4 pt-4 flex justify-end gap-2">
        <Button variant={view === 'list' ? 'primary' : 'outline'} onClick={() => setView('list')}>Lista</Button>
        <Button variant={view === 'map' ? 'primary' : 'outline'} onClick={() => setView('map')}>Mapa</Button>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto p-4">
        {view === 'map' ? (
          <div className="relative h-[70vh] rounded-xl overflow-hidden border bg-white">
            {loading && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-3 text-violet-800">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"></span>
                  <span className="text-sm">Cargando servicios en el mapa…</span>
                </div>
              </div>
            )}
            <MapContainer key={`${center.lat},${center.lng}`} center={[center.lat, center.lng]} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <RecenterOn center={center} />
              {filtered.map((s) => {
                  const latN = Number(s.location_lat);
                  const lngN = Number(s.location_lng);
                const hasCoords = Number.isFinite(latN) && Number.isFinite(lngN);
                return hasCoords ? (
                    <CircleMarker key={s.id}
                    center={[latN, lngN]}
                    radius={6}
                    pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.8 }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                          <div className="font-semibold">{s.title}</div>
                          <div className="text-[11px] text-gray-600">{s.provider_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-3">{s.description}</div>
                          <div className="text-[12px] text-gray-700 mt-1">COP {Number(s.price).toLocaleString('es-CO')}</div>
                        <div className="text-xs text-gray-600 mt-2">
                          {(() => {
                            const d = kmDistance(center, { lat: latN, lng: lngN });
                            return d != null ? `A ${d.toFixed(1)} km` : '';
                          })()}
                        </div>
                        <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => setCenter({ lat: latN, lng: lngN, label: s.title })}>Centrar</Button>
                            <Link to={`/services/${s.id}`} className="inline-flex items-center rounded px-2 py-1 text-sm text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50">Ver servicio</Link>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null;
              })}
            </MapContainer>
          </div>
        ) : (
          <div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border bg-white p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y rounded-lg border bg-white">
                {filtered.map((s) => (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-700 font-medium truncate">{s.title}</div>
                      <div className="text-xs text-gray-500 truncate">{s.provider_name}</div>
                      <div className="font-medium truncate flex items-center gap-2">
                        <span className="text-xs text-gray-700">COP {Number(s.price).toLocaleString('es-CO')}</span>
                        <span className="text-[11px] rounded bg-violet-50 text-violet-700 px-2 py-0.5">{s.category}</span>
                      </div>
                      {(s.location_lat && s.location_lng) && (
                        <div className="text-xs text-gray-600">
                          {(() => {
                            const d = kmDistance(center, { lat: Number(s.location_lat), lng: Number(s.location_lng) });
                            return d != null ? `A ${d.toFixed(1)} km` : '';
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/services/${s.id}`} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50 text-sm">Ver servicio</Link>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && !loading && <p className="p-4 text-sm text-gray-600">No se encontraron servicios</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;