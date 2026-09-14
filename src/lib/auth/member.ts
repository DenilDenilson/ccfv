import { sqlDb } from '@/lib/db/client';
import { requiredSecret } from '@/lib/env';
import { hmacSha256, randomBytes, randomId, sha256, base64UrlEncode } from '@/lib/security/crypto';
import { readCookie, serializeCookie, serializeDeleteCookie } from '@/lib/security/cookies';

export const MEMBER_SESSION_COOKIE = '__Host-ccfv_member';
const SESSION_ABSOLUTE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_IDLE_SECONDS = 14 * 24 * 60 * 60;

export interface MemberIdentity {
  id: string;
  displayName: string;
  authVersion: number;
  sessionId: string;
  sessionCookie?: string;
}

export interface IssuedMemberCode {
  memberId: string;
  code: string;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replaceAll('-', '').replaceAll(' ', '');
}

export async function hashMemberCode(code: string, version = 1): Promise<string> {
  return hmacSha256(requiredSecret('MEMBER_CODE_HMAC_KEY'), `${version}:member-code:${normalizeCode(code)}`);
}

export async function generateMemberCode(): Promise<string> {
  const raw = base64UrlEncode(randomBytes(16)).replaceAll('-', 'A').replaceAll('_', 'B').toUpperCase();
  const body = raw.slice(0, 26).padEnd(26, 'C');
  return `CCFV-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}-${body.slice(15, 20)}-${body.slice(20, 26)}`;
}

export async function authenticateMember(code: string): Promise<MemberIdentity | null> {
  const normalized = normalizeCode(code);
  if (!/^CCFV[A-Z0-9]{26}$/.test(normalized)) return null;
  const hash = await hashMemberCode(normalized);
  const row = await sqlDb()
    .prepare('SELECT id, display_name, auth_version FROM members WHERE code_hash = ? AND status = \'active\' LIMIT 1')
    .bind(hash)
    .first<{ id: string; display_name: string; auth_version: number }>();
  if (!row) return null;
  const rawToken = base64UrlEncode(randomBytes(32));
  const tokenHash = await sha256(rawToken);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_ABSOLUTE_SECONDS;
  const sessionId = randomId();
  await sqlDb()
    .prepare('INSERT INTO member_sessions (id, member_id, token_hash, auth_version, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(sessionId, row.id, tokenHash, row.auth_version, now, now, expiresAt)
    .run();
  return { id: row.id, displayName: row.display_name, authVersion: row.auth_version, sessionId, sessionCookie: serializeCookie(MEMBER_SESSION_COOKIE, rawToken, SESSION_ABSOLUTE_SECONDS) };
}

export async function currentMember(request: Request): Promise<MemberIdentity | null> {
  const rawToken = readCookie(request, MEMBER_SESSION_COOKIE);
  if (!rawToken || rawToken.length > 200) return null;
  const tokenHash = await sha256(rawToken);
  const now = Math.floor(Date.now() / 1000);
  const row = await sqlDb()
    .prepare(`
      SELECT s.id AS session_id, m.id, m.display_name, m.auth_version
      FROM member_sessions s
      JOIN members m ON m.id = s.member_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
        AND s.last_seen_at + ? > ? AND m.status = 'active' AND s.auth_version = m.auth_version
      LIMIT 1
    `)
    .bind(tokenHash, now, SESSION_IDLE_SECONDS, now)
    .first<{ session_id: string; id: string; display_name: string; auth_version: number }>();
  if (!row) return null;
  await sqlDb().prepare('UPDATE member_sessions SET last_seen_at = ? WHERE id = ? AND last_seen_at < ?').bind(now, row.session_id, now - 300).run();
  return { id: row.id, displayName: row.display_name, authVersion: row.auth_version, sessionId: row.session_id };
}

export async function revokeCurrentMemberSession(request: Request): Promise<string> {
  const rawToken = readCookie(request, MEMBER_SESSION_COOKIE);
  if (rawToken) {
    const tokenHash = await sha256(rawToken);
    await sqlDb().prepare('UPDATE member_sessions SET revoked_at = unixepoch() WHERE token_hash = ? AND revoked_at IS NULL').bind(tokenHash).run();
  }
  return serializeDeleteCookie(MEMBER_SESSION_COOKIE);
}

export async function revokeMemberSessions(memberId: string): Promise<void> {
  await sqlDb().prepare('UPDATE member_sessions SET revoked_at = unixepoch() WHERE member_id = ? AND revoked_at IS NULL').bind(memberId).run();
}

export async function createMember(displayName: string): Promise<IssuedMemberCode> {
  const memberId = randomId();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateMemberCode();
    const codeHash = await hashMemberCode(code);
    try {
      await sqlDb().prepare('INSERT INTO members (id, display_name, status, code_hash, code_key_version, auth_version, code_rotated_at) VALUES (?, ?, \'active\', ?, 1, 1, unixepoch())').bind(memberId, displayName.trim(), codeHash).run();
      return { memberId, code };
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error('Could not generate a unique member code');
}

export async function rotateMemberCode(memberId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateMemberCode();
    const hash = await hashMemberCode(code);
    try {
      await sqlDb().batch([
        sqlDb().prepare('UPDATE members SET code_hash = ?, code_key_version = 1, auth_version = auth_version + 1, code_rotated_at = unixepoch(), updated_at = unixepoch() WHERE id = ? AND status = \'active\'').bind(hash, memberId),
        sqlDb().prepare('UPDATE member_sessions SET revoked_at = unixepoch() WHERE member_id = ? AND revoked_at IS NULL').bind(memberId),
      ]);
      return code;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error('Could not rotate member code');
}
