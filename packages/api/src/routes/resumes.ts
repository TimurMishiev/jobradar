import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';

export async function resumeRoutes(app: FastifyInstance) {
  // GET /api/resumes
  app.get('/', async () => {
    const user = await getLocalUser();
    if (!user) return [];

    return prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        // textContent intentionally excluded — only used server-side for scoring
      },
    });
  });

  // DELETE /api/resumes/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await getLocalUser();
    if (!user) return reply.code(404).send({ error: 'Resume not found' });

    // Ownership check: ensure the resume belongs to the current user
    const existing = await prisma.resume.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return reply.code(404).send({ error: 'Resume not found' });
    }

    await prisma.resume.delete({ where: { id } });
    return reply.code(204).send();
  });
}
