import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Input, Button, Textarea } from '../../components/FormComponents';
import { api, assetUrl } from '../../lib/api';
import { useAuth } from '../../auth/AuthProvider';
import Modal from '../../components/Modal';

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
  const [imgModal, setImgModal] = useState({ open: false, src: null, alt: '' });

  const fmtCOP = (n) => {
    try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n||0)); } catch { return `$ ${n}`; }
  };

  const unitPrice = useMemo(() => Number(product?.price || 0), [product]);
  const qty = useMemo(() => Math.max(1, Number(quantity || 1)), [quantity]);
  const total = useMemo(() => unitPrice * qty, [unitPrice, qty]);

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
    if (!qty || qty < 1) return setError('Cantidad inválida');

    setSubmitting(true);
    try {
      // 1) Crear orden PRODUCT
      const orderRes = await api('/orders', {
        method: 'POST',
        body: {
          itemType: 'PRODUCT',
          itemId: Number(id),
          quantity: qty,
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
          unit_price: unitPrice,
          quantity: qty,
          total: unitPrice * qty
        };
        localStorage.setItem(`mp_order_summary_${orderRes.id}`, JSON.stringify(summary));
      } catch (e) { /* ignore */ }

      // 2) Crear preferencia MP
      const prefBody = {
        title: product.name || `Compra #${orderRes.id}`,
        quantity: qty,
        unit_price: unitPrice,
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
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Columna izquierda: imagen + info + campos secundarios */}
            <div className="md:col-span-8">
              <div
                className="relative mx-auto w-full md:max-w-md h-40 md:h-48 overflow-hidden rounded-xl bg-slate-50 flex items-center justify-center"
                onClick={() => { if (product.image_url) setImgModal({ open: true, src: assetUrl(product.image_url), alt: product.name }); }}
                role={product.image_url ? 'button' : undefined}
                aria-label={product.image_url ? 'Abrir imagen' : undefined}
                style={{ cursor: product.image_url ? 'zoom-in' : 'default' }}
              >
                {product.image_url ? (
                  <>
                    <img src={assetUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
                    <div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">Haz clic para ampliar</div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500">Sin imagen</div>
                )}
              </div>

              {product.description && (
                <div className="mt-3">
                  <div className="text-sm text-slate-500">Descripción</div>
                  <p className="text-sm text-slate-700">{product.description}</p>
                </div>
              )}

              {/* Campos del formulario principales (no en el panel sticky) */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Textarea label="Notas (opcional)" rows={3} value={notes} onChange={setNotes} />
                <Input label="Dirección de entrega (opcional)" value={address} onChange={setAddress} />
              </div>
            </div>

            {/* Columna derecha: panel de compra sticky */}
            <aside className="md:col-span-4">
              <div className="bg-gray-50 rounded-lg p-4 sticky top-4">
                <div className="text-sm text-slate-600">Precio unitario</div>
                <div className="text-2xl font-semibold">{fmtCOP(unitPrice)}</div>
                {typeof product.stock === 'number' && <div className="mt-1 text-xs text-slate-500">Stock: {product.stock}</div>}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">Cantidad</label>
                  <div className="mt-1 inline-flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setQuantity(q => Math.max(1, Number(q||1) - 1))} className="!px-3">-</Button>
                    <Input type="number" value={quantity} onChange={(v) => {
                      const n = Math.max(1, parseInt(v || '1', 10));
                      const max = typeof product.stock === 'number' ? Math.max(1, product.stock) : undefined;
                      setQuantity(max ? Math.min(n, max) : n);
                    }} min="1" className="w-24 text-center" />
                    <Button type="button" variant="outline" onClick={() => setQuantity(q => {
                      const current = Math.max(1, Number(q||1));
                      const next = current + 1;
                      const max = typeof product.stock === 'number' ? Math.max(1, product.stock) : undefined;
                      return max ? Math.min(next, max) : next;
                    })} className="!px-3">+</Button>
                  </div>
                  {typeof product.stock === 'number' && <div className="mt-1 text-xs text-slate-500">Máximo disponible: {product.stock}</div>}
                </div>

                <div className="mt-4 border-t pt-3 flex items-center justify-between">
                  <div className="text-sm text-slate-600">Total</div>
                  <div className="text-2xl font-semibold text-petzi">{fmtCOP(total)}</div>
                </div>

                {(product.stock ?? 1) <= 0 && <div className="mt-2 text-rose-600">Producto agotado</div>}
                {error && <div className="mt-2 text-rose-600">{error}</div>}

                <div className="mt-4 flex gap-2">
                  <Button type="submit" disabled={submitting || (product.stock ?? 1) <= 0}>{submitting ? 'Procesando…' : 'Confirmar compra'}</Button>
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>Volver</Button>
                </div>
              </div>
            </aside>
          </form>
        </Card>

        {/* Modal imagen */}
        <Modal isOpen={imgModal.open} onClose={() => setImgModal({ open: false, src: null, alt: '' })} ariaLabel="Imagen del producto">
          <div className="max-w-3xl mx-auto">
            {imgModal.src ? (
              <img src={imgModal.src} alt={imgModal.alt} className="max-h-[80vh] w-auto mx-auto rounded" />
            ) : (
              <div className="text-slate-500 text-sm">Sin imagen</div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ProductPurchase;
