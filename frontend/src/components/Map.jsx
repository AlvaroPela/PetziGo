import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

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
            <Marker key={p.id} position={[Number(p.location_lat), Number(p.location_lng)]}>
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
