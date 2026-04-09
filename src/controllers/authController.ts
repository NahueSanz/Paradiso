import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

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

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: name ?? email,
      role: (role as Role) ?? Role.employee,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  res.status(201).json({ status: 'success', token, user });
}

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

  const { password: _pw, ...safeUser } = user;
  res.json({ status: 'success', token, user: safeUser });
}
