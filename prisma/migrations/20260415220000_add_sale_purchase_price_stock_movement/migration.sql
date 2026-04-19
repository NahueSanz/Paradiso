-- AlterTable: rename price -> salePrice, rename quantity -> stock, add purchasePrice
ALTER TABLE "Product" RENAME COLUMN "price" TO "salePrice";
ALTER TABLE "Product" RENAME COLUMN "quantity" TO "stock";
ALTER TABLE "Product" ADD COLUMN "purchasePrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
