import { drizzle } from 'drizzle-orm/d1';
import { runtimeEnv } from '@/lib/env';

export function db() {
  return drizzle(runtimeEnv().CCFV_DB);
}

export function sqlDb(): Env['CCFV_DB'] {
  return runtimeEnv().CCFV_DB;
}
