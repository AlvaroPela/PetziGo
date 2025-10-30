import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Input, Button, Textarea } from '../../components/FormComponents';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';

const ProductPurchase = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api(`/products/${id}`);
        if (!cancelled) setProduct(data?.product || null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el producto');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!user) {
      return navigate('/login', { state: { from: location.pathname } });
    }
    if (!product) return setError('Producto inválido');
    if ((product.stock ?? 1) <= 0) return setError('Producto agotado');
    if (!quantity || Number(quantity) < 1) return setError('Cantidad inválida');

    setSubmitting(true);
    try {
      // 1) Crear orden PRODUCT
      const orderRes = await api('/orders', {
        method: 'POST',
        body: {
          itemType: 'PRODUCT',
          itemId: Number(id),
          quantity: Number(quantity) || 1,
          notes: notes || undefined,
          address: address || undefined,
        }
      });

      if (!orderRes?.id) throw new Error('No se creó la orden');

      // Guardar order id para sincronización con la pantalla de retorno
      try { localStorage.setItem('currentOrderId', String(orderRes.id)); } catch (e) { /* ignore */ }
      // Guardar resumen local del pedido para recibo offline
      try {
        const summary = {
          itemType: 'PRODUCT',
          title: product.name || `Compra #${orderRes.id}`,
          unit_price: Number(product.price) || 0,
          quantity: Number(quantity) || 1,
          total: (Number(product.price) || 0) * (Number(quantity) || 1)
        };
        localStorage.setItem(`mp_order_summary_${orderRes.id}`, JSON.stringify(summary));
      } catch (e) { /* ignore */ }

      // 2) Crear preferencia MP
      const prefBody = {
        title: product.name || `Compra #${orderRes.id}`,
        quantity: Number(quantity) || 1,
        unit_price: Number(product.price) || 0,
        external_reference: orderRes.id
      };
      const pref = await api('/payments/create-preference', { method: 'POST', body: prefBody });
      const redirectUrl = pref?.init_point || pref?.sandbox_init_point;
      if (!redirectUrl) throw new Error('No se pudo iniciar el pago');

      // 3) Abrir checkout en popup y navegar a waiting
      try {
        const popup = window.open(redirectUrl, 'mp_checkout', 'width=900,height=700');
        try {
          window.__mpPopupRef = popup;
          window.__mpCurrentOrderId = String(orderRes.id);
          localStorage.setItem(`mp_init_point_${orderRes.id}`, redirectUrl);
          const deadline = Date.now() + 1 * 60 * 1000; // 5 minutos
          localStorage.setItem(`mp_wait_deadline_${orderRes.id}`, String(deadline));
        } catch { /* ignore */ }
      } catch (openErr) {
        window.location.href = redirectUrl;
        return;
      }

      navigate(`/payments/wait?external_reference=${encodeURIComponent(orderRes.id)}`);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar la compra');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  if (error && !product) return <div className="min-h-screen flex items-center justify-center text-rose-600">Error: {error}</div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center">Producto no encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Card title={`Comprar: ${product.name}`} description={`Proveedor: ${product.provider_name || ''}`}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Cantidad" type="number" min="1" value={quantity} onChange={setQuantity} />
              <div className="sm:col-span-2">
                <Textarea label="Notas (opcional)" rows={3} value={notes} onChange={setNotes} />
              </div>
            </div>
            <Input label="Dirección de entrega (opcional)" value={address} onChange={setAddress} />
            <div className="text-sm text-slate-600">Precio unitario: ${Number(product.price).toFixed(2)}</div>
            {(product.stock ?? 1) <= 0 && <div className="text-rose-600">Producto agotado</div>}
            {error && <div className="text-rose-600">{error}</div>}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting || (product.stock ?? 1) <= 0}>{submitting ? 'Procesando…' : 'Confirmar compra'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Volver</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ProductPurchase;
