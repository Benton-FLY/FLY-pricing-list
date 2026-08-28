import{describe,expect,it}from'vitest'
import{buildPriceWorkbook}from'./exportPrices'
const rows=[{effective_date:'2026-08-28',season:'27',product_group:'J M/X',item_type:'JERSEY' as const,display_name:'27 TEST JERSEY',price_option:'Digital',bulk_fob:9.9575,public_remark_en:'Confirmed'}]
describe('public Excel export',()=>{
 it('stores Bulk FOB as an unrounded numeric cell with the requested display format',()=>{const sheet=buildPriceWorkbook(rows).Sheets['Confirmed FOB'];expect(sheet.G2).toMatchObject({t:'n',v:9.9575,z:'$0.00##'});expect(sheet['!autofilter']).toBeTruthy();expect(sheet['!freeze']).toMatchObject({ySplit:1})})
 it('contains only the eight public English headers',()=>{const sheet=buildPriceWorkbook(rows).Sheets['Confirmed FOB'],headers=['Update Date','Season','Product Group','Item Type','Style','Price Option','Bulk FOB','Public Remark'];expect(headers.map((_,i)=>sheet[String.fromCharCode(65+i)+'1'].v)).toEqual(headers);expect(JSON.stringify(sheet)).not.toMatch(/Internal Remark|created_by|source_file|source_sheet|token/i)})
})
