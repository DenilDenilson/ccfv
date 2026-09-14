import { env } from 'cloudflare:workers';

export function runtimeEnv(): Env {
  return env as unknown as Env;
}

export function requiredSecret(name: keyof Env): string {
  const value = runtimeEnv()[name];
  if (typeof value !== 'string' || value.length < 16) {
    throw new Error(`Missing or weak runtime secret: ${String(name)}`);
  }
  return value;
}

export function appOrigin(): string {
  return runtimeEnv().PUBLIC_APP_ORIGIN || 'http://localhost:4321';
}

export function isPublicVotingEnabled(): boolean {
  return runtimeEnv().PUBLIC_VOTING_ENABLED === 'true';
}
