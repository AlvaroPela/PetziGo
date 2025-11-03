import { Router } from 'express';
import { pool } from '../config/db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { query, validationResult, body, param } from 'express-validator';

const router = Router();

// GET público: devuelve reseñas APPROVED. Si viene un token y es PROVIDER, muestra todas del provider.
router.get('/', optionalAuth, [
  query('minRating').optional().isInt({ min: 1, max: 5 }),
  query('maxRating').optional().isInt({ min: 1, max: 5 }),
  query('itemType').optional().isIn(['SERVICE','PRODUCT']),
  query('itemId').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { minRating, maxRating, itemType, itemId } = req.query;
  const filters = ['r.status = "APPROVED"'];
  const values = [];

  // Si el request viene autenticado y es provider, mostramos sus reseñas (incluso PENDING/REJECTED si quiere)
  const isProvider = req.user && req.user.role === 'PROVIDER';
  if (isProvider) {
    filters[0] = 'o.provider_id = ?';
    values.push(req.user.id);
  }

  if (minRating) { filters.push('r.rating >= ?'); values.push(minRating); }
  if (maxRating) { filters.push('r.rating <= ?'); values.push(maxRating); }
  if (itemType) { filters.push('o.item_type = ?'); values.push(itemType); }
  if (itemId) { if (itemType === 'SERVICE') { filters.push('o.service_id = ?'); } else { filters.push('o.product_id = ?'); } values.push(itemId); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.status, r.created_at AS createdAt,
            o.id AS orderId, o.item_type AS itemType,
            p.name AS productName, s.title AS serviceTitle,
            u.name AS userName
     FROM reviews r
     JOIN orders o ON o.id = r.order_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN products p ON p.id = o.product_id
     LEFT JOIN services s ON s.id = o.service_id
     ${where}
     ORDER BY r.created_at DESC`,
    values
  );
  res.json(rows);
});

export default router;

// Crear reseña (solo CLIENTes que hayan completado/recibido el pedido)
router.post('/', authRequired(['CLIENT']), [
  body('itemType').isIn(['SERVICE','PRODUCT']).withMessage('itemType inválido'),
  body('itemId').isInt({ min: 1 }).withMessage('itemId inválido'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating debe ser 1-5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('comment muy largo')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { itemType, itemId, rating, comment } = req.body;
  const userId = req.user.id;

  try {
    // Buscar una orden del cliente para ese item que esté completada/delivered
    const [[order]] = await pool.query(
      `SELECT id, provider_id, status FROM orders WHERE user_id = ? AND item_type = ? AND ${itemType === 'SERVICE' ? 'service_id' : 'product_id'} = ? AND status IN ('DELIVERED','COMPLETED') LIMIT 1`,
      [userId, itemType, itemId]
    );
    if (!order) return res.status(403).json({ message: 'No se encontró una orden completada para este item por este cliente' });

    // Verificar que no exista reseña previa para esta orden
    const [existing] = await pool.query('SELECT id FROM reviews WHERE order_id = ? AND client_id = ? LIMIT 1', [order.id, userId]);
    if (existing && existing.length > 0) return res.status(409).json({ message: 'Ya existe una reseña para esta orden' });

  // Insertar reseña: comportamiento de moderación configurable por env REVIEW_AUTO_APPROVE
  // Por defecto las reseñas se auto-aprueban a menos que REVIEW_AUTO_APPROVE='false'
  const autoApprove = (process.env.REVIEW_AUTO_APPROVE || 'true') !== 'false';
  const status = autoApprove ? 'APPROVED' : 'PENDING';
  const [ins] = await pool.query('INSERT INTO reviews (order_id, client_id, provider_id, rating, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', [order.id, userId, order.provider_id, rating, comment || null, status]);

  // Recalcular promedio sólo si quedó aprobada inmediatamente
  if (status === 'APPROVED') await recalcProviderRating(order.provider_id);

    const [[newRow]] = await pool.query('SELECT r.rating, r.comment, r.created_at, u.name as client_name FROM reviews r INNER JOIN users u ON u.id = r.client_id WHERE r.id = ? LIMIT 1', [ins.insertId]);
    return res.status(201).json({ review: newRow });
  } catch (err) {
    console.error('[reviews] POST error:', err);
    return res.status(500).json({ message: 'Error creando reseña' });
  }
});

// Editar reseña (cliente dueño)
router.put('/:id', authRequired(['CLIENT']), [
  param('id').isInt({ min: 1 }),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 1000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const reviewId = req.params.id;
  const userId = req.user.id;
  const { rating, comment } = req.body;
  try {
    const [[r]] = await pool.query('SELECT id, client_id, provider_id FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
    if (!r) return res.status(404).json({ message: 'Reseña no encontrada' });
    if (r.client_id !== userId) return res.status(403).json({ message: 'No autorizado' });

    const sets = [];
    const params = [];
    if (rating != null) { sets.push('rating = ?'); params.push(rating); }
    if (comment != null) { sets.push('comment = ?'); params.push(comment); }
    if (sets.length === 0) return res.status(400).json({ message: 'Nada para actualizar' });
  params.push(reviewId);
  await pool.query(`UPDATE reviews SET ${sets.join(', ')} WHERE id = ?`, params);

    // Recalcular promedio sólo si la reseña ya estaba aprobada
    const [[existingStatus]] = await pool.query('SELECT status FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
    if (existingStatus && existingStatus.status === 'APPROVED') {
      await recalcProviderRating(r.provider_id);
    }

    const [[updated]] = await pool.query('SELECT r.rating, r.comment, r.created_at, u.name as client_name FROM reviews r INNER JOIN users u ON u.id = r.client_id WHERE r.id = ? LIMIT 1', [reviewId]);
    return res.json({ review: updated });
  } catch (err) {
    console.error('[reviews] PUT error:', err);
    return res.status(500).json({ message: 'Error actualizando reseña' });
  }
});

async function recalcProviderRating(providerId) {
  try {
    const [[agg]] = await pool.query('SELECT COALESCE(AVG(rating),0) AS avgRating, COUNT(*) AS cnt FROM reviews WHERE provider_id = ? AND status = "APPROVED"', [providerId]);
    const avg = Number(agg?.avgRating || 0).toFixed(2);
    const cnt = Number(agg?.cnt || 0);
    await pool.query('UPDATE provider_profiles SET average_rating = ?, total_reviews = ? WHERE user_id = ?', [avg, cnt, providerId]);
  } catch (e) {
    console.error('[reviews] recalcProviderRating error:', e);
  }
}

// --- Admin: listar pendientes y aprobar/rechazar ---
router.get('/admin/pending', authRequired(['ADMIN']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.status, r.created_at, u.name as client_name, o.item_type, o.service_id, o.product_id, o.id as order_id
       FROM reviews r
       JOIN users u ON u.id = r.client_id
       JOIN orders o ON o.id = r.order_id
       WHERE r.status = 'PENDING' ORDER BY r.created_at ASC`);
    return res.json(rows);
  } catch (e) {
    console.error('[reviews] admin pending error', e);
    return res.status(500).json({ message: 'Error' });
  }
});

// Obtener reseñas del usuario autenticado (CLIENT) — para detectar si ya opinó
router.get('/mine', authRequired(['CLIENT']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.status, r.created_at, o.item_type, o.service_id, o.product_id
       FROM reviews r
       JOIN orders o ON o.id = r.order_id
       WHERE r.client_id = ? ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (e) {
    console.error('[reviews] GET /mine error', e);
    return res.status(500).json({ message: 'Error' });
  }
});

router.patch('/admin/:id/approve', authRequired(['ADMIN']), async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT id, provider_id, status FROM reviews WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
    if (rows[0].status === 'APPROVED') return res.status(400).json({ message: 'Ya aprobado' });
  await pool.query('UPDATE reviews SET status = ? WHERE id = ?', ['APPROVED', id]);
    // Recalcular
    await recalcProviderRating(rows[0].provider_id);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[reviews] approve error', e);
    return res.status(500).json({ message: 'Error' });
  }
});

router.patch('/admin/:id/reject', authRequired(['ADMIN']), async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT id, provider_id, status FROM reviews WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
    if (rows[0].status === 'REJECTED') return res.status(400).json({ message: 'Ya rechazado' });
  await pool.query('UPDATE reviews SET status = ? WHERE id = ?', ['REJECTED', id]);
    // Si estaba aprobado antes y ahora rechazado, recalcular
    if (rows[0].status === 'APPROVED') await recalcProviderRating(rows[0].provider_id);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[reviews] reject error', e);
    return res.status(500).json({ message: 'Error' });
  }
});
