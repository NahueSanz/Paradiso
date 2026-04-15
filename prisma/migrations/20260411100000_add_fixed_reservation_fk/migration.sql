-- AddForeignKey
ALTER TABLE "FixedReservation" ADD CONSTRAINT "FixedReservation_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
