'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
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

const CANAIS: { value: CanalProduto | 'todos'; label: string }[] = [
  { value: 'todos',        label: 'Todos' },
  { value: 'fisico',       label: 'Físico' },
  { value: 'online',       label: 'Online' },
  { value: 'ambos',        label: 'Ambos' },
  { value: 'grupo_vip',    label: 'Grupo VIP' },
  { value: 'trafego_pago', label: 'Tráfego Pago' },
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
  const [filtroCanal, setFiltroCanal] = useState<CanalProduto | 'todos'>('todos')
  const [busca, setBusca] = useState('')

  const { data: produtos = [], isLoading } = useSWR('produtos-pdv', fetchProdutos, {
    refreshInterval: 30000,
  })

  const getQtdNoCarrinho = (produtoId: string) =>
    cartItems.find((i) => i.produto.id === produtoId)?.quantidade ?? 0

  // Filtra por canal e busca, mantém só produtos com estoque > 0
  const produtosFiltrados = produtos.filter((p) => {
    const qty = p.estoque?.[0]?.quantidade ?? 0
    if (qty <= 0) return false
    if (filtroCanal !== 'todos' && p.canal !== filtroCanal) return false
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  // Agrupa por nome normalizado (ignora espaços extras e capitalização)
  const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const grupos = produtosFiltrados.reduce<Record<string, ProdutoComEstoque[]>>((acc, p) => {
    const key = normalizar(p.nome)
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})
  const gruposArr = Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))

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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {gruposArr.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#888888]">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <p className="text-sm">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gruposArr.map(([, variantes]) => {
              const nome = variantes[0].nome.trim()
              const foto = variantes.find((v) => v.foto_url)?.foto_url ?? null
              const preco = variantes[0].preco_venda
              const totalNoCarrinho = variantes.reduce((s, v) => s + getQtdNoCarrinho(v.id), 0)

              return (
                <div
                  key={nome}
                  className="bg-[#111111] border border-[#1E1E1E] rounded-xl overflow-hidden flex flex-col"
                >
                  {/* Foto — ocupa a maior parte do card */}
                  <div className="relative w-full aspect-[3/4] bg-[#0A0A0A]">
                    {foto ? (
                      <Image
                        src={foto}
                        alt={nome}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#252525]">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[9px] uppercase tracking-widest">sem foto</span>
                      </div>
                    )}
                    {/* Badge quantidade no carrinho */}
                    {totalNoCarrinho > 0 && (
                      <span className="absolute top-2 right-2 bg-[#C9A840] text-[#080808] text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                        {totalNoCarrinho}
                      </span>
                    )}
                    {/* Gradiente no fundo para legibilidade */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#111111] to-transparent pointer-events-none" />
                    {/* Preço sobre a foto */}
                    <div className="absolute bottom-2 left-3">
                      <p className="text-sm font-black text-[#C9A840] drop-shadow-sm">{formatarMoeda(preco)}</p>
                    </div>
                  </div>

                  {/* Info + tamanhos */}
                  <div className="p-2.5 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-[#EBEBEB] line-clamp-2 leading-snug">
                      {nome}
                    </p>

                    {/* Tamanhos disponíveis */}
                    <div className="flex flex-wrap gap-1">
                      {variantes.map((v) => {
                        const estoqueQty = v.estoque?.[0]?.quantidade ?? 0
                        const noCarrinho = getQtdNoCarrinho(v.id)
                        const disponivel = estoqueQty - noCarrinho
                        const label = v.numero || v.tamanho

                        return (
                          <button
                            key={v.id}
                            onClick={() => disponivel > 0 && onAddToCart(v)}
                            disabled={disponivel <= 0}
                            title={`${disponivel} em estoque`}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                              noCarrinho > 0
                                ? 'bg-[#C9A840] text-[#080808] border-[#C9A840]'
                                : disponivel > 0
                                ? 'bg-transparent text-[#EBEBEB] border-[#2A2A2A] hover:border-[#C9A840] hover:text-[#C9A840]'
                                : 'opacity-20 cursor-not-allowed border-[#1A1A1A] text-[#444]'
                            }`}
                          >
                            {label}
                            {noCarrinho > 0 && (
                              <span className="ml-1 text-[9px]">×{noCarrinho}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
