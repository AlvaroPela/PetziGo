import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { pool, withTransaction } from '../config/db.js';
import { requireAuth, requireRole, requireVerifiedProvider } from '../middleware/auth.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/certifications'),
  filename: (req, file, cb) => {
    const uniqueFileName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos de imagen (JPG, PNG) y PDF'));
  }
});

const router = Router();

// Buscar proveedores verificados (público)
router.get('/', [
  // Categorías alineadas con `services.js` (ES):
  query('category').optional().isIn(['PASEO', 'VETERINARIA', 'ENTRENAMIENTO', 'ESTETICA', 'GUARDERIA', 'OTRO']),
  query('lat').optional().isFloat({ min: -90, max: 90 }),
  query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radius').optional().isInt({ min: 1, max: 50 }) // radio en km
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

  const { category, lat, lng, radius = 10 } = req.query;

    // Construimos una consulta que:
    // - Devuelva proveedores verificados y activos, con su ubicación (provider_profiles)
    // - Incluya el conteo de servicios activos por proveedor (filtrado por categoría si se envía)
    // - Aplique un filtro de existencia por categoría si se envía (solo proveedores con al menos un servicio de esa categoría)
    // - Aplique filtro por distancia (Haversine) usando la ubicación del perfil del proveedor

    const values = [];
    const selectServicesCount = category
      ? `COUNT(DISTINCT CASE WHEN s.category = ? THEN s.id END) AS services_count`
      : `COUNT(DISTINCT s.id) AS services_count`;
    if (category) values.push(category);

    let query = `
      SELECT 
        p.user_id, u.name, u.email, p.business_description,
        p.location_lat, p.location_lng, p.average_rating, p.total_reviews,
        ${selectServicesCount},
        (SELECT COUNT(*) FROM services sx WHERE sx.provider_id = p.user_id) AS services_total_any,
        (SELECT COUNT(*) FROM services sx WHERE sx.provider_id = p.user_id AND sx.active = 1) AS services_total_active,
        COALESCE(
          (
            SELECT s3.id FROM services s3
            WHERE s3.provider_id = p.user_id
            ${category ? 'AND s3.category = ?' : ''}
            AND s3.active = 1
            ORDER BY s3.created_at DESC
            LIMIT 1
          ),
          (
            SELECT s3b.id FROM services s3b
            WHERE s3b.provider_id = p.user_id
            ${category ? 'AND s3b.category = ?' : ''}
            ORDER BY s3b.created_at DESC
            LIMIT 1
          )
        ) AS sample_service_id,
        COALESCE(
          (
            SELECT s4.title FROM services s4
            WHERE s4.provider_id = p.user_id
            ${category ? 'AND s4.category = ?' : ''}
            AND s4.active = 1
            ORDER BY s4.created_at DESC
            LIMIT 1
          ),
          (
            SELECT s4b.title FROM services s4b
            WHERE s4b.provider_id = p.user_id
            ${category ? 'AND s4b.category = ?' : ''}
            ORDER BY s4b.created_at DESC
            LIMIT 1
          )
        ) AS sample_service_title,
        COALESCE(
          (
            SELECT s5.price FROM services s5
            WHERE s5.provider_id = p.user_id
            ${category ? 'AND s5.category = ?' : ''}
            AND s5.active = 1
            ORDER BY s5.created_at DESC
            LIMIT 1
          ),
          (
            SELECT s5b.price FROM services s5b
            WHERE s5b.provider_id = p.user_id
            ${category ? 'AND s5b.category = ?' : ''}
            ORDER BY s5b.created_at DESC
            LIMIT 1
          )
        ) AS sample_service_price
      FROM provider_profiles p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN services s ON s.provider_id = p.user_id
      WHERE u.status = 'ACTIVE'
    `;

    if (category) {
      // Añadir valores para las subconsultas del SELECT (en el mismo orden de aparición)
      // Para COALESCE: (id activo, id cualquiera), (title activo, title cualquiera), (price activo, price cualquiera)
      values.push(category, category, category, category, category, category);
      query += ` AND EXISTS (
        SELECT 1 FROM services s2
        WHERE s2.provider_id = p.user_id AND s2.category = ?
      )`;
      values.push(category);
    }

    if (lat && lng) {
      // Filtro por distancia usando Haversine, radio en km
      query += `
        AND (
          6371 * acos(
            cos(radians(?)) * cos(radians(p.location_lat))
            * cos(radians(p.location_lng) - radians(?))
            + sin(radians(?)) * sin(radians(p.location_lat))
          )
        ) <= ?
      `;
      values.push(lat, lng, lat, radius);
    }

    query += `
      GROUP BY p.user_id, u.name, u.email, p.business_description,
               p.location_lat, p.location_lng, p.average_rating, p.total_reviews
      ORDER BY p.average_rating DESC
    `;

    const [providers] = await pool.query(query, values);

    res.json({ providers });

  } catch (err) {
    console.error('Error al buscar proveedores:', err);
    res.status(500).json({
      message: 'Error al buscar proveedores'
    });
  }
});

// Obtener perfil público de un proveedor
router.get('/:id', async (req, res) => {
  try {
    const providerId = req.params.id;

    const [[provider]] = await pool.query(
      `SELECT p.user_id, u.name, u.email, p.business_description,
              p.location_lat, p.location_lng, p.average_rating, p.total_reviews
       FROM provider_profiles p
       INNER JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ? AND p.verified = 1 AND u.status = 'ACTIVE'`,
      [providerId]
    );

    if (!provider) {
      return res.status(404).json({
        message: 'Proveedor no encontrado'
      });
    }

    // Obtener certificaciones aprobadas
    const [certifications] = await pool.query(
      `SELECT id, document_name, file_url
       FROM certifications
       WHERE provider_id = ? AND status = 'APPROVED'`,
      [providerId]
    );

    // Obtener servicios activos
    const [services] = await pool.query(
      `SELECT id, title, description, price, category
       FROM services
       WHERE provider_id = ? AND active = 1`,
      [providerId]
    );

    // Obtener reseñas aprobadas
    const [reviews] = await pool.query(
      `SELECT r.rating, r.comment, r.created_at,
              u.name as client_name
       FROM reviews r
       INNER JOIN users u ON r.client_id = u.id
       WHERE r.provider_id = ? AND r.status = 'APPROVED'
       ORDER BY r.created_at DESC`,
      [providerId]
    );

    res.json({
      provider: {
        ...provider,
        certifications,
        services,
        reviews
      }
    });

  } catch (err) {
    console.error('Error al obtener perfil de proveedor:', err);
    res.status(500).json({
      message: 'Error al obtener perfil de proveedor'
    });
  }
});

// Actualizar perfil de proveedor (autenticado como proveedor)
router.put('/profile', requireAuth, requireRole(['PROVIDER']), [
  body('business_description')
    .trim()
    .notEmpty()
    .withMessage('La descripción del negocio es requerida'),
  body('location_lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitud inválida'),
  body('location_lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitud inválida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { business_description, location_lat, location_lng } = req.body;

    await pool.query(
      `UPDATE provider_profiles
       SET business_description = ?,
           location_lat = ?,
           location_lng = ?
       WHERE user_id = ?`,
      [business_description, location_lat, location_lng, req.user.id]
    );

    res.json({
      message: 'Perfil de proveedor actualizado exitosamente'
    });

  } catch (err) {
    console.error('Error al actualizar perfil de proveedor:', err);
    res.status(500).json({
      message: 'Error al actualizar perfil'
    });
  }
});

// Subir certificación
router.post('/certifications', requireAuth, requireRole(['PROVIDER']), upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No se proporcionó ningún archivo'
      });
    }

    const { document_name } = req.body;
    if (!document_name) {
      return res.status(400).json({
        message: 'El nombre del documento es requerido'
      });
    }

    const file_url = `/uploads/certifications/${req.file.filename}`;

    await pool.query(
      `INSERT INTO certifications (provider_id, document_name, file_url)
       VALUES (?, ?, ?)`,
      [req.user.id, document_name, file_url]
    );

    res.status(201).json({
      message: 'Certificación subida exitosamente'
    });

  } catch (err) {
    console.error('Error al subir certificación:', err);
    res.status(500).json({
      message: 'Error al subir certificación'
    });
  }
});

// Obtener certificaciones del proveedor (autenticado)
router.get('/certifications', requireAuth, requireRole(['PROVIDER']), async (req, res) => {
  try {
    const [certifications] = await pool.query(
      `SELECT id, document_name, file_url, status, admin_observations, created_at
       FROM certifications
       WHERE provider_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ certifications });

  } catch (err) {
    console.error('Error al obtener certificaciones:', err);
    res.status(500).json({
      message: 'Error al obtener certificaciones'
    });
  }
});

// Rutas de administración de proveedores
router.get('/admin/pending', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [providers] = await pool.query(
      `SELECT p.user_id, u.name, u.email, p.business_description,
              p.location_lat, p.location_lng, p.verified,
              (SELECT COUNT(*) FROM certifications c WHERE c.provider_id = p.user_id AND c.status = 'PENDING') as pending_certifications
       FROM provider_profiles p
       INNER JOIN users u ON p.user_id = u.id
       WHERE p.verified = 0 AND u.status = 'ACTIVE'
       ORDER BY u.created_at ASC`
    );

    res.json({ providers });

  } catch (err) {
    console.error('Error al obtener proveedores pendientes:', err);
    res.status(500).json({
      message: 'Error al obtener proveedores pendientes'
    });
  }
});

// Validar proveedor
router.patch('/admin/verify/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const providerId = req.params.id;
    const { verified } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({
        message: 'El estado de verificación debe ser verdadero o falso'
      });
    }

    await pool.query(
      'UPDATE provider_profiles SET verified = ? WHERE user_id = ?',
      [verified, providerId]
    );

    res.json({
      message: verified ? 'Proveedor verificado exitosamente' : 'Verificación de proveedor rechazada'
    });

  } catch (err) {
    console.error('Error al verificar proveedor:', err);
    res.status(500).json({
      message: 'Error al verificar proveedor'
    });
  }
});

// Validar certificación
router.patch('/admin/certifications/:id', requireAuth, requireRole(['ADMIN']), [
  body('status')
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Estado inválido'),
  body('observations')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Las observaciones no pueden estar vacías')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const certificationId = req.params.id;
    const { status, observations } = req.body;

    await pool.query(
      `UPDATE certifications
       SET status = ?, admin_observations = ?
       WHERE id = ?`,
      [status, observations, certificationId]
    );

    res.json({
      message: 'Estado de certificación actualizado exitosamente'
    });

  } catch (err) {
    console.error('Error al actualizar certificación:', err);
    res.status(500).json({
      message: 'Error al actualizar certificación'
    });
  }
});

export default router;

// Actualizar ubicación en vivo del proveedor (heartbeat cada 10s)
router.post('/me/location', requireAuth, requireRole(['PROVIDER']), [
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { latitude, longitude, providerId: providerIdFromBody } = req.body;
    const providerId = Number(providerIdFromBody || req.user.id);
    if (!providerId || providerId !== req.user.id) {
      return res.status(403).json({ message: 'providerId inválido' });
    }

    // Validar si existe registro para este proveedor y luego crear o actualizar
    const [[exists]] = await pool.query(
      `SELECT id FROM gps_locations WHERE provider_id = ? LIMIT 1`,
      [providerId]
    );

    if (exists) {
      await pool.query(
        `UPDATE gps_locations
         SET latitude = ?, longitude = ?, timestamp = NOW()
         WHERE provider_id = ?`,
        [latitude, longitude, providerId]
      );
    } else {
      await pool.query(
        `INSERT INTO gps_locations (provider_id, latitude, longitude, timestamp)
         VALUES (?, ?, ?, NOW())`,
        [providerId, latitude, longitude]
      );
    }
    return res.json({ ok: true, providerId });
  } catch (err) {
    console.error('Error en /providers/me/location', err);
    res.status(500).json({ message: 'Error registrando ubicación' });
  }
});

// Obtener ubicación en vivo del proveedor por id
router.get('/:id/location', async (req, res) => {
  try {
    const providerId = req.params.id;
    const [[row]] = await pool.query(
      `SELECT latitude, longitude, timestamp AS at FROM gps_locations WHERE provider_id = ?`,
      [providerId]
    );
    if (!row) return res.json({ location: null });
    res.json({ location: { latitude: Number(row.latitude), longitude: Number(row.longitude), at: row.at } });
  } catch (err) {
    console.error('Error al obtener ubicación del proveedor:', err);
    res.status(500).json({ message: 'Error al obtener ubicación' });
  }
});