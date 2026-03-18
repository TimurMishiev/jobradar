import OpenAI from 'openai';

// Singleton OpenAI client — instantiated once on first use.
// All agents and services share the same instance.
let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');

  if (!_client) {
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}
