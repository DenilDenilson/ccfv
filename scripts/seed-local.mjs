import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const displayName = args[0] || 'Miembro de prueba';
const code = (args[1] || 'CCFV-TESTLOCAL20260000000000000').trim().toUpperCase();
const normalizedCode = code.replaceAll('-', '').replaceAll(' ', '');
if (!/^CCFV[A-Z0-9]{26}$/.test(normalizedCode)) throw new Error('El código debe tener CCFV seguido de 26 caracteres alfanuméricos.');
if (!existsSync('.dev.vars')) throw new Error('Falta .dev.vars. Cópialo desde .dev.vars.example antes de ejecutar el seed.');

const vars = Object.fromEntries(readFileSync('.dev.vars', 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));
const secret = vars.MEMBER_CODE_HMAC_KEY;
if (!secret || secret.length < 16) throw new Error('MEMBER_CODE_HMAC_KEY debe tener al menos 16 caracteres.');
const codeHash = createHmac('sha256', secret).update(`1:member-code:${normalizedCode}`).digest('base64url');
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = `INSERT INTO members (id, display_name, status, code_hash, code_key_version, auth_version, code_rotated_at) VALUES (${sqlString(randomUUID())}, ${sqlString(displayName)}, 'active', ${sqlString(codeHash)}, 1, 1, unixepoch()) ON CONFLICT(code_hash) DO UPDATE SET display_name = excluded.display_name, status = 'active', updated_at = unixepoch();`;
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'CCFV_DB', '--local', '--command', sql], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Miembro local listo: ${displayName}`);
console.log(`Código: ${code}`);
