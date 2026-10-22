// Edit API_URL and getToken() to match your backend / auth setup.
const API_URL = '/api';
const getToken = (): string | null => localStorage.getItem('token');

type Params = Record<string, string | number | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: object;
}

export async function request<T>(
  path: string,
  { method = 'GET', body, params }: RequestOptions = {}
): Promise<T> {
  const qs = params
    ? '?' +
      new URLSearchParams(
        Object.entries(params as Params)
          .filter(([, v]) => v !== '' && v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';

  const token = getToken();
  const res = await fetch(`${API_URL}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err: { message?: string } = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}
