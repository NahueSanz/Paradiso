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
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
  if (product.clubId !== clubId) throw Object.assign(new Error('Producto no pertenece al club'), { status: 403 });
  if (product.stock < quantity) throw Object.assign(new Error('Stock insuficiente'), { status: 400 });

  const salePrice = Number(product.salePrice);
  const amount = salePrice * quantity;
  console.log({ productId, salePrice, quantity, amount });

  const [updated] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { stock: product.stock - quantity },
    }),
    prisma.cashMovement.create({
      data: {
        clubId,
        type: 'income',
        concept: `Venta - ${product.name} x${quantity}`,
        amount,
        paymentMethod,
        relatedProductId: productId,
      },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        quantity: -quantity,
        type: 'sale',
      },
    }),
  ]);

  return serializeProduct(updated);
}
