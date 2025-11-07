import 'dotenv/config';
import { sendNow } from '../lib/mailer.js';

async function run() {
  console.log('[test-mailgun] iniciando prueba de envío via Mailgun...');
  try {
    const res = await sendNow({
      to: process.env.TEST_MAIL_TO || 'duvancorrea96@gmail.com',
      subject: 'Prueba Mailgun PetziGo',
      text: 'Esta es una prueba de envío usando Mailgun desde el backend de PetziGo.',
      html: '<p>Esta es una <strong>prueba</strong> de envío usando <em>Mailgun</em> desde el backend de PetziGo.</p>'
    });
    console.log('[test-mailgun] resultado:', res);
  } catch (e) {
    console.error('[test-mailgun] error:', e);
    process.exitCode = 2;
  }
}

run();
