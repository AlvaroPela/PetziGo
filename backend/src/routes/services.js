import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, requireVerifiedProvider, requireResourceOwnership } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de subida de imágenes de servicios
const servicesStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/services'),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const imageUpload = multer({
  storage: servicesStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    if (ok) return cb(null, true);
    cb(new Error('Formato de imagen no permitido (usa JPG, PNG o WEBP)'));
  }
});

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
    .withMessage('La descripción es requerida')
    .isLength({ min: 100 })
    .withMessage('La descripción debe tener al menos 100 caracteres'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser mayor o igual a 0'),
  body('category')
    .isIn(['PASEO', 'VETERINARIA', 'ENTRENAMIENTO', 'ESTETICA', 'GUARDERIA', 'OTRO'])
    .withMessage('Categoría inválida')
];

// Obtener todos los servicios (público)
router.get('/', [
  query('category').optional().isIn(['PASEO', 'VETERINARIA', 'ENTRENAMIENTO', 'ESTETICA', 'GUARDERIA', 'OTRO']),
  query('min_price').optional().isFloat({ min: 0 }),
  query('max_price').optional().isFloat({ min: 0 }),
  query('rating').optional().isFloat({ min: 1, max: 5 }),
  query('search').optional().trim()
], async (req, res) => {
  // debug: query parameters (demoted)
  if (process.env.NODE_ENV !== 'production') console.debug('[services] GET / - query:', req.query);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category, min_price, max_price, rating, search, provider_id, idp } = req.query;

    // Owner-fastpath: si el frontend indica que es petición del proveedor mediante `idp=<id>`
    // intentamos verificar el token y devolver sólo los servicios de ese proveedor (sin aplicar filtros públicos).
    // Si no coincide el token o hay error, continuamos con la lógica pública.
    if (idp) {
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const [[requester]] = await pool.query(
            `SELECT u.id, u.role, u.status FROM users u WHERE u.id = ?`,
            [decoded.id]
          );
          if (requester && requester.role === 'PROVIDER' && String(requester.id) === String(idp)) {
            const [services] = await pool.query(
              `SELECT s.*, u.name AS provider_name, u.email AS provider_email, s.location_lat, s.location_lng, s.city
               FROM services s
               INNER JOIN users u ON s.provider_id = u.id
               WHERE s.provider_id = ?
               ORDER BY s.created_at DESC`,
              [idp]
            );

            if (process.env.NODE_ENV !== 'production') console.debug('[services] owner request via idp - returning', Array.isArray(services) ? services.length : 0, 'services for provider', idp);
            return res.json({ services });
          }
        }
      } catch (err) {
        console.warn('[services] could not verify token for owner-fastpath (idp):', err && err.message);
        // continuar con la lógica pública en caso de error de verificación
      }
    }
    // PENDIENTE para cuando se implemnte la activacion y desactivacions del provedor
    // let query = `
    //   SELECT s.*, u.name as provider_name, 
    //          pp.average_rating, pp.total_reviews,
    //          pp.location_lat, pp.location_lng
    //   FROM services s
    //   INNER JOIN users u ON s.provider_id = u.id
    //   INNER JOIN provider_profiles pp ON s.provider_id = pp.user_id
    //   WHERE s.active = 1 AND u.status = 'ACTIVE' AND pp.verified = 1
    // `;

    let query = `
      SELECT s.*, 
             u.name AS provider_name, 
             u.email AS provider_email,
             pp.verified AS provider_verified,
             pp.average_rating, pp.total_reviews,
             s.location_lat, s.location_lng, s.city
      FROM services s
      INNER JOIN users u ON s.provider_id = u.id
      INNER JOIN provider_profiles pp ON s.provider_id = pp.user_id
      WHERE s.active = 1
        AND u.status = 'ACTIVE'
        AND pp.verified = 1
        AND s.location_lat IS NOT NULL
        AND s.location_lng IS NOT NULL
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

  console.info('[services] found', Array.isArray(services) ? services.length : 0, 'services');
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
  if (process.env.NODE_ENV !== 'production') console.debug('[services] GET /:id - id:', req.params.id);
  try {
    const serviceId = req.params.id;

    // PENDIENTE para cuando se implemnte la activacion y desactivacions del provedor
    // const [[service]] = await pool.query(
    //   `SELECT s.*, u.name as provider_name,
    //           pp.business_description, pp.average_rating, pp.total_reviews,
    //           pp.location_lat, pp.location_lng
    //    FROM services s
    //    INNER JOIN users u ON s.provider_id = u.id
    //    INNER JOIN provider_profiles pp ON s.provider_id = pp.user_id
    //    WHERE s.id = ? AND s.active = 1
    //    AND u.status = 'ACTIVE' AND pp.verified = 1`,
    //   [serviceId]
    // );

    const [[service]] = await pool.query(
      `SELECT s.*, u.name as provider_name,
              pp.business_description, pp.average_rating, pp.total_reviews,
              s.location_lat, s.location_lng, s.city
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

    // Si hay token de cliente, incluir su propia reseña aunque esté PENDING o REJECTED
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          const [[requester]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [decoded.id]);
          if (requester && requester.role === 'CLIENT') {
            const [[myRev]] = await pool.query(
              `SELECT r.rating, r.comment, r.created_at, u.name as client_name, r.status
               FROM reviews r
               INNER JOIN orders o ON o.id = r.order_id
               INNER JOIN users u ON u.id = r.client_id
               WHERE r.client_id = ? AND o.service_id = ? LIMIT 1`,
              [requester.id, serviceId]
            );
            if (myRev && myRev.rating != null) {
              // comprobar si ya está en la lista de reviews (por ejemplo si ya aprobada)
              const exists = reviews.find(rv => rv.created_at && new Date(rv.created_at).getTime() === new Date(myRev.created_at).getTime() && rv.client_name === myRev.client_name);
              if (!exists) reviews.unshift({ rating: myRev.rating, comment: myRev.comment, created_at: myRev.created_at, client_name: myRev.client_name });
            }
          }
        }
      }
    } catch (e) {
      // no bloquear la respuesta por errores de token
      if (process.env.NODE_ENV !== 'production') console.debug('[services] token parse error', e && e.message);
    }

  console.info('[services] returning service id:', serviceId);
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
  // demote detailed request body logging
  if (process.env.NODE_ENV !== 'production') console.debug('[services] POST / - user:', req.user?.id);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

  const { title, description, price, category, location_lat, location_lng, city } = req.body;

    // Si es un servicio de paseo (PASEO), exigir ubicación base del proveedor
    if (category === 'PASEO') {
      const [[pp]] = await pool.query('SELECT location_lat, location_lng FROM provider_profiles WHERE user_id = ?', [req.user.id]);
      if (!pp || pp.location_lat == null || pp.location_lng == null) {
        return res.status(400).json({ message: 'Debes registrar tu ubicación en tu perfil para poder crear servicios de paseo.' });
      }
    }

    // Validar que la ubicación del servicio esté presente
    if (location_lat == null || location_lng == null) {
      return res.status(400).json({ message: 'La ubicación del servicio (latitud y longitud) es obligatoria.' });
    }

    const [result] = await pool.query(
      `INSERT INTO services (provider_id, title, description, price, category, location_lat, location_lng, city)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, description, price, category, location_lat, location_lng, city || null]
    );

  const insertId = result.insertId;
  console.info('[services] created id:', insertId);

    // Recuperar el servicio completo para devolver al cliente (incluye location, image_url, provider info)
    const [[created]] = await pool.query(
      `SELECT s.*, u.name as provider_name, pp.business_description, pp.average_rating, pp.total_reviews
       FROM services s
       INNER JOIN users u ON s.provider_id = u.id
       LEFT JOIN provider_profiles pp ON s.provider_id = pp.user_id
       WHERE s.id = ?`,
      [insertId]
    );

    res.status(201).json({ message: 'Servicio creado exitosamente', service: created || { id: insertId, title, description, price, category } });

  } catch (err) {
    console.error('Error al crear servicio:', err);
    res.status(500).json({
      message: 'Error al crear servicio'
    });
  }
});

// Actualizar servicio (propietario)
router.put('/:id', requireAuth, requireResourceOwnership('service'), serviceValidation, async (req, res) => {
  if (process.env.NODE_ENV !== 'production') console.debug('[services] PUT /:id - id:', req.params.id, 'user:', req.user?.id);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, price, category, location_lat, location_lng, city } = req.body;
    const serviceId = req.params.id;

    await pool.query(
      `UPDATE services
       SET title = ?, description = ?, price = ?, category = ?, location_lat = ?, location_lng = ?, city = ?
       WHERE id = ?`,
      [title, description, price, category, location_lat || null, location_lng || null, city || null, serviceId]
    );

  console.info('[services] updated id:', serviceId);

    // Recuperar fila actualizada para devolverla completa al frontend
    const [[updated]] = await pool.query(
      `SELECT s.*, u.name as provider_name, pp.business_description, pp.average_rating, pp.total_reviews
       FROM services s
       INNER JOIN users u ON s.provider_id = u.id
       LEFT JOIN provider_profiles pp ON s.provider_id = pp.user_id
       WHERE s.id = ?`,
      [serviceId]
    );

    res.json({ message: 'Servicio actualizado exitosamente', service: updated || { id: serviceId, title, description, price, category } });

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
  if (process.env.NODE_ENV !== 'production') console.debug('[services] PATCH /:id/status - id:', req.params.id, 'user:', req.user?.id);
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

  console.info('[services] status updated for id:', serviceId, 'active:', active);
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
  if (process.env.NODE_ENV !== 'production') console.debug('[services] GET /provider/mine - user:', req.user?.id);
  try {
    const [services] = await pool.query(`SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC`, [req.user.id]);
    console.info('[services] provider has', Array.isArray(services) ? services.length : 0, 'services');
    res.json({ services });
  } catch (err) {
    console.error('Error al obtener servicios del proveedor:', err);
    res.status(500).json({ message: 'Error al obtener servicios' });
  }
});

// Eliminar servicio -> marcar active = 2 (soft delete)
// Requiere autenticación y que el usuario sea propietario (requireResourceOwnership('service'))
router.delete('/:id', requireAuth, requireResourceOwnership('service'), async (req, res) => {
  if (process.env.NODE_ENV !== 'production') console.debug('[services] DELETE /:id - id:', req.params.id, 'user:', req.user?.id);
  try {
    const serviceId = req.params.id;

    // Actualizar active a 2 (estado eliminado)
    const [result] = await pool.query(
      `UPDATE services
       SET active = 2
       WHERE id = ?`,
      [serviceId]
    );

    // result.affectedRows (mysql2) indica si se actualizó algo
    if (result.affectedRows === 0) {
      console.warn('[services] delete attempt - not found or no change id:', serviceId);
      return res.status(404).json({ message: 'Servicio no encontrado' });
    }

  console.info('[services] soft-deleted id:', serviceId, 'by user:', req.user?.id);
    res.json({ message: 'Servicio eliminado correctamente', id: serviceId });

  } catch (err) {
    console.error('Error al eliminar servicio:', err);
    res.status(500).json({ message: 'Error al eliminar servicio' });
  }
});


export default router;

// Subir imagen de un servicio (propietario)
router.post('/:id/image', requireAuth, requireResourceOwnership('service'), imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió ninguna imagen' });
    const serviceId = req.params.id;
    const imageUrl = `/uploads/services/${req.file.filename}`;
    await pool.query('UPDATE services SET image_url = ? WHERE id = ?', [imageUrl, serviceId]);
    res.status(200).json({ ok: true, imageUrl });
  } catch (err) {
    console.error('Error subiendo imagen de servicio:', err);
    res.status(500).json({ message: 'Error subiendo imagen de servicio' });
  }
});
