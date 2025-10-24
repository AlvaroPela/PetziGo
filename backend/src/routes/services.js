import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import { requireAuth, requireRole, requireVerifiedProvider, requireResourceOwnership } from '../middleware/auth.js';

const router = Router();

// Validaciones comunes para servicios
const serviceValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ max: 140 })
    .withMessage('El título no puede exceder 140 caracteres'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('La descripción es requerida'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser mayor o igual a 0'),
  body('category')
    .isIn(['WALKING', 'VETERINARY', 'TRAINING', 'GROOMING', 'DAYCARE', 'OTHER'])
    .withMessage('Categoría inválida')
];

// Obtener todos los servicios (público)
router.get('/', [
  query('category').optional().isIn(['WALKING', 'VETERINARY', 'TRAINING', 'GROOMING', 'DAYCARE', 'OTHER']),
  query('min_price').optional().isFloat({ min: 0 }),
  query('max_price').optional().isFloat({ min: 0 }),
  query('rating').optional().isFloat({ min: 1, max: 5 }),
  query('search').optional().trim()
], async (req, res) => {
  console.log('[services] GET / - query:', req.query);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category, min_price, max_price, rating, search, provider_id } = req.query;
    let query = `
      SELECT s.*, u.name as provider_name, 
             pp.average_rating, pp.total_reviews,
             pp.location_lat, pp.location_lng
      FROM services s
      INNER JOIN users u ON s.provider_id = u.id
      INNER JOIN provider_profiles pp ON s.provider_id = pp.user_id
      WHERE s.active = 1 AND u.status = 'ACTIVE' AND pp.verified = 1
    `;
    const values = [];

    if (category) {
      query += ` AND s.category = ?`;
      values.push(category);
    }

    if (min_price) {
      query += ` AND s.price >= ?`;
      values.push(min_price);
    }

    if (max_price) {
      query += ` AND s.price <= ?`;
      values.push(max_price);
    }

    if (rating) {
      query += ` AND pp.average_rating >= ?`;
      values.push(rating);
    }

    if (search) {
      query += ` AND (s.title LIKE ? OR s.description LIKE ?)`;
      values.push(`%${search}%`, `%${search}%`);
    }

    if (provider_id) {
      query += ` AND s.provider_id = ?`;
      values.push(provider_id);
    }

    query += ` ORDER BY pp.average_rating DESC, s.created_at DESC`;

    const [services] = await pool.query(query, values);

  console.log('[services] found', Array.isArray(services) ? services.length : 0, 'services');
  res.json({ services });

  } catch (err) {
    console.error('Error al obtener servicios:', err);
    res.status(500).json({
      message: 'Error al obtener servicios'
    });
  }
});

// Obtener un servicio específico
router.get('/:id', async (req, res) => {
  console.log('[services] GET /:id - id:', req.params.id);
  try {
    const serviceId = req.params.id;

    const [[service]] = await pool.query(
      `SELECT s.*, u.name as provider_name,
              pp.business_description, pp.average_rating, pp.total_reviews,
              pp.location_lat, pp.location_lng
       FROM services s
       INNER JOIN users u ON s.provider_id = u.id
       INNER JOIN provider_profiles pp ON s.provider_id = pp.user_id
       WHERE s.id = ? AND s.active = 1
       AND u.status = 'ACTIVE' AND pp.verified = 1`,
      [serviceId]
    );

    if (!service) {
      console.warn('[services] service not found id:', serviceId);
      return res.status(404).json({ message: 'Servicio no encontrado' });
    }

    // Obtener reseñas del servicio
    const [reviews] = await pool.query(
      `SELECT r.rating, r.comment, r.created_at,
              u.name as client_name
       FROM reviews r
       INNER JOIN users u ON r.client_id = u.id
       WHERE r.provider_id = ? AND r.status = 'APPROVED'
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [service.provider_id]
    );

    console.log('[services] returning service id:', serviceId);
    res.json({ service: { ...service, reviews } });

  } catch (err) {
    console.error('Error al obtener servicio:', err);
    res.status(500).json({
      message: 'Error al obtener servicio'
    });
  }
});

// Crear servicio (proveedor verificado)
router.post('/', requireAuth, requireRole(['PROVIDER']), requireVerifiedProvider, serviceValidation, async (req, res) => {
  console.log('[services] POST / - user:', req.user?.id, 'body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, price, category } = req.body;

    const [result] = await pool.query(
      `INSERT INTO services (provider_id, title, description, price, category)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, title, description, price, category]
    );

    console.log('[services] created id:', result.insertId);
    res.status(201).json({ message: 'Servicio creado exitosamente', service: { id: result.insertId, title, description, price, category } });

  } catch (err) {
    console.error('Error al crear servicio:', err);
    res.status(500).json({
      message: 'Error al crear servicio'
    });
  }
});

// Actualizar servicio (propietario)
router.put('/:id', requireAuth, requireResourceOwnership('service'), serviceValidation, async (req, res) => {
  console.log('[services] PUT /:id - id:', req.params.id, 'user:', req.user?.id, 'body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, price, category } = req.body;
    const serviceId = req.params.id;

    await pool.query(
      `UPDATE services
       SET title = ?, description = ?, price = ?, category = ?
       WHERE id = ?`,
      [title, description, price, category, serviceId]
    );

    console.log('[services] updated id:', serviceId);
    res.json({ message: 'Servicio actualizado exitosamente' });

  } catch (err) {
    console.error('Error al actualizar servicio:', err);
    res.status(500).json({
      message: 'Error al actualizar servicio'
    });
  }
});

// Activar/desactivar servicio (propietario)
router.patch('/:id/status', requireAuth, requireResourceOwnership('service'), [
  body('active').isBoolean().withMessage('El estado debe ser verdadero o falso')
], async (req, res) => {
  console.log('[services] PATCH /:id/status - id:', req.params.id, 'user:', req.user?.id, 'body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const serviceId = req.params.id;
    const { active } = req.body;

    await pool.query(
      'UPDATE services SET active = ? WHERE id = ?',
      [active, serviceId]
    );

    console.log('[services] status updated for id:', serviceId, 'active:', active);
    res.json({ message: active ? 'Servicio activado exitosamente' : 'Servicio desactivado exitosamente' });

  } catch (err) {
    console.error('Error al actualizar estado del servicio:', err);
    res.status(500).json({
      message: 'Error al actualizar estado del servicio'
    });
  }
});

// Obtener servicios del proveedor autenticado
router.get('/provider/mine', requireAuth, requireRole(['PROVIDER']), async (req, res) => {
  console.log('[services] GET /provider/mine - user:', req.user?.id);
  try {
    const [services] = await pool.query(`SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC`, [req.user.id]);
    console.log('[services] provider has', Array.isArray(services) ? services.length : 0, 'services');
    res.json({ services });
  } catch (err) {
    console.error('Error al obtener servicios del proveedor:', err);
    res.status(500).json({ message: 'Error al obtener servicios' });
  }
});

export default router;
