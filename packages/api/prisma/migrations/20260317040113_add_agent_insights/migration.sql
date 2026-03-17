-- AlterTable
ALTER TABLE "JobScore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AgentInsight" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "AgentInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentInsight_type_idx" ON "AgentInsight"("type");

-- CreateIndex
CREATE INDEX "AgentInsight_generatedAt_idx" ON "AgentInsight"("generatedAt");
