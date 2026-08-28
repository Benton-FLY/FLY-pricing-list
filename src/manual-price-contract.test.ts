import{readFileSync}from'node:fs'
import{describe,expect,it}from'vitest'
const form=readFileSync('src/components/PriceForm.tsx','utf8'),admin=readFileSync('src/pages/AdminPage.tsx','utf8'),table=readFileSync('src/components/PriceTable.tsx','utf8'),flow=readFileSync('src/lib/manualPrice.ts','utf8')
describe('manual price persistence contract',()=>{
 it('verifies the returned id in price_versions and current_prices before success',()=>{expect(flow).toContain("from('price_versions')");expect(flow).toContain("from('current_prices')");expect(flow).toContain("eq('price_version_id',priceVersionId)");expect(form.indexOf('await onSaved(saved)')).toBeLessThan(form.indexOf('setForm(blank())'))})
 it('awaits a database refetch and rejects a missing current row',()=>{expect(admin).toContain('const fresh=await load()');expect(admin).toContain('fresh.find(r=>r.price_version_id===result.priceVersionId)');expect(admin).toContain('목록 재조회에 실패하여 저장 완료로 처리하지 않았습니다.')})
 it('preserves form values on failure and distinguishes unchanged prices',()=>{expect(form).toContain('catch(reason)');expect(admin).toContain('동일한 현재 가격이 이미 등록되어 있습니다.')})
 it('offers filter reset and reveals/highlights the saved option',()=>{expect(admin).toContain('현재 필터 조건 때문에 목록에서 보이지 않습니다.');expect(admin).toContain('저장한 가격 보기');expect(table).toContain('saved-price');expect(table).toContain('new Set(value).add(reveal.styleId)')})
 it('shows the failed query stage, Supabase message, and retry action',()=>{expect(admin).toContain('목록 조회 실패 · 발생 단계:');expect(admin).toContain('Supabase 오류:');expect(admin).toContain('다시 시도')})
})
