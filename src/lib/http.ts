export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorJson(status: number, code: string, message: string): Response {
  return json({ error: code, message }, { status });
}

export function redirectTo(location: string, status = 303, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}

export async function formBody(request: Request): Promise<FormData> {
  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > 16_384) throw new Error('request_too_large');
  return request.formData();
}
