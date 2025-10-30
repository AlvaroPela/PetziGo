import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card } from '../../components/FormComponents';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const PaymentsResult = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const [status, setStatus] = useState('LOADING');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [checking] = useState(false);
  const pollingRef = useRef({ attempts: 0, timer: null });

  const orderId = query.get('external_reference') || query.get('external_reference'.toString()) || localStorage.getItem('currentOrderId');

  useEffect(() => {
    // No llamamos al backend aquí. Sólo usamos los parámetros de la URL para
    // construir un resultado mínimo, lo guardamos y cerramos esta ventana.
    const params = new URLSearchParams(window.location.search);
    const extRef = params.get('external_reference') || orderId;
    if (!extRef) {
      setStatus('NOT_FOUND');
      setError('No se encontró external_reference en la URL ni en localStorage');
      return;
    }

    const mpStatus = (params.get('status') || params.get('collection_status') || '').toLowerCase();
    const mapped = mpStatus === 'approved' ? 'COMPLETED' : mpStatus === 'pending' ? 'PROCESSING' : mpStatus ? 'FAILED' : 'UNKNOWN';
    const paymentId = params.get('payment_id') || params.get('collection_id') || null;
    const preferenceId = params.get('preference_id') || null;
    const merchantOrderId = params.get('merchant_order_id') || null;

    const res = {
      external_reference: extRef,
      status: mapped,
      payment: paymentId ? { id: paymentId, status: mpStatus || undefined, preference_id: preferenceId || undefined } : null,
      merchantOrders: merchantOrderId ? { elements: [{ id: merchantOrderId, preference_id: preferenceId || undefined }], total: 1 } : { elements: [], total: 0 }
    };

    setInfo(res);
    setStatus(res.status || 'UNKNOWN');

    try {
      localStorage.setItem(`mp_payment_result_${extRef}`, JSON.stringify(res));
    } catch (e) { /* ignore */ }

    try {
      if (window && window.opener && window.opener !== window) {
        try { window.opener.postMessage({ type: 'mp_payment_result', orderId: extRef, payload: res }, '*'); } catch (e) { /* ignore */ }
        // cerrar siempre que tengamos un estado conocido (incluye COMPLETED/FAILED/PROCESSING)
        setTimeout(() => { try { window.close(); } catch (e) {} }, 200);
      }
    } catch (e) { /* ignore */ }

    return () => {
      if (pollingRef.current.timer) clearTimeout(pollingRef.current.timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No usamos verificación manual en esta vista; la lógica es sólo persistir y cerrar.

  function onManualVerify() {
    // NOP en la ventana de retorno (popup). Mantener por compatibilidad del layout.
  }

  function Receipt({ data }) {
    if (!data) return null;
    const p = data.payment || data.payments || null;
    const payment = p && (Array.isArray(p) ? p[0] : p);
    const amount = payment?.transaction_amount ?? (payment?.transaction_details?.total_paid_amount ?? null);
    const payer = payment?.payer || (payment?.payer ? `${payment.payer?.first_name || ''} ${payment.payer?.last_name || ''}` : null);
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

        {payment ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-500">Pago ID</div>
              <div className="font-medium">{payment.id}</div>
            </div>
            <div>
              <div className="text-slate-500">Preferencia</div>
              <div className="font-medium">{payment.preference_id || payment.preference?.id || data.preference_id || '—'}</div>
            </div>

            <div>
              <div className="text-slate-500">Monto</div>
              <div className="font-medium">{amount ? `${amount} ${payment.currency_id || 'COP'}` : '—'}</div>
            </div>
            <div>
              <div className="text-slate-500">Fecha</div>
              <div className="font-medium">{payment.date_approved || payment.date_created || '—'}</div>
            </div>

            <div className="col-span-2">
              <div className="text-slate-500">Payer</div>
              <div className="font-medium">{payer || JSON.stringify(payment?.payer || {})}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No hay detalles del pago en la respuesta.</div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center text-slate-600">
        <div className="text-sm">Procesando retorno de pago… esta ventana se cerrará automáticamente.</div>
      </div>
    </div>
  );
};

export default PaymentsResult;
