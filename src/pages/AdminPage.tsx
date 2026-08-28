import {useCallback,useEffect,useMemo,useState} from 'react'
import {useLocation} from 'react-router-dom'
import {PriceForm} from '../components/PriceForm'
import {PriceTable} from '../components/PriceTable'
import {supabase} from '../lib/supabase'
import {matchesSearch} from '../lib/normalize'
import type {ImportBatch,PriceRow} from '../types'

const koreanDbError=(message:string)=>`가격 데이터를 불러오지 못했습니다. Supabase 프로젝트·권한·current_prices View를 확인하세요. (${message})`

export function AdminPage(){
  const location=useLocation()
  const[rows,setRows]=useState<PriceRow[]>([]),[edit,setEdit]=useState<PriceRow>(),[history,setHistory]=useState<PriceRow[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[recent,setRecent]=useState<ImportBatch>(),[query,setQuery]=useState(''),[season,setSeason]=useState(''),[item,setItem]=useState(''),[group,setGroup]=useState(''),[option,setOption]=useState(''),[active,setActive]=useState('active'),[selected,setSelected]=useState(new Set<string>())
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    const [{data:prices,error:priceError},{data:batches,error:batchError}]=await Promise.all([
      supabase.from('current_prices').select('style_id,display_name,normalized_name,season,item_type,product_group,price_option,bulk_fob,public_remark_en,internal_remark,change_reason,effective_date,updated_at,price_version_id,is_active').order('updated_at',{ascending:false}),
      supabase.from('import_batches').select('id,internal_name,public_title_en,effective_date,confirmed_at,seasons,style_count,price_option_count,status').eq('status','CONFIRMED').order('confirmed_at',{ascending:false}).limit(1),
    ])
    if(priceError||batchError){setRows([]);setRecent(undefined);setError(koreanDbError(priceError?.message||batchError?.message||'알 수 없는 오류'))}
    else{
      setRows((prices??[]).map(row=>({...row,id:row.style_id})) as PriceRow[])
      const batch=batches?.[0] as ImportBatch|undefined
      if(batch){const{data:items,error:itemError}=await supabase.from('import_batch_items').select('status').eq('batch_id',batch.id);if(itemError)setError(koreanDbError(itemError.message));else setRecent({...batch,new_count:(items??[]).filter(x=>x.status==='New').length,update_count:(items??[]).filter(x=>x.status==='Update').length})}
    }
    sessionStorage.removeItem('prices:refresh');setLoading(false)
  },[])
  useEffect(()=>{void load()},[load,location.key])
  useEffect(()=>{const refresh=()=>void load();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[load])
  const filtered=useMemo(()=>rows.filter(r=>matchesSearch(r,query)&&(!season||r.season===season)&&(!item||r.item_type===item)&&(!group||r.product_group===group)&&(!option||r.price_option===option)&&(active==='all'||r.is_active===(active==='active'))),[rows,query,season,item,group,option,active])
  const styleCount=new Set(filtered.map(r=>r.style_id||r.id)).size
  const values=(k:keyof PriceRow)=>[...new Set(rows.map(r=>String(r[k]??'')).filter(Boolean))].sort()
  const showHistory=async(r:PriceRow)=>{const{data,error:historyError}=await supabase.from('price_versions').select('*').eq('style_id',r.style_id||r.id).ilike('price_option',r.price_option).order('created_at',{ascending:false});if(historyError)setError(koreanDbError(historyError.message));else setHistory((data??[]).map(p=>({...r,...p})) as PriceRow[])}
  const deactivate=async(r:PriceRow)=>{if(confirm(`${r.display_name} 스타일을 비활성화할까요?`)){const{error:e}=await supabase.from('styles').update({is_active:false}).eq('id',r.style_id||r.id);if(e)setError(`비활성화하지 못했습니다. (${e.message})`);else void load()}}
  const remove=async()=>{if(!selected.size||!confirm(`선택한 ${selected.size}개 스타일을 삭제하시겠습니까?`))return;const{error:e}=await supabase.rpc('soft_delete_styles',{p_style_ids:[...selected]});if(e)setError(`삭제하지 못했습니다. (${e.message})`);else{setSelected(new Set());void load()}}
  return <main className="container admin"><header><p className="eyebrow">ADMIN</p><h1>최종 FOB 가격 관리</h1><p className="muted">가격 옵션별 현재가와 이력을 관리합니다.</p></header>
  {recent&&<section className="card recent-import"><div><span>최근 Import</span><strong>{recent.internal_name||recent.public_title_en}</strong></div><div><span>업데이트 날짜</span><strong>{new Date(recent.confirmed_at).toLocaleString('ko-KR')}</strong></div><div><span>저장 결과</span><strong>{recent.style_count} Styles / {recent.price_option_count} Price Options</strong></div><div><span>New / Update</span><strong>{recent.new_count} / {recent.update_count}</strong></div></section>}
  <h2>{edit?'가격 수정':'직접 입력'}</h2><PriceForm initial={edit} onSaved={()=>{setEdit(undefined);void load()}} onCancel={edit?()=>setEdit(undefined):undefined}/><section className="section-head"><h2>현재 가격 <span>{styleCount} Styles / {filtered.length} Price Options</span></h2><button onClick={()=>void load()} disabled={loading}>{loading?'조회 중…':'최신 데이터 다시 조회'}</button></section><section className="filters card"><label className="search">검색<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Season, Style, Product Group, Price Option, Remark"/></label>{([['Season',season,setSeason,'season'],['Item Type',item,setItem,'item_type'],['Product Group',group,setGroup,'product_group'],['Price Option',option,setOption,'price_option']] as const).map(([label,value,set,key])=><label key={label}>{label}<select value={value} onChange={e=>set(e.target.value)}><option value="">전체</option>{values(key).map(x=><option key={x}>{x}</option>)}</select></label>)}<label>상태<select value={active} onChange={e=>setActive(e.target.value)}><option value="active">활성</option><option value="inactive">비활성</option><option value="all">전체</option></select></label></section><div className="toolbar"><span>{selected.size}개 선택</span><div><button onClick={()=>setSelected(new Set(filtered.map(r=>r.style_id||r.id!).filter(Boolean)))}>필터 결과 전체 선택</button><button onClick={()=>setSelected(new Set())}>전체 해제</button><button className="danger" disabled={!selected.size} onClick={remove}>선택 항목 삭제</button></div></div>{error&&<p role="alert" className="error">{error}</p>}<PriceTable rows={filtered} admin selected={selected} onSelect={(id,on)=>setSelected(s=>{const n=new Set(s);if(on)n.add(id);else n.delete(id);return n})} onEdit={setEdit} onHistory={showHistory} onDeactivate={deactivate}/>{history.length>0&&<div className="modal" role="dialog" aria-modal="true" onClick={()=>setHistory([])}><div className="modal-body" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setHistory([])}>닫기</button><h2>{history[0].display_name} / {history[0].price_option} 가격 이력</h2><PriceTable rows={history}/></div></div>}</main>
}
