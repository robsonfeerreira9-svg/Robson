'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import Badge from '@/components/ui/Badge'
import { formatarMoeda } from '@/lib/utils/preco'
import type { ProdutoComEstoque, TamanhoProduto, CanalProduto } from '@/lib/database.types'

interface CartItem {
  produto: ProdutoComEstoque
  quantidade: number
}

interface ProductGridProps {
  onAddToCart: (produto: ProdutoComEstoque) => void
  cartItems: CartItem[]
}

const TAMANHOS: { value: TamanhoProduto | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'PP', label: 'PP' },
  { value: 'P', label: 'P' },
  { value: 'M', label: 'M' },
  { value: 'G', label: 'G' },
  { value: 'GG', label: 'GG' },
  { value: 'UNICO', label: 'Único' },
]

const CANAIS: { value: CanalProduto | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'fisico', label: 'Físico' },
  { value: 'online', label: 'Online' },
  { value: 'ambos', label: 'Ambos' },
]

async function fetchProdutos(): Promise<ProdutoComEstoque[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('produtos')
    .select('*, estoque(*)')
    .eq('ativo', true)
    .order('nome')

  if (error) throw error
  return (data as ProdutoComEstoque[]) ?? []
}

export default function ProductGrid({ onAddToCart, cartItems }: ProductGridProps) {
  const [filtroTamanho, setFiltroTamanho] = useState<TamanhoProduto | 'todos'>('todos')
  const [filtroCanal, setFiltroCanal] = useState<CanalProduto | 'todos'>('todos')
  const [busca, setBusca] = useState('')

  const { data: produtos = [], isLoading } = useSWR('produtos-pdv', fetchProdutos, {
    refreshInterval: 30000,
  })

  const produtosFiltrados = produtos.filter((p) => {
    const estoqueQty = p.estoque?.[0]?.quantidade ?? 0
    if (estoqueQty <= 0) return false
    if (filtroTamanho !== 'todos' && p.tamanho !== filtroTamanho) return false
    if (filtroCanal !== 'todos' && p.canal !== filtroCanal) return false
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const getQtdNoCarrinho = (produtoId: string) =>
    cartItems.find((i) => i.produto.id === produtoId)?.quantidade ?? 0

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filtros */}
      <div className="p-4 border-b border-[#2A2A2A] flex flex-col gap-3">
        <input
          type="text"
          placeholder="Buscar produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#888888] focus:outline-none focus:border-gold"
        />
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {TAMANHOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setFiltroTamanho(t.value as TamanhoProduto | 'todos')}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                  filtroTamanho === t.value
                    ? 'bg-gold text-[#0D0D0D] border-gold'
                    : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold hover:text-gold'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {CANAIS.map((c) => (
              <button
                key={c.value}
                onClick={() => setFiltroCanal(c.value as CanalProduto | 'todos')}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                  filtroCanal === c.value
                    ? 'bg-gold text-[#0D0D0D] border-gold'
                    : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold hover:text-gold'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {produtosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#888888]">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <p className="text-sm">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {produtosFiltrados.map((produto) => {
              const estoqueQty = produto.estoque?.[0]?.quantidade ?? 0
              const noCarrinho = getQtdNoCarrinho(produto.id)
              const disponivel = estoqueQty - noCarrinho

              return (
                <button
                  key={produto.id}
                  onClick={() => disponivel > 0 && onAddToCart(produto)}
                  disabled={disponivel <= 0}
                  className={`
                    relative bg-[#1A1A1A] border rounded-lg p-3 text-left transition-all duration-150
                    flex flex-col gap-2
                    ${disponivel > 0
                      ? 'border-[#2A2A2A] hover:border-gold cursor-pointer active:scale-95'
                      : 'border-[#1A1A1A] opacity-40 cursor-not-allowed'
                    }
                  `}
                >
                  {/* Foto */}
                  <div className="relative w-full aspect-square bg-[#0D0D0D] rounded-md overflow-hidden">
                    {produto.foto_url ? (
                      <Image
                        src={produto.foto_url}
                        alt={produto.nome}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#2A2A2A]">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* Badge tamanho/numero */}
                    <span className="absolute top-1.5 left-1.5 bg-[#0D0D0D]/80 text-[#F0F0F0] text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {produto.numero || produto.tamanho}
                    </span>

                    {/* Quantidade no carrinho */}
                    {noCarrinho > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-gold text-[#0D0D0D] text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        {noCarrinho}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-[#F0F0F0] line-clamp-2 leading-snug">
                      {produto.nome}
                    </p>
                    <p className="text-sm font-bold text-gold">
                      {formatarMoeda(produto.preco_venda)}
                    </p>
                    <p className="text-[10px] text-[#888888]">
                      Estoque: {disponivel}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
