import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {pool} from '../config/db.js';

const router = Router();
const JWT_EXPIRES_IN = '12h';

function isEmail(v) {
  return /.+@.+\..+/.test(String(v).toLowerCase());
}
function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

/**
 * Registro flexible:
 * - Soporta body con:
 *   a) { userType: 'BUYER'|'PROVIDER', ... }
 *   b) { role: 'USER'|'PROVIDER'|'ADMIN', ... }  // se mapea a userType
 * - Campos de proveedor: legalRepName / legalRepresentative, companyName, nit / taxId
 */
router.post('/register', async (req, res) => {
  try {
    const {
      // comunes
      name,
      lastName,
      email,
      password,
      address = '',
      phone = '',

      // variantes de tipo/rol
      userType,                    // 'BUYER' | 'PROVIDER'
      role,                        // 'USER' | 'PROVIDER' | 'ADMIN' (frontend viejo)

      // proveedor (admite alias)
      legalRepName,
      legalRepresentative,
      companyName,
      nit,
      taxId,

      // opcional de versiones anteriores
      documentType,
    } = req.body || {};

    // Normalización tipo/rol
    const finalUserType = userType
      ? userType.toUpperCase()
      : (role === 'PROVIDER' ? 'PROVIDER' : 'BUYER');

    const finalRole = finalUserType === 'PROVIDER'
      ? 'PROVIDER'
      : (role === 'ADMIN' ? 'ADMIN' : 'USER'); // por si llega ADMIN

    const repName = legalRepName || legalRepresentative || null;
    const finalNit = nit || taxId || null;

    // Validaciones básicas
    if (!name || name.trim().length < 2) return res.status(400).json({ message: 'Nombre inválido' });
    //if (!lastName || lastName.trim().length < 2) return res.status(400).json({ message: 'Apellido inválido' });
    if (!isEmail(email)) return res.status(400).json({ message: 'Email inválido' });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Contraseña muy corta' });

    const phoneDigits = onlyDigits(phone);
    if (address && address.trim().length < 5) return res.status(400).json({ message: 'Dirección inválida' });
    if (phone && phoneDigits.length < 8) return res.status(400).json({ message: 'Celular inválido' });

    if (!['BUYER', 'PROVIDER'].includes(finalUserType))
      return res.status(400).json({ message: 'Tipo de usuario inválido' });

    if (finalUserType === 'PROVIDER') {
      if (!companyName || companyName.trim().length < 3)
        return res.status(400).json({ message: 'Razón social inválida' });
      if (!repName || repName.trim().length < 3)
        return res.status(400).json({ message: 'Representante legal inválido' });
      if (!finalNit || String(finalNit).trim().length < 4)
        return res.status(400).json({ message: 'NIT inválido' });
    }

    // Email único
    const [existing] = await pool.query('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email ya registrado' });

    // Hash y alta
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users
        (name, email, password_hash, role, user_type, address, phone, legal_rep_name, company_name, nit, document_type)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name.trim(),
        //lastName.trim(),
        email.trim(),
        hash,
        finalRole,               // USER | PROVIDER | ADMIN
        finalUserType,           // BUYER | PROVIDER
        address ? address.trim() : null,
        phoneDigits || null,
        finalUserType === 'PROVIDER' ? repName : null,
        finalUserType === 'PROVIDER' ? companyName : null,
        finalUserType === 'PROVIDER' ? finalNit : null,
        documentType || null,
      ]
    );

    // Puedes devolver token o solo confirmar registro; aquí devolvemos minimal
    res.status(201).json({
      id: result.insertId,
      name,
      lastName,
      email,
      role: finalRole,
      userType: finalUserType,
      message: 'Usuario registrado',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error en registro' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isEmail(email)) return res.status(400).json({ message: 'Email inválido' });
    if (!password) return res.status(400).json({ message: 'Contraseña requerida' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Credenciales inválidas' });

    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash || '');
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

    // Si manejas is_active (0/1), puedes bloquear aquí
    if (typeof u.is_active !== 'undefined' && u.is_active === 0) {
      return res.status(403).json({ message: 'Cuenta deshabilitada' });
    }

    const token = jwt.sign(
      { id: u.id, role: u.role },
      process.env.JWT_SECRET || 'dev',
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      role: u.role,
      userType: u.user_type,
      name: u.name,
      lastName: u.last_name,
      email: u.email,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

export default router;
