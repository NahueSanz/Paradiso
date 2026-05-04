import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { Role } from '@prisma/client';
import { sendPasswordResetEmail } from '../services/emailService';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

// ─── helpers ──────────────────────────────────────────────────────────────────

function generateToken(): { rawToken: string; hashedToken: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
}

/** Strip all fields that must never reach the client. */
function sanitizeUser(user: Record<string, unknown>) {
  const {
    password: _pw,
    resetPasswordToken: _rpt,
    resetPasswordExpires: _rpe,
    ...safe
  } = user;
  return safe;
}

// ─── register ─────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, role } = req.body;

  if (!email || !password) {
    res.status(400).json({ status: 'error', message: 'Email and password are required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ status: 'error', message: 'Email already in use' });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: name ?? email,
      role: (role as Role) ?? Role.employee,
    },
  });

  res.status(201).json({
    status: 'success',
    message: 'Cuenta creada correctamente.',
  });
}

// ─── login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ status: 'error', message: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  res.json({ status: 'success', token, user: sanitizeUser(user as unknown as Record<string, unknown>) });
}

// ─── forgotPassword ───────────────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  const successMsg =
    'Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.';

  if (!email) {
    res.json({ status: 'success', message: successMsg });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const { rawToken, hashedToken } = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: hashedToken, resetPasswordExpires: expires },
    });

    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch (err) {
      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: null, resetPasswordExpires: null },
      });
      console.error('[auth] Failed to send password reset email:', err);
      res.status(500).json({
        status: 'error',
        message: 'Error al enviar el correo. Intenta de nuevo más tarde.',
      });
      return;
    }
  }

  res.json({ status: 'success', message: successMsg });
}

// ─── resetPassword ────────────────────────────────────────────────────────────

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    res.status(400).json({ status: 'error', message: 'Token y nueva contraseña son requeridos' });
    return;
  }

  const trimmed = newPassword.trim();
  if (trimmed.length < 8) {
    res.status(400).json({
      status: 'error',
      message: 'La contraseña debe tener al menos 8 caracteres',
    });
    return;
  }
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    res.status(400).json({
      status: 'error',
      message: 'La contraseña debe contener al menos una letra o número',
    });
    return;
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const userByToken = await prisma.user.findFirst({
    where: { resetPasswordToken: hashedToken },
  });

  const user =
    userByToken?.resetPasswordExpires && userByToken.resetPasswordExpires > new Date()
      ? userByToken
      : null;

  if (!user) {
    if (userByToken) {
      console.warn(`[auth] Expired password reset token for user id=${userByToken.id}`);
    } else {
      console.warn('[auth] Unknown password reset token attempt');
    }
    res.status(400).json({ status: 'error', message: 'El enlace es inválido o ha expirado' });
    return;
  }

  const hashedPassword = await bcrypt.hash(trimmed, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  res.json({ status: 'success', message: 'Contraseña actualizada correctamente' });
}
