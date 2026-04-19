import prisma from '../lib/prisma';

function serialize(m: { amount: unknown; [key: string]: unknown }) {
  return { ...m, amount: Number(m.amount) };
}

export async function getMovements(clubId: number) {
  const items = await prisma.movement.findMany({
    where: { clubId },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return items.map(serialize);
}

export async function createManualMovement(data: {
  clubId: number;
  amount: number;
  description: string;
  paymentMethod: string;
}) {
  const movement = await prisma.movement.create({
    data: {
      clubId: data.clubId,
      type: 'manual',
      amount: data.amount,
      description: data.description,
      paymentMethod: data.paymentMethod,
      status: 'active',
    },
  });
  return serialize(movement);
}

export async function createSaleMovement(data: {
  clubId: number;
  productId: number;
  quantity: number;
  paymentMethod: string;
}) {
  const product = await prisma.product.findUnique({ where: { id: data.productId } });

  if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
  if (product.clubId !== data.clubId) throw Object.assign(new Error('Producto no pertenece al club'), { status: 403 });
  if (product.stock < data.quantity) throw Object.assign(new Error('Stock insuficiente'), { status: 400 });

  const amount = Number(product.salePrice) * data.quantity;

  const [movement] = await prisma.$transaction([
    prisma.movement.create({
      data: {
        clubId: data.clubId,
        type: 'sale',
        amount,
        description: `Venta - ${product.name} x${data.quantity}`,
        productId: data.productId,
        quantity: data.quantity,
        paymentMethod: data.paymentMethod,
        status: 'active',
      },
    }),
    prisma.product.update({
      where: { id: data.productId },
      data: { stock: product.stock - data.quantity },
    }),
    prisma.stockMovement.create({
      data: { productId: data.productId, quantity: -data.quantity, type: 'sale' },
    }),
  ]);

  return serialize(movement);
}

export async function cancelMovement(id: number, clubId: number) {
  const movement = await prisma.movement.findUnique({ where: { id } });

  if (!movement) throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });
  if (movement.clubId !== clubId) throw Object.assign(new Error('Sin permiso'), { status: 403 });
  if (movement.type !== 'sale') throw Object.assign(new Error('Solo se pueden cancelar ventas'), { status: 400 });
  if (movement.status === 'cancelled') throw Object.assign(new Error('El movimiento ya está cancelado'), { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.movement.update({ where: { id }, data: { status: 'cancelled' } });

    if (movement.productId && movement.quantity) {
      await tx.product.update({
        where: { id: movement.productId },
        data: { stock: { increment: movement.quantity } },
      });
      await tx.stockMovement.create({
        data: { productId: movement.productId, quantity: movement.quantity, type: 'restock' },
      });
    }

    return cancelled;
  });

  return serialize(updated);
}

export async function deleteMovement(id: number, clubId: number) {
  const movement = await prisma.movement.findUnique({ where: { id } });

  if (!movement) throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });
  if (movement.clubId !== clubId) throw Object.assign(new Error('Sin permiso'), { status: 403 });
  if (movement.type !== 'manual') throw Object.assign(new Error('Solo se pueden eliminar movimientos manuales'), { status: 400 });

  await prisma.movement.delete({ where: { id } });
}
