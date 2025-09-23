import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price, p.stock, p.visible,
            u.name AS providerName, u.company_name AS companyName
     FROM products p
     JOIN users u ON u.id = p.provider_id
     WHERE p.visible = 1 AND u.status = 'ACTIVE'`
  );
  res.json(rows);
});

router.get('/mine', authRequired('PROVIDER'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, description, price, stock, visible, created_at AS createdAt, updated_at AS updatedAt
     FROM products WHERE provider_id = ? ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

const productValidations = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('description').trim().notEmpty().withMessage('La descripcion es obligatoria'),
  body('price').isFloat({ min: 0 }).withMessage('El precio debe ser un numero positivo'),
  body('stock').optional().isInt({ min: 0 }).withMessage('El stock debe ser un entero positivo'),
  body('visible').optional().isBoolean().withMessage('Visible debe ser booleano')
];

router.post('/', authRequired('PROVIDER'), productValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, price, stock = 0, visible = true } = req.body;
  const [result] = await pool.query(
    `INSERT INTO products (provider_id, name, description, price, stock, visible)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [req.user.id, name, description, price, stock, visible ? 1 : 0]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', authRequired('PROVIDER'), [
  param('id').isInt({ min: 1 }),
  ...productValidations
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, description, price, stock = 0, visible = true } = req.body;

  const [ownership] = await pool.query('SELECT id FROM products WHERE id = ? AND provider_id = ?', [id, req.user.id]);
  if (!ownership.length) {
    return res.status(404).json({ message: 'Producto no encontrado' });
  }

  await pool.query(
    `UPDATE products SET name = ?, description = ?, price = ?, stock = ?, visible = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, description, price, stock, visible ? 1 : 0, id]
  );
  res.json({ ok: true });
});

router.patch('/:id/visibility', authRequired('PROVIDER'), [
  param('id').isInt({ min: 1 }),
  body('visible').isBoolean().withMessage('Visible debe ser booleano')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { visible } = req.body;
  const [ownership] = await pool.query('SELECT id FROM products WHERE id = ? AND provider_id = ?', [id, req.user.id]);
  if (!ownership.length) {
    return res.status(404).json({ message: 'Producto no encontrado' });
  }

  await pool.query('UPDATE products SET visible = ?, updated_at = NOW() WHERE id = ?', [visible ? 1 : 0, id]);
  res.json({ ok: true, visible });
});

router.delete('/:id', authRequired('PROVIDER'), [param('id').isInt({ min: 1 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  const [ownership] = await pool.query('SELECT id FROM products WHERE id = ? AND provider_id = ?', [id, req.user.id]);
  if (!ownership.length) {
    return res.status(404).json({ message: 'Producto no encontrado' });
  }
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
  res.status(204).send();
});

export default router;
