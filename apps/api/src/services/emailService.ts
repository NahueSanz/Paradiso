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

export async function sendVerificationEmail(
  to: string,
  rawToken: string,
  clubName?: string,
): Promise<void> {
  const brandName = clubName ?? 'ClubFlow';
  const appUrl    = process.env.APP_URL ?? 'http://localhost:5173';
  const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;

  await transporter.sendMail({
    from: `"${brandName}" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Verificá tu cuenta',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="margin-bottom:16px">
          <img src="${appUrl}/logo-icon.svg" alt="${brandName}" height="36" style="display:block" />
        </div>
        <h2 style="color:#4338ca;margin-top:0">${brandName}</h2>
        <p>¡Bienvenido/a! Hacé clic en el siguiente botón para verificar tu dirección de correo electrónico.</p>
        <p>Este enlace expira en <strong>24 horas</strong>.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4338ca;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verificar cuenta
        </a>
        <p style="color:#6b7280;font-size:13px">Si no creaste esta cuenta, podés ignorar este correo.</p>
        <p style="color:#6b7280;font-size:12px">O copiá este enlace en tu navegador:<br/>${verifyUrl}</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
  clubName?: string,
): Promise<void> {
  const brandName = clubName ?? 'ClubFlow';
  const appUrl    = process.env.APP_URL ?? 'http://localhost:5173';
  const resetUrl  = `${appUrl}/reset-password?token=${rawToken}`;

  await transporter.sendMail({
    from: `"${brandName}" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Recuperar contraseña',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="margin-bottom:16px">
          <img src="${appUrl}/logo-icon.svg" alt="${brandName}" height="36" style="display:block" />
        </div>
        <h2 style="color:#4338ca;margin-top:0">${brandName}</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Hacé clic en el siguiente botón para crear una nueva contraseña. Este enlace expira en <strong>1 hora</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4338ca;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Restablecer contraseña
        </a>
        <p style="color:#6b7280;font-size:13px">Si no solicitaste este cambio, ignorá este correo. Tu contraseña no será modificada.</p>
        <p style="color:#6b7280;font-size:12px">O copiá este enlace en tu navegador:<br/>${resetUrl}</p>
      </div>
    `,
  });
}
