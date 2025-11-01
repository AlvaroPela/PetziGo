import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

async function main() {
  const [,, nameArg, emailArg, passArg] = process.argv;
  const name = nameArg || process.env.ADMIN_NAME || 'Administrador';
  const email = emailArg || process.env.ADMIN_EMAIL;
  const password = passArg || process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('\nUso: node src/scripts/create_admin.js "Nombre Admin" admin@ejemplo.com "Password123"');
    console.error('O define variables de entorno ADMIN_EMAIL y ADMIN_PASSWORD (opcional ADMIN_NAME).');
    process.exit(1);
  }

  console.log('Creando/actualizando usuario ADMIN…');
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [rows] = await pool.query('SELECT id, role, status FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length) {
      const user = rows[0];
      await pool.query(
        'UPDATE users SET name = ?, password_hash = ?, role = ?, status = ? WHERE id = ?',
        [name, passwordHash, 'ADMIN', 'ACTIVE', user.id]
      );
      console.log(`Usuario existente actualizado a ADMIN: ${email}`);
    } else {
      const [res] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
        [name, email, passwordHash, 'ADMIN', 'ACTIVE']
      );
      console.log(`Usuario ADMIN creado (id=${res.insertId}): ${email}`);
    }
  } catch (err) {
    console.error('Error creando admin:', err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
