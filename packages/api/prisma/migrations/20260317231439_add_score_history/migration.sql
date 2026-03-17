-- CreateEnum
CREATE TYPE "ScoreTrigger" AS ENUM ('INITIAL', 'PROFILE_CHANGE', 'RESUME_CHANGE', 'MANUAL');

-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "trigger" "ScoreTrigger" NOT NULL,
    "reasonSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreHistory_jobId_idx" ON "ScoreHistory"("jobId");

-- CreateIndex
CREATE INDEX "ScoreHistory_userId_createdAt_idx" ON "ScoreHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScoreHistory" ADD CONSTRAINT "ScoreHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
