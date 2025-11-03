#!/usr/bin/env node
// Script: aprueba todas las reseñas PENDING y recalcula ratings de proveedores
import 'dotenv/config';
import { pool } from '../config/db.js';

async function main() {
  console.info('[script] aprobando reseñas PENDING y recalculando ratings');
  try {
    const [pending] = await pool.query("SELECT id, provider_id FROM reviews WHERE status = 'PENDING'");
    console.info('[script] pending count=', pending.length);
    if (pending.length === 0) {
      console.info('[script] nada que aprobar');
      process.exit(0);
    }

    // Agrupar por provider
    const providerSet = new Set(pending.map(p => p.provider_id));
    const providers = Array.from(providerSet);

  // Aprobar todas (reviews no tiene columna updated_at en este esquema)
  const [res] = await pool.query("UPDATE reviews SET status = 'APPROVED' WHERE status = 'PENDING'");
    console.info('[script] updated rows=', res.affectedRows);

    // Recalcular por proveedor
    for (const pid of providers) {
      const [[agg]] = await pool.query('SELECT COALESCE(AVG(rating),0) AS avgRating, COUNT(*) AS cnt FROM reviews WHERE provider_id = ? AND status = "APPROVED"', [pid]);
      const avg = Number(agg?.avgRating || 0).toFixed(2);
      const cnt = Number(agg?.cnt || 0);
      await pool.query('UPDATE provider_profiles SET average_rating = ?, total_reviews = ? WHERE user_id = ?', [avg, cnt, pid]);
      console.info('[script] provider', pid, 'avg=', avg, 'cnt=', cnt);
    }

    console.info('[script] listo');
    process.exit(0);
  } catch (err) {
    console.error('[script] error', err);
    process.exit(2);
  }
}

main();
