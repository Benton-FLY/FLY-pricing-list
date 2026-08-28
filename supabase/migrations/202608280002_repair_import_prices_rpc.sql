-- Remove the legacy one-argument overload and ensure PostgREST exposes the transactional batch import RPC.
drop function if exists public.import_prices(jsonb);

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

revoke all on function public.import_prices(jsonb,jsonb) from public, anon;
grant execute on function public.import_prices(jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
