-- Clear dev data that blocks the migration (Club rows without an owner)
-- Courts reference Club via FK, so courts must be cleared first
DELETE FROM "Court";
DELETE FROM "Club";

-- AlterTable: add ownerId to Club
ALTER TABLE "Club" ADD COLUMN "ownerId" INTEGER NOT NULL;

-- CreateIndex: one owner → one club
CREATE UNIQUE INDEX "Club_ownerId_key" ON "Club"("ownerId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
