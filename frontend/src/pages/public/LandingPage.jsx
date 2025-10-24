import React from 'react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-8">
        <section className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            AMA LAS MASCOTAS
          </h1>
          <p className="text-xl text-gray-600">
            Encuentra los mejores servicios para tu mascota
          </p>
        </section>

        {/* Sección de Servicios Destacados */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Aquí irán las tarjetas de servicios destacados */}
        </section>

        {/* Sección de Proveedores */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Proveedores Destacados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Aquí irán las tarjetas de proveedores */}
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;