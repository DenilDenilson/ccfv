/// <reference types="astro/client" />

interface Env {
  CCFV_DB: D1Database;
  APP_ENV: string;
  PUBLIC_APP_ORIGIN: string;
  PUBLIC_TIME_ZONE: string;
  PUBLIC_VOTING_ENABLED: string;
  TMDB_API_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  MEMBER_CODE_HMAC_KEY?: string;
  VISITOR_COOKIE_HMAC_KEY?: string;
  CSRF_HMAC_KEY?: string;
  LOCAL_ADMIN_SECRET?: string;
  CF_ACCESS_ISSUER?: string;
  CF_ACCESS_AUDIENCE?: string;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; last_row_id?: number; [key: string]: unknown };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T extends D1PreparedStatement[]>(statements: T): Promise<D1Result[]>;
}

declare module 'cloudflare:workers' {
  export const env: Env;
}

declare namespace App {
  interface Locals {
    requestId: string;
  }
}
