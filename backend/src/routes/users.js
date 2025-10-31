import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = Router();

// --- Configuración de subida de imágenes de mascotas ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const petsUploadDir = path.join(__dirname, '../../uploads/pets');
try { fs.mkdirSync(petsUploadDir, { recursive: true }); } catch {}

const petsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, petsUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const petImageUpload = multer({
  storage: petsStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    if (ok) return cb(null, true);
    cb(new Error('Formato de imagen no permitido (usa JPG, PNG o WEBP)'));
  }
});

// Obtener usuario actual
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.address,
              CASE WHEN u.role = 'PROVIDER' THEN pp.verified ELSE NULL END as provider_verified,
              CASE WHEN u.role = 'PROVIDER' THEN pp.business_description ELSE NULL END as business_description
       FROM users u
       LEFT JOIN provider_profiles pp ON u.id = pp.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = rows[0];
    res.json(user);
  } catch (err) {
    console.error('Error al obtener usuario:', err);
    res.status(500).json({
      message: 'Error al obtener información del usuario'
    });
  }
});

// Validaciones para mascota
const petValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es requerido'),
  body('species')
    .isIn(['DOG', 'CAT', 'OTHER'])
    .withMessage('Especie inválida'),
  body('breed')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La raza no puede estar vacía'),
  body('birth_date')
    .optional()
    .isISO8601()
    .withMessage('Fecha de nacimiento inválida'),
];

// Crear mascota
router.post('/pets', requireAuth, petValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, species, breed, birth_date, special_needs, photo_url } = req.body;

    const [result] = await pool.query(
      `INSERT INTO pets (user_id, name, species, breed, birth_date, special_needs, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, species, breed, birth_date, special_needs, photo_url]
    );

    res.status(201).json({
      message: 'Mascota registrada exitosamente',
      pet: {
        id: result.insertId,
        name,
        species,
        breed,
        birth_date,
        special_needs,
        photo_url
      }
    });

  } catch (err) {
    console.error('Error al crear mascota:', err);
    res.status(500).json({
      message: 'Error al registrar mascota'
    });
  }
});

// Obtener mascotas del usuario
router.get('/pets', requireAuth, async (req, res) => {
  try {
    const [pets] = await pool.query(
      'SELECT * FROM pets WHERE user_id = ?',
      [req.user.id]
    );

    res.json({ pets });

  } catch (err) {
    console.error('Error al obtener mascotas:', err);
    res.status(500).json({
      message: 'Error al obtener mascotas'
    });
  }
});

// Actualizar mascota
router.put('/pets/:id', requireAuth, petValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, species, breed, birth_date, special_needs, photo_url } = req.body;
    const petId = req.params.id;

    // Verificar propiedad
    const [pet] = await pool.query(
      'SELECT id FROM pets WHERE id = ? AND user_id = ?',
      [petId, req.user.id]
    );

    if (pet.length === 0) {
      return res.status(404).json({
        message: 'Mascota no encontrada'
      });
    }

    await pool.query(
      `UPDATE pets 
       SET name = ?, species = ?, breed = ?, birth_date = ?, 
           special_needs = ?, photo_url = ?
       WHERE id = ?`,
      [name, species, breed, birth_date, special_needs, photo_url, petId]
    );

    res.json({
      message: 'Mascota actualizada exitosamente'
    });

  } catch (err) {
    console.error('Error al actualizar mascota:', err);
    res.status(500).json({
      message: 'Error al actualizar mascota'
    });
  }
});

// Subir imagen de una mascota (propietario)
router.post('/pets/:id/image', requireAuth, petImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió ninguna imagen' });
    const petId = req.params.id;
    // Verificar propiedad
    const [rows] = await pool.query('SELECT id FROM pets WHERE id = ? AND user_id = ?', [petId, req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Mascota no encontrada' });

    const imageUrl = `/uploads/pets/${req.file.filename}`;
    await pool.query('UPDATE pets SET photo_url = ?, updated_at = NOW() WHERE id = ?', [imageUrl, petId]);
    res.status(200).json({ ok: true, imageUrl });
  } catch (err) {
    console.error('Error subiendo imagen de mascota:', err);
    res.status(500).json({ message: 'Error subiendo imagen de mascota' });
  }
});

// Eliminar mascota
router.delete('/pets/:id', requireAuth, async (req, res) => {
  try {
    const petId = req.params.id;

    // Verificar propiedad
    const [pet] = await pool.query(
      'SELECT id FROM pets WHERE id = ? AND user_id = ?',
      [petId, req.user.id]
    );

    if (pet.length === 0) {
      return res.status(404).json({
        message: 'Mascota no encontrada'
      });
    }

    await pool.query('DELETE FROM pets WHERE id = ?', [petId]);

    res.json({
      message: 'Mascota eliminada exitosamente'
    });

  } catch (err) {
    console.error('Error al eliminar mascota:', err);
    res.status(500).json({
      message: 'Error al eliminar mascota'
    });
  }
});

// Actualizar perfil de usuario
router.put('/profile', requireAuth, [
  body('name').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Teléfono inválido'),
  body('address').optional().trim().notEmpty().withMessage('La dirección no puede estar vacía')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, address } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No se proporcionaron datos para actualizar'
      });
    }

    const query = `UPDATE users SET ? WHERE id = ?`;
    await pool.query(query, [updates, req.user.id]);

    res.json({
      message: 'Perfil actualizado exitosamente'
    });

  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    res.status(500).json({
      message: 'Error al actualizar perfil'
    });
  }
});

// Rutas de administrador
router.get('/admin/list', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { search, role, status } = req.query;
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.address,
             CASE WHEN u.role = 'PROVIDER' THEN pp.verified ELSE NULL END as provider_verified,
             CASE WHEN u.role = 'PROVIDER' THEN pp.business_description ELSE NULL END as business_description
      FROM users u
      LEFT JOIN provider_profiles pp ON u.id = pp.user_id
      WHERE 1=1
    `;
    const values = [];

    if (search) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      values.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ` AND u.role = ?`;
      values.push(role);
    }

    if (status) {
      query += ` AND u.status = ?`;
      values.push(status);
    }

    query += ` ORDER BY u.created_at DESC`;

    const [users] = await pool.query(query, values);

    res.json({ users });
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    res.status(500).json({
      message: 'Error al obtener lista de usuarios'
    });
  }
});

// Actualizar estado de usuario
router.patch('/admin/users/:id/status', requireAuth, requireRole(['ADMIN']), [
  body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('Estado inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({
      message: 'Estado de usuario actualizado exitosamente'
    });
  } catch (err) {
    console.error('Error al actualizar estado:', err);
    res.status(500).json({
      message: 'Error al actualizar estado del usuario'
    });
  }
});

export default router;
