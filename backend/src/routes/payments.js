import { Router } from "express";
import mercadopago from "mercadopago";
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
        success: `${process.env.APP_URL}/payments/success`,
        failure: `${process.env.APP_URL}/payments/failure`,
        pending: `${process.env.APP_URL}/payments/pending`
      },
      auto_return: "approved",
      notification_url:
        notification_url || `${process.env.APP_URL}/api/payments/webhook`
    };

    const pref = await preferenceApi.create({ body });

    // En v2 la respuesta ya trae las propiedades en el objeto devuelto
    return res.json({
      id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point
    });
  } catch (e) {
    console.error("[MP create-preference] ", e);
    return res.status(500).json({ message: "Error creando preferencia de pago" });
  }
});

// Webhook de MercadoPago (ejemplo mínimo)
// Configura esta URL en tu preferencia o en el panel de MP (modo test)
router.post("/webhook", async (req, res) => {
  try {
    // Aquí debes consultar el pago/merchant_order con el SDK o REST
    // y actualizar tu orden a PAID/COMPLETED según corresponda.
    // Este es un stub para tu lógica de negocio.
    res.sendStatus(200);
  } catch (e) {
    console.error("[MP webhook] ", e);
    res.sendStatus(500);
  }
});

export default router;

