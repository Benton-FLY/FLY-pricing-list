import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/normalize'
import type { ChangeReason, ImportRow, ImportStatus, ItemType } from '../types'

const statuses: ImportStatus[] = ['New', 'Update', 'Duplicate', 'Unchanged', 'Needs Decision', 'Error', 'Skipped']
const selectable = (row: ImportRow) => !['Needs Decision', 'Error', 'Skipped'].includes(row.status) && row.bulk_fob != null
const rpcMessage = (message: string) => message.includes('import_prices(p_batch, p_rows)')
  ? '가격 저장 기능의 데이터베이스 업데이트가 적용되지 않았습니다. Supabase 마이그레이션을 적용한 뒤 다시 시도하세요.'
  : message

export function ImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [step, setStep] = useState(1)
  const [filter, setFilter] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [filename, setFilename] = useState('')
  const visible = useMemo(() => rows.filter(row => !filter || row.status === filter), [rows, filter])
  const selectedCount = rows.filter(row => row.import).length
  const attentionCount = rows.filter(row => !selectable(row)).length
  const pendingReasons = rows.filter(row => row.import && row.status === 'Update' && !row.change_reason).length
  const change = (key: string, patch: Partial<ImportRow>) => setRows(value => value.map(row => row.key === key ? { ...row, ...patch } : row))

  const file = async (selectedFile: File) => {
    setMessage('')
    setRows([])
    setStep(1)
    setAnalyzing(true)
    try {
      const { parseWorkbook, mergeImports } = await import('../lib/excel')
      const parsed = parseWorkbook(await selectedFile.arrayBuffer(), selectedFile.name)
      const { data, error } = await supabase.from('current_prices').select('*')
      if (error) throw error
      setRows(mergeImports(parsed, data ?? []))
      setFilename(selectedFile.name)
      setStep(3)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '파일을 분석하지 못했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  const select = (predicate: (row: ImportRow) => boolean, on: boolean) => setRows(value => value.map(row => predicate(row) && selectable(row) ? { ...row, import: on } : row))

  const confirmImport = async () => {
    const selected = rows.filter(row => row.import)
    setMessage('')
    if (!selected.length) return setMessage('가져올 가격을 하나 이상 선택하세요.')
    if (!title.trim()) return setMessage('Public Update Title (English)를 입력하세요.')
    if (selected.some(row => !selectable(row))) return setMessage('Needs Decision 또는 Error 행을 먼저 해결하세요.')
    if (pendingReasons) return setMessage('변경 가격에는 변경 사유가 필요합니다.')
    if (selected.some(row => row.change_reason === 'OTHER' && !row.public_remark_en.trim())) return setMessage('기타 사유에는 Public Remark (English)가 필요합니다.')
    setBusy(true)
    try {
      const batchPayload = {
        internal_name: filename,
        public_title_en: title.trim(),
        source_file: filename,
        effective_date: selected[0]?.effective_date,
        seasons: [...new Set(selected.map(row => row.season))],
      }
      const { error } = await supabase.rpc('import_prices', { p_batch: batchPayload, p_rows: selected })
      if (error) setMessage(rpcMessage(error.message))
      else {
        setMessage(`${selected.length}개 가격 옵션을 저장했습니다.`)
        setStep(4)
      }
    } catch (error) {
      setMessage(error instanceof Error ? rpcMessage(error.message) : '가격을 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="container admin">
    <header><p className="eyebrow">EXCEL IMPORT</p><h1>가격 파일 가져오기</h1></header>
    <ol className="steps">{['파일 선택', '분석 · 매핑', '검토 · 확인', '완료'].map((label, index) => <li className={step >= index + 1 ? 'active' : ''} key={label}><b>{index + 1}</b>{label}</li>)}</ol>
    <section className={`card upload ${analyzing ? 'is-loading' : ''}`}>
      <input aria-label="Excel 파일" type="file" accept=".xlsx,.xls" disabled={analyzing || busy} onChange={event => event.target.files?.[0] && file(event.target.files[0])} />
      <p>{analyzing ? 'Excel 파일을 분석하고 현재 가격과 비교하는 중…' : '원본 파일은 서버에 업로드되지 않습니다. Sample FOB는 생성하지 않습니다.'}</p>
    </section>
    {rows.length > 0 && <>
      <section className="import-summary" aria-label="Import summary">
        <div className="card"><span>파일</span><strong title={filename}>{filename}</strong></div>
        <div className="card"><span>분석 결과</span><strong>{rows.length}</strong></div>
        <div className="card"><span>선택됨</span><strong>{selectedCount}</strong></div>
        <div className={`card ${attentionCount ? 'has-attention' : ''}`}><span>확인 필요</span><strong>{attentionCount}</strong></div>
      </section>
      <label className="card title-input">Public Update Title (English)<input required lang="en" value={title} onChange={event => setTitle(event.target.value)} placeholder="27 MX/BMX Confirmed FOB Prices" /></label>
      <div className="toolbar">
        <div>{statuses.map(status => <button className={filter === status ? 'selected' : ''} onClick={() => setFilter(filter === status ? '' : status)} key={status}>{status} ({rows.filter(row => row.status === status).length})</button>)}</div>
        <div className="selection-actions"><span><b>{selectedCount}</b> selected</span><button onClick={() => select(row => visible.includes(row), true)}>필터 결과 전체 선택</button><button onClick={() => select(() => true, false)}>전체 해제</button>{[...new Set(rows.map(row => row.sheet))].map(sheet => <button key={sheet} onClick={() => select(row => row.sheet === sheet, !rows.filter(row => row.sheet === sheet && selectable(row)).every(row => row.import))}>{sheet} 선택/해제</button>)}</div>
      </div>
      <div className="table-wrap import-table"><table><thead><tr>{['Select', 'Status', 'Sheet / Row', 'Style', 'Season', 'Item Type', 'Product Group', 'Price Option', 'Current Bulk FOB', 'Incoming Bulk FOB', 'Difference', 'Current Updated Date', 'Change Reason', 'Internal Remark', 'Public Remark (English)', 'Message'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.key}><td><input aria-label={`Import ${row.display_name} ${row.price_option}`} type="checkbox" checked={row.import} disabled={!selectable(row)} onChange={event => change(row.key, { import: event.target.checked })} /></td><td><span className={`status s-${row.status.replace(' ', '-')}`}>{row.status}</span></td><td>{row.sheet}<br />{row.row}</td><td><input value={row.display_name} onChange={event => change(row.key, { display_name: event.target.value })} /></td><td>{row.season}</td><td><select value={row.item_type} onChange={event => change(row.key, { item_type: event.target.value as ItemType })}>{['PANT', 'JERSEY', 'GLOVE', 'OTHER'].map(value => <option key={value}>{value}</option>)}</select></td><td><input value={row.product_group} onChange={event => change(row.key, { product_group: event.target.value })} /></td><td><input value={row.price_option} onChange={event => change(row.key, { price_option: event.target.value })} /></td><td>{formatPrice(row.current_bulk_fob)}</td><td><input type="number" step=".0001" value={row.bulk_fob ?? ''} onChange={event => change(row.key, { bulk_fob: event.target.value ? Number(event.target.value) : null })} /></td><td className={row.current_bulk_fob != null && row.bulk_fob != null && row.bulk_fob - row.current_bulk_fob > 0 ? 'up' : 'down'}>{row.current_bulk_fob != null && row.bulk_fob != null ? `${row.bulk_fob - row.current_bulk_fob >= 0 ? '+' : ''}${formatPrice(row.bulk_fob - row.current_bulk_fob)}` : '—'}</td><td>{row.current_updated_at ? new Date(row.current_updated_at).toLocaleDateString() : '—'}</td><td><select value={row.change_reason} onChange={event => change(row.key, { change_reason: event.target.value as ChangeReason })} disabled={row.status !== 'Update'}><option value="">선택</option><option value="TYPO">오타 수정</option><option value="MATERIAL">자재단가 변경</option><option value="LABOR">공임 변경</option><option value="SPECIFICATION">사양 변경</option><option value="OTHER">기타</option></select></td><td><input value={row.internal_remark} onChange={event => change(row.key, { internal_remark: event.target.value })} /></td><td><input lang="en" value={row.public_remark_en} onChange={event => change(row.key, { public_remark_en: event.target.value })} /></td><td>{row.message}</td></tr>)}</tbody></table></div>
      <div className="confirm card"><div><strong>{selectedCount}개 가격 옵션 저장</strong><span>{pendingReasons ? `변경 사유 ${pendingReasons}건을 선택하세요.` : '선택한 항목을 하나의 가격 업데이트로 저장합니다.'}</span></div><button className="primary" disabled={busy || !selectedCount || !!pendingReasons} onClick={confirmImport}>{busy ? '저장 중…' : 'Confirm Import'}</button></div>
    </>}
    {message && <p role="alert" className={step === 4 ? 'success import-message' : 'error import-message'}>{message}</p>}
  </main>
}
