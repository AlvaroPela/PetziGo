import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { body, param, validationResult, query } from 'express-validator';

const router = Router();
const DOCUMENT_TYPES = ['IDENTIFICATION', 'LEGAL', 'BANK', 'OTHER'];
const DOCUMENT_STATUSES = ['REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

router.get('/me', authRequired(['PROVIDER', 'ADMIN']), async (req, res) => {
  let userId = req.user.id;
  if (req.user.role === 'ADMIN') {
    userId = Number(req.query.userId) || userId;
  }
  const [rows] = await pool.query(
    `SELECT id, document_type AS documentType, status, file_url AS fileUrl, observations,
            requested_at AS requestedAt, submitted_at AS submittedAt, reviewed_at AS reviewedAt
     FROM user_documents WHERE user_id = ? ORDER BY requested_at DESC`,
    [userId]
  );
  res.json(rows);
});

router.post('/', authRequired('PROVIDER'), [
  body('documentType').isIn(DOCUMENT_TYPES).withMessage('Tipo de documento invalido'),
  body('fileUrl').trim().isLength({ min: 5 }).withMessage('La URL del documento es obligatoria'),
  body('observations').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { documentType, fileUrl, observations } = req.body;
  const [result] = await pool.query(
    `INSERT INTO user_documents (user_id, document_type, status, file_url, observations, submitted_at)
     VALUES (?, ?, 'SUBMITTED', ?, ?, NOW())` ,
    [req.user.id, documentType, fileUrl, observations || null]
  );
  await pool.query('UPDATE users SET documents_status = ?, updated_at = NOW() WHERE id = ?', ['SUBMITTED', req.user.id]);
  res.status(201).json({ id: result.insertId, status: 'SUBMITTED' });
});

router.get('/', authRequired('ADMIN'), [
  query('status').optional().isIn(DOCUMENT_STATUSES),
  query('userId').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { status, userId } = req.query;
  const filters = [];
  const values = [];
  if (status) {
    filters.push('d.status = ?');
    values.push(status);
  }
  if (userId) {
    filters.push('d.user_id = ?');
    values.push(userId);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT d.id, d.user_id AS userId, d.document_type AS documentType, d.status, d.file_url AS fileUrl,
            d.observations, d.requested_at AS requestedAt, d.submitted_at AS submittedAt, d.reviewed_at AS reviewedAt,
            u.name AS userName, u.email AS userEmail
     FROM user_documents d
     JOIN users u ON u.id = d.user_id
     ${where}
     ORDER BY d.requested_at DESC`,
    values
  );
  res.json(rows);
});

router.patch('/:id/status', authRequired('ADMIN'), [
  param('id').isInt({ min: 1 }),
  body('status').isIn(DOCUMENT_STATUSES),
  body('observations').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { status, observations } = req.body;
  const [[document]] = await pool.query('SELECT user_id FROM user_documents WHERE id = ?', [id]);
  if (!document) {
    return res.status(404).json({ message: 'Documento no encontrado' });
  }

  await pool.query(
    `UPDATE user_documents SET status = ?, observations = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [status, observations || null, id]
  );

  await pool.query('UPDATE users SET documents_status = ?, updated_at = NOW() WHERE id = ?', [status, document.user_id]);
  res.json({ ok: true, status });
});

export default router;
