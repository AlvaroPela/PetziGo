#!/usr/bin/env node
import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { sendNow, ensureEmailJobsTable } from '../lib/mailer.js';

dotenv.config();

// Worker sencillo: poll a la tabla email_jobs y procesa pendientes.
async function processBatch(limit = 10) {
  try {
    await ensureEmailJobsTable();
    const [rows] = await pool.query('SELECT * FROM email_jobs WHERE status = ? ORDER BY created_at ASC LIMIT ?', ['pending', limit]);
    for (const r of rows) {
      const id = r.id;
      try {
        // marcar como processing
        await pool.query('UPDATE email_jobs SET status = ?, attempts = attempts + 1 WHERE id = ?', ['processing', id]);
        const to = r.recipient ? r.recipient.split(',').map(s => s.trim()).filter(Boolean) : [];
        const bcc = r.bcc ? r.bcc.split(',').map(s => s.trim()).filter(Boolean) : [];
        const payload = { to, bcc, subject: r.subject, html: r.html, text: r.text, replyTo: r.reply_to };
        const res = await sendNow(payload);
  await pool.query('UPDATE email_jobs SET status = ?, processed_at = NOW(), last_error = NULL WHERE id = ?', ['done', id]);
  // Info-level: a job completed successfully (useful to monitor delivery modes)
  console.info(`[email-worker] job ${id} done mode=${res?.mode || 'unknown'}`);
      } catch (jobErr) {
        console.error('[email-worker] job error', jobErr?.message || jobErr);
        try {
          await pool.query('UPDATE email_jobs SET status = ?, last_error = ?, processed_at = NOW() WHERE id = ?', ['failed', (jobErr?.message || String(jobErr)), id]);
        } catch (uerr) {
          console.error('[email-worker] failed updating job status:', uerr?.message || uerr);
        }
      }
    }
  } catch (err) {
    console.error('[email-worker] error procesando batch:', err?.message || err);
  }
}

async function main() {
  console.info('[email-worker] iniciando');
  while (true) {
    await processBatch(10);
    // Esperar 3s antes de siguiente ronda
    await new Promise(r => setTimeout(r, 3000));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
