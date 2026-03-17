// All API calls route through here.
// In dev, Vite proxies /api → localhost:3000 (see vite.config.ts).
// The backend API_KEY is a server-only secret — never put it in a VITE_ variable.

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      // Only set Content-Type for requests that have a body
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message: string;
    try {
      const json = JSON.parse(body) as { error?: string };
      message = json.error ?? `${res.status} ${res.statusText}`;
    } catch {
      message = `${res.status} ${res.statusText}`;
    }
    throw new ApiError(res.status, message);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
