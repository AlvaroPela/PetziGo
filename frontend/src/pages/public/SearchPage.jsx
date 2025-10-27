import React, { useState } from 'react';
import { Input, Select, Button } from '../../components/FormComponents';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

const SearchPage = () => {
  const [view, setView] = useState('map'); // 'map' or 'list'
  const [filters, setFilters] = useState({
    service: '',
    location: '',
    rating: ''
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra de filtros */}
      <div className="bg-white shadow p-4">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input placeholder="Buscar servicios..." value={filters.service} onChange={(v) => setFilters({ ...filters, service: v })} />
          <Input placeholder="Ubicación" value={filters.location} onChange={(v) => setFilters({ ...filters, location: v })} />
          <Select value={filters.rating} onChange={(v) => setFilters({ ...filters, rating: v })} options={[{ value: '', label: 'Calificación' }, { value: '4', label: '4+ estrellas' }, { value: '3', label: '3+ estrellas' }]} />
        </div>
      </div>

      {/* Vista de mapa/lista */}
      <div className="container mx-auto p-4">
        <div className="flex justify-end mb-4 gap-2">
          <Button variant={view === 'map' ? 'primary' : 'outline'} onClick={() => setView('map')}>Mapa</Button>
          <Button variant={view === 'list' ? 'primary' : 'outline'} onClick={() => setView('list')}>Lista</Button>
        </div>

        {view === 'map' ? (
          <div className="h-[600px] rounded-lg overflow-hidden">
            <MapContainer
              center={[4.6097, -74.0817]} // Coordenadas de Bogotá
              zoom={13}
              className="h-full w-full"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {/* Aquí irán los marcadores de proveedores */}
            </MapContainer>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Aquí irán las tarjetas de resultados */}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;