import { FastifyInstance } from 'fastify';
import OpenAI from 'openai';
import { TARGET_COMPANIES } from '../companies';

const MODEL = 'gpt-4o-mini';
const QUERY_MAX_LENGTH = 500;

const VALID_SENIORITY = new Set(['intern', 'junior', 'mid', 'senior', 'staff', 'principal']);
const VALID_REMOTE_TYPES = new Set(['remote', 'hybrid', 'onsite']);

export interface ParsedSearchFilters {
  title?: string;
  location?: string;
  company?: string;
  seniority?: string;
  remoteType?: string;
}

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: key });
}

export async function searchRoutes(app: FastifyInstance) {
  // POST /api/search/parse
  // Takes a natural language job search query and returns structured filter params.
  app.post('/parse', async (request, reply) => {
    const body = request.body as { query?: unknown };

    if (typeof body.query !== 'string' || !body.query.trim()) {
      return reply.code(400).send({ error: 'query is required' });
    }

    const query = body.query.slice(0, QUERY_MAX_LENGTH).trim();
    const companyNames = TARGET_COMPANIES.map((c) => c.name).join(', ');

    const client = getClient();
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extract job search filters from a natural language query. Return a JSON object with these optional fields:
- "title": role or job title keywords (e.g. "frontend engineer", "product manager", "data scientist")
- "location": location preference — use short forms like "US", "New York", "London", "remote"
- "company": exact company name only if clearly mentioned, must be one of: ${companyNames}
- "seniority": one of: intern, junior, mid, senior, staff, principal
- "remoteType": one of: remote, hybrid, onsite

Only include fields clearly indicated by the query. Return {} if nothing can be extracted. Do not guess.`,
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
    } catch {
      parsed = {};
    }

    // Sanitize — only pass through valid values
    const result: ParsedSearchFilters = {};
    if (typeof parsed.title === 'string' && parsed.title.length > 0) result.title = parsed.title.slice(0, 100);
    if (typeof parsed.location === 'string' && parsed.location.length > 0) result.location = parsed.location.slice(0, 100);
    if (typeof parsed.company === 'string' && parsed.company.length > 0) result.company = parsed.company.slice(0, 100);
    if (typeof parsed.seniority === 'string' && VALID_SENIORITY.has(parsed.seniority)) result.seniority = parsed.seniority;
    if (typeof parsed.remoteType === 'string' && VALID_REMOTE_TYPES.has(parsed.remoteType)) result.remoteType = parsed.remoteType;

    return result;
  });
}
