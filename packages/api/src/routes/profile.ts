import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getOrCreateLocalUser } from '../lib/user';
import type { RemotePreference } from '@jobradar/shared';

const VALID_REMOTE_PREFS: RemotePreference[] = ['REMOTE_ONLY', 'HYBRID', 'ONSITE', 'ANY'];

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

    // Ensure array fields are actually arrays of strings
    const toStringArray = (val: unknown): string[] => {
      if (!Array.isArray(val)) return [];
      return val.filter((v): v is string => typeof v === 'string');
    };

    const user = await getOrCreateLocalUser();

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        targetTitles: toStringArray(body.targetTitles),
        targetSkills: toStringArray(body.targetSkills),
        preferredCompanies: toStringArray(body.preferredCompanies),
        targetLocations: toStringArray(body.targetLocations),
        remotePreference: (body.remotePreference as RemotePreference) ?? 'ANY',
        seniorityPref: toStringArray(body.seniorityPref),
      },
      update: {
        ...(body.targetTitles !== undefined && { targetTitles: toStringArray(body.targetTitles) }),
        ...(body.targetSkills !== undefined && { targetSkills: toStringArray(body.targetSkills) }),
        ...(body.preferredCompanies !== undefined && { preferredCompanies: toStringArray(body.preferredCompanies) }),
        ...(body.targetLocations !== undefined && { targetLocations: toStringArray(body.targetLocations) }),
        ...(body.remotePreference !== undefined && { remotePreference: body.remotePreference as RemotePreference }),
        ...(body.seniorityPref !== undefined && { seniorityPref: toStringArray(body.seniorityPref) }),
      },
    });

    return reply.code(200).send(profile);
  });
}
