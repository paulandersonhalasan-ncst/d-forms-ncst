/*
  Warnings:

  - You are about to drop the column `user_agent` on the `LoginLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LoginLog" DROP COLUMN "user_agent";
