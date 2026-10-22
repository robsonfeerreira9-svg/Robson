'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',    icon: 'grid'    },
  { href: '/pdv',           label: 'PDV',           icon: 'cart'    },
  { href: '/vendas',        label: 'Vendas',        icon: 'chart'   },
  { href: '/estoque',       label: 'Estoque',       icon: 'box'     },
  { href: '/clientes',      label: 'Clientes',      icon: 'users'   },
  { href: '/financeiro',    label: 'Financeiro',    icon: 'wallet'  },
  { href: '/comissoes',     label: 'Comissões',     icon: 'percent' },
  { href: '/campanhas',     label: 'Campanhas',     icon: 'flag'    },
  { href: '/produtos/novo', label: 'Novo Produto',  icon: 'tag'     },
  { href: '/relatorio',     label: 'Relatório',     icon: 'doc'     },
]

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const s = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'grid':    return <svg {...s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    case 'cart':    return <svg {...s}><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
    case 'chart':   return <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
    case 'box':     return <svg {...s}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
    case 'users':   return <svg {...s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    case 'wallet':  return <svg {...s}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
    case 'percent': return <svg {...s}><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
    case 'flag':    return <svg {...s}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
    case 'tag':     return <svg {...s}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
    case 'doc':     return <svg {...s}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    default:        return <svg {...s}><circle cx="12" cy="12" r="4"/></svg>
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const NavItems = () => (
    <nav className="flex flex-col gap-0.5 px-3 flex-1 py-2">
      {NAV.map((item) => {
        const active = isActive(item.href)
        const isExternal = item.href === '/pdv'
        const cls = `flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] transition-all duration-150 ${
          active
            ? 'bg-[rgba(201,168,64,0.1)] text-[#C9A840] font-semibold border border-[rgba(201,168,64,0.2)]'
            : 'font-medium text-[#454545] hover:text-[#A8A8A8] hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
        }`
        return isExternal
          ? <a key={item.href} href={item.href} className={cls} onClick={() => setOpen(false)}><Icon name={item.icon} /><span>{item.label}</span></a>
          : <Link key={item.href} href={item.href} className={cls} onClick={() => setOpen(false)}><Icon name={item.icon} /><span>{item.label}</span></Link>
      })}
    </nav>
  )

  const SidebarBody = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex flex-col items-center px-4 pt-6 pb-4">
        <img
          src="/hg-logo.jpg"
          alt="HG Select"
          style={{
            width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid rgba(201,168,64,0.3)',
            boxShadow: '0 0 24px rgba(201,168,64,0.15), 0 0 0 4px rgba(201,168,64,0.05)',
          }}
        />
        <p style={{ marginTop: 10, fontSize: 9, color: '#2A2A2A', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          Sistema de Gestão
        </p>
      </div>

      {/* Gold divider */}
      <div style={{ height: 1, margin: '0 16px 8px', background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.2), transparent)' }} />

      <NavItems />

      {/* Bottom */}
      <div className="px-3 pb-4 pt-2">
        <div style={{ height: 1, marginBottom: 8, background: 'rgba(255,255,255,0.03)' }} />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 h-10 px-3 rounded-xl w-full text-[13px] font-medium text-[#2E2E2E] hover:text-[#E53E3E] hover:bg-[rgba(229,62,62,0.06)] border border-transparent transition-all duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sair</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-[220px] z-40"
        style={{ background: '#050505', borderRight: '1px solid #121212' }}
      >
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-[60px] z-50 flex items-center px-4"
        style={{ background: '#050505', borderBottom: '1px solid #121212' }}
      >
        <button onClick={() => setOpen(true)} className="text-[#333] hover:text-[#A8A8A8] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="flex-1 flex justify-center">
          <img
            src="/hg-logo.jpg"
            alt="HG Select"
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,64,0.3)' }}
          />
        </div>
        <div className="w-5" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.85)' }} />
          <aside
            className="relative w-[220px] h-full flex flex-col"
            style={{ background: '#050505', borderRight: '1px solid #121212' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #121212' }}>
              <img src="/hg-logo.jpg" alt="HG Select" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <button onClick={() => setOpen(false)} className="text-[#333] hover:text-[#A8A8A8] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarBody />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
