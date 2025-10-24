import React from 'react';
import { useParams } from 'react-router-dom';

const ServiceDetails = () => {
  const { id } = useParams();
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Imágenes del servicio */}
          <div className="mb-6">
            <img
              src="placeholder.jpg"
              alt="Servicio"
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>

          {/* Información del servicio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-4">Nombre del Servicio</h1>
              <p className="text-gray-600 mb-4">
                Descripción detallada del servicio...
              </p>

              {/* Características */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Características</h2>
                <ul className="list-disc list-inside">
                  <li>Característica 1</li>
                  <li>Característica 2</li>
                  <li>Característica 3</li>
                </ul>
              </div>

              {/* Reseñas */}
              <div>
                <h2 className="text-xl font-semibold mb-2">Reseñas</h2>
                {/* Lista de reseñas */}
              </div>
            </div>

            {/* Panel de reserva */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="sticky top-4">
                <h3 className="text-2xl font-bold mb-2">$99.999</h3>
                <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg mb-4 hover:bg-blue-600">
                  Reservar Ahora
                </button>
                <div className="text-sm text-gray-600">
                  <p>✓ Reserva Instantánea</p>
                  <p>✓ Garantía de Servicio</p>
                  <p>✓ Pago Seguro</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetails;