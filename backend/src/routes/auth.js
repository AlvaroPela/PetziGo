import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const router = Router();
const REGISTER_ROLES = ['USER', 'PROVIDER', 'ADMIN'];
const JWT_EXPIRES_IN = '12h';

const validateRegister = [
  body('role')
    .default('USER')
    .isIn(REGISTER_ROLES)
    .withMessage('Tipo de usuario invalido'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email invalido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contrasena debe tener al menos 6 caracteres'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (req.body.password !== value) {
        throw new Error('Las contrasenas no coinciden');
      }
      return true;
    }),
  body('name')
    .if(body('role').equals('USER'))
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio'),
  body('phone')
    .if(body('role').isIn(['USER', 'PROVIDER']))
    .trim()
    .notEmpty()
    .withMessage('El telefono es obligatorio'),
  body('address')
    .if(body('role').isIn(['USER', 'PROVIDER']))
    .trim()
    .notEmpty()
    .withMessage('La direccion es obligatoria'),
  body('legalRepresentative')
    .if(body('role').equals('PROVIDER'))
    .trim()
    .notEmpty()
    .withMessage('El nombre del representante legal es obligatorio'),
  body('companyName')
    .if(body('role').equals('PROVIDER'))
    .trim()
    .notEmpty()
    .withMessage('La razon social es obligatoria'),
  body('taxId')
    .if(body('role').equals('PROVIDER'))
    .trim()
    .notEmpty()
    .withMessage('El NIT es obligatorio')
];

router.post('/register', validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    role,
    email,
    password,
    name,
    phone,
    address,
    legalRepresentative,
    companyName,
    taxId
  } = req.body;

  const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ message: 'Email ya registrado' });
  }

  const hash = await bcrypt.hash(password, 10);

  const displayName = role === 'PROVIDER' ? companyName : name;
  const documentsStatus = role === 'PROVIDER' ? 'REQUESTED' : 'PENDING';

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, phone, address, legal_representative, company_name, tax_id, documents_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      displayName,
      email,
      hash,
      role,
      role === 'PROVIDER' || role === 'USER' ? phone : null,
      role === 'PROVIDER' || role === 'USER' ? address : null,
      role === 'PROVIDER' ? legalRepresentative : null,
      role === 'PROVIDER' ? companyName : null,
      role === 'PROVIDER' ? taxId : null,
      documentsStatus
    ]
  );

  const token = jwt.sign({ id: result.insertId, role }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.status(201).json({ token });
});

router.post('/login', [
  body('email').trim().isEmail().withMessage('Email invalido').normalizeEmail(),
  body('password').notEmpty().withMessage('La contrasena es obligatoria')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const [[user]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(401).json({ message: 'Credenciales invalidas' });
  }
  if (user.status === 'INACTIVE') {
    return res.status(403).json({ message: 'Usuario deshabilitado, contacta al administrador' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: 'Credenciales invalidas' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({
    token,
    role: user.role,
    name: user.name,
    phone: user.phone,
    address: user.address,
    documentsStatus: user.documents_status
  });
});

export default router;
