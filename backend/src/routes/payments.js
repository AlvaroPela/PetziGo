import { Router } from 'express';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

const router = Router();

// Helper: sanitize base URLs
const normalizeUrl = (u) => (u || '').replace(/\/+$/, '');

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
      paymentStatus = 'COMPLETED';
      orderStatus = 'COMPLETED';
    } else if (status === 'pending') {
      paymentStatus = 'PROCESSING';
    } else {
      paymentStatus = 'FAILED';
      orderStatus = 'CANCELLED';
    }

    const prefId = paymentData.preference_id || null;
    const externalRef = paymentData.external_reference || null;

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

  let status = 'AWAITING_PAYMENT'; // user-friendly: waiting for payment evidence
    let payment = null;

    if (payments && Array.isArray(payments.results) && payments.results.length > 0) {
      payment = payments.results[0];
      const st = (payment.status || '').toLowerCase();
      if (st === 'approved' || st === 'paid') status = 'COMPLETED';
      else if (st === 'pending') status = 'PROCESSING';
      else status = 'FAILED';
    } else if (merchantOrders && Array.isArray(merchantOrders.results) && merchantOrders.results.length > 0) {
      const mo = merchantOrders.results[0];
      const moPayments = Array.isArray(mo.payments) ? mo.payments : [];
      const anyApproved = moPayments.some(p => ['approved', 'paid'].includes((p.status || '').toLowerCase()));
      if (anyApproved) status = 'COMPLETED';
      else status = moPayments.length ? 'PROCESSING' : 'NOT_FOUND';
      if (moPayments.length > 0 && !payment) payment = moPayments[0];
    }

    let dbUpdated = false;
    let dbError = null;
    if (status === 'COMPLETED') {
      try {
        const mpId = payment?.id || null;
        const prefId = payment?.preference_id || payment?.preference?.id || null;

        const sets = ['payment_status = ?', 'updated_at = NOW()'];
        const params = ['COMPLETED'];
        if (mpId) { sets.push('mercadopago_payment_id = ?'); params.push(mpId); }
        if (prefId) { sets.push('mercadopago_preference_id = ?'); params.push(prefId); }
        sets.push('status = ?'); params.push('COMPLETED');
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
    }
    const user_message = status === 'AWAITING_PAYMENT'
      ? 'No se encontró evidencia de pago. Por favor completa el pago en la ventana de MercadoPago o pulsa "Verificar pago".'
      : undefined;

    return res.json({ external_reference: orderId, status, payment, merchantOrders, dbUpdated, dbError, user_message });
  } catch (err) {
    console.error('[MP status] ', err);
    return res.status(500).json({ message: 'Error consultando estado', error: String(err) });
  }
});

export default router;

