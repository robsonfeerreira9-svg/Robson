'use client'

import { useState, useCallback } from 'react'
import { mutate } from 'swr'
import ProductGrid from '@/components/pdv/ProductGrid'
import Cart, { type CartItem } from '@/components/pdv/Cart'
import type { ProdutoComEstoque } from '@/lib/database.types'
import { createClient } from '@/lib/supabase'

export default function PDVPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])

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
  }, [])

  const handleVendaRealizada = useCallback(() => {
    // Revalidar dados do grid de produtos após a venda
    mutate('produtos-pdv')
  }, [])

  return (
    <div className="flex h-screen bg-[#0D0D0D] overflow-hidden">
      {/* Cabeçalho mobile */}
      <div className="hidden" />

      {/* Coluna esquerda — grid de produtos (65%) */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#2A2A2A]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <span className="text-gold font-black text-lg uppercase tracking-widest">HG</span>
            <span className="text-[#888888] text-xs uppercase tracking-wide">Ponto de Venda</span>
          </div>
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <span className="bg-gold text-[#0D0D0D] text-xs font-black px-2 py-0.5 rounded-full">
                {cartItems.reduce((acc, i) => acc + i.quantidade, 0)} iten{cartItems.reduce((acc, i) => acc + i.quantidade, 0) !== 1 ? 's' : ''}
              </span>
            )}
            <a
              href="/dashboard"
              className="text-xs text-[#888888] hover:text-gold transition-colors"
            >
              Dashboard →
            </a>
            <button
              onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login' }}
              className="text-xs text-[#FF4444] hover:text-white transition-colors border border-[#FF4444]/40 px-2.5 py-1 rounded hover:border-[#FF4444] hover:bg-[#FF4444]/10"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Grid de produtos */}
        <ProductGrid
          onAddToCart={handleAddToCart}
          cartItems={cartItems}
        />
      </div>

      {/* Coluna direita — carrinho (35%) */}
      <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden">
        <Cart
          items={cartItems}
          onUpdateQty={handleUpdateQty}
          onRemove={handleRemove}
          onClear={handleClear}
          onVendaRealizada={handleVendaRealizada}
        />
      </div>
    </div>
  )
}
