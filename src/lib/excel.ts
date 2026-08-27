import * as XLSX from 'xlsx'
import type { ImportRow, PriceRow } from '../types'
import { inferStyle, normalizeStyle } from './normalize'

type CellValue = string | number | boolean | null
type Mapping = { style: number; bulk: number[]; sample: number[]; remark?: number; headerRow: number }
const cleanHeader = (v: unknown) => String(v ?? '').toUpperCase().replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ')').trim()
const styleAliases = ['STYLE', 'STYLE#', 'STYLE NAME']
const bulkPriority = ['FOB (BULK)', 'BULK FOB', 'BULK']
const samplePriority = ['SAMPLE FOB', 'FOB (SAMPLE)', 'SMS (1.5X FOB)', 'SMS (1.5X)', 'SMS(1.5X)', 'X1.5']
const remarkAliases = ['REMARK', 'REMARKS', 'NOTE', 'NOTES']
const equalsAlias = (header: string, aliases: string[]) => aliases.some((a) => header === a || header.endsWith(` ${a}`))

function headerPaths(grid: CellValue[][], row: number, width: number) {
  return Array.from({ length: width }, (_, col) => {
    const parts: string[] = []
    for (let r = Math.max(0, row - 3); r <= row; r++) {
      const part = cleanHeader(grid[r]?.[col])
      if (part && parts.at(-1) !== part) parts.push(part)
    }
    return parts.join(' > ')
  })
}

export function detectTables(grid: CellValue[][]): Mapping[] {
  const found: Mapping[] = []
  grid.forEach((line, row) => {
    const headers = line.map(cleanHeader)
    const style = headers.findIndex((h) => styleAliases.includes(h))
    if (style < 0) return
    const paths = headerPaths(grid, row, Math.max(...grid.map((r) => r.length), 0))
    const bulk: number[] = []
    const sample: number[] = []
    paths.forEach((path, col) => {
      const leaf = headers[col]
      if (bulkPriority.some((a) => leaf === a) || (/\bFOB\b/.test(leaf) && !/SAMPLE|SMS|1\.5|X1\.5/.test(path))) bulk.push(col)
      if (samplePriority.some((a) => leaf === a) || /SAMPLE FOB|FOB \(SAMPLE\)|SMS ?\(1\.5X(?: FOB)?\)|X1\.5/.test(path)) sample.push(col)
    })
    const remark = headers.findIndex((h) => equalsAlias(h, remarkAliases))
    const uniqueBulk = [...new Set(bulk.filter((c) => c !== style))]
    const uniqueSample = [...new Set(sample.filter((c) => c !== style))]
    if (uniqueBulk.length || uniqueSample.length) found.push({ style, bulk: uniqueBulk, sample: uniqueSample, remark: remark >= 0 ? remark : undefined, headerRow: row })
  })
  return found
}

export const numberValue = (cell: XLSX.CellObject | undefined, sheet: XLSX.WorkSheet): number | null => {
  if (!cell) return null
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    if (cell.v === 0 && cell.f) {
      const ref = cell.f.match(/^\s*([A-Z]+\d+)\s*\*\s*1\.5\s*$/i)?.[1]
      if (ref && sheet[ref]?.v == null) return null
    }
    return cell.v > 0 ? cell.v : null
  }
  if (cell.f) {
    const ref = cell.f.match(/^\s*([A-Z]+\d+)\s*\*\s*1\.5\s*$/i)?.[1]
    const base = ref ? sheet[ref]?.v : null
    return typeof base === 'number' && base > 0 ? base * 1.5 : null
  }
  const parsed = Number(String(cell.v ?? '').replace(/[$,]/g, '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function mergedStyle(sheet: XLSX.WorkSheet, row: number, col: number) {
  const own = sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v
  if (own != null && String(own).trim()) return String(own).trim()
  const merge = (sheet['!merges'] ?? []).find((m) => col >= m.s.c && col <= m.e.c && row >= m.s.r && row <= m.e.r)
  if (!merge) return ''
  return String(sheet[XLSX.utils.encode_cell(merge.s)]?.v ?? '').trim()
}

function valuesAt(sheet: XLSX.WorkSheet, row: number, columns: number[]) {
  return [...new Set(columns.map((c) => numberValue(sheet[XLSX.utils.encode_cell({ r: row, c })], sheet)).filter((v): v is number => v != null))]
}

export function parseWorkbook(data: ArrayBuffer, filename: string): ImportRow[] {
  const book = XLSX.read(data, { type: 'array', cellFormula: true, cellText: true })
  const rows: ImportRow[] = []
  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName]
    const grid = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, raw: true, defval: null })
    const tables = detectTables(grid)
    tables.forEach((mapping, tableIndex) => {
      const end = tables[tableIndex + 1]?.headerRow ?? grid.length
      for (let r = mapping.headerRow + 1; r < end; r++) {
        const display_name = mergedStyle(sheet, r, mapping.style)
        if (!display_name || styleAliases.includes(cleanHeader(display_name))) continue
        const bulkCandidates = valuesAt(sheet, r, mapping.bulk)
        const sampleCandidates = valuesAt(sheet, r, mapping.sample)
        const bulk_fob = bulkCandidates.length === 1 ? bulkCandidates[0] : null
        const sample_fob = sampleCandidates.length === 1 ? sampleCandidates[0] : null
        if (!bulkCandidates.length && !sampleCandidates.length) continue
        const inferred = inferStyle(display_name)
        const conflict = bulkCandidates.length > 1 || sampleCandidates.length > 1
        rows.push({ key: `${sheetName}:${r + 1}:${tableIndex}`, sheet: sheetName, row: r + 1, import: !conflict, status: conflict ? 'Needs Decision' : 'New', message: conflict ? '여러 가격 후보 중 최종 가격을 선택하세요.' : '', display_name, normalized_name: normalizeStyle(display_name), ...inferred, bulk_fob, sample_fob, remark: mapping.remark == null ? '' : String(grid[r]?.[mapping.remark] ?? '').trim(), effective_date: new Date().toISOString().slice(0, 10), source_type: 'EXCEL', source_file: filename, source_sheet: sheetName, source_row: r + 1, bulkCandidates, sampleCandidates })
      }
    })
  }
  return mergeImports(rows)
}

export function mergeImports(input: ImportRow[], existing: PriceRow[] = []): ImportRow[] {
  const grouped = new Map<string, ImportRow[]>()
  input.forEach((row) => grouped.set(row.normalized_name, [...(grouped.get(row.normalized_name) ?? []), row]))
  return [...grouped.values()].map((group) => {
    const first = { ...group[0] }
    const bulks = [...new Set(group.flatMap((r) => r.bulkCandidates ?? (r.bulk_fob == null ? [] : [r.bulk_fob])))]
    const samples = [...new Set(group.flatMap((r) => r.sampleCandidates ?? (r.sample_fob == null ? [] : [r.sample_fob])))]
    first.bulkCandidates = bulks; first.sampleCandidates = samples
    if (bulks.length > 1 || samples.length > 1) { first.status = 'Needs Decision'; first.import = false; first.bulk_fob = bulks.length === 1 ? bulks[0] : null; first.sample_fob = samples.length === 1 ? samples[0] : null; first.message = `충돌: Bulk ${bulks.join(', ') || '—'} / Sample ${samples.join(', ') || '—'}`; return first }
    first.bulk_fob = bulks[0] ?? null; first.sample_fob = samples[0] ?? null
    const current = existing.find((r) => r.normalized_name === first.normalized_name)
    if (current) {
      const same = current.bulk_fob === first.bulk_fob && current.sample_fob === first.sample_fob
      first.status = same ? 'Unchanged' : 'Update'; first.import = !same
      if (!same && !first.remark.trim()) first.message = '기존 가격 변경 시 Remark가 필요합니다.'
    } else if (group.length > 1) first.status = 'Duplicate'
    return first
  })
}
