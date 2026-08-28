export type ItemType = 'PANT' | 'JERSEY' | 'GLOVE' | 'OTHER'
export type SourceType = 'KEY_IN' | 'EXCEL'
export type ImportStatus = 'New' | 'Update' | 'Duplicate' | 'Unchanged' | 'Needs Decision' | 'Error' | 'Skipped'
export type ChangeReason = '' | 'TYPO' | 'MATERIAL' | 'LABOR' | 'SPECIFICATION' | 'OTHER'
export const changeReasonEnglish: Record<Exclude<ChangeReason,''>,string> = { TYPO:'Typo correction', MATERIAL:'Material cost update', LABOR:'Labor cost update', SPECIFICATION:'Specification update', OTHER:'Other' }
export interface PriceRow { id?: string; style_id?: string; price_version_id?: string; display_name: string; normalized_name: string; season: string; item_type: ItemType; product_group: string; price_option: string; bulk_fob: number | null; sample_fob?: number | null; currency?: string; internal_remark: string; public_remark_en: string; change_reason: ChangeReason; effective_date: string; updated_at?: string; previous_bulk_fob?: number | null; previous_version_id?: string | null; status?: string; is_active?: boolean; source_type?: SourceType; source_file?: string; source_sheet?: string; source_row?: number }
export interface ImportRow extends PriceRow { key: string; sheet: string; row: number; import: boolean; status: ImportStatus; message: string; current_bulk_fob?: number | null; current_updated_at?: string; bulkCandidates?: number[] }
export interface ImportBatch { id:string; public_title_en:string; effective_date:string; confirmed_at:string; seasons:string[]; style_count:number; price_option_count:number; status:string; items?:PriceRow[] }
export interface ShareLink { id: string; label: string; expires_at: string | null; revoked_at: string | null; created_at: string; original_url_available?: boolean; link?: string }
