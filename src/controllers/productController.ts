import { NextFunction, Request, Response } from 'express';
import * as productService from '../services/productService';
import prisma from '../lib/prisma';

// ── GET /products?clubId=
export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clubId = Number(req.query.clubId);
    if (!Number.isInteger(clubId) || clubId <= 0) {
      res.status(400).json({ message: 'clubId must be a positive integer' });
      return;
    }
    const products = await productService.getProducts(clubId);
    res.json(products);
  } catch (err) {
    next(err);
  }
}

// ── POST /products
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, salePrice, purchasePrice, stock } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ message: 'name is required' });
      return;
    }
    if (typeof salePrice !== 'number' || salePrice < 0) {
      res.status(400).json({ message: 'salePrice must be a non-negative number' });
      return;
    }
    if (typeof purchasePrice !== 'number' || purchasePrice < 0) {
      res.status(400).json({ message: 'purchasePrice must be a non-negative number' });
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      res.status(400).json({ message: 'stock must be a non-negative integer' });
      return;
    }

    const membership = await prisma.membership.findFirst({ where: { userId: req.user.id } });
    if (!membership) {
      res.status(403).json({ message: 'User has no club membership' });
      return;
    }

    const product = await productService.createProduct({ name, salePrice, purchasePrice, stock, clubId: membership.clubId });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

// ── PUT /products/:id
export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name, salePrice, purchasePrice, stock } = req.body;

    const product = await productService.updateProduct(id, { name, salePrice, purchasePrice, stock });
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /products/:id
export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    await productService.deleteProduct(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ── POST /products/sell  (also used by POST /cash/sell)
export async function sellProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, quantity, paymentMethod } = req.body;

    if (!Number.isInteger(productId) || productId <= 0) {
      res.status(400).json({ message: 'productId must be a positive integer' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ message: 'quantity must be a positive integer' });
      return;
    }
    if (!paymentMethod || typeof paymentMethod !== 'string') {
      res.status(400).json({ message: 'paymentMethod is required' });
      return;
    }

    const membership = await prisma.membership.findFirst({ where: { userId: req.user.id } });
    if (!membership) {
      res.status(403).json({ message: 'User has no club membership' });
      return;
    }

    const updated = await productService.sellProduct(productId, quantity, paymentMethod, membership.clubId);
    res.json(updated);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    next(err);
  }
}
