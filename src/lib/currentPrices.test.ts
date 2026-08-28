import{readFileSync}from'node:fs'
import{describe,expect,it}from'vitest'
import{CURRENT_PRICES_SELECT,fromCurrentPriceView,styleId}from'./currentPrices'
const viewRow={id:'style-123',display_name:'28 F-16 JERSEY',normalized_name:'28 F-16 JERSEY',season:'28',item_type:'JERSEY' as const,product_group:'J M/X',price_option:'Roller',bulk_fob:6.37,public_remark_en:'',internal_remark:'',change_reason:'' as const,effective_date:'2026-08-28',updated_at:'2026-08-28T00:00:00Z',price_version_id:'version-456',is_active:true}
describe('current_prices View contract',()=>{
 it('requests the deployed id column and maps it to the internal style_id',()=>{expect(CURRENT_PRICES_SELECT.split(',')).toContain('id');expect(CURRENT_PRICES_SELECT.split(',')).not.toContain('style_id');const mapped=fromCurrentPriceView(viewRow);expect(mapped).toMatchObject({id:'style-123',style_id:'style-123',price_version_id:'version-456'});expect(styleId(mapped)).toBe('style-123')})
 it('never requests style_id from current_prices in explicit select clauses',()=>{for(const file of['src/pages/AdminPage.tsx','src/lib/manualPrice.ts','src/lib/currentPrices.ts']){const source=readFileSync(file,'utf8');expect(source).not.toMatch(/from\(['"]current_prices['"]\)[\s\S]{0,100}select\(['"][^'"]*style_id/)}})
 it('keeps import comparison compatible with the View and public sharing independent',()=>{const importer=readFileSync('src/pages/ImportPage.tsx','utf8'),share=readFileSync('functions/api/share/[token].ts','utf8');expect(importer).toContain("from('current_prices').select('*')");expect(share).not.toContain("from('current_prices')")})
})
