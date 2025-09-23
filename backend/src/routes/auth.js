import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
const router = Router();
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      lastName,
      email,
      password,
      role = 'USER',
      documentType = 'CC',
      address = '',
      phone = ''
    } = req.body || {};

    if (!name || name.trim().length < 2) return res.status(400).json({ message: 'Nombre inválido' });
    if (!lastName || lastName.trim().length < 2) return res.status(400).json({ message: 'Apellido inválido' });
    if (!/.+@.+\..+/.test(email)) return res.status(400).json({ message: 'Email inválido' });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Contraseña muy corta' });

    const rolesOk = ['USER','PROVIDER','ADMIN'];
    if (!rolesOk.includes(role)) return res.status(400).json({ message: 'Rol inválido' });

    const docsOk = ['CC','CE','PA','NIT'];
    if (!docsOk.includes(documentType)) return res.status(400).json({ message: 'Tipo de documento inválido' });

    const phoneDigits = String(phone || '').replace(/\D/g, '');
    if (phoneDigits && phoneDigits.length < 8) return res.status(400).json({ message: 'Celular inválido' });
    if (address && address.trim().length < 5) return res.status(400).json({ message: 'Dirección inválida' });

    const [existing] = await db.query('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email ya registrado' });

    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, last_name, email, password_hash, role, document_type, address, phone) VALUES (?,?,?,?,?,?,?,?)',
      [name.trim(), lastName.trim(), email.trim(), hash, role, documentType, address.trim(), phoneDigits]
    );

    res.status(201).json({
      id: result.insertId,
      name, lastName, email, role, documentType,
      address, phone: phoneDigits
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error en registro' });
  }
});

export default router;
