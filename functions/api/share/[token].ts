import { json, sha256, supabase, type PagesContext } from '../_shared'

export const onRequestGet = async ({ env, params }: PagesContext) => {
  const token = params.token
  if (!token || token.length < 43) return json({ error: 'Invalid share link' }, 401)
  const hash = await sha256(token)
  const linkRes = await supabase(env, `share_links?token_hash=eq.${hash}&revoked_at=is.null&select=id,expires_at`)
  if (!linkRes.ok) return json({ error: 'Unable to verify link' }, 502)
  const links = await linkRes.json<Array<{ expires_at: string | null }>>()
  if (!links[0] || (links[0].expires_at && new Date(links[0].expires_at) <= new Date())) return json({ error: 'Share link expired or revoked' }, 401)
  const result = await supabase(env, 'current_prices?select=display_name,season,item_type,bulk_fob,sample_fob,currency,remark,effective_date,updated_at&order=season.desc,display_name.asc')
  return json(result.ok ? await result.json() : { error: 'Unable to load prices' }, result.status)
}
export const onRequestPost = async () => json({ error: 'Read only' }, 405)
export const onRequestPut = onRequestPost
export const onRequestDelete = onRequestPost
