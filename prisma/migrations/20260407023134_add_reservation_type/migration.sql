-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('booking', 'class', 'tournament', 'challenge');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "type" "ReservationType" NOT NULL DEFAULT 'booking';
