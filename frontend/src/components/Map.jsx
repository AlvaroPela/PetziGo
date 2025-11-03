import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Pet marker: pequeño icono SVG de huella para mayor coherencia UX
const pawSvg = encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'>
  <path d='M19.4 10.6c.6-1.3.4-2.9-.6-4-1-1.1-2.6-1.5-3.9-1-1.3.5-2 1.9-1.6 3.2.4 1.3 1.6 2.1 2.9 2.1.1 0 .2 0 .3-.1.6-.2 1.2-.1 1.5.3.2.2.3.5.3.8 0 .3-.1.6-.3.8-.4.4-1.2.5-1.9.3-1-.3-2-.1-2.7.5-.8.6-1 1.6-.6 2.5.4.9 1.3 1.6 2.3 1.8 1.7.4 3.6-.3 4.6-1.7 1-1.4 1.1-3.4.3-5.1zM7.1 6.3C7.8 4.9 7.6 3.3 6.6 2.3 5.6 1.3 4 1 2.7 1.7 1.4 2.5 1 4 1.7 5.1 2.3 6.1 3.6 6.8 4.7 6.8c.5 0 1-.1 1.4-.5.2-.2.3-.4.3-.5zM9.4 3.9c.9-1.1.8-2.7-.2-3.7C8.2-.9 6.6-.9 5.6.3 4.6 1.5 4.5 3.1 5.4 4.2c.9 1.1 2.5 1.4 3.6.4.3-.3.6-.8.6-1zM14.6 3.9c.9-1.1.8-2.7-.2-3.7-1-1-2.6-1-3.6.2-.9 1.1-.8 2.7.2 3.7.9.9 2.5 1 3.6-.2z' />
</svg>
`);

export const petIcon = new L.DivIcon({
  className: 'pet-marker',
  html: `<div style="width:34px;height:34px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);"><img src="data:image/svg+xml;utf8,${pawSvg}" style="width:18px;height:18px;display:block;" alt="pet"/></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

// Componente sencillo de mapa que recibe un array de providers con { id, name, location_lat, location_lng }
export default function Map({ providers = [], center = [6.2442, -75.5812], zoom = 13, height = '400px' }) {
  return (
    <div style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {providers.map((p) => {
          if (!p.location_lat || !p.location_lng) return null;
          return (
            <Marker key={p.id} icon={petIcon} position={[Number(p.location_lat), Number(p.location_lng)]}>
              <Popup>
                <strong>{p.name}</strong>
                <div>{p.business_description}</div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
