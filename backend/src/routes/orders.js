import { Router } from 'express';
import { body, validationResult, query, param } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
// Estados válidos según schema.sql
const ORDER_STATUSES = ['CREATED','PENDING','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED','DELIVERED'];

const creationValidations = [
  body('itemType').isIn(['SERVICE', 'PRODUCT']).withMessage('Tipo de item invalido'),
  body('itemId').isInt({ min: 1 }).withMessage('El item es obligatorio'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Las notas no pueden exceder 500 caracteres'),
  body('address').optional().isLength({ min: 3, max: 255 }).withMessage('La dirección debe tener entre 3 y 255 caracteres'),
  // fecha y mascota para reservas de servicios
  body('service_date').optional().isISO8601().withMessage('service_date debe ser una fecha ISO8601'),
  body('petId').optional().isInt({ min: 1 }).withMessage('petId debe ser un entero')
];

router.post('/', authRequired('CLIENT'), creationValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { itemType, itemId, quantity = 1, notes, service_date, petId, address } = req.body;

  let providerId;
  let unitPrice = 0;
  if (itemType === 'SERVICE') {
    const [[service]] = await pool.query(
      `SELECT id, provider_id, price FROM services WHERE id = ? AND active = 1`,
      [itemId]
    );
    if (!service) {
      return res.status(404).json({ message: 'Servicio no disponible' });
    }
    providerId = service.provider_id;
    unitPrice = Number(service.price) || 0;
  } else {
    const [[product]] = await pool.query(
      `SELECT id, provider_id, price FROM products WHERE id = ?`,
      [itemId]
    );
    if (!product) {
      return res.status(404).json({ message: 'Producto no disponible' });
    }
    providerId = product.provider_id;
    unitPrice = Number(product.price) || 0;
  }

  // Si es una reserva de servicio con fecha, validar que no sea en el pasado y que no haya otra reserva en la misma fecha/hora para el mismo proveedor
  if (itemType === 'SERVICE' && service_date) {
    const parsed = new Date(service_date);
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ message: 'service_date inválida' });
    }
    const now = new Date();
    if (parsed.getTime() < now.getTime()) {
      return res.status(400).json({ message: 'No se puede reservar en una fecha pasada' });
    }

    // Comprobación básica: no permitir otra orden con la misma service_date para el mismo proveedor y estado activo
    const [existing] = await pool.query(
      `SELECT id FROM orders WHERE provider_id = ? AND service_date = ? AND status IN ('PENDING','ACCEPTED','IN_PROGRESS') LIMIT 1`,
      [providerId, parsed]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'El proveedor ya tiene una reserva en esa fecha/hora' });
    }
  }

  // Calcular total
  const qty = Number(quantity) || 1;
  const totalAmount = unitPrice * qty;

  // Insertamos la orden incluyendo campos opcionales de reserva (service_date, pet_id) y total_amount
  const [result] = await pool.query(
    `INSERT INTO orders (user_id, provider_id, item_type, service_id, product_id, quantity, status, notes, address, service_date, pet_id, total_amount)
     VALUES (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?, ?, ?)` ,
    [
      req.user.id,
      providerId,
      itemType,
      itemType === 'SERVICE' ? itemId : null,
      itemType === 'PRODUCT' ? itemId : null,
      qty,
      notes || null,
      address || null,
      service_date ? new Date(service_date) : null,
      petId || null,
      totalAmount
    ]
  );

  res.status(201).json({ id: result.insertId, status: 'PENDING', totalAmount });
});

const filterValidations = [
  query('status').optional().isIn(ORDER_STATUSES),
  query('itemType').optional().isIn(['SERVICE', 'PRODUCT']),
  query('from').optional().isISO8601().toDate(),
  query('to').optional().isISO8601().toDate()
];

function buildOrderFilters({ status, itemType, from, to }) {
  const filters = [];
  const values = [];

  if (status) {
    filters.push('o.status = ?');
    values.push(status);
  }
  if (itemType) {
    filters.push('o.item_type = ?');
    values.push(itemType);
  }
  if (from) {
    filters.push('o.created_at >= ?');
    values.push(from);
  }
  if (to) {
    filters.push('o.created_at <= ?');
    values.push(to);
  }

  return { filters, values };
}

function ordersBaseQuery(extraFilter = '') {
  return `SELECT o.id,
                 o.item_type AS itemType,
                 o.status,
                 o.quantity,
                 o.notes,
                 o.created_at AS requestedAt,
                 o.updated_at AS updatedAt,
                 o.delivered_at AS deliveredAt,
                 o.address,
                 o.service_date AS serviceDate,
                 o.total_amount AS totalAmount,
                 o.payment_status AS paymentStatus,
                 o.mercadopago_preference_id AS mpPreferenceId,
                 o.mercadopago_payment_id AS mpPaymentId,
                 u.name AS buyerName,
                 u.email AS buyerEmail,
                 p.id AS productId,
                 p.name AS productName,
                 p.price AS productPrice,
                 s.id AS serviceId,
                 s.title AS serviceTitle,
                 s.price AS servicePrice,
                 prov.name AS providerName,
                 pp.business_description AS providerDescription,
                 pet.id AS petId,
                 pet.name AS petName
          FROM orders o
          JOIN users u ON u.id = o.user_id
          JOIN users prov ON prov.id = o.provider_id
          LEFT JOIN provider_profiles pp ON pp.user_id = o.provider_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN services s ON s.id = o.service_id
          LEFT JOIN pets pet ON pet.id = o.pet_id
          ${extraFilter}`;
}

router.get('/me', authRequired(['CLIENT', 'PROVIDER']), filterValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const role = req.user.role;
  const { status, itemType, from, to } = req.query;
  const { filters, values } = buildOrderFilters({ status, itemType, from, to });

  if (role === 'CLIENT') {
    filters.push('o.user_id = ?');
    values.push(req.user.id);
  } else {
    filters.push('o.provider_id = ?');
    values.push(req.user.id);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(`${ordersBaseQuery(where)} ORDER BY o.created_at DESC`, values);
  res.json(rows);
});

router.get('/', authRequired(['ADMIN', 'CLIENT']), filterValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status, itemType, from, to } = req.query;
  const { filters, values } = buildOrderFilters({ status, itemType, from, to });
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(`${ordersBaseQuery(where)} ORDER BY o.created_at DESC`, values);
  res.json(rows);
});

router.patch('/:id/status', authRequired(['PROVIDER', 'ADMIN']), [
  param('id').isInt({ min: 1 }),
  body('status').isIn(ORDER_STATUSES)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { status } = req.body;

  const [[order]] = await pool.query('SELECT id, provider_id, status FROM orders WHERE id = ?', [id]);
  if (!order) {
    return res.status(404).json({ message: 'Pedido no encontrado' });
  }
  if (req.user.role === 'PROVIDER' && order.provider_id !== req.user.id) {
    return res.status(403).json({ message: 'No autorizado a gestionar este pedido' });
  }
  if (order.status === status) {
    return res.json({ ok: true, status });
  }

  // Si se marca como DELIVERED, setear delivered_at
  if (status === 'DELIVERED') {
    await pool.query('UPDATE orders SET status = ?, delivered_at = NOW(), updated_at = NOW() WHERE id = ?', [status, id]);
  } else {
    await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
  }
  await pool.query(
    `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
     VALUES (?, ?, ?, ?)` ,
    [id, order.status, status, req.user.id]
  );
  res.json({ ok: true, status });
});

router.get('/:id/history', authRequired(['PROVIDER', 'ADMIN']), [param('id').isInt({ min: 1 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  if (req.user.role === 'PROVIDER') {
    const [[order]] = await pool.query('SELECT provider_id FROM orders WHERE id = ?', [id]);
    if (!order || order.provider_id !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }
  }
  const [rows] = await pool.query(
    `SELECT old_status AS oldStatus, new_status AS newStatus, changed_at AS changedAt, changed_by AS changedBy
     FROM order_status_history WHERE order_id = ? ORDER BY changed_at DESC`,
    [id]
  );
  res.json(rows);
});

export default router;
