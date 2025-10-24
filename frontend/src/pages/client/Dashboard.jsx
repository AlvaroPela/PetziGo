import React from 'react';

const ClientDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Hola, [Nombre del Cliente]
          </h1>
          <p className="text-gray-600">Bienvenido de nuevo</p>
        </header>

        {/* Próximas Citas */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Próximas Citas</h2>
          <div className="bg-white rounded-lg shadow p-4">
            {/* Lista de citas */}
          </div>
        </section>

        {/* Mis Mascotas */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Mis Mascotas</h2>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
              Añadir Mascota
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tarjetas de mascotas */}
          </div>
        </section>

        {/* Servicios Recomendados */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Servicios Recomendados</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tarjetas de servicios */}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClientDashboard;