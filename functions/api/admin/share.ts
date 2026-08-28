import { decryptToken, encryptToken, json, requireAdmin, sha256, supabase, type PagesContext } from '../_shared'

const token = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
export const onRequestGet = async ({ request, env }: PagesContext) => { if (!await requireAdmin(request, env)) return json({ error: 'Forbidden' }, 403); const r = await supabase(env, 'share_links?select=id,label,expires_at,revoked_at,created_at,token_ciphertext,token_iv&order=created_at.desc');if(!r.ok)return json({error:'Unable to load links'},r.status);const rows=await r.json<Array<{token_ciphertext?:string;token_iv?:string}>>();const origin=env.PUBLIC_APP_URL||new URL(request.url).origin;return json(await Promise.all(rows.map(async row=>{const{token_ciphertext,token_iv,...safe}=row;if(!token_ciphertext||!token_iv)return{...safe,original_url_available:false};try{const raw=await decryptToken(token_ciphertext,token_iv,env);return{...safe,original_url_available:true,link:`${origin}/share/${raw}`}}catch{return{...safe,original_url_available:false}}}))) }
export const onRequestPost = async ({ request, env }: PagesContext) => {
  const user = await requireAdmin(request, env); if (!user) return json({ error: 'Forbidden' }, 403)
  const body = await request.json<{ label?: string; expires_at?: string | null }>(); if (!body.label?.trim()) return json({ error: 'Label required' }, 400)
  const raw = token(); const hash = await sha256(raw);let encrypted;try{encrypted=await encryptToken(raw,env)}catch{return json({error:'Share token encryption is not configured'},500)}
  const r = await supabase(env, 'share_links', { method: 'POST', body: JSON.stringify({ label: body.label.trim(), expires_at: body.expires_at || null, token_hash: hash, created_by: user.id,...encrypted }) })
  if (!r.ok) return json({ error: 'Unable to create link' }, r.status)
  return json({ link: (env.PUBLIC_APP_URL || new URL(request.url).origin) + '/share/' + raw }, 201)
}
