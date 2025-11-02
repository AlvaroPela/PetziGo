#!/usr/bin/env node
// Script simple para enviar un email de prueba usando backend/src/lib/mailer.js
// Uso:
// node src/scripts/send_test_mail.js --to=dest@example.com --bcc=copy@example.com --subject="Hola" --text="cuerpo"

import 'dotenv/config';
import { sendMail } from '../lib/mailer.js';

function parseArg(name) {
  const arg = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  return undefined;
}

const to = parseArg('to') || process.env.TEST_EMAIL_TO || process.env.EMAIL_REDIRECT_ALL_TO || 'test-recipient@example.com';
const bcc = parseArg('bcc') || process.env.EMAIL_BCC_TO || '';
const subject = parseArg('subject') || 'Prueba de correo desde PetziGo';
const text = parseArg('text') || 'Este es un correo de prueba enviado desde send_test_mail.js';
const html = parseArg('html') || null;
const replyTo = parseArg('replyTo') || undefined;

(async () => {
  try {
    console.log('Enviando correo de prueba...');
    const res = await sendMail({ to, bcc: bcc || undefined, subject, text, html, replyTo });
    console.log('Resultado:', res);
    process.exit(0);
  } catch (e) {
    console.error('Error enviando correo de prueba:', e);
    process.exit(1);
  }
})();
