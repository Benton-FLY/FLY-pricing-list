interface Env { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; PUBLIC_APP_URL?: string }
export type PagesContext = { request: Request; env: Env; params: Record<string, string>; next: () => Promise<Response> }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
export const cors = (request: Request, env: Env) => ({ 'Access-Control-Allow-Origin': env.PUBLIC_APP_URL || new URL(request.url).origin, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Vary': 'Origin' })
export async function sha256(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('') }
export async function supabase(env: Env, path: string, init: RequestInit = {}) { return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } }) }
export async function requireAdmin(request: Request, env: Env) {
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return null
  const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization } })
  if (!auth.ok) return null
  const user = await auth.json<{ id: string }>()
  const check = await supabase(env, `admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`)
  const rows = await check.json<unknown[]>()
  return rows.length ? user : null
}
