import nodemailer from 'nodemailer';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import { MailtrapTransport } from 'mailtrap';
import 'dotenv/config';
import { pool } from '../config/db.js';

function buildSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [String(value)];
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  const originalRecipients = toArray(to);
  const redirectTo = (process.env.EMAIL_REDIRECT_ALL_TO || '').trim();
  let effectiveTo = originalRecipients;

  if (redirectTo) {
    effectiveTo = [redirectTo];
    const prefix = `[REDIRECTED→${redirectTo}] `;
    subject = subject ? prefix + subject : prefix + '(sin asunto)';
    const note = `<p style=\"font-size:12px;color:#888\"><em>Originalmente para: ${originalRecipients.join(', ')}</em></p>`;
    if (html) html = note + (html || '');
    if (!html && text) html = `<pre style=\"font-family:monospace\">${text}</pre>` + note;
    if (text) text = `Originalmente para: ${originalRecipients.join(', ')}\n\n${text}`;
  }

  // 1) MailerSend
  const msApiKey = process.env.MAILERSEND_API_KEY || process.env.API_KEY;
  if (msApiKey) {
    try {
      const mailerSend = new MailerSend({ apiKey: msApiKey });
      const fromEmail = process.env.MAILERSEND_FROM_EMAIL || process.env.SMTP_FROM || 'no-reply@petzigo.local';
      const fromName = process.env.MAILERSEND_FROM_NAME || 'PetziGo';
      const sentFrom = new Sender(fromEmail, fromName);
      const recipients = toArray(effectiveTo).map((addr) => new Recipient(String(addr), String(addr).split('@')[0] || 'Usuario'));
      const params = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject || '(sin asunto)');
      if (html) params.setHtml(html);
      if (text) params.setText(text);
      await mailerSend.email.send(params);
      return { ok: true, mode: 'mailersend' };
    } catch (err) {
      const detail = err?.statusCode ? ` status=${err.statusCode} body=${JSON.stringify(err.body)}` : (err?.message || String(err));
      console.warn('[mailer] MailerSend falló, intentando Mailtrap...', detail);
    }
  }

  // 2) Mailtrap API transport
  const mtToken = (process.env.MAILTRAP_TOKEN || '').trim();
  if (mtToken) {
    try {
      // Resolver inboxId automáticamente si no está definido
      let inboxId = process.env.MAILTRAP_TEST_INBOX_ID ? Number(process.env.MAILTRAP_TEST_INBOX_ID) : undefined;
      if (!inboxId || Number.isNaN(inboxId)) {
        try {
          const base = 'https://sandbox.api.mailtrap.io';
          // 1) Obtener cuentas para derivar accountId
          const accResp = await fetch(`${base}/api/accounts`, {
            headers: { Authorization: `Bearer ${mtToken}`, 'Content-Type': 'application/json' },
          });
          let accountId = null;
          if (accResp.ok) {
            const acc = await accResp.json();
            const accFirst = Array.isArray(acc?.data) ? acc.data[0] : (Array.isArray(acc) ? acc[0] : (acc?.data || null));
            accountId = accFirst?.id || accFirst?.account_id || null;
          } else {
            console.warn(`[mailer] Mailtrap: fallo listando accounts (status ${accResp.status})`);
          }

          // 2) Listar inboxes
          if (accountId) {
            const ibResp = await fetch(`${base}/api/accounts/${accountId}/inboxes`, {
              headers: { Authorization: `Bearer ${mtToken}`, 'Content-Type': 'application/json' },
            });
            if (ibResp.ok) {
              const ib = await ibResp.json();
              const first = Array.isArray(ib?.data) ? ib.data[0] : (Array.isArray(ib) ? ib[0] : null);
              const id = first?.id || first?.inbox_id || null;
              if (id) {
                inboxId = Number(id);
                console.info(`[mailer] Mailtrap: usando testInboxId ${inboxId} (auto)`);
              } else {
                console.warn('[mailer] Mailtrap: no se pudo determinar testInboxId automáticamente (sin inboxes)');
              }
            } else {
              console.warn(`[mailer] Mailtrap: fallo listando inboxes (status ${ibResp.status})`);
            }
          } else {
            // fallback al endpoint antiguo de test/inboxes
            const resp = await fetch(`${base}/api/test/inboxes`, {
              headers: { Authorization: `Bearer ${mtToken}`, 'Content-Type': 'application/json' },
            });
            if (resp.ok) {
              const data = await resp.json();
              const first = Array.isArray(data?.data) ? data.data[0] : (Array.isArray(data) ? data[0] : null);
              const id = first?.id || first?.inbox_id || null;
              if (id) {
                inboxId = Number(id);
                console.info(`[mailer] Mailtrap: usando testInboxId ${inboxId} (legacy)`);
              } else {
                console.warn('[mailer] Mailtrap: no se pudo determinar testInboxId automáticamente');
              }
            } else {
              console.warn(`[mailer] Mailtrap: fallo obteniendo inboxes legacy (status ${resp.status})`);
            }
          }
        } catch (e) {
          console.warn('[mailer] Mailtrap: error listando inboxes:', e?.message || String(e));
        }
      }

      const transport = nodemailer.createTransport(MailtrapTransport({
        token: mtToken,
        testInboxId: inboxId,
      }));
      const from = process.env.SMTP_FROM || process.env.MAILERSEND_FROM_EMAIL || 'no-reply@petzigo.local';
      const mailOpts = { from, to: toArray(effectiveTo).join(', '), subject, html, text };
      if (replyTo) mailOpts.replyTo = replyTo;
      if (process.env.MAILTRAP_CATEGORY) mailOpts.category = process.env.MAILTRAP_CATEGORY;
      if (process.env.MAILTRAP_SANDBOX === 'true') mailOpts.sandbox = true;
      await transport.sendMail(mailOpts);
      return { ok: true, mode: 'mailtrap' };
    } catch (err) {
      console.warn('[mailer] Mailtrap falló, intentando SMTP...', err?.message || String(err));
    }
  }

  // 3) SMTP
  const from = process.env.SMTP_FROM || 'no-reply@petzigo.local';
  const transport = buildSmtpTransport();
  if (transport) {
    const mailOpts = { from, to: toArray(effectiveTo).join(', '), subject, html, text };
    if (replyTo) mailOpts.replyTo = replyTo;
    await transport.sendMail(mailOpts);
    return { ok: true, mode: 'smtp' };
  }

  // 4) Consola
  console.log('[MAIL FAKE] To:', toArray(effectiveTo).join(', '), 'Subject:', subject, '\n', html || text || '');
  return { ok: true, mode: 'console' };
}

export async function sendOrderEmails(orderId) {
  const [[row]] = await pool.query(`
    SELECT o.*,
           cu.email AS client_email, cu.name AS client_name, cu.phone AS client_phone,
           pu.email AS provider_email, pu.name AS provider_name, pu.phone AS provider_phone,
           s.title AS service_title,
           p.name AS product_name,
           pt.name AS pet_name, pt.species AS pet_species
    FROM orders o
    JOIN users cu ON cu.id = o.user_id
    JOIN users pu ON pu.id = o.provider_id
    LEFT JOIN services s ON s.id = o.service_id
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN pets pt ON pt.id = o.pet_id
    WHERE o.id = ?
  `, [orderId]);

  if (!row) return { ok: false, reason: 'order-not-found' };

  try {
    if (typeof row.notifications_sent !== 'undefined' && row.notifications_sent) {
      return { ok: true, skipped: true };
    }
  } catch (_) {}

  const itemTitle = row.item_type === 'SERVICE' ? (row.service_title || 'Servicio') : (row.product_name || 'Producto');
  const subjectClient = row.item_type === 'SERVICE'
    ? `Tu reserva fue confirmada: ${itemTitle}`
    : `Tu compra fue confirmada: ${itemTitle}`;
  const subjectProvider = row.item_type === 'SERVICE'
    ? `Nueva reserva recibida: ${itemTitle}`
    : `Nueva compra recibida: ${itemTitle}`;

  const when = row.service_date ? new Date(row.service_date).toLocaleString('es-CO') : null;
  const total = Number(row.total_amount).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
  const petInfo = row.pet_name ? `${row.pet_name}${row.pet_species ? ` (${row.pet_species})` : ''}` : null;

  const feUrl = (process.env.FRONTEND_URL || '').replace(/\/?$/, '');
  const detailUrl = row.item_type === 'SERVICE'
    ? (row.service_id ? `${feUrl}/services/${row.service_id}` : null)
    : (row.product_id ? `${feUrl}/products/${row.product_id}` : null);

  const baseHtml = (who) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111">
      <h2>${who === 'client' ? '¡Gracias por tu pago!' : '¡Tienes un nuevo pedido!'}</h2>
      <p><strong>Orden #${row.id}</strong> – ${row.item_type === 'SERVICE' ? 'Servicio' : 'Producto'}</p>
      <p><strong>${row.item_type === 'SERVICE' ? 'Servicio' : 'Producto'}:</strong> ${itemTitle}</p>
      ${row.item_type === 'SERVICE' && when ? `<p><strong>Fecha/Hora:</strong> ${when}</p>` : ''}
      <p><strong>Cantidad:</strong> ${row.quantity}</p>
      <p><strong>Total:</strong> ${total}</p>
      ${row.address ? `<p><strong>Dirección:</strong> ${row.address}</p>` : ''}
      ${row.notes ? `<p><strong>Notas:</strong> ${row.notes}</p>` : ''}
      ${petInfo ? `<p><strong>Mascota:</strong> ${petInfo}</p>` : ''}
      ${detailUrl ? `<p><a href="${detailUrl}" target="_blank" rel="noreferrer">Ver detalle en la app</a></p>` : ''}
      <hr/>
      <p style="margin: 8px 0 4px; font-weight: bold;">Contacto ${who === 'client' ? 'del proveedor' : 'del cliente'}:</p>
      <p>
        ${who === 'client'
          ? `${row.provider_name || 'Proveedor'}${row.provider_email ? ` &lt;${row.provider_email}&gt;` : ''}${row.provider_phone ? ` — ${row.provider_phone}` : ''}`
          : `${row.client_name || 'Cliente'}${row.client_email ? ` &lt;${row.client_email}&gt;` : ''}${row.client_phone ? ` — ${row.client_phone}` : ''}`}
      </p>
      <hr/>
      <p style="font-size: 12px; color: #555">Este correo se generó automáticamente al confirmarse el pago.</p>
    </div>
  `;

  if (row.client_email) {
    await sendMail({ to: row.client_email, subject: subjectClient, html: baseHtml('client'), replyTo: row.provider_email || undefined });
  }
  if (row.provider_email) {
    await sendMail({ to: row.provider_email, subject: subjectProvider, html: baseHtml('provider'), replyTo: row.client_email || undefined });
  }

  try {
    await pool.query('UPDATE orders SET notifications_sent = 1, notifications_sent_at = NOW(), updated_at = NOW() WHERE id = ?', [orderId]);
  } catch (e) {
    console.warn('[mailer] No se pudo marcar notifications_sent:', e?.message || e);
  }

  return { ok: true };
}
