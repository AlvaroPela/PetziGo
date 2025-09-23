import { Router } from 'express';
import { body, validationResult, param, query } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const BASE_ROLES = ['USER', 'PROVIDER', 'ADMIN'];

router.get('/me', authRequired(BASE_ROLES), async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT id, name, email, role, phone, address, legal_representative AS legalRepresentative,
            company_name AS companyName, tax_id AS taxId, status, documents_status AS documentsStatus,
            created_at AS createdAt, updated_at AS updatedAt
     FROM users WHERE id = ?`,
    [req.user.id]
  );
  res.json(user);
});

const updateValidations = [
  body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacio'),
  body('phone').optional().trim().notEmpty().withMessage('El telefono no puede estar vacio'),
  body('address').optional().trim().notEmpty().withMessage('La direccion no puede estar vacia'),
  body('legalRepresentative')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El representante legal no puede estar vacio'),
  body('companyName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La razon social no puede estar vacia'),
  body('taxId').optional().trim().notEmpty().withMessage('El NIT no puede estar vacio')
];

router.put('/me', authRequired(BASE_ROLES), updateValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const role = req.user.role;
  const allowedFields = new Set(['phone', 'address']);
  if (role === 'USER') {
    allowedFields.add('name');
  }
  if (role === 'PROVIDER') {
    allowedFields.add('legalRepresentative');
    allowedFields.add('companyName');
    allowedFields.add('taxId');
    allowedFields.add('phone');
    allowedFields.add('address');
  }
  if (role === 'ADMIN') {
    allowedFields.add('name');
    allowedFields.add('legalRepresentative');
    allowedFields.add('companyName');
    allowedFields.add('taxId');
  }

  const fieldMap = {
    name: 'name',
    phone: 'phone',
    address: 'address',
    legalRepresentative: 'legal_representative',
    companyName: 'company_name',
    taxId: 'tax_id'
  };

  const updates = [];
  const values = [];

  Object.entries(fieldMap).forEach(([key, column]) => {
    if (!allowedFields.has(key)) {
      return;
    }
    if (req.body[key] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(req.body[key]);
      if (role === 'PROVIDER' && key === 'companyName') {
        updates.push('name = ?');
        values.push(req.body[key]);
      }
    }
  });

  if (updates.length === 0) {
    return res.json({ ok: true, updated: 0 });
  }

  values.push(req.user.id);
  await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
  res.json({ ok: true, updated: updates.length });
});

router.get('/', authRequired('ADMIN'), [
  query('role').optional().isIn(BASE_ROLES),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  query('search').optional().trim().isLength({ min: 2 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { role, status, search } = req.query;
  const filters = [];
  const values = [];

  if (role) {
    filters.push('role = ?');
    values.push(role);
  }
  if (status) {
    filters.push('status = ?');
    values.push(status);
  }
  if (search) {
    filters.push('(name LIKE ? OR email LIKE ? OR company_name LIKE ? OR tax_id LIKE ?)');
    const term = `%${search}%`;
    values.push(term, term, term, term);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, name, email, role, status, phone, address, company_name AS companyName, tax_id AS taxId,
            documents_status AS documentsStatus, created_at AS createdAt
     FROM users ${where} ORDER BY created_at DESC`,
    values
  );
  res.json(rows);
});

router.patch('/:id/status', authRequired('ADMIN'), [
  param('id').isInt({ min: 1 }),
  body('status').isIn(['ACTIVE', 'INACTIVE'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { status } = req.body;
  await pool.query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
  res.json({ ok: true, status });
});

router.patch('/:id/documents', authRequired('ADMIN'), [
  param('id').isInt({ min: 1 }),
  body('documentsStatus').isIn(['PENDING', 'REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { documentsStatus } = req.body;
  await pool.query('UPDATE users SET documents_status = ?, updated_at = NOW() WHERE id = ?', [documentsStatus, id]);
  res.json({ ok: true, documentsStatus });
});

export default router;
