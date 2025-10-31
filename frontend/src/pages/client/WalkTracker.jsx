import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Icono tipo caminante (emoji) un poco más grande para mayor visibilidad
const walkerIcon = new L.DivIcon({
  className: 'leaflet-div-icon',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(124,58,237,0.15);border:2px solid #7c3aed;font-size:18px;line-height:1;">🚶</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// Controlador del mapa: centra/auto-sigue al último punto según flags
const MapController = ({ last, autoFollow, centerTick }) => {
  const map = useMap();
  useEffect(() => {
    if (!autoFollow || !last) return;
    map.setView([last.latitude, last.longitude], 17, { animate: true });
  }, [autoFollow, last, map]);

  useEffect(() => {
    if (!centerTick || !last) return;
    map.setView([last.latitude, last.longitude], 17, { animate: true });
  }, [centerTick, last, map]);
  return null;
};

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

// Nota: No re-centrar automáticamente para no resetear zoom/posición del usuario.

// Marcador con animación simple hacia nueva coordenada en 1s
const AnimatedMarker = ({ position }) => {
  const markerRef = useRef(null);
  const [current, setCurrent] = useState(position);

  useEffect(() => {
    if (!position || !current) { setCurrent(position); return; }
    const steps = 60; // más pasos para un movimiento más suave
    const duration = 10000; // 10s para empatar con el intervalo de actualización
    const dt = duration / steps;
    const dLat = (position[0] - current[0]) / steps;
    const dLng = (position[1] - current[1]) / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      const next = [current[0] + dLat * i, current[1] + dLng * i];
      setCurrent(next);
      if (markerRef.current) {
        markerRef.current.setLatLng(next);
      }
      if (i >= steps) clearInterval(id);
    }, dt);
    return () => clearInterval(id);
  }, [position]);

  return <Marker ref={(m) => { markerRef.current = m; }} position={current} icon={walkerIcon} />;
};

const WalkTracker = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoFollow, setAutoFollow] = useState(false);
  const [centerTick, setCenterTick] = useState(0);
  const initialCenterRef = useRef(null); // guardar centro inicial sin volver a mover el mapa

  const isPaseo = useMemo(() => (order?.serviceCategory || '').toUpperCase() === 'PASEO', [order]);

  useEffect(() => {
    let mounted = true;
    const loadOrder = async () => {
      try {
        const o = await api(`/orders/${orderId}`);
        if (!mounted) return;
        setOrder(o);
      } catch (err) {
        setError(err?.message || 'No se pudo cargar el pedido');
      } finally { setLoading(false); }
    };
    loadOrder();
    return () => { mounted = false; };
  }, [orderId]);

  useEffect(() => {
    // Esperar a tener providerId del pedido para consultar por proveedor en gps_locations
    if (!order?.providerId) return;
    let timer;
    let mounted = true;
    const fetchGps = async () => {
      try {
        const data = await api(`/orders/${orderId}/gps?providerId=${order.providerId}`);
        if (!mounted) return;
        const pts = Array.isArray(data?.points) ? data.points : [];
        // ordenar por fecha ascendente y garantizar números
        const norm = pts.map(p => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }));
        const normSorted = norm.sort((a, b) => new Date(a.at) - new Date(b.at));
        // establecer centro inicial una sola vez cuando llegue el primer punto
        if (!initialCenterRef.current && normSorted.length) {
          const p0 = normSorted[0];
          initialCenterRef.current = [p0.latitude, p0.longitude];
        }
        setPoints(normSorted);
      } catch (err) {
        console.warn('gps fetch error', err?.message || err);
      } finally {
        timer = setTimeout(fetchGps, 5000);
      }
    };
    fetchGps();
    return () => { mounted = false; if (timer) clearTimeout(timer); };
  }, [orderId, order?.providerId]);

  const last = points.length ? points[points.length - 1] : null;
  const poly = points.length > 1 ? points.map(p => [p.latitude, p.longitude]) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Seguimiento del paseo</h1>
          <Link to="/client" className="text-sm text-violet-700">Volver al panel</Link>
        </div>

        {loading && <div>Cargando…</div>}
        {error && <div className="text-rose-600">{error}</div>}

        {order && (
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <div className="text-sm text-slate-500">Proveedor</div>
            <div className="text-lg font-semibold">{order.providerName || 'Proveedor'}</div>
            {order.providerDescription && <div className="text-sm text-slate-600">{order.providerDescription}</div>}
            <div className="mt-2 text-xs text-slate-500">Servicio: {order.serviceTitle || 'Paseo'}</div>
            <div className="text-xs text-slate-500">Estado: {(order.status||'').toUpperCase()}</div>
            <div className="text-xs text-slate-500">Actualización GPS: {last?.at ? formatDate(last.at) : '—'}</div>
            {!isPaseo && <div className="mt-2 text-amber-600 text-xs">Este servicio no es PASEO: se muestra la ubicación base del proveedor.</div>}
          </div>
        )}

        <div className="bg-white rounded-lg overflow-hidden shadow-sm relative" style={{ height: 420 }}>
          <MapContainer center={initialCenterRef.current || [0,0]} zoom={initialCenterRef.current ? 15 : 2} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController last={last} autoFollow={autoFollow} centerTick={centerTick} />
            {last && <AnimatedMarker position={[last.latitude, last.longitude]} />}
            {poly.length > 1 && <Polyline positions={poly} color="#7c3aed" opacity={0.6} />}
          </MapContainer>
          {/* Controles flotantes */}
          <div className="absolute top-3 right-3 space-y-2 z-20">
            <button
              type="button"
              className={`px-3 py-1.5 rounded text-xs font-medium shadow-sm border ${autoFollow ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
              onClick={() => setAutoFollow(v => !v)}
              title="Activar/Desactivar seguimiento automático"
            >
              {autoFollow ? 'Siguiendo' : 'Seguir' }
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded text-xs font-medium shadow-sm border bg-white text-slate-700 border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setCenterTick(t => t + 1)}
              disabled={!last}
              title="Centrar en la última ubicación"
            >
              Centrar
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-600">
          El mapa se actualiza cada 5 segundos. El indicador púrpura parpadea y se anima al recibir una nueva ubicación.
        </div>
      </div>
    </div>
  );
};

export default WalkTracker;
