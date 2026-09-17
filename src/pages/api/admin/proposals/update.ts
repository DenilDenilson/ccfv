import type { APIRoute } from 'astro';
import { currentAdmin, updateProposal } from '@/lib/auth/admin';
import { isProposalStatus, parseAdminPoster } from '@/lib/admin/validation';
import { errorJson, formBody, redirectTo } from '@/lib/http';
import { verifyCsrfToken } from '@/lib/security/csrf';

export const prerender = false;

function optionalInteger(value: string, min: number, max: number): number | null | undefined {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export const POST: APIRoute = async ({ request }) => {
  const admin = await currentAdmin(request);
  if (!admin) return errorJson(403, 'admin_required', 'No tienes permisos para esta operación.');
  const body = await formBody(request);
  if (!await verifyCsrfToken(request, String(body.get('csrf') || ''), 'admin-proposals-edit')) return errorJson(403, 'csrf', 'No se pudo validar el formulario.');
  const proposalId = String(body.get('proposalId') || '').trim();
  const title = String(body.get('title') || '').trim().slice(0, 200);
  const originalTitle = String(body.get('originalTitle') || '').trim().slice(0, 200) || title;
  const overview = String(body.get('overview') || '').trim().slice(0, 4000) || null;
  const posterPath = parseAdminPoster(String(body.get('posterPath') || ''));
  const releaseYear = optionalInteger(String(body.get('releaseYear') || '').trim(), 1888, new Date().getUTCFullYear() + 2);
  const runtimeMinutes = optionalInteger(String(body.get('runtimeMinutes') || '').trim(), 1, 1000);
  const directors = String(body.get('directors') || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 10);
  const justification = String(body.get('justification') || '').trim().slice(0, 500) || null;
  const status = String(body.get('status') || 'pending');
  if (!/^[0-9a-f-]{20,80}$/i.test(proposalId) || title.length < 2 || posterPath === undefined || releaseYear === undefined || runtimeMinutes === undefined || !isProposalStatus(status)) {
    return errorJson(422, 'invalid_input', 'Revisa los campos de la propuesta.');
  }
  const changed = await updateProposal(admin.id, proposalId, { title, originalTitle, overview, posterPath, releaseYear, runtimeMinutes, directors, justification, status });
  return changed ? redirectTo('/admin?status=proposal-updated') : errorJson(404, 'not_found', 'No se encontró la propuesta.');
};
