import { Router } from 'express';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { query, validationResult } from 'express-validator';

const router = Router();

router.get('/', authRequired(['ADMIN', 'PROVIDER']), [
  query('minRating').optional().isInt({ min: 1, max: 5 }),
  query('maxRating').optional().isInt({ min: 1, max: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { minRating, maxRating } = req.query;
  const filters = [];
  const values = [];

  if (req.user.role === 'PROVIDER') {
    filters.push('o.provider_id = ?');
    values.push(req.user.id);
  }
  if (minRating) {
    filters.push('r.rating >= ?');
    values.push(minRating);
  }
  if (maxRating) {
    filters.push('r.rating <= ?');
    values.push(maxRating);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt,
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
