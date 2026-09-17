export function parseAdminDateTime(value: string): number | null {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00-05:00` : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}

export function parseAdminPoster(value: string): string | null | undefined {
  const poster = value.trim();
  if (!poster) return null;
  if (/^\/[A-Za-z0-9._/-]+$/.test(poster) || /^https:\/\//i.test(poster)) return poster.slice(0, 1000);
  return undefined;
}

export function isProposalStatus(value: string): value is 'pending' | 'approved' | 'rejected' {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}
