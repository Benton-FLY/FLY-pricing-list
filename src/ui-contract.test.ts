import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const share = readFileSync('src/pages/SharePage.tsx', 'utf8')
const admin = readFileSync('src/pages/AdminPage.tsx', 'utf8')
const importer = readFileSync('src/pages/ImportPage.tsx', 'utf8')

describe('public and admin UI contracts', () => {
  it('opens on an English batch list with date search', () => {
    expect(share).toContain("document.documentElement.lang='en'")
    expect(share).toContain('Price Updates')
    expect(share).toContain('Specific date')
    expect(share).toContain('View Price List')
  })
  it('provides product group filtering, option accordion and public history', () => {
    expect(share).toContain('Product Group')
    expect(share).toContain('price options')
    expect(share).toContain('Previous price:')
    expect(share).toContain('Full Price History')
    expect(share).not.toContain('internal_remark')
  })
  it('supports filtered selection and soft delete confirmation', () => {
    expect(admin).toContain('필터 결과 전체 선택')
    expect(admin).toContain('soft_delete_styles')
    expect(admin).toContain('개 스타일을 삭제하시겠습니까?')
  })
  it('keeps invalid import rows unselected and exposes comparison columns', () => {
    expect(importer).toContain("['Needs Decision','Error','Skipped']")
    expect(importer).toContain('Current Bulk FOB')
    expect(importer).toContain('Incoming Bulk FOB')
    expect(importer).not.toContain('Sample FOB</th>')
  })
})
