import { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';

// ── GET /chat/messages
export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.membership) {
      res.status(403).json({ message: 'X-Club-Id header required' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { clubId: req.membership.clubId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(messages);
  } catch (err) {
    next(err);
  }
}

// ── POST /chat/messages
export async function postMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.membership) {
      res.status(403).json({ message: 'X-Club-Id header required' });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim() === '') {
      res.status(400).json({ message: 'content is required' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        clubId:   req.membership.clubId,
        senderId: req.user.id,
        content:  content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}
