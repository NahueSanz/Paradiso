-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'partial', 'paid');

-- CreateEnum
CREATE TYPE "PlayStatus" AS ENUM ('scheduled', 'playing', 'finished');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "playStatus" "PlayStatus" NOT NULL DEFAULT 'scheduled',
ADD COLUMN     "totalPrice" DECIMAL(10,2);
