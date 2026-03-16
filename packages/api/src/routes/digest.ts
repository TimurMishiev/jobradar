import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';

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

    const jobSelect = {
      id: true,
      company: true,
      title: true,
      url: true,
      location: true,
      remoteType: true,
      seniorityGuess: true,
      postedAt: true,
      scores: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: { score: true, fitCategory: true, summary: true, matchReasons: true, missingSignals: true },
      },
      userActions: {
        where: { userId },
        select: { action: true },
      },
    };

    const [topScored, newToday, watchlist] = await Promise.all([
      // Top scored: jobs with score >= 70 in the last 7 days
      prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { gte: sevenDaysAgo },
          scores: { some: { score: { gte: 70 } } },
        },
        orderBy: { scores: { _count: 'desc' } },
        take: 10,
        select: jobSelect,
      }),

      // New today: jobs posted in the last 24h
      prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { gte: oneDayAgo },
        },
        orderBy: { postedAt: 'desc' },
        take: 20,
        select: jobSelect,
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
            select: jobSelect,
          })
        : Promise.resolve([]),
    ]);

    // Sort topScored by actual score descending (the DB orderBy above is approximate)
    topScored.sort((a, b) => (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0));

    return {
      generatedAt: new Date().toISOString(),
      topScored,
      newToday,
      watchlist,
    };
  });
}
