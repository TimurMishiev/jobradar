import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';
import { fetchSignalsContext, computeSignals } from '../lib/opportunitySignals';

export async function digestRoutes(app: FastifyInstance) {
  // GET /api/digest
  // Returns a daily job intelligence summary:
  //   topScored    — highest-scoring jobs from the last 7 days (score >= 70, limit 10)
  //   newToday     — jobs posted in the last 24 hours (limit 20)
  //   watchlist    — recent jobs from the user's preferred companies (last 7 days, limit 10)
  app.get('/', async () => {
    const user = await getLocalUser();
    const userId = user?.id ?? '__no_user__';

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const profile = user
      ? await prisma.userProfile.findUnique({ where: { userId: user.id } })
      : null;

    const preferredCompanies = profile?.preferredCompanies ?? [];

    const jobInclude = {
      omit: { rawPayload: true, descriptionRaw: true } as const,
      include: {
        scores: { take: 1, orderBy: { createdAt: 'desc' as const } },
        userActions: { where: { userId } },
      },
    };

    const [topScored, newToday, watchlist, signalsCtx] = await Promise.all([
      // Top scored: jobs with score >= 70 in the last 7 days
      prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { gte: sevenDaysAgo },
          scores: { some: { score: { gte: 70 } } },
        },
        orderBy: { postedAt: 'desc' },
        take: 10,
        ...jobInclude,
      }),

      // New today: jobs posted in the last 24h
      prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { gte: oneDayAgo },
        },
        orderBy: { postedAt: 'desc' },
        take: 20,
        ...jobInclude,
      }),

      // Watchlist: recent jobs from preferred companies
      preferredCompanies.length > 0
        ? prisma.job.findMany({
            where: {
              isActive: true,
              postedAt: { gte: sevenDaysAgo },
              company: { in: preferredCompanies },
            },
            orderBy: { postedAt: 'desc' },
            take: 10,
            ...jobInclude,
          })
        : Promise.resolve([]),
      user ? fetchSignalsContext(user.id) : Promise.resolve(null),
    ]);

    // Sort topScored by actual score descending (the DB orderBy above is approximate)
    topScored.sort((a, b) => (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0));

    // Batch-fetch score history for all digest jobs and attach to signalsCtx
    if (signalsCtx && user) {
      const allJobs = [...topScored, ...newToday, ...watchlist];
      const jobIds = [...new Set(allJobs.map((j) => j.id))];
      if (jobIds.length > 0) {
        const historyRows = await prisma.scoreHistory.findMany({
          where: { jobId: { in: jobIds }, userId: user.id },
          orderBy: { createdAt: 'asc' },
          select: { jobId: true, score: true },
        });
        for (const row of historyRows) {
          const list = signalsCtx.scoreHistoryByJob.get(row.jobId) ?? [];
          list.push({ score: row.score });
          signalsCtx.scoreHistoryByJob.set(row.jobId, list);
        }
      }
    }

    const withSignals = (jobs: typeof topScored) =>
      jobs.map((job) => ({
        ...job,
        opportunitySignals: signalsCtx ? computeSignals(job, signalsCtx) : [],
      }));

    return {
      generatedAt: new Date().toISOString(),
      topScored:  withSignals(topScored),
      newToday:   withSignals(newToday),
      watchlist:  withSignals(watchlist),
    };
  });
}
