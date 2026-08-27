export type ItemType = 'PANT' | 'JERSEY' | 'GLOVE' | 'OTHER'
export type SourceType = 'KEY_IN' | 'EXCEL'
export type ImportStatus = 'New' | 'Update' | 'Duplicate' | 'Unchanged' | 'Needs Decision' | 'Error' | 'Skipped'
export interface PriceRow { id?: string; style_id?: string; display_name: string; normalized_name: string; season: string; item_type: ItemType; bulk_fob: number | null; sample_fob: number | null; currency?: string; remark: string; effective_date: string; updated_at?: string; source_type?: SourceType; source_file?: string; source_sheet?: string; source_row?: number }
export interface ImportRow extends PriceRow { key: string; sheet: string; row: number; import: boolean; status: ImportStatus; message: string; bulkCandidates?: number[]; sampleCandidates?: number[] }
export interface ShareLink { id: string; label: string; expires_at: string | null; revoked_at: string | null; created_at: string }
