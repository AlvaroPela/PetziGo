import 'dotenv/config';
import { sendOrderEmails } from '../lib/mailer.js';

const idArg = process.argv[2];
if (!idArg) {
  console.error('Usage: node run_send_order_emails.js <orderId>');
  process.exit(2);
}

(async () => {
  try {
    const id = Number(idArg);
    console.info('[script] invoking sendOrderEmails for orderId=', id);
    const res = await sendOrderEmails(id);
    console.info('[script] result:', res);
    process.exit(0);
  } catch (e) {
    console.error('[script] error calling sendOrderEmails:', e);
    process.exit(1);
  }
})();
