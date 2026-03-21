import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { getLocalUser, getOrCreateLocalUser } from '../lib/user';
import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';
import { rescoreAllJobs, ScoreTrigger } from '../services/scoring';
import { extractSkillsFromResume } from '../services/resumeSkills';
import { uploadFile, deleteFile } from '../lib/storage';

const MAX_LABEL_LENGTH = 100;

export async function resumeRoutes(app: FastifyInstance) {
  // GET /api/resumes — list all resumes for the local user
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
        extractedSkills: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        // textContent intentionally excluded — only used server-side for scoring
      },
    });
  });

  // POST /api/resumes — upload a PDF resume
  app.post('/', async (request, reply) => {
    const user = await getOrCreateLocalUser();

    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    if (data.mimetype !== 'application/pdf') {
      return reply.code(400).send({ error: 'Only PDF files are accepted' });
    }

    const buffer = await data.toBuffer();

    if (buffer.length === 0) {
      return reply.code(400).send({ error: 'Uploaded file is empty' });
    }

    // Extract text from PDF
    let textContent: string | null = null;
    try {
      const parsed = await pdfParse(buffer);
      textContent = parsed.text?.trim() || null;
    } catch {
      // If extraction fails, continue without text — scoring will skip it
    }

    // Upload file to storage (R2 in production, local filesystem in dev)
    const fileId = randomUUID();
    const storagePath = `resumes/${user.id}/${fileId}.pdf`;
    await uploadFile(storagePath, buffer, 'application/pdf');

    const rawLabel = data.fields?.label;
    const labelValue = rawLabel && typeof rawLabel === 'object' && 'value' in rawLabel
      ? String(rawLabel.value)
      : data.filename;
    const label = labelValue.slice(0, MAX_LABEL_LENGTH);

    // If this is the user's first resume, make it default
    const existingCount = await prisma.resume.count({ where: { userId: user.id } });
    const isDefault = existingCount === 0;

    // If setting as default, unset all others first
    if (isDefault) {
      await prisma.resume.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }

    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        label,
        filename: data.filename,
        storagePath,
        mimeType: data.mimetype,
        sizeBytes: buffer.length,
        textContent,
        isDefault,
      },
      select: {
        id: true,
        label: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Extract skills in background — non-blocking, failure doesn't affect upload
    setImmediate(() =>
      extractSkillsFromResume(resume.id).catch((err) =>
        console.error('[resumes] skill extraction failed:', err instanceof Error ? err.message : String(err)),
      ),
    );

    return reply.code(201).send(resume);
  });

  // POST /api/resumes/:id/extract-skills — re-extract skills on demand (for existing resumes)
  app.post('/:id/extract-skills', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getLocalUser();
    if (!user) return reply.code(404).send({ error: 'Resume not found' });

    const existing = await prisma.resume.findUnique({
      where: { id },
      select: { userId: true, textContent: true },
    });
    if (!existing || existing.userId !== user.id) {
      return reply.code(404).send({ error: 'Resume not found' });
    }
    if (!existing.textContent) {
      return reply.code(422).send({ error: 'Resume has no extracted text content' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({ error: 'OPENAI_API_KEY not configured' });
    }

    const skills = await extractSkillsFromResume(id, { force: true });
    return { extractedSkills: skills };
  });

  // PATCH /api/resumes/:id/default — set a resume as the default
  app.patch('/:id/default', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getLocalUser();
    if (!user) return reply.code(404).send({ error: 'Resume not found' });

    const existing = await prisma.resume.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return reply.code(404).send({ error: 'Resume not found' });
    }

    await prisma.resume.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    const updated = await prisma.resume.update({
      where: { id },
      data: { isDefault: true },
      select: {
        id: true,
        label: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // New default resume — rescore ALL jobs so scores reflect the new resume
    setImmediate(() => rescoreAllJobs(ScoreTrigger.RESUME_CHANGE).catch((err) => console.error('[resumes] rescoreAllJobs failed:', err instanceof Error ? err.message : String(err))));

    return updated;
  });

  // DELETE /api/resumes/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getLocalUser();
    if (!user) return reply.code(404).send({ error: 'Resume not found' });

    const existing = await prisma.resume.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return reply.code(404).send({ error: 'Resume not found' });
    }

    // Delete file from storage (best-effort)
    deleteFile(existing.storagePath).catch(() => {});

    await prisma.resume.delete({ where: { id } });

    // If deleted resume was default, promote the next most recent one
    if (existing.isDefault) {
      const next = await prisma.resume.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (next) await prisma.resume.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    return reply.code(204).send();
  });
}
