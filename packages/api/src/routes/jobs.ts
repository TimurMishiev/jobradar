import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getLocalUser, getOrCreateLocalUser } from '../lib/user';

const VALID_ACTIONS = ['SAVED', 'IGNORED', 'APPLIED'] as const;
type JobAction = (typeof VALID_ACTIONS)[number];

export async function jobRoutes(app: FastifyInstance) {
  // GET /api/jobs
  // Query params:
  //   page, limit          — pagination
  //   company              — filter by company name
  //   remoteType           — filter by remote type
  //   seniority            — filter by seniorityGuess
  //   action               — show only jobs with this user action (SAVED | APPLIED | IGNORED)
  //   hideIgnored          — 'true' to exclude jobs the user has ignored
  //   postedWithin         — days since posting: 30 | 60 | 90 (default) | 'all'
  app.get('/', async (request) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      company?: string;
      remoteType?: string;
      seniority?: string;
      action?: string;
      hideIgnored?: string;
      postedWithin?: string;
    };

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit ?? '25', 10) || 25), 100);
    const offset = (page - 1) * limit;

    const user = await getLocalUser();
    const userId = user?.id ?? '__no_user__';

    // Default to 90 days; pass 'all' to disable the cutoff
    const VALID_DAYS = [30, 60, 90];
    const rawDays = query.postedWithin;
    const parsedDays = rawDays === 'all' ? null : parseInt(rawDays ?? '90', 10);
    const postedWithinDays = parsedDays !== null && VALID_DAYS.includes(parsedDays) ? parsedDays : 90;
    const postedAfter =
      rawDays === 'all'
        ? undefined
        : new Date(Date.now() - postedWithinDays * 24 * 60 * 60 * 1000);

    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...(postedAfter ? { postedAt: { gte: postedAfter } } : {}),
      ...(query.company ? { company: query.company } : {}),
      ...(query.remoteType ? { remoteType: query.remoteType } : {}),
      ...(query.seniority ? { seniorityGuess: query.seniority } : {}),
    };

    // Filter to jobs matching a specific user action
    if (query.action && VALID_ACTIONS.includes(query.action.toUpperCase() as JobAction)) {
      where.userActions = {
        some: { userId, action: query.action.toUpperCase() as JobAction },
      };
    }

    // Hide jobs the user has ignored (used on the main feed)
    if (query.hideIgnored === 'true' && user) {
      where.NOT = {
        userActions: { some: { userId, action: 'IGNORED' } },
      };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { postedAt: 'desc' },
        take: limit,
        skip: offset,
        omit: { rawPayload: true, descriptionRaw: true },
        include: {
          scores: { take: 1, orderBy: { createdAt: 'desc' } },
          userActions: { where: { userId } },
        },
      }),
      prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  });

  // GET /api/jobs/:id — full detail including description
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getLocalUser();
    const userId = user?.id ?? '__no_user__';

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        scores: { orderBy: { createdAt: 'desc' } },
        userActions: { where: { userId } },
      },
    });

    if (!job) return reply.code(404).send({ error: 'Job not found' });
    return job;
  });

  // POST /api/jobs/:id/action
  app.post('/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { action?: unknown; notes?: unknown };

    if (!body.action || !VALID_ACTIONS.includes(body.action as JobAction)) {
      return reply.code(400).send({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    const action = body.action as JobAction;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;
    const user = await getOrCreateLocalUser();

    const result = await prisma.userJobAction.upsert({
      where: { userId_jobId: { userId: user.id, jobId: id } },
      create: { userId: user.id, jobId: id, action, notes },
      update: { action, notes },
    });

    return reply.code(200).send(result);
  });

  // DELETE /api/jobs/:id/action
  app.delete('/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getLocalUser();
    if (!user) return reply.code(204).send();

    await prisma.userJobAction.deleteMany({
      where: { userId: user.id, jobId: id },
    });

    return reply.code(204).send();
  });
}
