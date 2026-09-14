import type { APIRoute } from 'astro';
import { clearLocalAdminCookie } from '@/lib/auth/admin';
import { redirectTo } from '@/lib/http';

export const prerender = false;

export const POST: APIRoute = async () => redirectTo('/admin/login', 303, [clearLocalAdminCookie()]);
