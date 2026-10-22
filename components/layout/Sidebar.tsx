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
  { href: '/relatorio',     label: 'Relatório PDF', icon: 'doc'     },
]

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'grid':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'cart':
      return (
        <svg {...props}>
          <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6"  y1="20" x2="6"  y2="14" />
          <line x1="2"  y1="20" x2="22" y2="20" />
        </svg>
      )
    case 'box':
      return (
        <svg {...props}>
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    case 'users':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...props}>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      )
    case 'percent':
      return (
        <svg {...props}>
          <line x1="19" y1="5" x2="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      )
    case 'flag':
      return (
        <svg {...props}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      )
    case 'doc':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    default:
      return <svg {...props}><circle cx="12" cy="12" r="4" /></svg>
  }
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 40, height: 40, background: '#F5C518' }}
        >
          <span className="text-xl font-black text-[#0D0D0D] leading-none">HG</span>
        </div>
        <div>
          <p className="text-sm font-bold text-[#F0F0F0] tracking-widest uppercase leading-none">Grifes</p>
          <p className="text-[10px] text-[#555555] tracking-widest uppercase mt-0.5">ERP</p>
        </div>
      </div>

      <div className="h-px bg-[#1A1A1A] mx-4 mb-2" />

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV.map((item) => {
          const active = isActive(item.href)
          const isExternal = item.href === '/pdv'
          const className = `
            flex items-center gap-3 h-11 px-3 rounded-lg transition-all duration-150 text-sm font-medium
            ${active
              ? 'bg-[#F5C518] text-[#0D0D0D] font-bold'
              : 'text-[#666666] hover:text-[#F0F0F0] hover:bg-[#1A1A1A]'
            }
          `
          if (isExternal) {
            return (
              <a key={item.href} href={item.href} className={className} onClick={() => setOpen(false)}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </a>
            )
          }
          return (
            <Link key={item.href} href={item.href} className={className} onClick={() => setOpen(false)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 mt-2">
        <div className="h-px bg-[#1A1A1A] mb-2" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 h-11 px-3 rounded-lg w-full transition-all duration-150 text-sm font-medium text-[#666666] hover:text-[#FF4444] hover:bg-[#FF4444]/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
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
        className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-[220px] bg-[#0D0D0D] border-r border-[#1A1A1A] z-40"
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-[60px] bg-[#0D0D0D] border-b border-[#1A1A1A] z-50 flex items-center px-4">
        <button
          onClick={() => setOpen(true)}
          className="text-[#888888] hover:text-[#F0F0F0] transition-colors"
          aria-label="Abrir menu"
        >
          <HamburgerIcon open={false} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <div
            className="flex items-center justify-center rounded-md"
            style={{ width: 28, height: 28, background: '#F5C518' }}
          >
            <span className="text-[11px] font-black text-[#0D0D0D] leading-none">HG</span>
          </div>
          <span className="text-sm font-bold text-[#F0F0F0] tracking-widest uppercase">Grifes</span>
        </div>
        <div className="w-[22px]" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <aside
            className="relative flex flex-col w-[220px] h-full bg-[#0D0D0D] border-r border-[#1A1A1A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center rounded-md"
                  style={{ width: 28, height: 28, background: '#F5C518' }}
                >
                  <span className="text-[11px] font-black text-[#0D0D0D] leading-none">HG</span>
                </div>
                <span className="text-sm font-bold text-[#F0F0F0] tracking-widest uppercase">Grifes</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#666666] hover:text-[#F0F0F0] transition-colors"
              >
                <HamburgerIcon open={true} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
