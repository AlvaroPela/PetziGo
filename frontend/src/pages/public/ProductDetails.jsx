import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/FormComponents';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api(`/products/${id}`);
        if (!cancelled) setProduct(data?.product || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar el producto');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleBuy = () => {
    // redirect to a purchase/checkout page (to implement)
    navigate(`/products/${id}/buy`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">Cargando producto...</div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-rose-600">Error: {error}</div>
  );

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center">Producto no encontrado</div>
  );

  const { name, description, price, stock, category, provider_name, business_description, reviews, location_lat, location_lng } = product;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <img src={product.image_url || '/placeholder.jpg'} alt={name} onError={(e) => { e.target.src = '/placeholder.jpg'; }} className="w-full h-64 object-cover rounded-lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-2">{name}</h1>
              <div className="text-sm text-slate-600 mb-4">Por: {provider_name}</div>
              <p className="text-gray-600 mb-4">{description}</p>

              {business_description && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Sobre el proveedor</h2>
                  <p className="text-sm text-slate-600">{business_description}</p>
                </div>
              )}

              <div>
                <h2 className="text-xl font-semibold mb-2">Reseñas</h2>
                {reviews && reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.map((r, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.client_name || 'Cliente'}</div>
                          <div className="text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className="text-sm text-yellow-600">★ {r.rating}</div>
                        {r.comment && <div className="text-sm text-slate-700 mt-2">{r.comment}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Aún no hay reseñas para este proveedor.</div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="sticky top-4">
                <h3 className="text-2xl font-bold mb-2">${Number(price).toFixed(2)}</h3>
                <div className="text-sm text-slate-600 mb-4">{stock > 0 ? `En stock: ${stock}` : 'Agotado'}</div>
                <Button className="w-full mb-4" variant="primary" onClick={handleBuy} disabled={stock <= 0}>Comprar</Button>
                <div className="text-sm text-gray-600">
                  <p>✓ Pago Seguro</p>
                </div>

                {(location_lat && location_lng) && (
                  <div className="mt-4 text-sm text-slate-600">
                    <div>Ubicación aproximada:</div>
                    <div>lat: {location_lat}, lng: {location_lng}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
