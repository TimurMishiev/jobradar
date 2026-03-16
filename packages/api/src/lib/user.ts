import { prisma } from './prisma';

// The single local user is always identified by this email.
// Using a deterministic lookup (findUnique by email) instead of findFirst()
// ensures the single-user mode is unambiguous even if the DB somehow has
// multiple rows (which shouldn't happen, but findFirst() order is undefined).

const LOCAL_USER_EMAIL = 'local@signalhire.local';

export async function getLocalUser() {
  return prisma.user.findUnique({ where: { email: LOCAL_USER_EMAIL } });
}

export async function getOrCreateLocalUser() {
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    create: { email: LOCAL_USER_EMAIL },
    update: {},
  });
}
