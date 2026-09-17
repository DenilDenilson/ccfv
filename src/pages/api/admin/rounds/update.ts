import type { APIRoute } from 'astro';
import { currentAdmin, updateRound } from '@/lib/auth/admin';
import { parseAdminDateTime } from '@/lib/admin/validation';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  const roundId = String(body.get('roundId') || '').trim();
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-round:${roundId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const title = String(body.get('title') || '').trim().slice(0, 120);
  const slug = String(body.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const description = String(body.get('description') || '').trim().slice(0, 500);
  const audience = String(body.get('audience') || 'members_and_public');
  const startsAt = parseAdminDateTime(String(body.get('startsAt') || ''));
  const endsAt = parseAdminDateTime(String(body.get('endsAt') || ''));
  const autoApproveProposals = body.get('autoApproveProposals') === 'on';
  if (!/^[0-9a-f-]{20,80}$/i.test(roundId) || !title || !slug || !startsAt || !endsAt || endsAt <= startsAt || !['members', 'members_and_public'].includes(audience)) {
    return errorJson(422, 'invalid_input', 'Completa los datos de la ronda y revisa sus fechas.');
  }
  try {
    return await updateRound(admin.id, roundId, { title, slug, description, startsAt, endsAt, audience: audience as 'members' | 'members_and_public', autoApproveProposals })
      ? redirectTo('/admin?status=round-updated')
      : errorJson(409, 'conflict', 'La ronda no existe o está cancelada.');
  } catch {
    return errorJson(409, 'conflict', 'No se pudo actualizar la ronda. El slug puede estar en uso.');
  }
};
