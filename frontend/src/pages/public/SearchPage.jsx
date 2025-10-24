import React, { useState } from 'react';
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
        <div className="container mx-auto flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Buscar servicios..."
            className="border p-2 rounded"
            onChange={(e) => setFilters({ ...filters, service: e.target.value })}
          />
          <input
            type="text"
            placeholder="Ubicación"
            className="border p-2 rounded"
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          />
          <select
            className="border p-2 rounded"
            onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
          >
            <option value="">Calificación</option>
            <option value="4">4+ estrellas</option>
            <option value="3">3+ estrellas</option>
          </select>
        </div>
      </div>

      {/* Vista de mapa/lista */}
      <div className="container mx-auto p-4">
        <div className="flex justify-end mb-4">
          <button
            className={`px-4 py-2 rounded ${view === 'map' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setView('map')}
          >
            Mapa
          </button>
          <button
            className={`px-4 py-2 rounded ml-2 ${view === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setView('list')}
          >
            Lista
          </button>
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