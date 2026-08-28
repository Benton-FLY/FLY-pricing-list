-- Non-destructive visibility/share upgrade. Existing prices, history, users and links are preserved.
alter table public.share_links add column if not exists last_accessed_at timestamptz;

-- style_id is explicit; id remains as a compatibility alias for older clients.
drop view if exists public.current_prices;
create view public.current_prices with (security_invoker=true) as
select s.id, s.id as style_id, s.display_name, s.normalized_name, s.season,
 s.item_type, s.product_group, s.is_active, p.id as price_version_id,
 p.price_option, p.bulk_fob, p.sample_fob, p.currency, p.internal_remark,
 p.public_remark_en, p.change_reason, p.previous_version_id,
 p.effective_date, p.created_at as updated_at
from public.styles s
join public.price_versions p on p.style_id=s.id and p.is_current
where s.deleted_at is null;

revoke all on public.current_prices from anon;
grant select on public.current_prices to authenticated;

notify pgrst, 'reload schema';
