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
  query('category').optional().isIn(['WALKING', 'VETERINARY', 'TRAINING', 'GROOMING', 'DAYCARE', 'OTHER']),
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

    let query = `
      SELECT DISTINCT p.user_id, u.name, u.email, p.business_description,
             p.location_lat, p.location_lng, p.average_rating, p.total_reviews
      FROM provider_profiles p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN services s ON p.user_id = s.provider_id
      WHERE p.verified = 1 AND u.status = 'ACTIVE'
    `;
    const values = [];

    if (category) {
      query += ` AND s.category = ?`;
      values.push(category);
    }

    if (lat && lng) {
      // Fórmula Haversine para distancia
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

    query += ` ORDER BY p.average_rating DESC`;

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