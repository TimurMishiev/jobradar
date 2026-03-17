import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getOrCreateLocalUser } from '../lib/user';
import type { RemotePreference } from '@jobradar/shared';
import { scoreUnscoredJobs, rescoreAllJobs } from '../services/scoring';

const VALID_REMOTE_PREFS: RemotePreference[] = ['REMOTE_ONLY', 'HYBRID', 'ONSITE', 'ANY'];
const VALID_SENIORITY_PREFS = new Set(['Intern', 'Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Manager', 'Director']);

// Max items per array field — prevents oversized scoring prompts and DB bloat
const ARRAY_LIMITS: Record<string, number> = {
  targetTitles: 20,
  targetSkills: 50,
  preferredCompanies: 30,
  targetLocations: 20,
  seniorityPref: 10,
};
const ITEM_MAX_LENGTH = 100; // max chars per individual array item

export async function profileRoutes(app: FastifyInstance) {
  // GET /api/profile
  app.get('/', async () => {
    const profile = await prisma.userProfile.findFirst({
      include: { user: true },
    });
    return profile ?? null;
  });

  // PUT /api/profile — create or update the single user's profile
  app.put('/', async (request, reply) => {
    const body = request.body as {
      targetTitles?: unknown;
      targetSkills?: unknown;
      preferredCompanies?: unknown;
      targetLocations?: unknown;
      remotePreference?: unknown;
      seniorityPref?: unknown;
    };

    // Validate remotePreference if provided
    if (body.remotePreference !== undefined && !VALID_REMOTE_PREFS.includes(body.remotePreference as RemotePreference)) {
      return reply.code(400).send({
        error: `remotePreference must be one of: ${VALID_REMOTE_PREFS.join(', ')}`,
      });
    }

    // Validate and sanitize an array field: enforce type, item length, and array size caps
    const toStringArray = (val: unknown, field: string): string[] => {
      if (!Array.isArray(val)) return [];
      const limit = ARRAY_LIMITS[field] ?? 20;
      return val
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim().slice(0, ITEM_MAX_LENGTH))
        .filter((v) => v.length > 0)
        .slice(0, limit);
    };

    // Validate seniorityPref against the known set of values
    const rawSeniority = Array.isArray(body.seniorityPref)
      ? (body.seniorityPref as unknown[]).filter((v): v is string => typeof v === 'string' && VALID_SENIORITY_PREFS.has(v))
      : [];

    const user = await getOrCreateLocalUser();

    // Fetch existing profile to detect scoring-relevant changes
    const existing = await prisma.userProfile.findUnique({ where: { userId: user.id } });

    const newTitles = toStringArray(body.targetTitles, 'targetTitles');
    const newSkills = toStringArray(body.targetSkills, 'targetSkills');
    const newCompanies = toStringArray(body.preferredCompanies, 'preferredCompanies');
    const newLocations = toStringArray(body.targetLocations, 'targetLocations');

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        targetTitles: newTitles,
        targetSkills: newSkills,
        preferredCompanies: newCompanies,
        targetLocations: newLocations,
        remotePreference: (body.remotePreference as RemotePreference) ?? 'ANY',
        seniorityPref: rawSeniority,
      },
      update: {
        ...(body.targetTitles !== undefined && { targetTitles: newTitles }),
        ...(body.targetSkills !== undefined && { targetSkills: newSkills }),
        ...(body.preferredCompanies !== undefined && { preferredCompanies: newCompanies }),
        ...(body.targetLocations !== undefined && { targetLocations: newLocations }),
        ...(body.remotePreference !== undefined && { remotePreference: body.remotePreference as RemotePreference }),
        ...(body.seniorityPref !== undefined && { seniorityPref: rawSeniority }),
      },
    });

    // If scoring-relevant fields changed, rescore everything.
    // Otherwise just score any new unscored jobs.
    const scoringFieldsChanged =
      !existing ||
      JSON.stringify(newTitles.slice().sort()) !== JSON.stringify([...existing.targetTitles].sort()) ||
      JSON.stringify(newSkills.slice().sort()) !== JSON.stringify([...existing.targetSkills].sort()) ||
      JSON.stringify(newCompanies.slice().sort()) !== JSON.stringify([...existing.preferredCompanies].sort());

    if (scoringFieldsChanged) {
      setImmediate(() => rescoreAllJobs().catch((err) => console.error('[profile] rescoreAllJobs failed:', err instanceof Error ? err.message : String(err))));
    } else {
      setImmediate(() => scoreUnscoredJobs().catch((err) => console.error('[profile] scoreUnscoredJobs failed:', err instanceof Error ? err.message : String(err))));
    }

    return reply.code(200).send(profile);
  });
}
