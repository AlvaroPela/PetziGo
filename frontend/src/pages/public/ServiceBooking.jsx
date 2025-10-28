import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Textarea } from '../../components/FormComponents';
import { api } from '../../lib/api';

const ServiceBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api(`/services/${id}`);
        if (!cancelled) setService(data?.service || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el servicio');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!service) return setError('Servicio inválido');
    setSubmitting(true);
    try {
      const body = {
        itemType: 'SERVICE',
        itemId: Number(id),
        quantity: Number(quantity) || 1,
        notes: notes || undefined
      };

      const res = await api('/orders', { method: 'POST', body });
      // Respuesta esperada: { id: <orderId>, status: 'PENDING' }
      if (res?.id) {
        // Llevar al usuario a la página de inicio o detalles del pedido cuando exista
        navigate(`/`, { replace: true });
      } else {
        setError('Reserva creada pero sin id de pedido en la respuesta');
      }
    } catch (err) {
      setError(err.message || 'Error al crear la reserva');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (error && !service) return <div className="min-h-screen flex items-center justify-center text-rose-600">Error: {error}</div>;
  if (!service) return <div className="min-h-screen flex items-center justify-center">Servicio no encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-2">Reservar: {service.title}</h2>
          <div className="text-sm text-slate-600 mb-4">Precio: ${Number(service.price).toFixed(2)}</div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Cantidad</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-28 rounded-2xl border px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Notas (opcional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border px-3 py-2" />
            </div>

            {error && <div className="text-rose-600">{error}</div>}

            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Reservando…' : 'Confirmar reserva'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Volver</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ServiceBooking;
