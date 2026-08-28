import type{PriceRow}from'../types'

export const CURRENT_PRICES_SELECT='id,display_name,normalized_name,season,item_type,product_group,price_option,bulk_fob,public_remark_en,internal_remark,change_reason,effective_date,updated_at,price_version_id,is_active'

export type CurrentPriceViewRow=Omit<PriceRow,'style_id'>&{id:string}

export function fromCurrentPriceView(row:CurrentPriceViewRow):PriceRow{
 return{...row,id:row.id,style_id:row.id}
}

export function styleId(row:Pick<PriceRow,'id'|'style_id'>):string{
 const id=row.style_id??row.id
 if(!id)throw new Error('Style ID가 없습니다.')
 return id
}
