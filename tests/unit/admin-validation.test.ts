import { describe, expect, it } from 'vitest';
import { isProposalStatus, parseAdminDateTime, parseAdminPoster } from '@/lib/admin/validation';
import { normalizeDisplayName } from '@/lib/auth/member';

describe('admin input validation', () => {
  it('interprets Lima datetime-local values consistently', () => {
    expect(parseAdminDateTime('2026-09-17T10:30')).toBe(Date.parse('2026-09-17T10:30:00-05:00') / 1000);
    expect(parseAdminDateTime('invalid')).toBeNull();
  });

  it('allows TMDB paths and HTTPS posters while rejecting unsafe URLs', () => {
    expect(parseAdminPoster('/abc123.jpg')).toBe('/abc123.jpg');
    expect(parseAdminPoster('https://example.org/poster.jpg')).toBe('https://example.org/poster.jpg');
    expect(parseAdminPoster('')).toBeNull();
    expect(parseAdminPoster('javascript:alert(1)')).toBeUndefined();
  });

  it('accepts only supported proposal states', () => {
    expect(isProposalStatus('pending')).toBe(true);
    expect(isProposalStatus('approved')).toBe(true);
    expect(isProposalStatus('rejected')).toBe(true);
    expect(isProposalStatus('deleted')).toBe(false);
  });

  it('preserves accented names and normalizes repeated spaces', () => {
    expect(normalizeDisplayName('  Ana   Lucía  ')).toBe('Ana Lucía');
    expect(normalizeDisplayName('José')).toBe('José');
  });
});
