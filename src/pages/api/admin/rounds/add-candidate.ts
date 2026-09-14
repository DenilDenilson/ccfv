import type { APIRoute } from 'astro';
import { addApprovedProposalToRound, currentAdmin } from '@/lib/auth/admin';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  const roundId = String(body.get('roundId') || '');
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), `admin-round:${roundId}`)) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const proposalId = String(body.get('proposalId') || '');
  const position = Number(body.get('position') || 0);
  if (!/^[0-9a-f-]{20,80}$/i.test(roundId) || !/^[0-9a-f-]{20,80}$/i.test(proposalId) || !Number.isInteger(position) || position < 1 || position > 99) return errorJson(422, 'invalid_input', 'Datos inválidos.');
  const changed = await addApprovedProposalToRound(roundId, proposalId, admin.id, position);
  return changed ? redirectTo('/admin?status=candidate-added') : errorJson(409, 'conflict', 'La propuesta no está aprobada, la ronda no es editable o ya estaba incluida.');
};
