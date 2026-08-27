import type { PriceRow } from '../types'
import { formatPrice } from '../lib/normalize'

export function PriceTable({ rows, admin = false, onEdit, onHistory, onDeactivate }: { rows: PriceRow[]; admin?: boolean; onEdit?: (r: PriceRow) => void; onHistory?: (r: PriceRow) => void; onDeactivate?: (r: PriceRow) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Season</th><th>Style</th><th>Item</th><th className="money bulk">Bulk FOB</th><th className="money sample">Sample FOB</th><th>Remark</th><th>{admin ? 'Effective Date' : 'Updated'}</th>{admin && <th>Action</th>}</tr></thead><tbody>
    {rows.map((r) => <tr key={r.id ?? r.normalized_name}><td>{r.season}</td><td className="style-name">{r.display_name}</td><td><span className="badge">{r.item_type}</span></td><td className="money bulk">{formatPrice(r.bulk_fob)}</td><td className="money sample">{formatPrice(r.sample_fob, true)}</td><td className="remark">{r.remark || '—'}</td><td>{new Date(admin ? r.effective_date : (r.updated_at ?? r.effective_date)).toLocaleDateString()}</td>{admin && <td className="actions"><button onClick={() => onEdit?.(r)}>가격 수정</button><button onClick={() => onHistory?.(r)}>이력</button><button className="danger-link" onClick={() => onDeactivate?.(r)}>비활성화</button></td>}</tr>)}
    {!rows.length && <tr><td colSpan={admin ? 9 : 8} className="empty">검색 결과가 없습니다.</td></tr>}
  </tbody></table></div>
}
