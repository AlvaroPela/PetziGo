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
    // Validar dirección obligatoria y longitud mínima
    if (!address || (address || '').trim().length < 10) {
      setError('La dirección de entrega es obligatoria y debe tener al menos 10 caracteres');
      return;
    }

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
            const deadline = Date.now() + 10 * 60 * 1000; // 10 minutos
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
                  <div className="flex flex-col items-center justify-center text-xs text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                    </svg>
                    <div>Sin imagen</div>
                  </div>
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
                <div>
                  <label className="block text-sm font-medium">Dirección de entrega (obligatoria)</label>
                  {/* Mostrar borde y mensaje en rojo si la dirección es inválida (menos de 10 caracteres) */}
                  <Input placeholder="Calle, barrio y número" value={address} onChange={setAddress} className="w-full" error={(address || '').trim().length > 0 && (address || '').trim().length < 10 ? 'La dirección debe tener al menos 10 caracteres' : undefined} />
                  <div className={`mt-1 text-xs ${((address || '').trim().length > 0 && (address || '').trim().length < 10) ? 'text-rose-600' : 'text-slate-500'}`}>Actualmente tiene {(address || '').trim().length} caracteres. Mínimo requerido: 10</div>
                </div>
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
              <div className="flex flex-col items-center justify-center text-sm text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-violet-400 mb-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7.5 3C6.1 3 5 4.1 5 5.5S6.1 8 7.5 8 10 6.9 10 5.5 8.9 3 7.5 3zM16.5 3c-1.4 0-2.5 1.1-2.5 2.5S15.1 8 16.5 8 19 6.9 19 5.5 17.9 3 16.5 3zM12 5c-1.3 0-2.4.8-2.9 1.9C9.6 7 10.7 7.8 12 7.8s2.4-.8 2.9-1.9C14.4 5.8 13.3 5 12 5zM4 14c0-2.8 2.2-5 5-5h6c2.8 0 5 2.2 5 5v1c0 2.8-4 5-8 5s-8-2.2-8-5v-1z" />
                </svg>
                <div>Sin imagen</div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ProductPurchase;
