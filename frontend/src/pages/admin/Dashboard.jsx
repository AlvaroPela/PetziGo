import React from 'react';

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Panel de Administración
          </h1>
        </header>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Usuarios Totales</h3>
            <p className="text-3xl font-bold text-blue-500">0</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Proveedores Pendientes</h3>
            <p className="text-3xl font-bold text-yellow-500">0</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Servicios Activos</h3>
            <p className="text-3xl font-bold text-green-500">0</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Reseñas Pendientes</h3>
            <p className="text-3xl font-bold text-red-500">0</p>
          </div>
        </div>

        {/* Proveedores Pendientes de Verificación */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Proveedores Pendientes de Verificación
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documentos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de Solicitud
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Aquí irían las filas de proveedores pendientes */}
              </tbody>
            </table>
          </div>
        </section>

        {/* Últimas Reseñas */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Últimas Reseñas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Aquí irían las tarjetas de reseñas */}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;