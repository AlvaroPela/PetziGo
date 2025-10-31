import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Validaciones comunes
const registerValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (req.body.role === 'PROVIDER' || typeof value !== 'undefined') {
        if (value !== req.body.password) throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
  body('role')
    .isIn(['CLIENT', 'PROVIDER'])
    .withMessage('Rol inválido'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Teléfono inválido'),
  // Si es proveedor, exigir ubicación base
  body('location_lat').if(body('role').equals('PROVIDER')).isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('location_lng').if(body('role').equals('PROVIDER')).isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
];

// Registro de usuarios
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

  const { name, email, password, role, phone, address, location_lat, location_lng } = req.body;

    // Verificar email único
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        message: 'El email ya está registrado'
      });
    }

    // Hash del password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear usuario en transacción
    const result = await withTransaction(async (connection) => {
      // Insertar usuario
      const [userResult] = await connection.query(
        `INSERT INTO users (name, email, password_hash, role, phone, address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, passwordHash, role, phone, address]
      );

      // Si es proveedor, crear perfil
      if (role === 'PROVIDER') {
        await connection.query(
          'INSERT INTO provider_profiles (user_id, location_lat, location_lng) VALUES (?, ?, ?)',
          [userResult.insertId, location_lat, location_lng]
        );
      }

      return userResult.insertId;
    });

    // Generar JWT
    const token = jwt.sign(
      { id: result, role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: result,
        name,
        email,
        role
      }
    });

  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({
      message: 'Error al registrar usuario'
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Buscar usuario
    const [users] = await pool.query(
      `SELECT u.*, 
        CASE 
          WHEN u.role = 'PROVIDER' THEN pp.verified
          ELSE NULL
        END as provider_verified
       FROM users u
       LEFT JOIN provider_profiles pp ON u.id = pp.user_id
       WHERE u.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    const user = users[0];

    // Verificar estado
    if (user.status === 'INACTIVE') {
      return res.status(401).json({
        message: 'Usuario inactivo'
      });
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider_verified: user.provider_verified
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({
      message: 'Error en el servidor'
    });
  }
});

// Verificar token / Obtener usuario actual
router.get('/me', requireAuth, (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json({ user });
});

export default router;
