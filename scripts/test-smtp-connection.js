const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
const secure = process.env.SMTP_SECURE === 'true';
const user = process.env.SMTP_USER || '';
const password = process.env.SMTP_PASSWORD || '';

async function main() {
  console.log('Testing SMTP connection with:');
  console.log({
    host,
    port,
    secure,
    user: user || '(not set)',
    password: password ? '(set)' : '(not set)',
  });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: password } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  await transporter.verify();
  console.log('SMTP connection successful.');
}

main().catch((err) => {
  console.error('SMTP connection failed.');
  console.error({
    code: err.code,
    command: err.command,
    response: err.response,
    responseCode: err.responseCode,
    message: err.message,
  });
  process.exitCode = 1;
});
