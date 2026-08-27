import type { ItemType, PriceRow } from '../types'

export const normalizeStyle = (value: string) => value.trim().toUpperCase().replace(/[‐‑‒–—]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ')
export const searchable = (value: string) => normalizeStyle(value).replace(/[-\s]/g, '')
export function inferStyle(value: string): { season: string; item_type: ItemType } {
  const normalized = normalizeStyle(value)
  const season = normalized.match(/^(\d{2}(?:\.5)?)(?:\s|$)/)?.[1] ?? ''
  const item_type: ItemType = /\bPANT\b/.test(normalized) ? 'PANT' : /\bJERSEY\b/.test(normalized) ? 'JERSEY' : /\bGLOVE\b/.test(normalized) ? 'GLOVE' : 'OTHER'
  return { season, item_type }
}
export function matchesSearch(row: PriceRow, query: string) {
  const terms = normalizeStyle(query).split(' ').filter(Boolean).map(searchable)
  const haystack = searchable([row.display_name, row.season, row.item_type, row.remark].join(' '))
  return terms.every((term) => haystack.includes(term))
}
export function formatPrice(value: number | null, sample = false) {
  if (value == null) return '—'
  const digits = sample && Math.round(value * 1000) % 10 !== 0 ? 3 : 2
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}
