import type { APIRoute } from 'astro';
import { issueLocalAdminCookie } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await formBody(request);
  const cookie = await issueLocalAdminCookie(String(body.get('secret') || ''));
  return cookie ? redirectTo('/admin?status=authenticated', 303, [cookie]) : errorJson(403, 'invalid_secret', 'Secreto local inválido.');
};
