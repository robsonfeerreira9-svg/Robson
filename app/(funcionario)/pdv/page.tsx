'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { mutate } from 'swr'
import ProductGrid from '@/components/pdv/ProductGrid'
import Cart, { type CartItem } from '@/components/pdv/Cart'
import type { ProdutoComEstoque, RoleUsuario } from '@/lib/database.types'
import { createClient } from '@/lib/supabase'
import SplashMotivacional from '@/components/SplashMotivacional'

export default function PDVPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState<RoleUsuario>('funcionario')
  const [mobileView, setMobileView] = useState<'produtos' | 'carrinho'>('produtos')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('usuarios').select('role').eq('id', user.id).single()
      if (data?.role) setUserRole(data.role as RoleUsuario)
    }
    init()
  }, [])

  const isSocio = userRole === 'socio'
  const totalItens = cartItems.reduce((acc, i) => acc + i.quantidade, 0)

  const handleAddToCart = useCallback((produto: ProdutoComEstoque) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.produto.id === produto.id)
      if (existing) {
        const estoqueMax = produto.estoque?.[0]?.quantidade ?? 0
        if (existing.quantidade >= estoqueMax) return prev
        return prev.map((i) =>
          i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
        )
      }
      return [...prev, { produto, quantidade: 1 }]
    })
  }, [])

  const handleUpdateQty = useCallback((produtoId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((prev) => prev.filter((i) => i.produto.id !== produtoId))
    } else {
      setCartItems((prev) =>
        prev.map((i) => (i.produto.id === produtoId ? { ...i, quantidade: qty } : i))
      )
    }
  }, [])

  const handleRemove = useCallback((produtoId: string) => {
    setCartItems((prev) => prev.filter((i) => i.produto.id !== produtoId))
  }, [])

  const handleClear = useCallback(() => {
    setCartItems([])
    setMobileView('produtos')
  }, [])

  const handleVendaRealizada = useCallback(() => {
    mutate('produtos-pdv')
    setMobileView('produtos')
  }, [])

  // Header compartilhado
  const Header = ({ showBack }: { showBack?: boolean }) => (
    <div className="px-4 py-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#111111] flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="w-9 h-9 rounded-full overflow-hidden border border-[#C9A840]/30 flex-shrink-0">
          <Image src="/hg-logo.jpg" alt="HG Select" width={36} height={36} className="object-cover w-full h-full" />
        </div>
        <div>
          <p className="text-[11px] font-black text-[#C9A840] uppercase tracking-[0.15em] leading-none">HG Select</p>
          <p className="text-[9px] text-[#555] uppercase tracking-wide leading-none mt-0.5">
            {showBack ? 'Carrinho' : 'Ponto de Venda'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Voltar ao dashboard / perfil (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {isSocio ? (
            <a href="/dashboard" className="text-[11px] text-[#C9A840] border border-[#C9A840]/30 px-2.5 py-1 rounded-lg hover:border-[#C9A840] transition-colors">
              ← Dashboard
            </a>
          ) : (
            <a href="/perfil" className="text-[11px] text-[#C9A840] border border-[#C9A840]/30 px-2.5 py-1 rounded-lg hover:border-[#C9A840] transition-colors">
              Meu Perfil
            </a>
          )}
          <a href="/estoque" className="text-[11px] text-[#666] hover:text-[#C9A840] transition-colors">Estoque</a>
          <a href="/campanhas" className="text-[11px] text-[#666] hover:text-[#C9A840] transition-colors">Campanhas</a>
          <button
            onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login' }}
            className="text-[11px] text-[#FF4444] border border-[#FF4444]/30 px-2.5 py-1 rounded-lg hover:border-[#FF4444] transition-colors"
          >
            Sair
          </button>
        </div>
        {/* Mobile: botão sair */}
        <button
          onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login' }}
          className="md:hidden text-[11px] text-[#FF4444] border border-[#FF4444]/30 px-2.5 py-1.5 rounded-lg"
        >
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0A0A0A] overflow-hidden">
      {/* Splash motivacional */}
      {userId && !isSocio && <SplashMotivacional userId={userId} />}

      {/* ── MOBILE: uma tela por vez ── */}
      <div className="flex flex-col h-full md:hidden">
        {mobileView === 'produtos' ? (
          <>
            <Header />
            <div className="flex-1 overflow-hidden">
              <ProductGrid onAddToCart={handleAddToCart} cartItems={cartItems} />
            </div>
            {/* Barra inferior fixa: ir para carrinho */}
            <div className="flex-shrink-0 border-t border-[#1E1E1E] bg-[#111111] px-4 py-3">
              {totalItens > 0 ? (
                <button
                  onClick={() => setMobileView('carrinho')}
                  className="w-full flex items-center justify-between bg-[#C9A840] text-[#080808] font-black text-sm rounded-2xl px-5 py-3.5 active:scale-[0.98] transition-transform"
                >
                  <span className="flex items-center gap-2">
                    <span className="bg-[#080808]/20 text-[#080808] text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                      {totalItens}
                    </span>
                    <span>Ver Carrinho</span>
                  </span>
                  <span className="text-sm">→</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-3 py-1">
                  {isSocio ? (
                    <a href="/dashboard" className="text-xs text-[#555] hover:text-[#C9A840] transition-colors">← Dashboard</a>
                  ) : (
                    <a href="/perfil" className="text-xs text-[#555] hover:text-[#C9A840] transition-colors">Meu Perfil</a>
                  )}
                  <span className="text-[#2A2A2A]">·</span>
                  <a href="/estoque" className="text-xs text-[#555] hover:text-[#C9A840] transition-colors">Estoque</a>
                  <span className="text-[#2A2A2A]">·</span>
                  <a href="/campanhas" className="text-xs text-[#555] hover:text-[#C9A840] transition-colors">Campanhas</a>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Header showBack />
            {/* Botão voltar aos produtos */}
            <div className="px-4 pt-3 pb-1 flex-shrink-0">
              <button
                onClick={() => setMobileView('produtos')}
                className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#C9A840] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2.5L5 7L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Voltar aos produtos
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Cart
                items={cartItems}
                onUpdateQty={handleUpdateQty}
                onRemove={handleRemove}
                onClear={handleClear}
                onVendaRealizada={handleVendaRealizada}
                userRole={userRole}
              />
            </div>
          </>
        )}
      </div>

      {/* ── DESKTOP: duas colunas ── */}
      <div className="hidden md:flex h-full">
        {/* Coluna esquerda — produtos */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1E1E1E]">
          <Header />
          <ProductGrid onAddToCart={handleAddToCart} cartItems={cartItems} />
        </div>
        {/* Coluna direita — carrinho */}
        <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden">
          <Cart
            items={cartItems}
            onUpdateQty={handleUpdateQty}
            onRemove={handleRemove}
            onClear={handleClear}
            onVendaRealizada={handleVendaRealizada}
            userRole={userRole}
          />
        </div>
      </div>
    </div>
  )
}
