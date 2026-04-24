import prisma from '../lib/prisma';

// Prisma returns Decimal fields as objects that serialize to strings in JSON.
// Always convert to JS numbers before returning to the frontend.
function serializeProduct(p: { salePrice: unknown; purchasePrice: unknown; [key: string]: unknown }) {
  return {
    ...p,
    salePrice: Number(p.salePrice),
    purchasePrice: Number(p.purchasePrice),
  };
}

export async function getProducts(clubId: number) {
  const products = await prisma.product.findMany({
    where: { clubId },
    orderBy: { name: 'asc' },
  });
  return products.map(serializeProduct);
}

export async function createProduct(data: {
  name: string;
  salePrice: number;
  purchasePrice: number;
  stock: number;
  clubId: number;
}) {
  const product = await prisma.product.create({ data });
  return serializeProduct(product);
}

export async function updateProduct(
  id: number,
  data: { name?: string; salePrice?: number; purchasePrice?: number; stock?: number },
) {
  const product = await prisma.product.update({ where: { id }, data });
  return serializeProduct(product);
}

export async function deleteProduct(id: number) {
  return prisma.product.delete({ where: { id } });
}

export async function sellProduct(
  productId: number,
  quantity: number,
  paymentMethod: string,
  clubId: number,
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
    if (product.clubId !== clubId) throw Object.assign(new Error('Producto no pertenece al club'), { status: 403 });

    // Atomic check-and-decrement: fails if stock drops below quantity
    // between the findUnique above and this update.
    const result = await tx.product.updateMany({
      where: { id: productId, stock: { gte: quantity } },
      data:  { stock: { decrement: quantity } },
    });
    if (result.count === 0) throw Object.assign(new Error('Stock insuficiente'), { status: 400 });

    const salePrice = Number(product.salePrice);
    const amount    = salePrice * quantity;

    await tx.cashMovement.create({
      data: {
        clubId,
        type:             'income',
        concept:          `Venta - ${product.name} x${quantity}`,
        amount,
        paymentMethod,
        relatedProductId: productId,
      },
    });
    await tx.stockMovement.create({
      data: { productId, quantity: -quantity, type: 'sale' },
    });

    return serializeProduct({ ...product, stock: product.stock - quantity });
  });
}
