-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN "relatedProductId" INTEGER;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
