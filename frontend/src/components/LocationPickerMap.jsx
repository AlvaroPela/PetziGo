import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      if (onPick) onPick([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

export default function LocationPickerMap({ value, onChange, center = [6.2442, -75.5812], zoom = 13, height = 320 }) {
  const [pos, setPos] = useState(value || null);

  useEffect(() => { setPos(value || null); }, [value]);

  const handlePick = (latlng) => {
    setPos(latlng);
    if (onChange) onChange({ lat: latlng[0], lng: latlng[1] });
  };

  return (
    <div style={{ height }}>
      <MapContainer center={pos || center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={handlePick} />
        {pos && <Marker position={pos} />} 
      </MapContainer>
      <div className="mt-2 text-xs text-slate-600">
        {pos ? `Lat: ${pos[0].toFixed(6)}, Lng: ${pos[1].toFixed(6)}` : 'Haz clic en el mapa para elegir tu ubicación'}
      </div>
    </div>
  );
}
