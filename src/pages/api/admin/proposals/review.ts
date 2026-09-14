import type { APIRoute } from 'astro';
import { currentAdmin, reviewProposal } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-review')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const proposalId = String(body.get('proposalId') || '');
  const decision = String(body.get('decision') || '');
  if (!/^[0-9a-f-]{20,80}$/i.test(proposalId) || !['approved', 'rejected'].includes(decision)) return errorJson(422, 'invalid_input', 'Datos inválidos.');
  const changed = await reviewProposal(proposalId, admin.id, decision as 'approved' | 'rejected', String(body.get('reason') || '').trim().slice(0, 500) || null);
  return changed ? redirectTo('/admin?status=updated') : errorJson(409, 'conflict', 'La propuesta ya fue revisada.');
};
