import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card } from '../../components/FormComponents';
import { api } from '../../lib/api';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const PaymentsWaiting = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const orderId = query.get('external_reference') || localStorage.getItem('currentOrderId');

  const [status, setStatus] = useState('WAITING');
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [popupClosed, setPopupClosed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // segundos
  const storageKey = orderId ? `mp_payment_result_${orderId}` : null;

  useEffect(() => {
    // Listen to storage events (popup will write result here)
    function onStorage(e) {
      if (!storageKey) return;
      if (e.key === storageKey) {
        try {
          const data = JSON.parse(e.newValue);
          setInfo(data);
          setStatus(data.status || 'UNKNOWN');
          // Si la popup indicó que el pago quedó COMPLETED, llamar al backend
          // para que actualice la orden en la base de datos.
          if ((data.status || '').toUpperCase() === 'COMPLETED') {
            // Llamamos a verifyNow que consulta /api/payments/status/:orderId
            // y además persiste el resultado en localStorage.
            verifyNow();
          }
        } catch (err) {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  // Countdown de 5 minutos
  useEffect(() => {
    if (!orderId) return;
    const key = `mp_wait_deadline_${orderId}`;
    let deadline = parseInt(localStorage.getItem(key) || '0', 10);
    if (!deadline || Number.isNaN(deadline)) {
      deadline = Date.now() + 5 * 60 * 1000;
      try { localStorage.setItem(key, String(deadline)); } catch (e) { /* ignore */ }
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((deadline - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0 && status !== 'COMPLETED') {
        setStatus('TIMEOUT');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [orderId, status]);

  // Detectar si el popup se cerró antes de completar
  useEffect(() => {
    const ref = window.__mpPopupRef;
    if (!ref) return;
    const t = setInterval(() => {
      try {
        if (ref.closed && status !== 'COMPLETED') {
          setPopupClosed(true);
          clearInterval(t);
        }
      } catch (e) { /* ignore */ }
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  async function verifyNow() {
    if (!orderId) return;
    setChecking(true);
    try {
      const res = await api(`/payments/status/${encodeURIComponent(orderId)}`);
  setInfo(res);
  setStatus(res.status || 'AWAITING_PAYMENT');
      // Save to localStorage so popup/opener syncs
      try { localStorage.setItem(`mp_payment_result_${orderId}`, JSON.stringify(res)); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('verifyNow', err);
    } finally {
      setChecking(false);
    }
  }

  function Receipt({ data }) {
    if (!data) return null;
    const p = data.payment || (data.merchantOrders?.elements?.[0]?.payments?.[0]) || null;
    const payment = p && (Array.isArray(p) ? p[0] : p);
    const amount = payment?.transaction_amount ?? payment?.total_paid_amount ?? null;
    const currency = payment?.currency_id || 'COP';
    const preference = payment?.preference_id || data.merchantOrders?.elements?.[0]?.preference_id || '—';
    const moId = data.merchantOrders?.elements?.[0]?.id || '—';
    return (
      <div className="bg-white border rounded p-4 text-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-slate-500">Orden</div>
            <div className="text-lg font-semibold">{data.external_reference}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Estado</div>
            <div className={`font-bold ${data.status === 'COMPLETED' ? 'text-emerald-600' : 'text-rose-600'}`}>{data.status}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Pago ID</div>
            <div className="font-medium">{payment?.id || '—'}</div>
          </div>
          <div>
            <div className="text-slate-500">Preferencia</div>
            <div className="font-medium">{preference}</div>
          </div>
          <div>
            <div className="text-slate-500">Merchant Order</div>
            <div className="font-medium">{moId}</div>
          </div>
          <div>
            <div className="text-slate-500">Monto</div>
            <div className="font-medium">{amount ? `${amount} ${currency}` : '—'}</div>
          </div>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = Math.floor(timeLeft % 60).toString().padStart(2, '0');

  function reopenPayment() {
    if (!orderId) return;
    const url = localStorage.getItem(`mp_init_point_${orderId}`);
    if (url) {
      try {
        const w = window.open(url, 'mp_checkout', 'width=900,height=700');
        window.__mpPopupRef = w;
        setPopupClosed(false);
      } catch (e) {
        window.location.href = url;
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 pt-6 pb-10">
      <div className="w-full max-w-2xl mx-auto">
        <Card title="Esperando pago" description={`Orden: ${orderId || '—'}`}>
          <div className="space-y-4">
            {status !== 'COMPLETED' && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">La ventana de pago está abierta. Esperando confirmación...</div>
                <div className="text-sm font-medium text-slate-700">Tiempo restante: {minutes}:{seconds}</div>
              </div>
            )}
            {status !== 'COMPLETED' && (
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-4 border-t-4 border-transparent border-t-amber-500 rounded-full animate-spin" aria-hidden="true"></div>
                <div className="text-lg font-medium">{status === 'WAITING' ? 'Esperando pago...' : status}</div>
              </div>
            )}

            {popupClosed && status !== 'COMPLETED' && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">La ventana de pago se ha cerrado sin completar el pago.</div>
            )}

            {status === 'COMPLETED' && info && (
              <Receipt data={info} />
            )}
            {(status === 'NOT_FOUND' || status === 'AWAITING_PAYMENT') && (
              <div className="text-sm text-slate-600">No se ha validado el pago aún. Por favor completa el pago en la ventana emergente.</div>
            )}
            {status === 'PROCESSING' && (
              <div className="text-sm text-slate-600">Pago en proceso. Puedes verificar manualmente cuando desees.</div>
            )}
            {status === 'TIMEOUT' && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">Tiempo agotado (5 minutos). Si aún deseas pagar, reabre el checkout.</div>
            )}

            {status !== 'COMPLETED' && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={verifyNow} disabled={checking}>{checking ? 'Verificando…' : 'Verificar pago ahora'}</Button>
                <Button variant="outline" onClick={reopenPayment}>Reabrir pago</Button>
                <Button variant="outline" onClick={() => navigate('/')}>Cancelar</Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentsWaiting;
