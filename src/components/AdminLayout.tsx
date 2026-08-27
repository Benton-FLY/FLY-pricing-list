import { NavLink, Outlet, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
export function AdminLayout({session}:{session:Session|null}) { if(!session)return <Navigate to="/admin/login" replace/>; return <><header className="admin-bar"><NavLink to="/admin" className="brand">FLY / PRICING</NavLink><nav><NavLink to="/admin">가격 관리</NavLink><NavLink to="/admin/import">Excel Import</NavLink><NavLink to="/admin/share">공유 링크</NavLink><button onClick={()=>supabase.auth.signOut()}>로그아웃</button></nav></header><Outlet/></> }
