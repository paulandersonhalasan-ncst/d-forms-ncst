/*
  Warnings:

  - You are about to drop the column `employee_id` on the `LoginLog` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LoginLog" DROP CONSTRAINT "LoginLog_employee_id_email_fkey";

-- DropIndex
DROP INDEX "User_employee_id_email_key";

-- AlterTable
ALTER TABLE "LoginLog" DROP COLUMN "employee_id",
ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
