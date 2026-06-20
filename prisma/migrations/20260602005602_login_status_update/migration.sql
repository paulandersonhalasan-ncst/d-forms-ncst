-- CreateEnum
CREATE TYPE "LoginStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "last_login" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "LoginStatus" NOT NULL DEFAULT 'SUCCESS',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "User"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
