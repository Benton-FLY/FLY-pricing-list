import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { detectTables, mergeImports, numberValue, parseWorkbook } from './excel'
import type { ImportRow } from '../types'

const workbook = (sheets: Record<string, unknown[][]>, merges: Record<string, XLSX.Range[]> = {}) => { const wb=XLSX.utils.book_new(); for(const [name,data] of Object.entries(sheets)){const ws=XLSX.utils.aoa_to_sheet(data);ws['!merges']=merges[name]??[];XLSX.utils.book_append_sheet(wb,ws,name)} return XLSX.write(wb,{bookType:'xlsx',type:'array'}) as ArrayBuffer }
const row=(name:string,bulk:number|null,sample:number|null,sheet='A'):ImportRow=>({key:name+sheet,sheet,row:2,import:true,status:'New',message:'',display_name:name,normalized_name:name,season:'27',item_type:'OTHER',bulk_fob:bulk,sample_fob:sample,remark:'',effective_date:'2026-01-01',bulkCandidates:bulk?[bulk]:[],sampleCandidates:sample?[sample]:[]})

describe('Excel detection',()=>{
  it('detects aliases and repeated headers',()=>{const grid=[['STYLE NAME','BULK FOB','FOB (SAMPLE)','NOTES'],['A',1,1.5,''],['STYLE#','FOB (BULK)','X1.5','REMARKS']];expect(detectTables(grid).map(x=>x.headerRow)).toEqual([0,2])})
  it('combines multi-row headers and flags multiple FOBs',()=>{const grid=[['','Roller Sublimation','Digital Sublimation'],['STYLE','Above 3K Unit','Below 3K Unit'],['STYLE','FOB','FOB']];expect(detectTables(grid)[0].bulk).toEqual([1,2])})
  it('uses merged style only inside its range',()=>{const data=workbook({A:[['STYLE','BULK FOB'],['27 LITE GLOVE',8],['',9],['',10]]},{A:[{s:{r:1,c:0},e:{r:2,c:0}}]});const rows=parseWorkbook(data,'synthetic.xlsx');expect(rows[0].bulkCandidates).toEqual([8,9]);expect(rows.some(r=>r.bulk_fob===10)).toBe(false)})
  it('prefers explicit 1.5X sample and ignores empty-reference cached zero',()=>{const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([['STYLE','BULK FOB','SMS','SMS (1.5X)'],['26 F-16 PANT',20.3,21.64,32.46],['26 MTB SHORT LINER',5,null,null]]);ws.D3={t:'n',v:0,f:'C3*1.5'};XLSX.utils.book_append_sheet(wb,ws,'Prices');const data=XLSX.write(wb,{bookType:'xlsx',type:'array'}) as ArrayBuffer;const rows=parseWorkbook(data,'synthetic.xlsx');expect(rows.find(r=>r.display_name==='26 F-16 PANT')).toMatchObject({bulk_fob:20.3,sample_fob:32.46});expect(rows.find(r=>r.display_name==='26 MTB SHORT LINER')?.sample_fob).toBeNull()})
  it('safely calculates a simple uncached x1.5 formula',()=>{const ws=XLSX.utils.aoa_to_sheet([['STYLE','BULK FOB','X1.5'],['27 F-16 JERSEY (SIZE: S ~ 2XL)',6.37,null]]);expect(numberValue({t:'n',f:'B2*1.5'} as XLSX.CellObject,ws)).toBeCloseTo(9.555)})
})
describe('cross-sheet merge and conflict',()=>{
  it('merges complementary bulk/sample',()=>{const out=mergeImports([row('26.5 KINETIC 1 MESH PANT',34.9,null,'A'),row('26.5 KINETIC 1 MESH PANT',null,63.03,'B')]);expect(out[0]).toMatchObject({bulk_fob:34.9,sample_fob:63.03,status:'Duplicate'})})
  it('requires a decision for conflicting prices',()=>{const out=mergeImports([row('27.5 KINETIC 1 MESH PANT',36.8,null,'A'),row('27.5 KINETIC 1 MESH PANT',37.75,null,'B')]);expect(out[0]).toMatchObject({bulk_fob:null,status:'Needs Decision',import:false})})
  it('marks equal existing data unchanged and changed data update',()=>{const existing=[{...row('27 GLOVE',8.72,null),id:'1'}];expect(mergeImports([row('27 GLOVE',8.72,null)],existing)[0].status).toBe('Unchanged');expect(mergeImports([row('27 GLOVE',9,null)],existing)[0].status).toBe('Update')})
})
