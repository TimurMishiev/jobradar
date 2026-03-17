import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getLocalUser, getOrCreateLocalUser } from '../lib/user';
import { enrichWorkdayJob } from '../services/workdayEnrich';
import { fetchSignalsContext, computeSignals } from '../lib/opportunitySignals';

const VALID_ACTIONS = ['SAVED', 'IGNORED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
type JobAction = (typeof VALID_ACTIONS)[number];

const VALID_REMOTE_TYPES = new Set(['remote', 'hybrid', 'onsite', 'unknown']);
const VALID_SENIORITY = new Set(['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'director', 'manager']);
const NOTES_MAX_LENGTH = 5_000;

export async function jobRoutes(app: FastifyInstance) {
  // GET /api/jobs
  // Query params:
  //   page, limit          — pagination
  //   company              — filter by company name
  //   remoteType           — filter by remote type
  //   seniority            — filter by seniorityGuess
  //   action               — show only jobs with this user action (SAVED | APPLIED | IGNORED)
  //   hideIgnored          — 'true' to exclude jobs the user has ignored
  //   postedWithin         — days since posting: 1 | 3 | 7 (default) | 14 | 30 | 'all'
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
      location?: string;
      title?: string;
    };

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit ?? '25', 10) || 25), 100);
    const offset = (page - 1) * limit;

    const user = await getLocalUser();
    const userId = user?.id ?? '__no_user__';

    // Default to 7 days; pass 'all' to disable the cutoff
    const VALID_DAYS = [1, 3, 7, 14, 30];
    const rawDays = query.postedWithin;
    const parsedDays = rawDays === 'all' ? null : parseInt(rawDays ?? '7', 10);
    const postedWithinDays = parsedDays !== null && VALID_DAYS.includes(parsedDays) ? parsedDays : 7;
    const postedAfter =
      rawDays === 'all'
        ? undefined
        : new Date(Date.now() - postedWithinDays * 24 * 60 * 60 * 1_000);

    // Only pass allowlisted values to Prisma to prevent unintended filter behaviour
    const remoteType = query.remoteType && VALID_REMOTE_TYPES.has(query.remoteType)
      ? query.remoteType : undefined;
    const seniority = query.seniority && VALID_SENIORITY.has(query.seniority)
      ? query.seniority : undefined;
    // company is a free-text label (e.g. 'Anthropic') — safe because Prisma parameterizes it
    const company = typeof query.company === 'string' && query.company.length <= 100
      ? query.company : undefined;
    const location = typeof query.location === 'string' && query.location.trim().length > 0 && query.location.length <= 100
      ? query.location.trim() : undefined;
    const title = typeof query.title === 'string' && query.title.trim().length > 0 && query.title.length <= 100
      ? query.title.trim() : undefined;

    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...(postedAfter ? { postedAt: { gte: postedAfter } } : {}),
      ...(company ? { company } : {}),
      ...(remoteType ? { remoteType } : {}),
      ...(seniority ? { seniorityGuess: seniority } : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
      ...(title ? { title: { contains: title, mode: 'insensitive' } } : {}),
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

    const [jobs, total, signalsCtx] = await Promise.all([
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
      user ? fetchSignalsContext(user.id) : Promise.resolve(null),
    ]);

    const data = jobs.map((job) => ({
      ...job,
      opportunitySignals: signalsCtx ? computeSignals(job, signalsCtx) : [],
    }));

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  });

  // GET /api/jobs/:id — full detail including description
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getLocalUser();
    const userId = user?.id ?? '__no_user__';

    const [job, signalsCtx] = await Promise.all([
      prisma.job.findUnique({
        where: { id },
        include: {
          scores: { orderBy: { createdAt: 'desc' } },
          userActions: { where: { userId } },
        },
      }),
      user ? fetchSignalsContext(user.id) : Promise.resolve(null),
    ]);

    if (!job) return reply.code(404).send({ error: 'Job not found' });

    // Lazily fetch and cache Workday job descriptions on first open
    if (job.sourceType === 'workday' && !job.descriptionNormalized) {
      await enrichWorkdayJob(id);
      const refreshed = await prisma.job.findUnique({
        where: { id },
        include: {
          scores: { orderBy: { createdAt: 'desc' } },
          userActions: { where: { userId } },
        },
      });
      if (!refreshed) return reply.code(404).send({ error: 'Job not found' });
      return { ...refreshed, opportunitySignals: signalsCtx ? computeSignals(refreshed, signalsCtx) : [] };
    }

    return { ...job, opportunitySignals: signalsCtx ? computeSignals(job, signalsCtx) : [] };
  });

  // POST /api/jobs/:id/action
  app.post('/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { action?: unknown; notes?: unknown };

    if (!body.action || !VALID_ACTIONS.includes(body.action as JobAction)) {
      return reply.code(400).send({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    const action = body.action as JobAction;
    const rawNotes = typeof body.notes === 'string' ? body.notes.slice(0, NOTES_MAX_LENGTH) : undefined;
    const notes = rawNotes?.trim() || undefined;
    const user = await getOrCreateLocalUser();

    const jobExists = await prisma.job.findUnique({ where: { id }, select: { id: true } });
    if (!jobExists) return reply.code(404).send({ error: 'Job not found' });

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

  // PATCH /api/jobs/:id/notes — update notes on an existing action without changing stage
  app.patch('/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { notes?: unknown };
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, NOTES_MAX_LENGTH).trim() : '';

    const user = await getOrCreateLocalUser();

    const existing = await prisma.userJobAction.findUnique({
      where: { userId_jobId: { userId: user.id, jobId: id } },
    });
    if (!existing) return reply.code(404).send({ error: 'No action found for this job' });

    const result = await prisma.userJobAction.update({
      where: { id: existing.id },
      data: { notes: notes || null },
    });

    return result;
  });
}
