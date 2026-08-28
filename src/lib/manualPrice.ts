import{supabase}from'./supabase'
import{normalizeStyle}from'./normalize'
import type{PriceRow}from'../types'

export type SavedManualPrice={row:PriceRow;priceVersionId:string;unchanged:boolean}

export async function saveManualPrice(form:PriceRow):Promise<SavedManualPrice>{
 const normalized_name=normalizeStyle(form.display_name),price_option=form.price_option.trim()||'Standard'
 const{data:before,error:beforeError}=await supabase.from('current_prices').select('price_version_id,bulk_fob').eq('normalized_name',normalized_name).ilike('price_option',price_option).maybeSingle()
 if(beforeError)throw new Error(`저장 전 현재 가격 확인 실패: ${beforeError.message}`)
 const payload={...form,normalized_name,price_option,source_type:'KEY_IN' as const}
 const{data:priceVersionId,error:saveError}=await supabase.rpc('save_price',{p:payload})
 if(saveError)throw new Error(`가격 저장 RPC 실패: ${saveError.message}`)
 if(!priceVersionId)throw new Error('가격 저장 RPC가 price_version_id를 반환하지 않았습니다.')
 const[{data:version,error:versionError},{data:current,error:currentError}]=await Promise.all([
  supabase.from('price_versions').select('id,style_id,bulk_fob,is_current').eq('id',priceVersionId).single(),
  supabase.from('current_prices').select('style_id,display_name,normalized_name,season,item_type,product_group,price_option,bulk_fob,public_remark_en,internal_remark,change_reason,effective_date,updated_at,price_version_id,is_active').eq('price_version_id',priceVersionId).single(),
 ])
 if(versionError||!version)throw new Error(`price_versions 저장 확인 실패: ${versionError?.message||'저장 버전을 찾을 수 없습니다.'}`)
 if(!version.is_current)throw new Error('저장된 가격 버전이 현재 가격으로 활성화되지 않았습니다.')
 if(currentError||!current)throw new Error(`current_prices 반영 확인 실패: ${currentError?.message||'현재 가격에서 저장 항목을 찾을 수 없습니다.'}`)
 return{row:{...current,id:current.style_id,source_type:'KEY_IN'}as PriceRow,priceVersionId,unchanged:before?.price_version_id===priceVersionId&&Number(before?.bulk_fob)===Number(form.bulk_fob)}
}
