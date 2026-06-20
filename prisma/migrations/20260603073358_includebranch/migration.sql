-- CreateEnum
CREATE TYPE "SystemBranch" AS ENUM ('MAIN', 'IMUS', 'NASTECH', 'SHS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branch" "SystemBranch" NOT NULL DEFAULT 'MAIN';
