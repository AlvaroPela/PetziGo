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
  // Dirección: si es una orden de servicio, es obligatoria y mínimo 5 caracteres; para productos es opcional
  body('address').custom((val, { req }) => {
    const itemType = (req.body?.itemType || '').toUpperCase();
    if (itemType === 'SERVICE') {
      if (!val || String(val).trim().length < 10) {
        throw new Error('La dirección es obligatoria para servicios y debe tener al menos 10 caracteres');
      }
      if (String(val).length > 255) throw new Error('La dirección debe tener como máximo 255 caracteres');
      return true;
    }
    // Para productos, si se envía validar longitud entre 3 y 255
    if (val) {
      if (String(val).trim().length < 3 || String(val).length > 255) throw new Error('La dirección debe tener entre 3 y 255 caracteres');
    }
    return true;
  }),
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
  const initialStatus = itemType === 'SERVICE' ? 'PENDING' : 'PENDING';
  const [result] = await pool.query(
    `INSERT INTO orders (user_id, provider_id, item_type, service_id, product_id, quantity, status, notes, address, service_date, pet_id, total_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      req.user.id,
      providerId,
      itemType,
      itemType === 'SERVICE' ? itemId : null,
      itemType === 'PRODUCT' ? itemId : null,
      qty,
      initialStatus,
      notes || null,
      address || null,
      service_date ? new Date(service_date) : null,
      petId || null,
      totalAmount
    ]
  );

  res.status(201).json({ id: result.insertId, status: initialStatus, paymentStatus: 'PENDING', totalAmount });
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
                 o.provider_id AS providerId,
                 u.id AS buyer_id,
                 u.name AS buyer_name,
                 u.email AS buyer_email,
                 u.phone AS buyer_phone,
                 u.address AS buyer_address,
                 u.created_at AS buyer_created_at,
                 u.updated_at AS buyer_updated_at,
                 p.id AS productId,
                 p.name AS productName,
                 p.price AS productPrice,
                 s.id AS serviceId,
                 s.title AS serviceTitle,
                 s.category AS serviceCategory,
                 s.price AS servicePrice,
                 prov.name AS providerName,
                 pp.business_description AS providerDescription,
                 pp.location_lat AS providerBaseLat,
                 pp.location_lng AS providerBaseLng,
                 pet.id AS pet_id,
                 pet.user_id AS pet_owner_id,
                 pet.name AS pet_name,
                 pet.species AS pet_species,
                 pet.breed AS pet_breed,
                 pet.birth_date AS pet_birth_date,
                 pet.special_needs AS pet_special_needs,
                 pet.photo_url AS pet_image_url,
                 pet.created_at AS pet_created_at,
                 pet.updated_at AS pet_updated_at,
                 -- owner info for the pet (may differ from order buyer)
                 pet_owner.id AS pet_owner_user_id,
                 pet_owner.name AS pet_owner_name,
                 pet_owner.email AS pet_owner_email,
                 pet_owner.phone AS pet_owner_phone
          FROM orders o
          JOIN users u ON u.id = o.user_id
          JOIN users prov ON prov.id = o.provider_id
          LEFT JOIN provider_profiles pp ON pp.user_id = o.provider_id
          LEFT JOIN products p ON p.id = o.product_id
          LEFT JOIN services s ON s.id = o.service_id
          LEFT JOIN pets pet ON pet.id = o.pet_id
          LEFT JOIN users pet_owner ON pet_owner.id = pet.user_id
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

// Obtener una orden por id (enriquecida)
router.get('/:id', authRequired(['CLIENT', 'PROVIDER', 'ADMIN']), [param('id').isInt({ min: 1 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  // Restringir acceso: cliente dueño o proveedor dueño, o admin
  if (req.user.role !== 'ADMIN') {
    const [[own]] = await pool.query('SELECT user_id, provider_id FROM orders WHERE id = ?', [id]);
    if (!own) return res.status(404).json({ message: 'Orden no encontrada' });
    if (own.user_id !== req.user.id && own.provider_id !== req.user.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }
  }
  const [rows] = await pool.query(`${ordersBaseQuery('WHERE o.id = ?')} LIMIT 1`, [id]);
  if (!rows || rows.length === 0) return res.status(404).json({ message: 'Orden no encontrada' });
  res.json(rows[0]);
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

// Registrar posición GPS del proveedor para una orden de servicio (paseo)
router.post('/:id/gps', authRequired(['PROVIDER']), [
  param('id').isInt({ min: 1 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  // Validar que la orden sea del proveedor y de tipo servicio
  const [[order]] = await pool.query(
    `SELECT o.id, o.provider_id, o.item_type, o.service_id, s.category
     FROM orders o
     LEFT JOIN services s ON s.id = o.service_id
     WHERE o.id = ?`, [id]
  );
  if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
  if (order.provider_id !== req.user.id) return res.status(403).json({ message: 'No autorizado' });
  if ((order.item_type || '').toUpperCase() !== 'SERVICE') return res.status(400).json({ message: 'La orden no es de servicio' });
  // Opcional: exigir que sea PASEO
  // if ((order.category || '').toUpperCase() !== 'PASEO') return res.status(400).json({ message: 'Solo se admite tracking para servicios de paseo' });

  await pool.query(
    'INSERT INTO gps_locations (order_id, latitude, longitude) VALUES (?, ?, ?)',
    [id, latitude, longitude]
  );
  res.status(201).json({ ok: true });
});

// Obtener últimas posiciones GPS de una orden para cliente o proveedor
router.get('/:id/gps', authRequired(['CLIENT', 'PROVIDER', 'ADMIN']), [param('id').isInt({ min: 1 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  const role = req.user.role;
  const providerIdQ = req.query.providerId ? Number(req.query.providerId) : null;

  if (role !== 'ADMIN') {
    const [[order]] = await pool.query('SELECT user_id, provider_id FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    const isOwner = order.user_id === req.user.id;
    const isProvider = order.provider_id === req.user.id;
    if (!isOwner && !isProvider) return res.status(403).json({ message: 'No autorizado' });
  }

  // Si viene providerId, responder SOLO desde gps_locations filtrando por provider_id (sin joins),
  // cumpliendo la autorización del pedido previa
  if (providerIdQ && Number.isFinite(providerIdQ) && providerIdQ > 0) {
    const [rows] = await pool.query(
      `SELECT latitude, longitude, \`timestamp\` AS at
       FROM gps_locations WHERE provider_id = ?
       ORDER BY \`timestamp\` ASC LIMIT 1000`,
      [providerIdQ]
    );
    return res.json({ points: rows.map(r => ({
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      at: r.at
    })) });
  }

  // Determinar si es servicio PASEO o no, y devolver fallback a base para no-PASEO
  const [[svcInfo]] = await pool.query(
    `SELECT o.item_type AS itemType, s.category AS serviceCategory, pp.location_lat AS baseLat, pp.location_lng AS baseLng
     FROM orders o
     LEFT JOIN services s ON s.id = o.service_id
     LEFT JOIN provider_profiles pp ON pp.user_id = o.provider_id
     WHERE o.id = ?`, [id]
  );

  const up = (x) => (x || '').toUpperCase();
  const isService = up(svcInfo?.itemType) === 'SERVICE';
  const isPaseo = up(svcInfo?.serviceCategory) === 'PASEO';

  if (isService && !isPaseo) {
    // No es paseo: intentar ubicación en vivo del proveedor; si no existe, fallback a base
    const [[live]] = await pool.query(
      `SELECT latitude, longitude, timestamp AS at FROM gps_locations WHERE provider_id = (
         SELECT provider_id FROM orders WHERE id = ?
       )`, [id]
    );
    if (live) {
      return res.json({ points: [{ latitude: Number(live.latitude), longitude: Number(live.longitude), at: live.at }] });
    }
    if (svcInfo?.baseLat != null && svcInfo?.baseLng != null) {
      return res.json({ points: [{ latitude: Number(svcInfo.baseLat), longitude: Number(svcInfo.baseLng), at: null }] });
    }
    return res.json({ points: [] });
  }

  // Paseo: devolver puntos GPS reales por orden en orden cronológico ascendente
  const [rows] = await pool.query(
    `SELECT latitude, longitude, \`timestamp\` AS at
     FROM gps_locations WHERE order_id = ?
     ORDER BY \`timestamp\` ASC LIMIT 1000`,
    [id]
  );
  res.json({ points: rows });
});

export default router;
