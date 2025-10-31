import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/FormComponents';
import { useParams, useNavigate } from 'react-router-dom';
import { api, assetUrl } from '../../lib/api';
import Modal from '../../components/Modal';

const ServiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api(`/services/${id}`);
        if (!cancelled) {
          setService(data?.service || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar el servicio');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleReserve = () => {
    // Redirigir a ruta de reserva/checkout. Si no existe, lleva a una página placeholder.
    navigate(`/services/${id}/book`);
  };

  // Hooks antes de cualquier retorno condicional para cumplir reglas de React
  const fmtPrice = useMemo(() => {
    const p = service?.price;
    try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(p||0)); } catch { return `$ ${p}`; }
  }, [service?.price]);

  const [showImage, setShowImage] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-600">Cargando servicio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-rose-600">Error: {error}</div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-600">Servicio no encontrado</div>
      </div>
    );
  }

  const { title, description, price, provider_name, business_description, location_lat, location_lng, reviews = [], image_url, category, average_rating, total_reviews } = service;

  function RatingStars({ value = 0, size = 'text-base' }) {
    const v = Math.max(0, Math.min(5, Number(value || 0)));
    const full = Math.floor(v);
    const half = v - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return (
      <div className={`flex items-center gap-0.5 ${size}`} aria-label={`Rating ${v}`}>
        {Array.from({ length: full }).map((_, i) => <span key={`f-${i}`} className="text-amber-500">★</span>)}
        {half && <span className="text-amber-500">☆</span>}
        {Array.from({ length: empty }).map((_, i) => <span key={`e-${i}`} className="text-gray-300">★</span>)}
        <span className="ml-1 text-xs text-gray-500">{v.toFixed(1)}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mx-auto max-w-4xl">
          {/* Imagen del servicio */}
          <div className="mb-6">
            <div className="relative mx-auto w-full max-w-2xl h-80 md:h-96 overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center cursor-pointer" onClick={() => image_url && setShowImage(true)}>
              {image_url ? (
                <img src={assetUrl(image_url)} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-500 text-sm">Sin imagen</div>
              )}
              {image_url && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white text-[11px] px-2 py-1 pointer-events-none select-none">
                  Haz clic para ampliar
                </div>
              )}
            </div>
          </div>

          {/* Información del servicio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-start justify-between">
                <h1 className="text-3xl font-bold mb-2">{title}</h1>
                <span className="ml-2 inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">{category}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 mb-4">
                <span>Por: {provider_name}</span>
                {typeof average_rating !== 'undefined' && (
                  <div className="flex items-center gap-2">
                    <RatingStars value={average_rating} size="text-sm" />
                    <span className="text-xs text-slate-500">({total_reviews || 0})</span>
                  </div>
                )}
              </div>
              <p className="text-gray-600 mb-4">{description}</p>

              {business_description && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Sobre el proveedor</h2>
                  <p className="text-sm text-slate-600">{business_description}</p>
                </div>
              )}

              {/* Características (si existen como arreglo) */}
              {service.features && Array.isArray(service.features) && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">Características</h2>
                  <ul className="list-disc list-inside">
                    {service.features.map((f, idx) => <li key={idx}>{f}</li>)}
                  </ul>
                </div>
              )}

              {/* Reseñas */}
              <div>
                <h2 className="text-xl font-semibold mb-2">Reseñas</h2>
                {reviews && reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((r, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.client_name || 'Cliente'}</div>
                          <div className="text-sm text-slate-500">{new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className="mt-1">
                          <RatingStars value={r.rating} size="text-sm" />
                        </div>
                        {r.comment && <div className="text-sm text-slate-700 mt-2">{r.comment}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Aún no hay reseñas para este proveedor.</div>
                )}
              </div>
            </div>

            {/* Panel de reserva */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="sticky top-4">
                <h3 className="text-2xl font-bold mb-2">{fmtPrice}</h3>
                <Button className="w-full mb-4" variant="primary" onClick={handleReserve}>Reservar Ahora</Button>
                <div className="text-sm text-gray-600">
                  <p>✓ Reserva Instantánea</p>
                  <p>✓ Garantía de Servicio</p>
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
        <Modal isOpen={showImage} onClose={() => setShowImage(false)} ariaLabel="Imagen del servicio">
          <div className="max-w-3xl mx-auto">
            {image_url ? (
              <img src={assetUrl(image_url)} alt={title} className="w-full h-auto rounded" />
            ) : (
              <div className="text-slate-500 text-sm">Sin imagen</div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ServiceDetails;