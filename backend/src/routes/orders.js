import { Router } from 'express';
import { body, validationResult, query, param } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const ORDER_STATUSES = ['PENDING', 'IN_PROCESS', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const creationValidations = [
  body('itemType').isIn(['SERVICE', 'PRODUCT']).withMessage('Tipo de item invalido'),
  body('itemId').isInt({ min: 1 }).withMessage('El item es obligatorio'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Las notas no pueden exceder 500 caracteres')
];

router.post('/', authRequired('USER'), creationValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { itemType, itemId, quantity = 1, notes } = req.body;

  let providerId;
  if (itemType === 'SERVICE') {
    const [[service]] = await pool.query(
      `SELECT id, provider_id FROM services WHERE id = ? AND active = 1 AND visible = 1`,
      [itemId]
    );
    if (!service) {
      return res.status(404).json({ message: 'Servicio no disponible' });
    }
    providerId = service.provider_id;
  } else {
    const [[product]] = await pool.query(
      `SELECT id, provider_id FROM products WHERE id = ? AND visible = 1`,
      [itemId]
    );
    if (!product) {
      return res.status(404).json({ message: 'Producto no disponible' });
    }
    providerId = product.provider_id;
  }

  const [result] = await pool.query(
    `INSERT INTO orders (user_id, provider_id, item_type, service_id, product_id, quantity, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)` ,
    [
      req.user.id,
      providerId,
      itemType,
      itemType === 'SERVICE' ? itemId : null,
      itemType === 'PRODUCT' ? itemId : null,
      quantity,
      notes || null
    ]
  );

  res.status(201).json({ id: result.insertId, status: 'PENDING' });
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
    filters.push('o.requested_at >= ?');
    values.push(from);
  }
  if (to) {
    filters.push('o.requested_at <= ?');
    values.push(to);
  }

  return { filters, values };
}

function ordersBaseQuery(extraFilter = '') {
  return `SELECT o.id, o.item_type AS itemType, o.status, o.quantity, o.notes,
                 o.requested_at AS requestedAt, o.updated_at AS updatedAt, o.delivery_date AS deliveryDate,
                 u.name AS buyerName, u.email AS buyerEmail,
                 p.name AS productName, s.title AS serviceTitle,
                 prov.name AS providerName, prov.company_name AS providerCompany
          FROM orders o
          JOIN users u ON u.id = o.user_id
          JOIN users prov ON prov.id = o.provider_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN services s ON s.id = o.service_id
          ${extraFilter}`;
}

router.get('/me', authRequired(['USER', 'PROVIDER']), filterValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const role = req.user.role;
  const { status, itemType, from, to } = req.query;
  const { filters, values } = buildOrderFilters({ status, itemType, from, to });

  if (role === 'USER') {
    filters.push('o.user_id = ?');
    values.push(req.user.id);
  } else {
    filters.push('o.provider_id = ?');
    values.push(req.user.id);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(`${ordersBaseQuery(where)} ORDER BY o.requested_at DESC`, values);
  res.json(rows);
});

router.get('/', authRequired(['ADMIN', 'USER']), filterValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status, itemType, from, to } = req.query;
  const { filters, values } = buildOrderFilters({ status, itemType, from, to });
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(`${ordersBaseQuery(where)} ORDER BY o.requested_at DESC`, values);
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

  await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
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
