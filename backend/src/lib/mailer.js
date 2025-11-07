import nodemailer from 'nodemailer';
// mailersend / mailtrap are optional runtime dependencies; import them dynamically
import 'dotenv/config';
import { pool } from '../config/db.js';

// Simple in-memory send queue to rate-limit outbound emails.
// Uses a process-wide FIFO queue and waits EMAIL_SEND_INTERVAL_MS between sends.
const EMAIL_SEND_INTERVAL_MS = Number(process.env.EMAIL_SEND_INTERVAL_MS || process.env.EMAIL_SEND_RATE_MS || 5000);
const _sendQueue = [];
let _sendProcessing = false;

function enqueueSendTask(fn) {
  return new Promise((resolve, reject) => {
    _sendQueue.push({ fn, resolve, reject });
    if (!_sendProcessing) processSendQueue();
  });
}

async function processSendQueue() {
  _sendProcessing = true;
  while (_sendQueue.length > 0) {
    const item = _sendQueue.shift();
    try {
      const res = await item.fn();
      item.resolve(res);
    } catch (err) {
      item.reject(err);
    }
    // wait interval before next send
    await new Promise(r => setTimeout(r, Math.max(0, EMAIL_SEND_INTERVAL_MS)));
  }
  _sendProcessing = false;
}

// --- Email queue table helper (minimal) ---
export async function ensureEmailJobsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_jobs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        recipient TEXT,
        bcc TEXT,
        subject TEXT,
        html LONGTEXT,
        text LONGTEXT,
        reply_to VARCHAR(255),
        status VARCHAR(32) DEFAULT 'pending',
        attempts INT DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    // This is important for async mode; surface as an error
    console.error('[mailer] no se pudo crear/verificar tabla email_jobs:', e?.message || e);
  }
}

// Función interna que realiza el envío real (intentar transportar con las mismas reglas actuales)
export async function sendNow({ to, bcc, subject, html, text, replyTo }) {
  // Wrap the real send logic into a task and enqueue it so we honor the global rate limit.
  const task = async () => {
    // replicate previous inline transport logic but simplified by using existing code paths
    const originalRecipients = Array.isArray(to) ? to : (to ? [String(to)] : []);
    const redirectTo = (process.env.EMAIL_REDIRECT_ALL_TO || '').trim();
    let effectiveTo = originalRecipients;

    if (redirectTo) {
      effectiveTo = [redirectTo];
      const prefix = `[REDIRECTED→${redirectTo}] `;
      subject = subject ? prefix + subject : prefix + '(sin asunto)';
      const note = `<p style="font-size:12px;color:#888"><em>Originalmente para: ${originalRecipients.join(', ')}</em></p>`;
      if (html) html = note + (html || '');
      if (!html && text) html = `<pre style="font-family:monospace">${text}</pre>` + note;
      if (text) text = `Originalmente para: ${originalRecipients.join(', ')}\n\n${text}`;
    }

    // Try MailerSend if key present
    const msApiKey = process.env.MAILERSEND_API_KEY || process.env.API_KEY;
    // Try Mailgun if configured (prefer Mailgun as primary provider when present)
    const mgApiKey = (process.env.MAILGUN_API_KEY || '').trim();
    const mgDomain = (process.env.MAILGUN_DOMAIN || '').trim();
    const mgBase = (process.env.MAILGUN_BASE_URL || '').trim() || undefined;
    if (mgApiKey && mgDomain) {
      try {
        // Use application/x-www-form-urlencoded via URLSearchParams to call Mailgun HTTP API.
        const fromEmail = process.env.SMTP_FROM || process.env.MAILERSEND_FROM_EMAIL || `no-reply@${mgDomain}`;
        const params = new URLSearchParams();
        params.append('from', fromEmail);
        params.append('to', (effectiveTo || []).join(','));
        params.append('subject', subject || '(sin asunto)');
        if (text) params.append('text', text);
        if (html) params.append('html', html);
        if (bcc) params.append('bcc', Array.isArray(bcc) ? bcc.join(',') : String(bcc));
        if (replyTo) params.append('h:Reply-To', replyTo);

        const base = mgBase || 'https://api.mailgun.net';
        const url = `${base.replace(/\/$/, '')}/v3/${mgDomain}/messages`;
        const auth = Buffer.from(`api:${mgApiKey}`).toString('base64');

        // prefer global fetch if available, else use node-fetch
        let fetchFn = globalThis.fetch;
        if (!fetchFn) {
          try { fetchFn = (await import('node-fetch')).default; } catch (e) { fetchFn = null; }
        }
        if (!fetchFn) throw new Error('fetch no disponible para Mailgun; instala node-fetch o usa SMTP');

        const resp = await fetchFn(url, { method: 'POST', body: params.toString(), headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '<no body>');
          throw new Error(`Mailgun API error ${resp.status}: ${body}`);
        }
        return { ok: true, mode: 'mailgun' };
      } catch (err) {
        console.error('[mailer] Mailgun falló, intentando siguientes transportes:', err?.message || String(err));
      }
    }
    if (msApiKey) {
      try {
        const ms = await import('mailersend');
        const MailerSendLib = ms.MailerSend || ms.default || ms;
        const EmailParams = ms.EmailParams || (ms.default && ms.default.EmailParams) || null;
        const Sender = ms.Sender || (ms.default && ms.default.Sender) || null;
        const Recipient = ms.Recipient || (ms.default && ms.default.Recipient) || null;
        if (!MailerSendLib || !EmailParams || !Sender || !Recipient) throw new Error('mailersend api shape not found');
        const mailerSend = new MailerSendLib({ apiKey: msApiKey });
        const fromEmail = process.env.MAILERSEND_FROM_EMAIL || process.env.SMTP_FROM || 'no-reply@petzigo.local';
        const fromName = process.env.MAILERSEND_FROM_NAME || 'PetziGo';
        const sentFrom = new Sender(fromEmail, fromName);
        const recipients = effectiveTo.map((addr) => new Recipient(String(addr), String(addr).split('@')[0] || 'Usuario'));
        const params = new EmailParams().setFrom(sentFrom).setTo(recipients).setSubject(subject || '(sin asunto)');
        if (bcc) {
          const bccRecipients = (Array.isArray(bcc) ? bcc : [bcc]).map(a => new Recipient(String(a), String(a).split('@')[0] || 'Usuario'));
          if (typeof params.setBcc === 'function') params.setBcc(bccRecipients);
          else if (typeof params.addBcc === 'function') params.addBcc(bccRecipients);
        }
        if (html) params.setHtml(html);
        if (text) params.setText(text);
        await mailerSend.email.send(params);
        return { ok: true, mode: 'mailersend' };
      } catch (err) {
        // MailerSend failures are relevant; surface as error so monitoring/alerts catch them
        console.error('[mailer] MailerSend falló, intentando siguientes transportes:', err?.message || String(err));
      }
    }

    // Mailtrap API path
    const mtToken = (process.env.MAILTRAP_TOKEN || '').trim();
    if (mtToken) {
      try {
        let inboxId = process.env.MAILTRAP_TEST_INBOX_ID ? Number(process.env.MAILTRAP_TEST_INBOX_ID) : undefined;
        // attempt auto-resolution omitted here for brevity (keep previous behaviour if package exists)
        let MailtrapTransportLib = null;
        try { const mt = await import('mailtrap'); MailtrapTransportLib = mt.MailtrapTransport || mt.default || null; } catch (e) { MailtrapTransportLib = null; }
        if (MailtrapTransportLib) {
          const transport = nodemailer.createTransport(MailtrapTransportLib({ token: mtToken, testInboxId: inboxId }));
          const from = process.env.SMTP_FROM || process.env.MAILERSEND_FROM_EMAIL || 'no-reply@petzigo.local';
          const mailOpts = { from, to: (effectiveTo || []).join(', '), subject, html, text };
          if (bcc) mailOpts.bcc = (Array.isArray(bcc) ? bcc : [bcc]).join(', ');
          if (replyTo) mailOpts.replyTo = replyTo;
          await transport.sendMail(mailOpts);
          return { ok: true, mode: 'mailtrap' };
        }
      } catch (err) {
        console.error('[mailer] Mailtrap falló, intentando SMTP...', err?.message || String(err));
      }
    }

    // SMTP
    const from = process.env.SMTP_FROM || 'no-reply@petzigo.local';
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    const mailOpts = { from, to: (effectiveTo || []).join(', '), subject, html, text };
    if (bcc) mailOpts.bcc = (Array.isArray(bcc) ? bcc : [bcc]).join(', ');
    if (replyTo) mailOpts.replyTo = replyTo;
    try {
      await transport.sendMail(mailOpts);
      return { ok: true, mode: 'smtp' };
    } catch (e) {
      console.error('[mailer] SMTP falló:', e?.message || String(e));
      // Fall back to console only for local/dev; don't spam logs in production
    }

    // Fallback to console
    // In dev environments we may want to inspect fake mails; keep at debug level
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[MAIL FAKE] To:', (effectiveTo || []).join(', '), 'Subject:', subject, '\n', html || text || '');
    }
    return { ok: true, mode: 'console' };
  };

  // enqueue the actual network send to respect the global rate limit
  return await enqueueSendTask(task);
}

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

export async function sendMail({ to, bcc, subject, html, text, replyTo }) {
  // Si se configura EMAIL_ASYNC=true, encolamos el correo en la tabla email_jobs
  const asyncMode = String(process.env.EMAIL_ASYNC || 'false').toLowerCase() === 'true';
  if (asyncMode) {
    try {
      await ensureEmailJobsTable();
      const [res] = await pool.query('INSERT INTO email_jobs (recipient, bcc, subject, html, text, reply_to, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        Array.isArray(to) ? to.join(',') : (to || ''),
        Array.isArray(bcc) ? bcc.join(',') : (bcc || ''),
        subject || '', html || '', text || '', replyTo || '', 'pending'
      ]);
      // Log enqueue action so we can debug missing jobs in production
      try {
        console.info('[mailer] enqueued email job id=', res.insertId, 'to=', Array.isArray(to) ? to.join(',') : (to || ''));
      } catch (_) {}
      return { ok: true, queued: true };
    } catch (e) {
      console.error('[mailer] no se pudo encolar correo, fallback a envío inmediato:', e?.message || String(e));
      // continue to immediate send
    }
  }
  // Por defecto, enviar inmediatamente (sin bloqueo adicional)
  return await sendNow({ to, bcc, subject, html, text, replyTo });
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
  // Determine subjects and message variants depending on item type and order status
  const isService = (row.item_type || '').toUpperCase() === 'SERVICE';
  const status = (row.status || '').toUpperCase();

  let subjectClient;
  let subjectProvider;
  if (isService) {
    if (status === 'PENDING') {
      subjectClient = `🐾 Reserva pendiente: ${itemTitle}`;
      subjectProvider = `🐾 Nueva solicitud de reserva: ${itemTitle}`;
    } else if (status === 'ACCEPTED' || status === 'IN_PROGRESS') {
      subjectClient = `✅ Reserva confirmada: ${itemTitle}`;
      subjectProvider = `✅ Reserva aceptada: ${itemTitle}`;
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      subjectClient = `❌ Reserva cancelada: ${itemTitle}`;
      subjectProvider = `❌ Reserva cancelada: ${itemTitle}`;
    } else {
      subjectClient = `Información sobre tu reserva: ${itemTitle}`;
      subjectProvider = `Nueva reserva: ${itemTitle}`;
    }
  } else {
    // Product
    subjectClient = `🐾 Compra confirmada: ${itemTitle}`;
    subjectProvider = `🐾 Nueva compra recibida: ${itemTitle}`;
  }

  const when = row.service_date ? new Date(row.service_date).toLocaleString('es-CO') : null;
  const total = Number(row.total_amount).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
  const petInfo = row.pet_name ? `${row.pet_name}${row.pet_species ? ` (${row.pet_species})` : ''}` : null;

  const feUrl = (process.env.FRONTEND_URL || '').replace(/\/?$/, '');
  const detailUrl = row.item_type === 'SERVICE'
    ? (row.service_id ? `${feUrl}/services/${row.service_id}` : null)
    : (row.product_id ? `${feUrl}/products/${row.product_id}` : null);

  const needsPayment = isService && String(row.payment_status || '').toUpperCase() !== 'COMPLETED';

  const baseHtml = (who) => {
    const header = isService
      ? (status === 'PENDING'
          ? (who === 'client' ? 'Tu reserva está pendiente de aprobación' : 'Tienes una nueva solicitud de reserva')
          : (status === 'ACCEPTED' || status === 'IN_PROGRESS' ? (who === 'client' ? 'Reserva confirmada' : 'Reserva aceptada') : 'Información de la orden'))
      : (who === 'client' ? 'Gracias por tu compra' : 'Has recibido una nueva compra');

    const introClient = isService
      ? (status === 'PENDING'
          ? `Hemos enviado tu solicitud de reserva al proveedor <strong>${row.provider_name || ''}</strong>. Queda pendiente su aprobación. Te avisaremos en cuanto la acepten.`
          : (status === 'ACCEPTED' || status === 'IN_PROGRESS'
              ? `¡Buena noticia! Tu reserva ha sido aceptada por <strong>${row.provider_name || ''}</strong>. Aquí están los detalles.`
              : `Aquí tienes la información sobre tu reserva.`))
      : `Gracias por tu compra. Aquí están los detalles de tu pedido.`;

    const introProvider = isService
      ? (status === 'PENDING'
          ? `Tienes una nueva solicitud de reserva de <strong>${row.client_name || 'un cliente'}</strong>. Revisa los detalles y confirma o rechaza la reserva.`
          : (status === 'ACCEPTED' || status === 'IN_PROGRESS'
              ? `Has confirmado la reserva. Gracias por atender la solicitud — el cliente ha sido notificado.`
              : `Información sobre la reserva.`))
      : `Has recibido una nueva orden de compra. Revisa los detalles y gestiona el envío.`;

    const whoIntro = who === 'client' ? introClient : introProvider;
    // Action steps depending on role and status
    const actionStepsClient = (() => {
      if (isService) {
        if (status === 'PENDING') return `<ol><li>Espera la confirmación del proveedor.</li><li>Si deseas cancelar, puedes hacerlo desde la app o contactando al proveedor.</li></ol>`;
        if (status === 'ACCEPTED' || status === 'IN_PROGRESS') return `<ol><li>Prepárate para el servicio en la fecha indicada.</li><li>Contacta al proveedor si necesitas indicar instrucciones adicionales.</li></ol>`;
        if (status === 'DELIVERED' || status === 'COMPLETED') return `<ol><li>Comprueba que el servicio/producto fue entregado correctamente.</li><li>Deja una reseña para ayudar a otros usuarios.</li></ol>`;
        if (status === 'CANCELLED') return `<ol><li>Revisa la información de reembolso en tu panel.</li><li>Contacta soporte si hay algún problema.</li></ol>`;
      }
      // product or default
      if (status === 'DELIVERED' || status === 'COMPLETED') return `<ol><li>Verifica la recepción del producto.</li><li>Deja una reseña para el vendedor.</li></ol>`;
      return `<ol><li>Revisa tu panel para más detalles.</li></ol>`;
    })();

    const actionStepsProvider = (() => {
      if (isService) {
        if (status === 'PENDING') return `<ol><li>Revisa la solicitud y acepta o rechaza desde tu panel de proveedor.</li><li>Si aceptas, coordina con el cliente la preparación.</li></ol>`;
        if (status === 'ACCEPTED' || status === 'IN_PROGRESS') return `<ol><li>Confirma los detalles con el cliente si es necesario.</li><li>Marca la orden como completada/entregada cuando finalices.</li></ol>`;
        if (status === 'DELIVERED' || status === 'COMPLETED') return `<ol><li>Confirma que el servicio fue realizado.</li><li>Pide al cliente que deje una reseña.</li></ol>`;
        if (status === 'CANCELLED') return `<ol><li>Registra la razón de la cancelación en el panel.</li><li>Contacta soporte si hay discrepancias.</li></ol>`;
      }
      // product or default
      return `<ol><li>Gestiona el envío y marca como entregado cuando corresponda.</li></ol>`;
    })();

    const actionsHtml = `<div style="margin:10px 0;padding:10px;background:#FFF; border-radius:6px;border:1px solid #f2f2f2;"><p style="margin:0 0 6px;font-weight:600">Pasos recomendados</p>${who === 'client' ? actionStepsClient : actionStepsProvider}</div>`;

    return `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height:1.5; color:#222; max-width:680px;">
        <div style="background:#FFFAF0; padding:18px; border-radius:8px; border:1px solid #F0E6D6;">
          <h1 style="margin:0 0 8px; font-size:20px;">${header} ${isService ? '🐾' : '🛍️'}</h1>
          <p style="margin:0 0 12px; font-size:14px; color:#444">${whoIntro}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:12px 0"/>
          <p style="margin:6px 0"><strong>Orden</strong>: #${row.id}</p>
          <p style="margin:6px 0"><strong>${isService ? 'Servicio' : 'Producto'}</strong>: ${itemTitle}</p>
          ${isService && when ? `<p style="margin:6px 0"><strong>Fecha/Hora</strong>: ${when}</p>` : ''}
          <p style="margin:6px 0"><strong>Cantidad</strong>: ${row.quantity}</p>
          <p style="margin:6px 0"><strong>Total</strong>: ${total}</p>
          ${row.address ? `<p style="margin:6px 0"><strong>Dirección</strong>: ${row.address}</p>` : ''}
          ${petInfo ? `<p style="margin:6px 0"><strong>Mascota</strong>: ${petInfo}</p>` : ''}
          ${row.notes ? `<p style="margin:6px 0"><strong>Notas</strong>: ${row.notes}</p>` : ''}
          ${who === 'client' && needsPayment && status === 'ACCEPTED' ? `
            <p style="margin:12px 0"><a href="${feUrl}/payments/checkout?orderId=${row.id}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 16px;background:#FF6B6B;color:white;border-radius:8px;font-weight:700;text-decoration:none">Pagar ahora</a></p>
            <p style="margin:6px 0;font-weight:600;color:#333">Reserva confirmada 🐾 — Ingresa a realizar el pago para asegurar tu turno.</p>
          ` : ''}
          <hr style="border:none;border-top:1px solid #eee;margin:10px 0"/>
          <p style="margin:6px 0;font-size:13px;color:#555"><strong>Contacto ${who === 'client' ? 'del proveedor' : 'del cliente'}</strong></p>
          <p style="margin:4px 0;color:#333">${who === 'client'
            ? `${row.provider_name || 'Proveedor'}${row.provider_email ? ` &lt;${row.provider_email}&gt;` : ''}${row.provider_phone ? ` — ${row.provider_phone}` : ''}`
            : `${row.client_name || 'Cliente'}${row.client_email ? ` &lt;${row.client_email}&gt;` : ''}${row.client_phone ? ` — ${row.client_phone}` : ''}`}</p>
          <p style="margin-top:12px;font-size:12px;color:#888">Este es un mensaje automático de PetziGo — cuidado y cariño para tu mascota 🐶🐱</p>
        </div>
      </div>
    `;
  };

  const envBcc = (process.env.EMAIL_BCC_TO || process.env.EMAIL_COPY_TO || 'zonavipcol@gmail.com');
  // Build a plain-text alternative to improve deliverability for simple clients
  const buildText = (who) => {
    const lines = [];
    lines.push(`${who === 'client' ? 'Cliente' : 'Proveedor'} — Orden #${row.id}`);
    lines.push(`Estado: ${status}`);
    lines.push(`${isService ? 'Servicio' : 'Producto'}: ${itemTitle}`);
    if (when) lines.push(`Fecha/Hora: ${when}`);
    lines.push(`Cantidad: ${row.quantity}`);
    lines.push(`Total: ${total}`);
    if (row.address) lines.push(`Dirección: ${row.address}`);
    if (petInfo) lines.push(`Mascota: ${petInfo}`);
    if (row.notes) lines.push(`Notas: ${row.notes}`);
    lines.push('');
    lines.push(who === 'client' ? (isService ? (status === 'PENDING' ? 'Pasos: Espera la confirmación del proveedor.' : (status === 'ACCEPTED' || status === 'IN_PROGRESS' ? 'Pasos: Prepárate para el servicio en la fecha indicada.' : 'Pasos: Revisa la orden en tu panel.')) : 'Pasos: Revisa tu pedido en el panel.') : (isService ? (status === 'PENDING' ? 'Pasos: Revisa la solicitud y acepta o rechaza desde tu panel.' : 'Pasos: Marca la orden como completada cuando termine.') : 'Pasos: Gestiona el envío y marca como entregado.'));
    lines.push('');
    lines.push(`Contacto ${who === 'client' ? 'del proveedor' : 'del cliente'}:`);
    lines.push(who === 'client' ? `${row.provider_name || ''} ${row.provider_email || ''} ${row.provider_phone || ''}` : `${row.client_name || ''} ${row.client_email || ''} ${row.client_phone || ''}`);
    lines.push('---');
    lines.push('Mensaje generado por PetziGo');
    return lines.join('\n');
  };

  if (row.client_email) {
    // Enviar de forma no bloqueante: si EMAIL_ASYNC=true se encolará, sino se enviará inmediatamente
    try {
      sendMail({ to: row.client_email, bcc: envBcc, subject: subjectClient, html: baseHtml('client'), text: buildText('client'), replyTo: row.provider_email || undefined }).catch(e => console.error('[mailer] error sendMail client:', e));
    } catch (e) {
      console.error('[mailer] sendMail client threw:', e);
    }
  }
  if (row.provider_email) {
    try {
      sendMail({ to: row.provider_email, bcc: envBcc, subject: subjectProvider, html: baseHtml('provider'), text: buildText('provider'), replyTo: row.client_email || undefined }).catch(e => console.error('[mailer] error sendMail provider:', e));
    } catch (e) {
      console.error('[mailer] sendMail provider threw:', e);
    }
  }

  try {
    await pool.query('UPDATE orders SET notifications_sent = 1, notifications_sent_at = NOW(), updated_at = NOW() WHERE id = ?', [orderId]);
  } catch (e) {
    console.error('[mailer] No se pudo marcar notifications_sent:', e?.message || e);
  }

  return { ok: true };
}
