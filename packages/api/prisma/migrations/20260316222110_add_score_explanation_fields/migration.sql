-- AlterTable
ALTER TABLE "JobScore" ADD COLUMN     "matchReasons" TEXT[],
ADD COLUMN     "missingSignals" TEXT[],
ADD COLUMN     "summary" TEXT;
