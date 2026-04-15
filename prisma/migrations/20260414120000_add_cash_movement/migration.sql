-- CreateTable
CREATE TABLE "CashMovement" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "relatedReservationId" INTEGER,
    "fixedReservationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
