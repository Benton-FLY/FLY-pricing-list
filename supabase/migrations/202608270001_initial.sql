create extension if not exists pgcrypto;

create type public.item_type as enum ('PANT','JERSEY','GLOVE','OTHER');
create type public.source_type as enum ('KEY_IN','EXCEL');

create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table public.styles (
  id uuid primary key default gen_random_uuid(), display_name text not null, normalized_name text not null,
  season text not null check (season ~ '^\d{2}(\.5)?$'), item_type public.item_type not null,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(normalized_name)
);
create table public.price_versions (
  id uuid primary key default gen_random_uuid(), style_id uuid not null references public.styles(id),
  bulk_fob numeric(12,4), sample_fob numeric(12,4), currency text not null default 'USD', remark text not null default '',
  effective_date date not null default current_date, is_current boolean not null default true, source_type public.source_type not null,
  source_file text, source_sheet text, source_row integer, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check (bulk_fob > 0 or sample_fob > 0), check (bulk_fob is null or bulk_fob > 0), check (sample_fob is null or sample_fob > 0)
);
create unique index one_current_price_per_style on public.price_versions(style_id) where is_current;
create table public.share_links (
  id uuid primary key default gen_random_uuid(), label text not null, token_hash text not null unique,
  expires_at timestamptz, revoked_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public; grant execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.styles enable row level security;
alter table public.price_versions enable row level security;
alter table public.share_links enable row level security;
create policy admin_read_admins on public.admin_users for select to authenticated using (public.is_admin());
create policy admin_all_styles on public.styles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_prices on public.price_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all_links on public.share_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.admin_users, public.styles, public.price_versions, public.share_links from anon;
grant select, insert, update on public.styles, public.price_versions, public.share_links to authenticated;
grant select on public.admin_users to authenticated;

create or replace function public.save_price(p jsonb) returns uuid language plpgsql security invoker as $$
declare v_style public.styles; v_current public.price_versions; v_id uuid;
begin
  if not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  if nullif(p->>'bulk_fob','')::numeric is null and nullif(p->>'sample_fob','')::numeric is null then raise exception 'at least one price required'; end if;
  insert into public.styles(display_name,normalized_name,season,item_type)
    values(p->>'display_name',p->>'normalized_name',p->>'season',(p->>'item_type')::public.item_type)
    on conflict(normalized_name) do update set display_name=excluded.display_name,season=excluded.season,item_type=excluded.item_type,updated_at=now()
    returning * into v_style;
  select * into v_current from public.price_versions where style_id=v_style.id and is_current for update;
  if found and v_current.bulk_fob is not distinct from nullif(p->>'bulk_fob','')::numeric and v_current.sample_fob is not distinct from nullif(p->>'sample_fob','')::numeric then return v_current.id; end if;
  if found and coalesce(trim(p->>'remark'),'')='' then raise exception 'remark required when price changes'; end if;
  update public.price_versions set is_current=false where style_id=v_style.id and is_current;
  insert into public.price_versions(style_id,bulk_fob,sample_fob,remark,effective_date,source_type,source_file,source_sheet,source_row,created_by)
  values(v_style.id,nullif(p->>'bulk_fob','')::numeric,nullif(p->>'sample_fob','')::numeric,coalesce(p->>'remark',''),coalesce(nullif(p->>'effective_date','')::date,current_date),(p->>'source_type')::public.source_type,p->>'source_file',p->>'source_sheet',nullif(p->>'source_row','')::integer,auth.uid()) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.save_price(jsonb) to authenticated;

create or replace function public.import_prices(p_rows jsonb) returns integer language plpgsql security invoker as $$
declare r jsonb; n integer := 0;
begin
  if not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop perform public.save_price(r); n := n + 1; end loop;
  return n;
end $$;
grant execute on function public.import_prices(jsonb) to authenticated;

create view public.current_prices with (security_invoker=true) as
select s.id,s.display_name,s.normalized_name,s.season,s.item_type,p.bulk_fob,p.sample_fob,p.currency,p.remark,p.effective_date,p.created_at as updated_at
from public.styles s join public.price_versions p on p.style_id=s.id and p.is_current where s.is_active;
grant select on public.current_prices to authenticated;
