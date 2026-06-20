/*
  Warnings:

  - The values [SSO,SHS,NASTECH,INSTRUCTOR,OCM,PSMO,IIRT,MARKETING,BRAND,CDO,IMUS] on the enum `Department` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Department_new" AS ENUM ('AMT', 'ARCHITECTURE', 'BUSINESS', 'CJED', 'CSD', 'EDPSYCOMM', 'GENED', 'NSTP', 'ENGINEERING', 'HEROES', 'HTMD', 'RESEARCH', 'SSMT', 'ACAD', 'ACCOUNTING', 'OP', 'OCMCDO', 'HRD', 'GUIDANCE', 'OSA', 'HSO', 'ITJPO', 'ITO', 'LIBRARY', 'PRD', 'PSMOFMO', 'REGISTRAR', 'SAFETYSECURITY');
ALTER TABLE "public"."User" ALTER COLUMN "department" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "department" TYPE "Department_new" USING ("department"::text::"Department_new");
ALTER TYPE "Department" RENAME TO "Department_old";
ALTER TYPE "Department_new" RENAME TO "Department";
DROP TYPE "public"."Department_old";
ALTER TABLE "User" ALTER COLUMN "department" SET DEFAULT 'ITO';
COMMIT;
