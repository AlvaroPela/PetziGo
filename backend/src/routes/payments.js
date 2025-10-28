import { Router } from "express";
import mercadopago from "mercadopago";
import { pool } from '../config/db.js';
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// --- MercadoPago v2 ---
// 1) Crear el cliente con tu Access Token
const mpClient = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ""
});

// 2) Usar la clase Preference para crear la preferencia
const preferenceApi = new mercadopago.Preference(mpClient);

// POST /api/payments/create-preference
// body: { title, quantity, unit_price, notification_url? }
router.post("/create-preference", async (req, res) => {
  try {
    const { title, quantity = 1, unit_price, notification_url } = req.body;

    // Validaciones mínimas
    if (!title || !unit_price) {
      return res
        .status(400)
        .json({ message: "Faltan campos: title y unit_price son obligatorios." });
    }

    // FRONTEND_URL debe apuntar a la URL pública del frontend (ej. https://mi-front.example.com)
    // BACKEND_URL debe apuntar a la URL pública del backend (ej. https://mi-back.example.com)
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL;

    if (!frontendUrl) {
      return res.status(500).json({ message: 'Server misconfiguration: FRONTEND_URL or APP_URL is not set. Set it to your frontend base URL (e.g. https://mi-front.example.com).' });
    }
    if (!backendUrl) {
      return res.status(500).json({ message: 'Server misconfiguration: BACKEND_URL or APP_URL is not set. Set it to your backend base URL (e.g. https://mi-back.example.com).' });
    }

    // Para que MercadoPago haga auto-redirect con auto_return: 'approved', back_urls.success debe ser una URL válida
    // y en producción normalmente requiere HTTPS. Validamos y damos una advertencia si no es así.
    const isFrontendHttps = /^https:\/\//i.test(frontendUrl);

    const body = {
      items: [
        {
          title: String(title),
          quantity: Number(quantity) || 1,
          currency_id: "COP",
          unit_price: Number(unit_price)
        }
      ],
      back_urls: {
        success: `${frontendUrl.replace(/\/+$/, '')}/payments/success`,
        failure: `${frontendUrl.replace(/\/+$/, '')}/payments/failure`,
        pending: `${frontendUrl.replace(/\/+$/, '')}/payments/pending`
      },
      // notification_url debe apuntar al backend para recibir webhooks
      notification_url: notification_url || `${backendUrl.replace(/\/+$/, '')}/api/payments/webhook`
    };

    // Añadir external_reference si el frontend lo envía (ej. id de la orden)
    if (req.body.external_reference) {
      body.external_reference = String(req.body.external_reference);
    }

    // Habilitar auto_return solo si FRONTEND_URL es https — evita errores de MP en entornos locales
    if (isFrontendHttps) {
      body.auto_return = 'approved';
    }

    const pref = await preferenceApi.create({ body });

    // Si el frontend pasó external_reference (id de la orden), guardar la preferencia en la orden
    try {
      if (pref && pref.id && body.external_reference) {
        const orderId = body.external_reference;
        await pool.query(
          `UPDATE orders SET mercadopago_preference_id = ?, payment_status = ? WHERE id = ?`,
          [pref.id, 'PROCESSING', orderId]
        );
      }
    } catch (dbErr) {
      console.warn('[MP] no se pudo actualizar la orden con la preferencia:', dbErr.message || dbErr);
      // no interrumpimos el flujo de preferencia por un fallo secundario en la BD
    }

    // En v2 la respuesta ya trae las propiedades en el objeto devuelto
    return res.json({
      id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
      raw: pref
    });
  } catch (e) {
    console.error("[MP create-preference] ", e);
    // Propagar mensaje de error más explícito si está disponible
    const message = e?.message || 'Error creando preferencia de pago';
    const status = e?.status || 500;
    return res.status(status).json({ message });
  }
});

// Webhook de MercadoPago (ejemplo mínimo)
// Configura esta URL en tu preferencia o en el panel de MP (modo test)
router.post("/webhook", async (req, res) => {
  try {
    // Intentamos procesar notificaciones de MercadoPago.
    // MercadoPago puede enviar distintos formatos; intentamos extraer un id de pago.
    const paymentId = req.query.id || req.body?.data?.id || req.body?.id || req.body?.collection?.id;

    if (!paymentId) {
      console.warn('[MP webhook] notificación sin id detectada, payload:', JSON.stringify(req.body).slice(0, 200));
      return res.sendStatus(200); // ACK para evitar reintentos infinitos
    }

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      console.error('[MP webhook] MP_ACCESS_TOKEN no configurado en el servidor');
      return res.sendStatus(500);
    }

    // Consultar el detalle del pago en la API de MercadoPago
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` }
    });

    if (!resp.ok) {
      console.warn('[MP webhook] fallo al consultar payment:', resp.status, await resp.text());
      return res.sendStatus(200);
    }

    const paymentData = await resp.json();
    // paymentData tiene campos: id, status, status_detail, preference_id, external_reference, etc.
    const prefId = paymentData.preference_id || paymentData.order?.preference_id;
    const externalRef = paymentData.external_reference || paymentData.order?.external_reference;
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

    // Actualizar ordenes encontradas por preference_id o por external_reference (orderId)
    try {
      if (prefId) {
        await pool.query(
          `UPDATE orders SET payment_status = ?, updated_at = NOW() ${orderStatus ? ', status = ?' : ''} WHERE mercadopago_preference_id = ?`,
          orderStatus ? [paymentStatus, orderStatus, prefId] : [paymentStatus, prefId]
        );
      }
      if (externalRef) {
        await pool.query(
          `UPDATE orders SET payment_status = ?, updated_at = NOW() ${orderStatus ? ', status = ?' : ''} WHERE id = ?`,
          orderStatus ? [paymentStatus, orderStatus, externalRef] : [paymentStatus, externalRef]
        );
      }
    } catch (dbErr) {
      console.error('[MP webhook] error actualizando orden:', dbErr.message || dbErr);
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("[MP webhook] ", e);
    res.sendStatus(500);
  }
});

export default router;

