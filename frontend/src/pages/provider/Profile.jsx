import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

const ProviderProfile = () => {
  const [profile, setProfile] = useState({
    businessName: '',
    description: '',
    location: {
      lat: 4.6097,
      lng: -74.0817
    },
    phone: '',
    email: '',
    categories: [],
    certifications: []
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Perfil del Negocio
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <form>
            {/* Información básica */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Información Básica</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 mb-2">
                    Nombre del Negocio
                  </label>
                  <input
                    type="text"
                    value={profile.businessName}
                    onChange={(e) => setProfile({...profile, businessName: e.target.value})}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>
            </section>

            {/* Descripción */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Descripción</h2>
              <textarea
                value={profile.description}
                onChange={(e) => setProfile({...profile, description: e.target.value})}
                className="w-full border rounded-lg p-2 h-32"
                placeholder="Describe tu negocio..."
              />
            </section>

            {/* Ubicación */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Ubicación</h2>
              <div className="h-[400px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[profile.location.lat, profile.location.lng]}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <Marker position={[profile.location.lat, profile.location.lng]} />
                </MapContainer>
              </div>
            </section>

            {/* Certificaciones */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Certificaciones</h2>
              <div className="border-dashed border-2 border-gray-300 rounded-lg p-8 text-center">
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                  Subir Certificación
                </button>
              </div>
            </section>

            {/* Botón de guardar */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProviderProfile;