/*
  Warnings:

  - You are about to drop the column `departmentId` on the `User` table. All the data in the column will be lost.
  - Added the required column `departmentCode` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_departmentId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "departmentId",
ADD COLUMN     "departmentCode" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentCode_fkey" FOREIGN KEY ("departmentCode") REFERENCES "Department"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
