import { Router } from 'express';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { sendOrderEmails } from '../lib/mailer.js';

dotenv.config();

const router = Router();

// Helper: sanitize base URLs
const normalizeUrl = (u) => (u || '').replace(/\/+$/, '');

// Helper: consulta MP y si no hay pago aprobado, cancela orden en BD
async function checkAndCancelIfUnpaid(orderId) {
  const mpToken = process.env.MP_ACCESS_TOKEN;
  if (!mpToken) return { ok: false, cancelled: false, reason: 'MP_ACCESS_TOKEN not set' };
  try {
    const paymentsResp = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}` , {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const payments = await paymentsResp.json();

    let paid = false;
    if (payments && Array.isArray(payments.results) && payments.results.length > 0) {
      const payment = payments.results[0];
      const st = (payment.status || '').toLowerCase();
      if (st === 'approved' || st === 'paid') paid = true;
    }

    if (!paid) {
      // Marcar en BD como cancelado/failed si aún no está completada
      const [result] = await pool.query(
        `UPDATE orders SET payment_status = 'FAILED', status = 'CANCELLED', updated_at = NOW()
         WHERE id = ? AND status <> 'COMPLETED'`,
        [orderId]
      );
      return { ok: true, cancelled: result.affectedRows > 0 };
    }
    return { ok: true, cancelled: false };
  } catch (err) {
    return { ok: false, cancelled: false, reason: err?.message || String(err) };
  }
}

// POST /api/payments/create-preference
// Body: { title, quantity, unit_price, external_reference? }
router.post('/create-preference', async (req, res) => {
  try {
    const { title, quantity = 1, unit_price, external_reference } = req.body;

    if (!title || !unit_price) {
      return res.status(400).json({ message: 'Faltan campos: title y unit_price son obligatorios.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL;

    if (!frontendUrl) return res.status(500).json({ message: 'FRONTEND_URL o APP_URL no configurada en el servidor.' });
    if (!backendUrl) return res.status(500).json({ message: 'BACKEND_URL o APP_URL no configurada en el servidor.' });

    const isFrontendHttps = /^https:\/\//i.test(frontendUrl);

    const body = {
      items: [
        {
          title: String(title),
          quantity: Number(quantity) || 1,
          currency_id: 'COP',
          unit_price: Number(unit_price)
        }
      ],
      back_urls: {
        success: `${normalizeUrl(frontendUrl)}/payments/success`,
        failure: `${normalizeUrl(frontendUrl)}/payments/failure`,
        pending: `${normalizeUrl(frontendUrl)}/payments/pending`
      },
      auto_return: 'approved',
      notification_url: `${normalizeUrl(backendUrl)}/api/payments/webhook`
    };

    if (external_reference) body.external_reference = String(external_reference);

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return res.status(500).json({ message: 'MP_ACCESS_TOKEN no configurado' });

    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    // Guardar el id de preferencia en la orden si external_reference fue provisto
    try {
      if (external_reference && data && data.id) {
        await pool.query('UPDATE orders SET mercadopago_preference_id = ?, payment_status = ? WHERE id = ?', [data.id, 'PROCESSING', external_reference]);
      }
    } catch (dbErr) {
      // No interrumpimos el flujo si la DB falla aquí
      console.warn('[MP] no se pudo actualizar la orden con la preferencia:', dbErr?.message || dbErr);
    }

    // Programar un timeout de 5 minutos para cancelar la orden si no hay pago
    if (external_reference && resp.ok) {
      const orderId = String(external_reference);
      setTimeout(async () => {
        try {
          await checkAndCancelIfUnpaid(orderId);
        } catch (_) { /* ignore */ }
      }, 1 * 60 * 1000);
    }

    return res.status(resp.status).json(data);
  } catch (err) {
    console.error('[MP create-preference] ', err);
    return res.status(500).json({ message: 'Error creando preferencia', error: String(err) });
  }
});

// POST /api/payments/webhook
// Maneja notificaciones simples de MercadoPago
router.post('/webhook', async (req, res) => {
  try {
    // MercadoPago puede enviar varios payloads; intentamos extraer un payment_id o collection_id
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return res.sendStatus(200);

    // Algunos webhooks vienen con { type: 'payment', data: { id: '123' } }
    const paymentId = req.body?.data?.id || req.body?.id || req.query?.id || null;

    if (!paymentId) {
      // Nothing to do; acknowledge
      return res.sendStatus(200);
    }

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });

    if (!resp.ok) {
      return res.sendStatus(200);
    }

    const paymentData = await resp.json();

    const status = (paymentData.status || '').toLowerCase();
    let paymentStatus = 'PROCESSING';
    let orderStatus = null;
    if (status === 'approved' || status === 'paid') {
      // Pago aprobado: marcar pago COMPLETED; estado de la orden depende del tipo
      paymentStatus = 'COMPLETED';
      // orderStatus se resolverá abajo según item_type
    } else if (status === 'pending') {
      paymentStatus = 'PROCESSING';
    } else if (status === 'cancelled' || status === 'canceled') {
      // Cancelado por el usuario: dejamos payment_status como PENDING y orden CANCELLED
      paymentStatus = 'PENDING';
      orderStatus = 'CANCELLED';
    } else {
      paymentStatus = 'FAILED';
      orderStatus = 'CANCELLED';
    }

    const prefId = paymentData.preference_id || null;
    const externalRef = paymentData.external_reference || null;

    // Resolver estado objetivo según el tipo de orden (sólo para pagos aprobados)
    if ((paymentStatus || '').toUpperCase() === 'COMPLETED') {
      try {
        let row = null;
        if (externalRef) {
          const [[o]] = await pool.query('SELECT id, item_type FROM orders WHERE id = ? LIMIT 1', [externalRef]);
          row = o || null;
        }
        if (!row && prefId) {
          const [[o2]] = await pool.query('SELECT id, item_type FROM orders WHERE mercadopago_preference_id = ? LIMIT 1', [prefId]);
          row = o2 || null;
        }
        if (row && (row.item_type || '').toUpperCase() === 'SERVICE') {
          orderStatus = 'IN_PROGRESS';
        } else {
          // Para productos u otros, no forzar estado; mantener el actual
          orderStatus = null;
        }
      } catch (e) {
        // Si falla la consulta, no cambiamos el estado de la orden
        orderStatus = null;
      }
    }

    try {
      if (prefId) {
        await pool.query('UPDATE orders SET payment_status = ?, updated_at = NOW() ' + (orderStatus ? ', status = ?' : '') + (paymentData.id ? ', mercadopago_payment_id = ?' : '') + ' WHERE mercadopago_preference_id = ?',
          orderStatus ? (paymentData.id ? [paymentStatus, orderStatus, paymentData.id, prefId] : [paymentStatus, orderStatus, prefId]) : (paymentData.id ? [paymentStatus, paymentData.id, prefId] : [paymentStatus, prefId]));
      }
      if (externalRef) {
        await pool.query('UPDATE orders SET payment_status = ?, updated_at = NOW() ' + (orderStatus ? ', status = ?' : '') + (paymentData.id ? ', mercadopago_payment_id = ?' : '') + ' WHERE id = ?',
          orderStatus ? (paymentData.id ? [paymentStatus, orderStatus, paymentData.id, externalRef] : [paymentStatus, orderStatus, externalRef]) : (paymentData.id ? [paymentStatus, paymentData.id, externalRef] : [paymentStatus, externalRef]));
      }
    } catch (dbErr) {
      const msg = dbErr?.message || String(dbErr);
      console.error('[MP webhook] error actualizando orden:', msg);
      // Intentar fallback: marcar payment_status = 'PROCESSING' para que la orden quede en estado pendiente
      try {
        if (prefId) {
          await pool.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE mercadopago_preference_id = ?', ['PROCESSING', prefId]);
        }
        if (externalRef) {
          await pool.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', ['PROCESSING', externalRef]);
        }
      } catch (fallbackErr) {
        console.error('[MP webhook] fallback error marcando PROCESSING:', fallbackErr?.message || String(fallbackErr));
      }
    }

    // Enviar correos si el pago quedó COMPLETED (idempotente por marca en BD)
    try {
      if ((paymentStatus || '').toUpperCase() === 'COMPLETED') {
        if (externalRef) {
          await sendOrderEmails(externalRef);
        } else if (prefId) {
          // Buscar orderId por preference_id
          try {
            const [[o]] = await pool.query('SELECT id FROM orders WHERE mercadopago_preference_id = ? LIMIT 1', [prefId]);
            if (o?.id) await sendOrderEmails(o.id);
          } catch (_) { /* ignore */ }
        }
      }
    } catch (mailErr) {
      console.warn('[MP webhook] error enviando correos:', mailErr?.message || String(mailErr));
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[MP webhook] ', err);
    return res.sendStatus(500);
  }
});

// Endpoints de debug / apoyo
router.get('/debug/preference/:prefId', async (req, res) => {
  try {
    const { prefId } = req.params;
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return res.status(500).json({ message: 'MP_ACCESS_TOKEN no configurado' });

    const url = `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(prefId)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${mpToken}` } });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    console.error('[MP debug preference] ', err);
    return res.status(500).json({ message: 'Error consultando preferencia', error: String(err) });
  }
});

router.get('/debug/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return res.status(500).json({ message: 'MP_ACCESS_TOKEN no configurado' });

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    console.error('[MP debug payment] ', err);
    return res.status(500).json({ message: 'Error consultando pago', error: String(err) });
  }
});

router.get('/debug/search', async (req, res) => {
  try {
    const { external_reference } = req.query;
    if (!external_reference) return res.status(400).json({ message: 'external_reference es requerido' });
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return res.status(500).json({ message: 'MP_ACCESS_TOKEN no configurado' });

    const paymentsResp = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(external_reference)}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const payments = await paymentsResp.json();

    const moResp = await fetch(`https://api.mercadopago.com/merchant_orders/search?external_reference=${encodeURIComponent(external_reference)}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const merchantOrders = await moResp.json();

    return res.json({ payments, merchantOrders });
  } catch (err) {
    console.error('[MP debug search] ', err);
    return res.status(500).json({ message: 'Error en búsqueda', error: String(err) });
  }
});

// GET /api/payments/status/:orderId
// Devuelve un resumen simple del estado del pago/merchant_order buscando por external_reference
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ message: 'orderId es requerido en la ruta' });

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return res.status(500).json({ message: 'MP_ACCESS_TOKEN no configurado' });

    const paymentsResp = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const payments = await paymentsResp.json();

    const moResp = await fetch(`https://api.mercadopago.com/merchant_orders/search?external_reference=${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const merchantOrders = await moResp.json();

  let status = 'AWAITING_PAYMENT'; // estado lógico para UI
    let payment = null;

    if (payments && Array.isArray(payments.results) && payments.results.length > 0) {
      payment = payments.results[0];
  const st = (payment.status || '').toLowerCase();
  if (st === 'approved' || st === 'paid') status = 'COMPLETED';
  else if (st === 'pending') status = 'PROCESSING';
  else if (st === 'cancelled' || st === 'canceled') status = 'CANCELLED';
  else status = 'FAILED';
    } else if (merchantOrders && Array.isArray(merchantOrders.results) && merchantOrders.results.length > 0) {
      const mo = merchantOrders.results[0];
      const moPayments = Array.isArray(mo.payments) ? mo.payments : [];
      const anyApproved = moPayments.some(p => ['approved', 'paid'].includes((p.status || '').toLowerCase()));
      if (anyApproved) status = 'COMPLETED';
      else status = moPayments.length ? 'PROCESSING' : 'NOT_FOUND';
      if (moPayments.length > 0 && !payment) payment = moPayments[0];
    }
    // Enviar correos si se completó
    if (status === 'COMPLETED') {
      try { await sendOrderEmails(orderId); } catch (mailErr) { console.warn('[MP status] error enviando correos:', mailErr?.message || String(mailErr)); }
    }

    let dbUpdated = false;
    let dbError = null;
    if (status === 'COMPLETED') {
      try {
        const mpId = payment?.id || null;
        const prefId = payment?.preference_id || payment?.preference?.id || null;

        const sets = ['payment_status = ?', 'updated_at = NOW()'];
        const params = ['COMPLETED'];
        // Determinar si debemos cambiar el estado de la orden según item_type
        let desiredOrderStatus = null;
        try {
          const [[o]] = await pool.query('SELECT item_type FROM orders WHERE id = ? LIMIT 1', [orderId]);
          const itemType = (o?.item_type || '').toUpperCase();
          if (itemType === 'SERVICE') {
            desiredOrderStatus = 'IN_PROGRESS';
          }
        } catch (_) { /* ignore */ }
        if (desiredOrderStatus) { sets.push('status = ?'); params.push(desiredOrderStatus); }
        if (mpId) { sets.push('mercadopago_payment_id = ?'); params.push(mpId); }
        if (prefId) { sets.push('mercadopago_preference_id = ?'); params.push(prefId); }
        params.push(orderId);

        const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`;
        await pool.query(sql, params);
        dbUpdated = true;
      } catch (dbErrInner) {
        dbError = dbErrInner?.message || String(dbErrInner);
        dbUpdated = false;
        console.error('[MP status] error actualizando orden en BD:', dbError);
        // Intentar fallback: marcar payment_status = 'PROCESSING' para no dejar la orden en un estado inconsistente
        try {
          await pool.query('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', ['PROCESSING', orderId]);
        } catch (fallbackErr) {
          console.error('[MP status] fallback error marcando PROCESSING:', fallbackErr?.message || String(fallbackErr));
        }
      }
    } else if (status === 'CANCELLED') {
      try {
        const sets = ['payment_status = ?', 'status = ?', 'updated_at = NOW()'];
        const params = ['PENDING', 'CANCELLED', orderId];
        const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`;
        await pool.query(sql, params);
        dbUpdated = true;
      } catch (dbErrInner) {
        dbError = dbErrInner?.message || String(dbErrInner);
        dbUpdated = false;
        console.error('[MP status] error actualizando orden CANCELLED:', dbError);
      }
    }
    const user_message = status === 'AWAITING_PAYMENT'
      ? 'Aún no registramos tu pago. Completa el pago en la ventana de MercadoPago o verifica más tarde.'
      : status === 'CANCELLED'
      ? 'El pago fue cancelado. Puedes iniciar nuevamente cuando quieras.'
      : undefined;

    return res.json({ external_reference: orderId, status, payment, merchantOrders, dbUpdated, dbError, user_message });
  } catch (err) {
    console.error('[MP status] ', err);
    return res.status(500).json({ message: 'Error consultando estado', error: String(err) });
  }
});

// POST /api/payments/timeout-cancel/:orderId
// Cancela la orden si tras 5 minutos no tiene pago aprobado
router.post('/timeout-cancel/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ message: 'orderId es requerido' });
    const result = await checkAndCancelIfUnpaid(orderId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Error al cancelar por timeout', error: String(err) });
  }
});

export default router;

