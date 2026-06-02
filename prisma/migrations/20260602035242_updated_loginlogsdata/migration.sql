/*
  Warnings:

  - A unique constraint covering the columns `[employee_id,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "LoginLog" DROP CONSTRAINT "LoginLog_employee_id_fkey";

-- AlterTable
ALTER TABLE "LoginLog" ADD COLUMN     "email" TEXT,
ALTER COLUMN "employee_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_employee_id_email_key" ON "User"("employee_id", "email");

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_employee_id_email_fkey" FOREIGN KEY ("employee_id", "email") REFERENCES "User"("employee_id", "email") ON DELETE CASCADE ON UPDATE CASCADE;
