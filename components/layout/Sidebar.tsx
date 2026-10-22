'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV_PRIMARY = [
  { href: '/dashboard',  label: 'Início',   icon: 'grid'  },
  { href: '/pdv',        label: 'PDV',       icon: 'cart'  },
  { href: '/estoque',    label: 'Estoque',   icon: 'box'   },
  { href: '/clientes',   label: 'Clientes',  icon: 'users' },
]

const NAV_ALL = [
  { href: '/dashboard',     label: 'Dashboard',   icon: 'grid'    },
  { href: '/pdv',           label: 'PDV',          icon: 'cart'    },
  { href: '/vendas',        label: 'Vendas',       icon: 'chart'   },
  { href: '/estoque',       label: 'Estoque',      icon: 'box'     },
  { href: '/clientes',      label: 'Clientes',     icon: 'users'   },
  { href: '/financeiro',    label: 'Financeiro',   icon: 'wallet'  },
  { href: '/comissoes',     label: 'Comissões',    icon: 'percent' },
  { href: '/campanhas',     label: 'Campanhas',    icon: 'flag'    },
  { href: '/produtos/novo', label: 'Novo Produto', icon: 'tag'     },
  { href: '/relatorio',     label: 'Relatório',    icon: 'doc'     },
]

function Icon({ name, size = 20 }: { name: string; size?: number }) {
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
    case 'menu':    return <svg {...s}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    case 'close':   return <svg {...s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    case 'logout':  return <svg {...s}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    default:        return <svg {...s}><circle cx="12" cy="12" r="4"/></svg>
  }
}

const GOLD = '#C9A840'
const GOLD_BG = 'rgba(201,168,64,0.1)'
const GOLD_BORDER = 'rgba(201,168,64,0.25)'
const BG = '#050505'
const BORDER = '#141414'

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

  /* ── Desktop sidebar ─────────────────────────────────────────────────────── */
  return (
    <>
      <aside
        className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-[220px] z-40"
        style={{ background: BG, borderRight: `1px solid ${BORDER}` }}
      >
        {/* Logo area */}
        <div className="flex flex-col items-center px-4 pt-7 pb-5">
          <img
            src="/hg-logo.jpg"
            alt="HG Select"
            style={{
              width: 92, height: 92, borderRadius: '50%', objectFit: 'cover',
              border: `2px solid ${GOLD_BORDER}`,
              boxShadow: `0 0 28px rgba(201,168,64,0.18), 0 0 0 5px rgba(201,168,64,0.04)`,
            }}
          />
          <p style={{ marginTop: 10, fontSize: 9, color: '#2C2C2C', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            Sistema de Gestão
          </p>
        </div>

        <div style={{ height: 1, margin: '0 20px 6px', background: `linear-gradient(90deg, transparent, ${GOLD_BORDER}, transparent)` }} />

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 flex-1 py-1 overflow-y-auto">
          {NAV_ALL.map((item) => {
            const active = isActive(item.href)
            return item.href === '/pdv'
              ? (
                <a key={item.href} href={item.href}
                  className="flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] font-medium transition-all duration-150 border"
                  style={active
                    ? { background: GOLD_BG, color: GOLD, borderColor: GOLD_BORDER, fontWeight: 600 }
                    : { color: '#444', borderColor: 'transparent' }
                  }
                >
                  <Icon name={item.icon} size={16} /><span>{item.label}</span>
                </a>
              ) : (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] font-medium transition-all duration-150 border"
                  style={active
                    ? { background: GOLD_BG, color: GOLD, borderColor: GOLD_BORDER, fontWeight: 600 }
                    : { color: '#444', borderColor: 'transparent' }
                  }
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#A8A8A8'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#444'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
                >
                  <Icon name={item.icon} size={16} /><span>{item.label}</span>
                </Link>
              )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5 pt-2">
          <div style={{ height: 1, marginBottom: 6, background: 'rgba(255,255,255,0.03)' }} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 h-10 px-3 rounded-xl w-full text-[13px] font-medium transition-all duration-150"
            style={{ color: '#2E2E2E' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E53E3E'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229,62,62,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2E2E2E'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Icon name="logout" size={16} /><span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
        style={{ height: 64, background: BG, borderBottom: `1px solid ${BORDER}` }}
      >
        {/* Logo centralizada + nome */}
        <div className="flex items-center gap-3">
          <img
            src="/hg-logo.jpg"
            alt="HG Select"
            style={{
              width: 44, height: 44, borderRadius: '50%', objectFit: 'cover',
              border: `1.5px solid ${GOLD_BORDER}`,
              boxShadow: `0 0 14px rgba(201,168,64,0.2)`,
            }}
          />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F0F0F0', letterSpacing: '-0.02em', lineHeight: 1 }}>HG Select</p>
            <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>Gestão</p>
          </div>
        </div>

        {/* Botão "mais" que abre overlay */}
        <button
          onClick={() => setOpen(true)}
          style={{ color: '#444', padding: 8 }}
          className="hover:text-[#A8A8A8] transition-colors rounded-lg"
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      {/* ── Mobile bottom navigation ─────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{
          height: 68,
          background: BG,
          borderTop: `1px solid ${BORDER}`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {NAV_PRIMARY.map((item) => {
          const active = isActive(item.href)
          const isExternal = item.href === '/pdv'
          const content = (
            <>
              <span style={{ color: active ? GOLD : '#3A3A3A', transition: 'color 150ms' }}>
                <Icon name={item.icon} size={22} />
              </span>
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 500,
                color: active ? GOLD : '#3A3A3A',
                letterSpacing: '0.02em',
                transition: 'color 150ms',
              }}>
                {item.label}
              </span>
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 24, height: 2, borderRadius: 1, background: GOLD,
                }} />
              )}
            </>
          )
          const style: React.CSSProperties = {
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, position: 'relative', paddingTop: 4,
            textDecoration: 'none',
          }
          return isExternal
            ? <a key={item.href} href={item.href} style={style}>{content}</a>
            : <Link key={item.href} href={item.href} style={style}>{content}</Link>
        })}

        {/* Botão "Mais" */}
        <button
          onClick={() => setOpen(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, paddingTop: 4, background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ color: open ? GOLD : '#3A3A3A' }}><Icon name="menu" size={22} /></span>
          <span style={{ fontSize: 10, fontWeight: 500, color: open ? GOLD : '#3A3A3A', letterSpacing: '0.02em' }}>Mais</span>
        </button>
      </nav>

      {/* ── Mobile overlay (menu completo) ───────────────────────────────────── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.85)' }} />
          <div
            className="relative flex flex-col rounded-t-3xl"
            style={{ background: '#0A0A0A', border: `1px solid ${BORDER}`, borderBottom: 'none', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#222' }} />
            </div>

            {/* Logo + título */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <img src="/hg-logo.jpg" alt="HG Select" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${GOLD_BORDER}` }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F0' }}>HG Select</p>
                  <p style={{ fontSize: 10, color: '#444' }}>Menu completo</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: '#444', padding: 6 }}>
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* Todos os links */}
            <div className="overflow-y-auto px-4 py-3 flex flex-col gap-1">
              {NAV_ALL.map((item) => {
                const active = isActive(item.href)
                const content = (
                  <div
                    className="flex items-center gap-4 rounded-2xl px-4 transition-all"
                    style={{
                      height: 52,
                      background: active ? GOLD_BG : 'transparent',
                      border: `1px solid ${active ? GOLD_BORDER : 'transparent'}`,
                    }}
                  >
                    <span style={{ color: active ? GOLD : '#555' }}><Icon name={item.icon} size={20} /></span>
                    <span style={{ fontSize: 15, fontWeight: active ? 600 : 500, color: active ? GOLD : '#888' }}>{item.label}</span>
                    {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: GOLD }} />}
                  </div>
                )
                return item.href === '/pdv'
                  ? <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{content}</a>
                  : <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{content}</Link>
              })}
            </div>

            {/* Logout */}
            <div className="px-4 pb-6 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 w-full rounded-2xl px-4 transition-all"
                style={{ height: 52, color: '#555' }}
              >
                <Icon name="logout" size={20} />
                <span style={{ fontSize: 15, fontWeight: 500 }}>Sair da conta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
