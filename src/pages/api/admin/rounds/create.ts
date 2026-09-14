import type { APIRoute } from 'astro';
import { createRound, currentAdmin } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

function parseDateTime(value: string): number | null {
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00-05:00` : value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-round-create')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');

  const title = String(body.get('title') || '').trim().slice(0, 120);
  const slug = String(body.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const description = String(body.get('description') || '').trim().slice(0, 500);
  const audience = String(body.get('audience') || 'members_and_public');
  const startsAt = parseDateTime(String(body.get('startsAt') || ''));
  const endsAt = parseDateTime(String(body.get('endsAt') || ''));
  if (!title || !slug || !startsAt || !endsAt || endsAt <= startsAt || !['members', 'members_and_public'].includes(audience)) {
    return errorJson(422, 'invalid_input', 'Completa los datos de la ronda y revisa sus fechas.');
  }
  try {
    await createRound(admin.id, { title, slug, description, startsAt, endsAt, audience: audience as 'members' | 'members_and_public' });
    return redirectTo('/admin?status=round-created');
  } catch {
    return errorJson(409, 'conflict', 'No se pudo crear la ronda. El slug puede estar en uso.');
  }
};
