/*
  Warnings:

  - Added the required column `updatedAt` to the `JobScore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add updatedAt, backfill existing rows with createdAt
ALTER TABLE "JobScore" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
UPDATE "JobScore" SET "updatedAt" = "createdAt";
