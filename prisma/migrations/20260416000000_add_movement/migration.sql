-- CreateTable
CREATE TABLE "Movement" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "productId" INTEGER,
    "quantity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
