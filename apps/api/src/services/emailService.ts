import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
  clubName?: string,
): Promise<void> {
  const appUrl   = process.env.APP_URL ?? 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

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

  await transporter.sendMail({
    from: `"Club Flow" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Recuperar contraseña — Club Flow',
    html: emailWrapper(appUrl, content),
  });
}

export async function sendInvitationEmail(params: {
  to: string;
  token: string;
  clubName: string;
  inviterName?: string;
}): Promise<void> {
  const { to, token, clubName, inviterName } = params;
  const appUrl    = process.env.APP_URL ?? 'http://localhost:5173';
  const inviteUrl = `${appUrl}/invite?token=${token}`;

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

  await transporter.sendMail({
    from: `"Club Flow" <${process.env.SMTP_USER}>`,
    to,
    subject: `Invitación para unirte a ${clubName} — Club Flow`,
    replyTo: undefined,
    html: emailWrapper(appUrl, content),
  });
}
