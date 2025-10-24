import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';

const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api('/services');
        if (!mounted) return;
        setServices(Array.isArray(res.services) ? res.services : res.services || []);
      } catch (err) {
        console.error('ServicesPage load error:', err);
        setError(err.message || 'Error cargando servicios');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Servicios</h1>
      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map((s) => (
          <div key={s.id} className="rounded-lg border p-4 bg-white">
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm text-gray-600">{s.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-petzi">${s.price}</span>
              <Link to={`/services/${s.id}`} className="text-sm text-petzi hover:underline">Ver</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServicesPage;
