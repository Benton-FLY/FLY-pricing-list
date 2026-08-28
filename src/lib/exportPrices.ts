import * as XLSX from 'xlsx'
import type { PriceRow } from '../types'

export type PublicExportRow = Pick<PriceRow,'season'|'product_group'|'item_type'|'display_name'|'price_option'|'bulk_fob'|'public_remark_en'|'effective_date'>

export function buildPriceWorkbook(rows:PublicExportRow[],updateDate?:string){
  const data=rows.map(row=>({
    'Update Date':row.effective_date||updateDate||'',
    'Season':row.season,
    'Product Group':row.product_group,
    'Item Type':row.item_type,
    'Style':row.display_name,
    'Price Option':row.price_option,
    'Bulk FOB':row.bulk_fob,
    'Public Remark':row.public_remark_en||'',
  }))
  const sheet=XLSX.utils.json_to_sheet(data,{header:['Update Date','Season','Product Group','Item Type','Style','Price Option','Bulk FOB','Public Remark']})
  sheet['!autofilter']={ref:sheet['!ref']||'A1:H1'}
  sheet['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'}
  sheet['!cols']=[{wch:13},{wch:10},{wch:18},{wch:14},{wch:38},{wch:18},{wch:13},{wch:42}]
  for(let row=2;row<=data.length+1;row++){
    const price=sheet[`G${row}`]
    if(price){price.t='n';price.z='$0.00##'}
    const date=sheet[`A${row}`]
    if(date)date.z='yyyy-mm-dd'
  }
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'Confirmed FOB')
  return workbook
}

export function downloadPriceWorkbook(rows:PublicExportRow[],date:string){
  const safeDate=(date||new Date().toISOString().slice(0,10)).slice(0,10)
  XLSX.writeFile(buildPriceWorkbook(rows,safeDate),`FLY_RACING_Confirmed_FOB_${safeDate}.xlsx`,{compression:true})
}
