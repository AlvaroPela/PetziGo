import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Select, Button } from '../../components/FormComponents';
import Modal from '../../components/Modal';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api, assetUrl } from '../../lib/api';

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

function FitBounds({ points = [] }) {
  const map = useMap();
  useEffect(() => {
    const latlngs = points
      .map((p) => {
        const lat = Number(p.location_lat);
        const lng = Number(p.location_lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      })
      .filter(Boolean);
    if (!latlngs.length) return;
    try {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds.pad ? bounds.pad(0.15) : bounds, { maxZoom: 15 });
    } catch (err) {
      console.warn('FitBounds error:', err);
    }
  }, [points, map]);
  return null;
}

const SearchPage = () => {
  // Vista seleccionada
  const [view, setView] = useState('list'); // 'map' | 'list'
  // Filtros
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState(10);
  const [cityFilter, setCityFilter] = useState('');
  // Datos de ubicación y resultados
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [usingDefault, setUsingDefault] = useState(true);
  const [services, setServices] = useState([]);
  // Note: removed forced UI hide behavior to avoid blank results after load
  // Estados de control: carga/errores
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Ref para evitar re-solicitudes en StrictMode
  const geoRequestedRef = React.useRef(false);
  // Polling control for repeated location requests
  const pollingRef = React.useRef(null);
  const pollingStopRef = React.useRef(null);
  const [polling, setPolling] = useState(false);

  // (Opcional) logs mínimos
  const trace = (label) => console.log(`[SearchPage] ${label} - ${new Date().toISOString()}`);

  // On mount: fetch services immediately, and request geolocation in background.
  useEffect(() => {
    // No forced UI hide behavior; fetch services immediately and let loading state control the UI
    let forcedTimer = null;

    trace('mount: fetch services and request geo in background');
    // fetch services right away
    fetchServices(category, query);

    // Geo: use global promise to avoid duplicate prompts
    if (!geoRequestedRef.current && typeof navigator !== 'undefined' && navigator.geolocation) {
      geoRequestedRef.current = true;
      const getGeoPromise = () => {
        if (typeof window === 'undefined') return Promise.resolve(null);
        if (window.__petziGoGeoPromise) {
          trace('reusing existing global geo promise');
          return window.__petziGoGeoPromise;
        }
        trace('creating global geo promise');
        window.__petziGoGeoPromise = new Promise((resolve) => {
          let reasks = 0;
          const maxReasks = 2;
          let geoTimerLocal = null;
          let reaskTimerLocal = null;
          const finishWith = (pos) => {
            if (geoTimerLocal) clearTimeout(geoTimerLocal);
            if (reaskTimerLocal) clearTimeout(reaskTimerLocal);
            resolve(pos);
          };
          const attempt = () => {
            trace('geo promise attempt (reasks=' + reasks + ')');
            if (navigator.permissions && navigator.permissions.query) {
              navigator.permissions.query({ name: 'geolocation' }).then((p) => trace('permission state: ' + p.state)).catch(() => {});
            }
            if (geoTimerLocal) clearTimeout(geoTimerLocal);
            geoTimerLocal = setTimeout(() => { trace('geo promise global timeout -> fallback'); finishWith(null); }, 10000);
            if (reaskTimerLocal) clearTimeout(reaskTimerLocal);
            reaskTimerLocal = setTimeout(() => { if (reasks < maxReasks) { reasks += 1; attempt(); } }, 3000);
            trace('geo promise calling getCurrentPosition');
            navigator.geolocation.getCurrentPosition((pos) => { trace('geo promise success coords=' + pos.coords.latitude + ',' + pos.coords.longitude); finishWith({ lat: pos.coords.latitude, lng: pos.coords.longitude }); }, (err) => { trace('geo promise error code=' + (err && err.code) + ' msg=' + (err && err.message)); finishWith(null); }, { enableHighAccuracy: true, timeout: 8000 });
          };
          attempt();
        }).finally(() => { trace('global geo promise settled'); });
        return window.__petziGoGeoPromise;
      };
      getGeoPromise().then((pos) => {
        if (pos) {
          trace('global geo resolved; set center to user coords');
          setCenter({ lat: pos.lat, lng: pos.lng, label: 'Mi ubicación' });
          setUsingDefault(false);
        } else {
          trace('global geo resolved null; keeping default center');
          setUsingDefault(true);
        }
      });
    }
    // cleanup
    return () => {
      if (forcedTimer) clearTimeout(forcedTimer);
      // ensure polling timers are cleared on unmount
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      if (pollingStopRef.current) { clearTimeout(pollingStopRef.current); pollingStopRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchServices(cat, q, currentCenter = center) {
    trace('fetchServices start');
    console.time('fetchServices');
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cat) params.append('category', cat);
      if (q) params.append('search', q);
      const qs = params.toString();
      const path = qs ? `/services?${qs}` : '/services';
  trace('about to call api ' + path);
  const res = await api(path);
      trace('api returned for ' + path + ' (keys=' + Object.keys(res || {}).join(',') + ')');
      const list = Array.isArray(res.services) ? res.services : (res.services || []);
      trace('api services length: ' + (Array.isArray(res.services) ? res.services.length : (res.services ? Object.keys(res.services).length : 0)));
      setServices(list);
      trace('setServices completed - items: ' + list.length);
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
      console.timeEnd('fetchServices');
      setLoading(false);
      trace('fetchServices end');
    }
  }

  // (sin timers globales ahora)

  function onApplyFilters() {
    fetchServices(category, query);
  }

  function onUseMyLocation() {
    // Toggle polling: start polling every 1s while active (with auto-stop)
    if (!navigator.geolocation) return;
    const doGet = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Mi ubicación' };
          setCenter(c);
          setUsingDefault(false);
          // opcional: refetch para ajustar resultados por radio
          fetchServices(category, query);
        },
        (err) => {
          // on error, we keep defaults but log
          console.warn('getCurrentPosition error', err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    const startPolling = () => {
      // immediate
      doGet();
      // poll every 1000ms
      pollingRef.current = setInterval(doGet, 1000);
      // safety auto-stop after 30s
      pollingStopRef.current = setTimeout(() => stopPolling(), 30000);
      setPolling(true);
    };

    const stopPolling = () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      if (pollingStopRef.current) { clearTimeout(pollingStopRef.current); pollingStopRef.current = null; }
      setPolling(false);
    };

    if (pollingRef.current) {
      stopPolling();
    } else {
      startPolling();
    }
  }

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    let list = services;
    // filtro de texto
    if (q) {
      list = list.filter((s) => {
        const title = String(s.title || '').toLowerCase();
        const desc = String(s.description || '').toLowerCase();
        const provider = String(s.provider_name || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || provider.includes(q);
      });
    }
    // filtro por categoría
    if (category) {
      list = list.filter((s) => String(s.category) === String(category));
    }
    // filtro por ciudad (cliente)
    if (cityFilter && cityFilter.trim()) {
      const cf = cityFilter.trim().toLowerCase();
      list = list.filter((s) => String(s.city || '').toLowerCase().includes(cf));
    }
    // filtro por radio (si hay coordenadas válidas)
    if (center && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng)) && Number(radius) > 0) {
      list = list.filter((s) => {
        const latN = Number(s.location_lat);
        const lngN = Number(s.location_lng);
        if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return false;
        const d = kmDistance(center, { lat: latN, lng: lngN });
        return d != null && d <= Number(radius);
      });
    }
    return list;
  }, [services, query, category, center, radius]);

  // Image modal for thumbnails
  const [imgModal, setImgModal] = useState({ open: false, src: null, alt: '' });
  // Optional modals for associated Pet and Client
  const [petModal, setPetModal] = useState({ open: false, data: null });
  const [clientModal, setClientModal] = useState({ open: false, data: null });

  // No gating: mostramos la interfaz inmediatamente (la geo se aplica en background)

  // UI completa cuando phase === 'ready'
  // uiLoading: simple loading state (no forced UI hide)
  const uiLoading = loading;
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Contenido principal */}
          <div className="lg:col-span-9 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {usingDefault ? 'Usando ubicación por defecto: Bogotá.' : 'Usando tu ubicación actual.'} {filtered.length} resultados.
              </div>
              <div className="flex items-center gap-2">
                <Button variant={view === 'list' ? 'primary' : 'outline'} onClick={() => setView('list')} aria-label="Ver en lista">Lista</Button>
                <Button variant={view === 'map' ? 'primary' : 'outline'} onClick={() => setView('map')} aria-label="Ver en mapa">Mapa</Button>
              </div>
            </div>
            {view === 'map' ? (
              <div className="relative h-[50vh] rounded-xl overflow-hidden border bg-white">
                {uiLoading && (
                  <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex items-center gap-3 text-violet-800">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent"></span>
                      <span className="text-sm">Cargando servicios en el mapa…</span>
                    </div>
                  </div>
                )}
                <MapContainer key={`${center.lat},${center.lng}-${filtered.length}`} center={[center.lat, center.lng]} zoom={13} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                  <RecenterOn center={center} />
                  <FitBounds points={filtered} />
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
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => setCenter({ lat: latN, lng: lngN, label: s.title })}>Centrar</Button>
                              <Link to={`/services/${s.id}`} className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm">Ver</Link>
                              {(s.pet || s.pet_id || s.pet_name) && (
                                <button className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm" onClick={() => setPetModal({ open: true, data: s })}>Mascota</button>
                              )}
                              {(s.client || s.client_id || s.client_name) && (
                                <button className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm" onClick={() => setClientModal({ open: true, data: s })}>Cliente</button>
                              )}
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
                {uiLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-lg border bg-white p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[60vh] overflow-auto pr-2">
                    {filtered.map((s) => {
                      const latN = Number(s.location_lat);
                      const lngN = Number(s.location_lng);
                      const dist = (Number.isFinite(latN) && Number.isFinite(lngN)) ? kmDistance(center, { lat: latN, lng: lngN }) : null;
                      return (
                        <div key={s.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-3 flex items-center gap-4">
                          <div className="w-16 h-16 bg-slate-50 rounded-md overflow-hidden flex-shrink-0 cursor-pointer shadow-sm" onClick={() => { if (s.image_url) setImgModal({ open: true, src: assetUrl(s.image_url), alt: s.title || s.provider_name || 'Imagen' }); }}>
                            {s.image_url ? (
                              <img src={assetUrl(s.image_url)} alt={s.title || ''} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex flex-col items-center justify-center text-xs text-gray-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                                  </svg>
                                  <div className="text-[11px]">Sin imagen</div>
                                </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="text-lg font-semibold text-gray-900 truncate">{s.title}</div>
                                <div className="text-sm text-gray-500 truncate mt-1">{s.provider_name}</div>
                              </div>
                              <div className="text-lg font-semibold text-gray-900 ml-4">COP {Number(s.price).toLocaleString('es-CO')}</div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="min-w-0 text-sm text-gray-600 truncate flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path fillRule="evenodd" d="M10 2a5 5 0 00-5 5c0 4.418 5 11 5 11s5-6.582 5-11a5 5 0 00-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" clipRule="evenodd" />
                                </svg>
                                <span className="truncate">{s.city || (dist != null ? `${dist.toFixed(1)} km` : 'Ubicación no disponible')}</span>
                                <div className="text-[12px] text-violet-600 ml-3 truncate">{s.category}</div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-2">
                                <Link to={`/services/${s.id}`} className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm">Ver</Link>
                                {(s.pet || s.pet_id || s.pet_name) && (
                                  <button className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm" onClick={() => setPetModal({ open: true, data: s })}>Mascota</button>
                                )}
                                {(s.client || s.client_id || s.client_name) && (
                                  <button className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 text-sm" onClick={() => setClientModal({ open: true, data: s })}>Cliente</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Image modal for thumbnails */}
                    <Modal isOpen={imgModal.open} onClose={() => setImgModal({ open: false, src: null, alt: '' })} ariaLabel="Imagen">
                      {imgModal.src ? (
                        <img src={imgModal.src} alt={imgModal.alt} className="max-h-[80vh] w-auto mx-auto rounded" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-sm text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                          </svg>
                          <div className="text-sm text-gray-500">Sin imagen</div>
                        </div>
                      )}
                    </Modal>
                    {filtered.length === 0 && !loading && (
                      <div className="p-4 text-sm text-gray-600">
                        {services.length === 0 ? (
                          <div>No hay servicios publicados aún en esta área.</div>
                        ) : (
                          <div className="space-y-2">
                            <div>No se encontraron servicios cerca dentro del radio seleccionado.</div>
                            <div className="flex gap-2">
                              <Button onClick={() => setRadius((r) => Math.min(200, r * 2))}>Ampliar búsqueda (x2)</Button>
                              <Button variant="outline" onClick={() => setCityFilter('')}>Limpiar ciudad</Button>
                            </div>
                            <div className="text-xs text-gray-500">También puedes buscar por ciudad usando el filtro "Ciudad".</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Sidebar de filtros a la derecha */}
          <aside className="lg:col-span-3">
            <div className="sticky top-4 space-y-3">
              <div className="rounded-lg border bg-white p-4">
                <div className="text-sm font-medium text-gray-800 mb-3">Filtros</div>
                <div className="space-y-3">
                  <Input label="Buscar" placeholder="servicio o proveedor" value={query} onChange={setQuery} />
                  <Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
                  <Input label="Ciudad" placeholder="Ciudad (ej. Bogotá)" value={cityFilter} onChange={setCityFilter} />
                  <Select label="Radio" value={String(radius)} onChange={(v) => setRadius(Number(v))} options={[
                    { value: '5', label: '5 km' },
                    { value: '10', label: '10 km' },
                    { value: '20', label: '20 km' },
                    { value: '30', label: '30 km' },
                    { value: '50', label: '50 km' },
                  ]} />
                  <div className="flex gap-2 justify-end pt-1">
                    <Button onClick={onApplyFilters} disabled={loading}>Buscar</Button>
                    <Button variant="outline" onClick={onUseMyLocation}>Mi ubicación</Button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {/* Pet modal */}
      <Modal isOpen={petModal.open} onClose={() => setPetModal({ open: false, data: null })} ariaLabel="Mascota asociada">
        {(() => {
          const s = petModal.data;
          if (!s) return null;
          const pet = s.pet || {};
          const name = pet.name || s.pet_name || 'Mascota';
          const species = pet.species || s.pet_species;
          const breed = pet.breed || s.pet_breed;
          const age = pet.age || s.pet_age;
          const weight = pet.weight || s.pet_weight;
          const image = pet.image_url || s.pet_image_url;
          return (
            <div className="max-w-md mx-auto p-4">
              <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-4">
                <div className="flex-shrink-0">
                  {image ? (
                    <img src={assetUrl(image)} alt={name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-xl font-semibold">{(name || 'M')[0]}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{name}</h3>
                  <div className="text-sm text-gray-600 mt-1">
                    {species && <div>Especie: {species}</div>}
                    {breed && <div>Raza: {breed}</div>}
                    {age != null && <div>Edad: {age}</div>}
                    {weight != null && <div>Peso: {weight} kg</div>}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setPetModal({ open: false, data: null })} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
              </div>
            </div>
          );
        })()}
      </Modal>
      {/* Client modal */}
      <Modal isOpen={clientModal.open} onClose={() => setClientModal({ open: false, data: null })} ariaLabel="Cliente">
        {(() => {
          const s = clientModal.data;
          if (!s) return null;
          const c = s.client || {};
          const name = c.name || s.client_name || 'Cliente';
          const email = c.email || s.client_email;
          const phone = c.phone || s.client_phone;
          const avatar = c.avatar || s.client_avatar;
          return (
            <div className="max-w-md mx-auto p-4">
              <div className="bg-white rounded-lg shadow-sm p-4 flex items-start gap-4">
                <div className="flex-shrink-0">
                  {avatar ? (
                    <img src={assetUrl(avatar)} alt={name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-xl font-semibold">{(name || 'C')[0]}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{name}</h3>
                  <div className="text-sm text-gray-600 mt-1 space-y-1">
                    {email && <div>Email: <a className="text-violet-700 underline" href={`mailto:${email}`}>{email}</a></div>}
                    {phone && <div>Teléfono: {phone}</div>}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setClientModal({ open: false, data: null })} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default SearchPage;