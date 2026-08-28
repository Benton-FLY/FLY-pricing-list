-- Non-destructive upgrade: price options, import batches, public remarks and soft delete.
alter table public.styles add column if not exists product_group text not null default '';
alter table public.styles add column if not exists deleted_at timestamptz;
alter table public.styles add column if not exists deleted_by uuid references auth.users(id);

alter table public.price_versions add column if not exists price_option text not null default 'Standard';
alter table public.price_versions add column if not exists internal_remark text not null default '';
alter table public.price_versions add column if not exists public_remark_en text not null default '';
alter table public.price_versions add column if not exists change_reason text;
alter table public.price_versions add column if not exists previous_version_id uuid references public.price_versions(id);

-- Preserve every legacy remark. English-only text can safely be public; all other text remains internal.
update public.price_versions
set public_remark_en = case when remark <> '' and octet_length(remark) = length(remark) then remark else public_remark_en end,
    internal_remark = case when remark <> '' and octet_length(remark) <> length(remark) then remark else internal_remark end
where remark <> '' and public_remark_en = '' and internal_remark = '';

drop index if exists public.one_current_price_per_style;
create unique index if not exists one_current_price_per_style_option
  on public.price_versions(style_id, lower(price_option)) where is_current;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(), internal_name text not null,
  public_title_en text not null, source_file text, effective_date date not null default current_date,
  confirmed_at timestamptz not null default now(), seasons text[] not null default '{}',
  style_count integer not null default 0, price_option_count integer not null default 0,
  created_by uuid not null references auth.users(id), status text not null default 'CONFIRMED'
    check (status in ('DRAFT','CONFIRMED','CANCELLED')), created_at timestamptz not null default now()
);
create table if not exists public.import_batch_items (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.import_batches(id),
  style_id uuid not null references public.styles(id), price_version_id uuid not null references public.price_versions(id),
  price_option text not null, bulk_fob numeric(12,4) not null, status text not null,
  public_remark_en text not null default '', source_sheet text, source_row integer,
  unique(batch_id, style_id, price_option)
);
alter table public.share_links add column if not exists token_ciphertext text;
alter table public.share_links add column if not exists token_iv text;
alter table public.share_links add column if not exists encryption_version smallint;

alter table public.import_batches enable row level security;
alter table public.import_batch_items enable row level security;
drop policy if exists admin_all_batches on public.import_batches;
create policy admin_all_batches on public.import_batches for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_all_batch_items on public.import_batch_items;
create policy admin_all_batch_items on public.import_batch_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.import_batches, public.import_batch_items from anon;
grant select, insert, update on public.import_batches, public.import_batch_items to authenticated;

create or replace function public.save_price(p jsonb) returns uuid language plpgsql security invoker as $$
declare v_style public.styles; v_current public.price_versions; v_id uuid; v_option text; v_batch uuid;
begin
  if not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  if nullif(p->>'bulk_fob','')::numeric is null then raise exception 'bulk fob required'; end if;
  v_option := coalesce(nullif(trim(p->>'price_option'),''),'Standard');
  insert into public.styles(display_name,normalized_name,season,item_type,product_group,is_active,deleted_at,deleted_by)
    values(p->>'display_name',p->>'normalized_name',p->>'season',(p->>'item_type')::public.item_type,coalesce(p->>'product_group',''),true,null,null)
    on conflict(normalized_name) do update set display_name=excluded.display_name,season=excluded.season,item_type=excluded.item_type,
      product_group=excluded.product_group,updated_at=now() returning * into v_style;
  select * into v_current from public.price_versions where style_id=v_style.id and lower(price_option)=lower(v_option) and is_current for update;
  if found and v_current.bulk_fob is not distinct from nullif(p->>'bulk_fob','')::numeric then return v_current.id; end if;
  if found and nullif(p->>'change_reason','') is null then raise exception 'change reason required'; end if;
  if p->>'change_reason'='OTHER' and coalesce(trim(p->>'public_remark_en'),'')='' then raise exception 'public English remark required for Other'; end if;
  if octet_length(coalesce(p->>'public_remark_en','')) <> length(coalesce(p->>'public_remark_en','')) then raise exception 'public remark must be English'; end if;
  update public.price_versions set is_current=false where style_id=v_style.id and lower(price_option)=lower(v_option) and is_current;
  insert into public.price_versions(style_id,bulk_fob,sample_fob,remark,internal_remark,public_remark_en,change_reason,price_option,
    previous_version_id,effective_date,source_type,source_file,source_sheet,source_row,created_by)
  values(v_style.id,nullif(p->>'bulk_fob','')::numeric,null,coalesce(p->>'internal_remark',''),coalesce(p->>'internal_remark',''),
    case when coalesce(trim(p->>'public_remark_en'),'')<>'' then p->>'public_remark_en'
      when p->>'change_reason'='TYPO' then 'Typo correction' when p->>'change_reason'='MATERIAL' then 'Material cost update'
      when p->>'change_reason'='LABOR' then 'Labor cost update' when p->>'change_reason'='SPECIFICATION' then 'Specification update'
      else '' end,nullif(p->>'change_reason',''),v_option,v_current.id,
    coalesce(nullif(p->>'effective_date','')::date,current_date),(p->>'source_type')::public.source_type,p->>'source_file',p->>'source_sheet',
    nullif(p->>'source_row','')::integer,auth.uid()) returning id into v_id;
  if coalesce((p->>'create_manual_batch')::boolean,true) then
    insert into public.import_batches(internal_name,public_title_en,effective_date,seasons,style_count,price_option_count,created_by)
      values('Manual Update','Manual Price Update',coalesce(nullif(p->>'effective_date','')::date,current_date),array[v_style.season],1,1,auth.uid()) returning id into v_batch;
    insert into public.import_batch_items(batch_id,style_id,price_version_id,price_option,bulk_fob,status,public_remark_en)
      select v_batch,v_style.id,v_id,v_option,nullif(p->>'bulk_fob','')::numeric,case when v_current.id is null then 'New' else 'Update' end,public_remark_en
      from public.price_versions where id=v_id;
  end if;
  return v_id;
end $$;

create or replace function public.import_prices(p_batch jsonb, p_rows jsonb) returns uuid language plpgsql security invoker as $$
declare r jsonb; v_batch uuid; v_version uuid; v_style uuid; n integer := 0; style_ids uuid[] := '{}';
begin
  if not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  if coalesce(trim(p_batch->>'public_title_en'),'')='' then raise exception 'public update title required'; end if;
  if octet_length(p_batch->>'public_title_en') <> length(p_batch->>'public_title_en') then raise exception 'public update title must be English'; end if;
  insert into public.import_batches(internal_name,public_title_en,source_file,effective_date,seasons,created_by)
  values(coalesce(nullif(p_batch->>'internal_name',''),'Excel Import'),p_batch->>'public_title_en',p_batch->>'source_file',
    coalesce(nullif(p_batch->>'effective_date','')::date,current_date),coalesce(array(select jsonb_array_elements_text(p_batch->'seasons')),'{}'),auth.uid()) returning id into v_batch;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_version := public.save_price(r || jsonb_build_object('create_manual_batch',false));
    select style_id into v_style from public.price_versions where id=v_version;
    insert into public.import_batch_items(batch_id,style_id,price_version_id,price_option,bulk_fob,status,public_remark_en,source_sheet,source_row)
      select v_batch,v_style,v_version,coalesce(nullif(r->>'price_option',''),'Standard'),(r->>'bulk_fob')::numeric,r->>'status',public_remark_en,r->>'source_sheet',nullif(r->>'source_row','')::integer
      from public.price_versions where id=v_version
      on conflict(batch_id,style_id,price_option) do nothing;
    n:=n+1; style_ids:=array_append(style_ids,v_style);
  end loop;
  update public.import_batches set style_count=(select count(distinct x) from unnest(style_ids) x),price_option_count=n where id=v_batch;
  return v_batch;
end $$;
revoke all on function public.import_prices(jsonb) from authenticated;
grant execute on function public.import_prices(jsonb,jsonb) to authenticated;

create or replace function public.soft_delete_styles(p_style_ids uuid[]) returns integer language plpgsql security invoker as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  update public.styles set deleted_at=now(),deleted_by=auth.uid(),updated_at=now() where id=any(p_style_ids) and deleted_at is null;
  get diagnostics n=row_count; return n;
end $$;
grant execute on function public.soft_delete_styles(uuid[]) to authenticated;

drop view if exists public.current_prices;
create view public.current_prices with (security_invoker=true) as
select s.id,s.display_name,s.normalized_name,s.season,s.item_type,s.product_group,s.is_active,p.id price_version_id,
 p.price_option,p.bulk_fob,p.sample_fob,p.currency,p.internal_remark,p.public_remark_en,p.change_reason,p.previous_version_id,
 p.effective_date,p.created_at updated_at
from public.styles s join public.price_versions p on p.style_id=s.id and p.is_current
where s.deleted_at is null;
grant select on public.current_prices to authenticated;

-- Create non-public legacy batches grouped by effective date without changing versions.
do $$ declare d record; b uuid;
begin
  for d in select effective_date,count(distinct style_id) sc,count(*) pc,array_agg(distinct s.season) seasons
    from public.price_versions p join public.styles s on s.id=p.style_id
    where not exists(select 1 from public.import_batch_items i where i.price_version_id=p.id) group by effective_date
  loop
    insert into public.import_batches(internal_name,public_title_en,effective_date,seasons,style_count,price_option_count,created_by)
    select 'Legacy backfill','Legacy Confirmed Prices',d.effective_date,d.seasons,d.sc,d.pc,(select user_id from public.admin_users order by created_at limit 1)
    where exists(select 1 from public.admin_users) returning id into b;
    if b is not null then
      insert into public.import_batch_items(batch_id,style_id,price_version_id,price_option,bulk_fob,status,public_remark_en)
      select b,p.style_id,p.id,p.price_option,p.bulk_fob,'Legacy',p.public_remark_en from public.price_versions p
      where p.effective_date=d.effective_date and p.bulk_fob is not null and not exists(select 1 from public.import_batch_items i where i.price_version_id=p.id);
    end if;
  end loop;
end $$;
