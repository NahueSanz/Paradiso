import nodemailer from 'nodemailer';

const SMTP_HOST   = process.env.SMTP_HOST   ?? 'smtp.gmail.com';
const SMTP_PORT   = Number(process.env.SMTP_PORT ?? 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

console.log(`[EMAIL] Creating transporter — host:${SMTP_HOST} port:${SMTP_PORT} secure:${SMTP_SECURE}`);

const transporter = nodemailer.createTransport({
  host:   SMTP_HOST,
  port:   SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10_000,
  greetingTimeout:   10_000,
  socketTimeout:     15_000,
});

// Called once at startup to verify SMTP reachability.
export async function verifySmtp(): Promise<void> {
  try {
    await transporter.verify();
    console.log('[EMAIL] SMTP READY');
  } catch (err) {
    console.error('[EMAIL] SMTP FAILED —', (err as Error).message);
  }
}

// Wraps a promise with a hard timeout so SMTP hangs never block the request.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`SMTP timeout after ${ms}ms [${label}]`)), ms),
    ),
  ]);
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function emailHeader(appUrl: string): string {
  return `
    <div style="background:#4338ca;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center">
      <img src="${appUrl}/logo-icon.png" alt="Club Flow" height="40"
           style="display:inline-block;vertical-align:middle;margin-right:10px" />
      <span style="color:#fff;font-size:20px;font-weight:700;vertical-align:middle;font-family:sans-serif">
        Club Flow
      </span>
    </div>
  `;
}

const emailFooter = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">
      Enviado por <strong>Club Flow</strong> — Plataforma de gestión de clubes
    </p>
  </div>
`;

function emailWrapper(appUrl: string, content: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
      ${emailHeader(appUrl)}
      <div style="padding:28px 32px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        ${content}
        ${emailFooter}
      </div>
    </div>
  `;
}

// ── sendPasswordResetEmail ────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
  clubName?: string,
): Promise<void> {
  const appUrl   = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  const start    = Date.now();

  console.log(`[EMAIL] sendPasswordResetEmail — to:${to} host:${SMTP_HOST}:${SMTP_PORT} secure:${SMTP_SECURE} ts:${new Date().toISOString()}`);

  const content = `
    <h2 style="color:#111;margin-top:0;font-size:18px">Recuperar contraseña</h2>
    ${clubName ? `<p style="color:#6b7280;font-size:13px;margin-top:-8px">para tu cuenta en <strong>${clubName}</strong></p>` : ''}
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <p>Hacé clic en el siguiente botón para crear una nueva contraseña. Este enlace expira en <strong>1 hora</strong>.</p>
    <a href="${resetUrl}"
       style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4338ca;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
      Restablecer contraseña
    </a>
    <p style="color:#6b7280;font-size:13px">Si no solicitaste este cambio, ignorá este correo. Tu contraseña no será modificada.</p>
    <p style="color:#6b7280;font-size:12px">O copiá este enlace en tu navegador:<br/>${resetUrl}</p>
  `;

  try {
    console.log(`[EMAIL] Calling sendMail (password-reset) → ${SMTP_HOST}:${SMTP_PORT}`);
    await withTimeout(
      transporter.sendMail({
        from:    `"Club Flow" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Recuperar contraseña — Club Flow',
        html:    emailWrapper(appUrl, content),
      }),
      20_000,
      'password-reset',
    );
    console.log(`[EMAIL] sendMail resolved (password-reset) in ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`[EMAIL] sendMail FAILED (password-reset) after ${Date.now() - start}ms —`, (err as Error).message);
    throw err;
  }
}

// ── sendInvitationEmail ───────────────────────────────────────────────────────

export async function sendInvitationEmail(params: {
  to: string;
  token: string;
  clubName: string;
  inviterName?: string;
}): Promise<void> {
  const { to, token, clubName, inviterName } = params;
  const appUrl    = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const inviteUrl = `${appUrl}/invite?token=${token}`;
  const start     = Date.now();

  console.log(`[EMAIL] sendInvitationEmail — to:${to} club:${clubName} host:${SMTP_HOST}:${SMTP_PORT} secure:${SMTP_SECURE} ts:${new Date().toISOString()}`);

  const inviterLine = inviterName
    ? `<p><strong>${inviterName}</strong> te invitó a unirte al equipo de <strong>${clubName}</strong>.</p>`
    : `<p>Fuiste invitado/a a unirte al equipo de <strong>${clubName}</strong>.</p>`;

  const content = `
    <h2 style="color:#111;margin-top:0;font-size:18px">Invitación a unirte a ${clubName}</h2>
    ${inviterLine}
    <p>Hacé clic en el botón para crear tu cuenta. La invitación expira en <strong>7 días</strong>.</p>
    <a href="${inviteUrl}"
       style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4338ca;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
      Aceptar invitación
    </a>
    <p style="color:#6b7280;font-size:12px">O copiá este enlace en tu navegador:<br/>${inviteUrl}</p>
    <p style="color:#6b7280;font-size:11px">Si no esperabas esta invitación, podés ignorar este correo.</p>
  `;

  try {
    console.log(`[EMAIL] Calling sendMail (invitation) → ${SMTP_HOST}:${SMTP_PORT}`);
    await withTimeout(
      transporter.sendMail({
        from:    `"Club Flow" <${process.env.SMTP_USER}>`,
        to,
        subject: `Invitación para unirte a ${clubName} — Club Flow`,
        html:    emailWrapper(appUrl, content),
      }),
      20_000,
      'invitation',
    );
    console.log(`[EMAIL] sendMail resolved (invitation) in ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`[EMAIL] sendMail FAILED (invitation) after ${Date.now() - start}ms —`, (err as Error).message);
    throw err;
  }
}
