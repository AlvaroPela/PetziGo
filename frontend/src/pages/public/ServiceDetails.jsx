import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/FormComponents';
import { useParams, useNavigate } from 'react-router-dom';
import { api, assetUrl } from '../../lib/api';
import Modal from '../../components/Modal';
import { useAuth } from '../../auth/AuthProvider';

const ServiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  // Cargar reseña del usuario si es CLIENT
  useEffect(() => {
    if (!user || user.role !== 'CLIENT' || !service) return;
    let cancelled = false;
    async function loadMine() {
      setLoadingMyReview(true);
      try {
        const mine = await api('/reviews/mine');
        if (cancelled) return;
        const found = (mine || []).find(r => r.item_type === 'SERVICE' && Number(r.service_id) === Number(service.id));
        if (found) {
          setMyReview(found);
          setEditingReviewId(found.id);
          setFormRating(found.rating);
          setFormComment(found.comment || '');
        } else {
          setMyReview(null);
          setEditingReviewId(null);
        }
      } catch (err) {
        console.error('Error cargando mis reseñas', err);
      } finally {
        if (!cancelled) setLoadingMyReview(false);
      }
    }
    loadMine();
    return () => { cancelled = true; };
  }, [user, service]);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [myReview, setMyReview] = useState(null);
  const [loadingMyReview, setLoadingMyReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [editingReviewId, setEditingReviewId] = useState(null);

  const handleReserve = () => {
    // Si el usuario autenticado es PROVIDER, mostrar modal indicándole crear cuenta de CLIENT
    if (user && user.role === 'PROVIDER') {
      setShowRoleModal(true);
      return;
    }
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

  const { title, description, price, provider_name, business_description, location_lat, location_lng, city, reviews = [], image_url, category, average_rating, total_reviews } = service;

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
                <div className="flex flex-col items-center justify-center text-xs text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                  </svg>
                  <div>Sin imagen</div>
                </div>
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
                <span>Por: {provider_name} <button onClick={() => setShowProviderModal(true)} className="ml-2 text-violet-600 text-sm underline">Ver proveedor</button></span>
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
                {/* Formulario de reseña para clientes */}
                {user && user.role === 'CLIENT' && (
                  <div className="mb-4">
                    {myReview ? (
                      <div className="mb-2">
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-slate-600">Tu reseña existente:</div>
                          {myReview?.status === 'PENDING' ? (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Tu reseña · pendiente</span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Tu reseña</span>
                          )}
                        </div>
                        <div className="border rounded-md p-2 mt-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">Tu</div>
                            <div className="text-sm text-slate-500">{new Date(myReview.created_at).toLocaleDateString()}</div>
                          </div>
                          <div className="mt-1"><RatingStars value={myReview.rating} size="text-sm" /></div>
                          {myReview.comment && <div className="text-sm text-slate-700 mt-2">{myReview.comment}</div>}
                          <div className="mt-2 flex gap-2">
                            <button className="px-3 py-1 rounded bg-violet-600 text-white text-sm" onClick={() => setShowReviewForm(true)}>Editar</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2">
                        <button className="px-3 py-1 rounded bg-violet-600 text-white text-sm" onClick={() => { setShowReviewForm(true); setFormRating(5); setFormComment(''); setEditingReviewId(null); }}>{loadingMyReview ? 'Cargando...' : 'Escribir reseña'}</button>
                      </div>
                    )}
                    {showReviewForm && (
                      <div className="border rounded-md p-3 bg-white mt-2">
                        <div className="mb-2">Califica</div>
                        <div className="flex items-center gap-2 mb-3">
                          {[5,4,3,2,1].map(v => (
                            <button key={v} onClick={() => setFormRating(v)} className={`px-2 py-1 rounded ${formRating===v? 'bg-amber-300' : 'bg-gray-100'}`}>{v} ★</button>
                          ))}
                        </div>
                        <textarea className="w-full border p-2 rounded mb-3" rows={4} value={formComment} onChange={e => setFormComment(e.target.value)} placeholder="Cuenta tu experiencia... (opcional)" />
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            try {
                              if (editingReviewId) {
                                await api(`/reviews/${editingReviewId}`, { method: 'PUT', body: { rating: formRating, comment: formComment } });
                              } else {
                                await api('/reviews', { method: 'POST', body: { itemType: 'SERVICE', itemId: service.id, rating: formRating, comment: formComment } });
                              }
                              // recargar servicio para actualizar lista
                              const d = await api(`/services/${service.id}`);
                              setService(d.service || service);
                              setShowReviewForm(false);
                            } catch (err) {
                              console.error('Error enviando reseña', err);
                              alert(err?.message || 'Error al enviar reseña');
                            }
                          }} className="px-3 py-1 rounded bg-green-600 text-white">Enviar</button>
                          <button onClick={() => setShowReviewForm(false)} className="px-3 py-1 rounded bg-gray-100">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                <Button className="w-full mb-4 bg-gradient-to-r from-violet-500 to-violet-400 text-white shadow-sm hover:from-violet-600 hover:to-violet-500 transition" variant="primary" onClick={handleReserve}>Reservar Ahora</Button>
                <div className="text-sm text-gray-600">
                  <p>✓ Reserva Instantánea</p>
                  <p>✓ Garantía de Servicio</p>
                  <p>✓ Pago Seguro</p>
                </div>

                {(city || (location_lat && location_lng)) && (
                  <div className="mt-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 2a5 5 0 00-5 5c0 4.418 5 11 5 11s5-6.582 5-11a5 5 0 00-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" clipRule="evenodd" />
                      </svg>
                      <span>Ubicación aproximada:</span>
                    </div>
                    {city ? (
                      <div>{city}</div>
                    ) : (
                      <div>lat: {location_lat}, lng: {location_lng}</div>
                    )}
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
              <div className="flex flex-col items-center justify-center text-sm text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                </svg>
                <div>Sin imagen</div>
              </div>
            )}
          </div>
        </Modal>
        <Modal isOpen={showProviderModal} onClose={() => setShowProviderModal(false)} ariaLabel="Información del proveedor">
          <div className="max-w-xl mx-auto p-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {/* Avatar: usar provider_avatar si existe, si no iniciales */}
                  {(service?.provider_avatar || service?.provider_image_url) ? (
                    <img src={assetUrl(service.provider_avatar || service.provider_image_url)} alt={provider_name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-xl font-semibold">{(provider_name || 'P').split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="truncate">
                      <h3 className="text-lg font-semibold truncate">{provider_name || 'Proveedor'}</h3>
                      <div className="text-sm text-gray-500 truncate mt-0.5">{service?.provider_title || ''}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {/* Badge verificado si viene */}
                      {service?.provider_verified && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Verificado</span>}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">{business_description || 'No hay descripción del proveedor.'}</div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <div><strong className="text-sm">{(average_rating || 0).toFixed ? (average_rating || 0).toFixed(1) : (average_rating || 0)}</strong></div>
                          <div className="text-xs text-gray-500">({total_reviews || 0})</div>
                        </div>
                        <div className="mt-1"><span className="text-xs text-gray-500">Calificación</span></div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                        {service?.provider_email && <div><span className="font-semibold">Email:</span> <a className="font-semibold text-violet-600 underline" href={`mailto:${service.provider_email}`}>{service.provider_email}</a></div>}
                        {service?.provider_phone && <div><span className="font-semibold">Teléfono:</span> <span className="font-semibold">{service.provider_phone}</span></div>}
                      </div>
                  </div>

                  {(city || (location_lat && location_lng)) && (
                    <div className="mt-3 text-sm text-gray-600">
                      {city ? (
                        <div><span className="font-semibold">Ciudad:</span> <span className="font-semibold">{city}</span></div>
                      ) : (
                        <a className="underline text-sm text-gray-700" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${location_lat},${location_lng}`}>Ver ubicación en mapa</a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                {service?.provider_email && (
                  <a href={`mailto:${service.provider_email}`} className="px-4 py-2 border rounded">Contactar</a>
                )}
                <button onClick={() => setShowProviderModal(false)} className="px-4 py-2 rounded bg-gray-100">Cerrar</button>
              </div>
            </div>
          </div>
        </Modal>
        <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} ariaLabel="Solo clientes pueden reservar">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Solo clientes pueden reservar</h2>
            <p className="text-sm text-slate-600 mb-4">Los proveedores no pueden reservar ni comprar desde su cuenta. Por favor crea una cuenta como Cliente para continuar.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setShowRoleModal(false); navigate('/register'); }} className="px-4 py-2 rounded bg-violet-700 text-white">Crear cuenta de cliente</button>
              <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 rounded bg-gray-200">Cerrar</button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ServiceDetails;