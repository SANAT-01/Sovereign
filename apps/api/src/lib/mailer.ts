import nodemailer, { type Transporter } from 'nodemailer';

// Sends reminder digests (APPROACH.md §21) over Gmail SMTP using the app's
// own sender account — one server-wide credential, not per-user. Validated
// lazily (only when a send is actually attempted), same pattern as
// lib/kafka.ts's getKafka() — a deployment that never enables reminders
// shouldn't fail to boot over unset SMTP env vars.
//
// The transport is cached as a module-level singleton (`pool: true` lets
// nodemailer reuse/manage a small connection pool internally) instead of
// opening and tearing down a fresh SMTP connection on every single send —
// cheap at one user's scale, but the kind of per-call resource churn that
// adds up and is worth avoiding from the start.
let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (transport) return transport;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_APP_PASSWORD must be set to send reminder emails');
  }
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await getTransport().sendMail({
    from: `Sovereign <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}
