'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import useSWR from 'swr'
import { createBrowserClient } from '@supabase/ssr'
import { formatarMoeda } from '@/lib/utils/preco'
import type { Database } from '@/lib/database.types'
import type { ProdutoComEstoque } from '@/lib/database.types'

interface CartItem { produto: ProdutoComEstoque; quantidade: number }
type View = 'loja' | 'carrinho' | 'pedido' | 'ok'
type Pagamento = 'pix' | 'credito' | 'debito' | 'dinheiro'

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

async function fetchProdutos(): Promise<ProdutoComEstoque[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('*, estoque(*)')
    .eq('ativo', true)
    .order('nome')
  if (error) return []
  return (data as ProdutoComEstoque[]).filter((p) => (p.estoque?.[0]?.quantidade ?? 0) > 0)
}

export default function LojaPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<View>('loja')
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [pagamento, setPagamento] = useState<Pagamento>('pix')
  const [enviando, setEnviando] = useState(false)

  const { data: produtos = [], isLoading } = useSWR('loja-produtos', fetchProdutos, {
    refreshInterval: 60000,
  })

  const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const grupos = produtos
    .filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))
    .reduce<Record<string, ProdutoComEstoque[]>>((acc, p) => {
      const k = normalizar(p.nome)
      if (!acc[k]) acc[k] = []
      acc[k].push(p)
      return acc
    }, {})
  const gruposArr = Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))

  const getQtd = (id: string) => cart.find((i) => i.produto.id === id)?.quantidade ?? 0
  const totalItens = cart.reduce((s, i) => s + i.quantidade, 0)
  const totalValor = cart.reduce((s, i) => s + i.produto.preco_venda * i.quantidade, 0)

  const addToCart = useCallback((produto: ProdutoComEstoque) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.produto.id === produto.id)
      const max = produto.estoque?.[0]?.quantidade ?? 0
      if (existing) {
        if (existing.quantidade >= max) return prev
        return prev.map((i) => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { produto, quantidade: 1 }]
    })
  }, [])

  const updateQty = (id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0 ? prev.filter((i) => i.produto.id !== id)
               : prev.map((i) => i.produto.id === id ? { ...i, quantidade: qty } : i)
    )
  }

  const enviarPedido = async () => {
    if (!nome.trim()) return
    setEnviando(true)
    const LABEL_PGTO: Record<Pagamento, string> = {
      pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito', dinheiro: 'Dinheiro',
    }
    const linhas = cart.map((i) => {
      const tam = i.produto.numero || i.produto.tamanho || ''
      return `• ${i.produto.nome}${tam ? ` (${tam})` : ''} × ${i.quantidade} = ${formatarMoeda(i.produto.preco_venda * i.quantidade)}`
    })
    const msg = [
      `🏷️ *Pedido HG Select*`,
      ``,
      `👤 *Cliente:* ${nome.trim()}`,
      telefone ? `📱 *Telefone:* ${telefone.trim()}` : '',
      `💳 *Pagamento:* ${LABEL_PGTO[pagamento]}`,
      ``,
      `*Itens:*`,
      ...linhas,
      ``,
      `*Total: ${formatarMoeda(totalValor)}*`,
      ``,
      `_Pedido feito pelo site HG Select_`,
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    setView('ok')
    setEnviando(false)
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = () => (
    <header className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-md border-b border-[#141414]">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => setView('loja')} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-[#C9A840]/40 flex-shrink-0" style={{ boxShadow: '0 0 12px rgba(201,168,64,0.15)' }}>
            <Image src="/hg-logo.jpg" alt="HG Select" width={36} height={36} className="object-cover w-full h-full" />
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-[#C9A840] uppercase tracking-[0.2em] leading-none">HG Select</p>
            <p className="text-[9px] text-[#444] leading-none mt-0.5 uppercase tracking-wide">Moda Premium</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {view !== 'loja' && (
            <button onClick={() => setView('loja')} className="text-xs text-[#555] hover:text-[#C9A840] transition-colors">
              ← Voltar
            </button>
          )}
          {view === 'loja' && totalItens > 0 && (
            <button
              onClick={() => setView('carrinho')}
              className="relative flex items-center gap-2 bg-[#C9A840] text-[#080808] font-black text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="bg-[#080808]/25 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{totalItens}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )

  // ── LOJA ─────────────────────────────────────────────────────────────────
  if (view === 'loja') return (
    <div className="min-h-[100dvh] bg-[#080808] flex flex-col">
      <Header />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[#111]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A840]/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-3">
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#C9A840]/60 border border-[#C9A840]/20 px-3 py-1 rounded-full">
            Nova Coleção
          </span>
          <h1 className="text-2xl font-black text-[#EBEBEB] leading-tight" style={{ letterSpacing: '-0.02em' }}>
            Estilo que fala<br/>
            <span style={{ color: '#C9A840' }}>por você.</span>
          </h1>
          <p className="text-xs text-[#444] max-w-xs leading-relaxed">
            Peças selecionadas com exclusividade. Escolha, peça e receba com rapidez.
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-5 pb-32">
        {/* Busca */}
        <div className="relative mb-5">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-[#0C0C0C] border border-[#1A1A1A] rounded-xl pl-10 pr-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#333] focus:outline-none focus:border-[#C9A840]/40 transition-colors"
          />
        </div>

        {/* Contador */}
        {!isLoading && gruposArr.length > 0 && (
          <p className="text-[10px] text-[#333] mb-3 uppercase tracking-wider">
            {gruposArr.length} {gruposArr.length === 1 ? 'produto' : 'produtos'} disponíveis
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : gruposArr.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#2A2A2A]">
            <svg className="w-14 h-14 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <p className="text-sm">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gruposArr.map(([, variantes]) => {
              const nomeProd = variantes[0].nome.trim()
              const foto = variantes.find((v) => v.foto_url)?.foto_url ?? null
              const preco = variantes[0].preco_venda
              const totalNoCarrinho = variantes.reduce((s, v) => s + getQtd(v.id), 0)

              return (
                <div
                  key={nomeProd}
                  className="group bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:border-[#C9A840]/20"
                  style={{ boxShadow: totalNoCarrinho > 0 ? '0 0 0 1.5px rgba(201,168,64,0.4)' : 'none' }}
                >
                  {/* Foto */}
                  <div className="relative w-full aspect-[3/4] bg-[#080808]">
                    {foto ? (
                      <Image src={foto} alt={nomeProd} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 33vw" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#1E1E1E]">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[9px] uppercase tracking-widest text-[#222]">sem foto</span>
                      </div>
                    )}

                    {totalNoCarrinho > 0 && (
                      <span className="absolute top-2.5 right-2.5 bg-[#C9A840] text-[#080808] text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-10">
                        {totalNoCarrinho}
                      </span>
                    )}

                    {/* Gradiente + preço */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0C0C0C] via-[#0C0C0C]/60 to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-sm font-black text-[#C9A840]" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>{formatarMoeda(preco)}</p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2.5">
                    <p className="text-xs font-semibold text-[#DEDEDE] line-clamp-2 leading-snug">{nomeProd}</p>

                    <div className="flex flex-wrap gap-1">
                      {variantes.map((v) => {
                        const estoqueQty = v.estoque?.[0]?.quantidade ?? 0
                        const noCarrinho = getQtd(v.id)
                        const disponivel = estoqueQty - noCarrinho
                        const label = v.numero || v.tamanho
                        return (
                          <button
                            key={v.id}
                            disabled={disponivel <= 0}
                            onClick={() => disponivel > 0 && addToCart(v)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-90 ${
                              noCarrinho > 0
                                ? 'bg-[#C9A840] text-[#080808] border-[#C9A840]'
                                : disponivel > 0
                                ? 'bg-transparent text-[#C8C8C8] border-[#242424] hover:border-[#C9A840]/60 hover:text-[#C9A840]'
                                : 'opacity-15 cursor-not-allowed border-[#1A1A1A] text-[#333]'
                            }`}
                          >
                            {label}{noCarrinho > 0 && <span className="ml-1 text-[9px]">×{noCarrinho}</span>}
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
      </main>

      {/* Barra flutuante carrinho */}
      {totalItens > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 pb-6 bg-gradient-to-t from-[#080808] via-[#080808]/90 to-transparent pointer-events-none z-20">
          <button
            onClick={() => setView('carrinho')}
            className="pointer-events-auto w-full max-w-sm mx-auto flex items-center justify-between bg-[#C9A840] text-[#080808] font-black text-sm rounded-2xl px-5 py-4 active:scale-[0.98] transition-transform"
            style={{ boxShadow: '0 8px 40px rgba(201,168,64,0.4)', display: 'flex' }}
          >
            <span className="flex items-center gap-2.5">
              <span className="bg-[#080808]/20 text-[#080808] text-xs font-black w-7 h-7 rounded-full flex items-center justify-center">
                {totalItens}
              </span>
              Ver Carrinho
            </span>
            <span className="text-sm font-black">{formatarMoeda(totalValor)}</span>
          </button>
        </div>
      )}

      <footer className="text-center py-5 text-[10px] text-[#1E1E1E] border-t border-[#0E0E0E]">
        HG Select — Moda Premium · Todos os preços em reais
      </footer>
    </div>
  )

  // ── CARRINHO ─────────────────────────────────────────────────────────────
  if (view === 'carrinho') return (
    <div className="min-h-[100dvh] bg-[#080808] flex flex-col">
      <Header />
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#EBEBEB]">Carrinho</h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-[10px] text-[#444] hover:text-red-400 transition-colors uppercase tracking-wider">
              Limpar tudo
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#2A2A2A]">
            <svg className="w-14 h-14 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm mb-4">Carrinho vazio</p>
            <button onClick={() => setView('loja')} className="text-xs font-bold text-[#C9A840] border border-[#C9A840]/30 px-5 py-2.5 rounded-xl">
              Ver produtos →
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {cart.map((item) => {
                const tam = item.produto.numero || item.produto.tamanho
                return (
                  <div key={item.produto.id} className="flex items-center gap-3 bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl p-3">
                    {item.produto.foto_url ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative bg-[#141414]">
                        <Image src={item.produto.foto_url} alt={item.produto.nome} fill className="object-cover" sizes="64px" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#141414] flex-shrink-0 flex items-center justify-center text-[#222]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#EBEBEB] leading-snug">{item.produto.nome}</p>
                      {tam && <p className="text-[10px] text-[#555] mt-0.5">Tamanho: {tam}</p>}
                      <p className="text-sm font-black text-[#C9A840] mt-1">{formatarMoeda(item.produto.preco_venda * item.quantidade)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQty(item.produto.id, item.quantidade - 1)}
                        className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#252525] text-[#EBEBEB] font-bold flex items-center justify-center active:scale-90 text-base">
                        −
                      </button>
                      <span className="text-sm font-bold text-[#EBEBEB] w-5 text-center">{item.quantidade}</span>
                      <button onClick={() => updateQty(item.produto.id, item.quantidade + 1)}
                        className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#252525] text-[#EBEBEB] font-bold flex items-center justify-center active:scale-90 text-base">
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Resumo */}
            <div className="bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl p-4 flex flex-col gap-2">
              {cart.map((i) => (
                <div key={i.produto.id} className="flex justify-between text-xs text-[#555]">
                  <span className="truncate pr-2">{i.produto.nome} ×{i.quantidade}</span>
                  <span className="flex-shrink-0 text-[#888]">{formatarMoeda(i.produto.preco_venda * i.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-[#1A1A1A] pt-3 mt-1 flex justify-between items-center">
                <span className="text-sm text-[#888]">Total</span>
                <span className="text-xl font-black text-[#C9A840]">{formatarMoeda(totalValor)}</span>
              </div>
            </div>

            <button
              onClick={() => setView('pedido')}
              className="w-full bg-[#C9A840] text-[#080808] font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 6px 24px rgba(201,168,64,0.3)' }}
            >
              Continuar para pagamento →
            </button>
          </>
        )}
      </main>
    </div>
  )

  // ── PEDIDO / CHECKOUT ────────────────────────────────────────────────────
  if (view === 'pedido') return (
    <div className="min-h-[100dvh] bg-[#080808] flex flex-col">
      <Header />
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 flex flex-col gap-5">

        <div>
          <h2 className="text-lg font-black text-[#EBEBEB]">Finalizar pedido</h2>
          <p className="text-xs text-[#444] mt-1">Preencha seus dados para confirmar</p>
        </div>

        {/* Dados do cliente */}
        <div className="bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-[10px] font-black text-[#555] uppercase tracking-wider">Seus dados</p>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#555] font-semibold uppercase tracking-wider">Nome completo *</label>
            <input
              type="text"
              placeholder="Ex: João Ferreira"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-[#080808] border border-[#1E1E1E] focus:border-[#C9A840]/50 rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#2A2A2A] outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#555] font-semibold uppercase tracking-wider">WhatsApp</label>
            <input
              type="tel"
              placeholder="(31) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full bg-[#080808] border border-[#1E1E1E] focus:border-[#C9A840]/50 rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#2A2A2A] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Pagamento */}
        <div className="bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-[#555] uppercase tracking-wider">Pagamento</p>
            <span className="text-[9px] bg-[#C9A840]/10 text-[#C9A840] border border-[#C9A840]/20 px-2.5 py-1 rounded-full font-black uppercase tracking-wide">
              Em breve online
            </span>
          </div>

          {/* Opções de pagamento */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'pix', label: 'PIX', icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.06 11.57c-.46 0-.9-.18-1.22-.5l-2.91-2.9a.74.74 0 00-1.06 0L8.96 11.07c-.32.32-.76.5-1.22.5H7.1l3.68 3.68c.68.68 1.78.68 2.46 0l3.68-3.68h-.86zm-10.12.86c0 .46.18.9.5 1.22l2.9 2.91c.68.68 1.78.68 2.46 0l2.9-2.91c.32-.32.76-.5 1.22-.5h.44l-3.68-3.68a1.74 1.74 0 00-2.46 0L7.54 12.43h-.6zm10.5-6.37L13.76 2.38c-.68-.68-1.78-.68-2.46 0L7.62 6.06c.46 0 .9.18 1.22.5l2.91 2.9c.3.31.72.47 1.1.47.38 0 .8-.16 1.1-.47l2.91-2.9c.32-.32.76-.5 1.22-.5h.46zm.72.72h-.46c-.46 0-.9.18-1.22.5l-2.91 2.9a.74.74 0 01-1.06 0l-2.91-2.9c-.32-.32-.76-.5-1.22-.5H7.9c-.01 0-.02 0-.03.01L4.19 11.57c-.68.68-.68 1.78 0 2.46l3.68 3.68.03.01h.46c.46 0 .9-.18 1.22-.5l2.91-2.9c.3-.31.72-.47 1.1-.47.38 0 .8.16 1.1.47l2.91 2.9c.32.32.76.5 1.22.5h.44l.02-.01 3.68-3.68c.68-.68.68-1.78 0-2.46l-3.68-3.68z"/>
                </svg>
              )},
              { v: 'credito', label: 'Crédito', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )},
              { v: 'debito', label: 'Débito', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )},
              { v: 'dinheiro', label: 'Dinheiro', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )},
            ] as { v: Pagamento; label: string; icon: React.ReactNode }[]).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setPagamento(opt.v)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  pagamento === opt.v
                    ? 'border-[#C9A840] bg-[#C9A840]/8 text-[#C9A840]'
                    : 'border-[#1E1E1E] text-[#555] hover:border-[#2A2A2A]'
                }`}
              >
                {opt.icon}
                <span className="text-[10px] font-bold">{opt.label}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-[#333] text-center leading-relaxed">
            Pagamento online em desenvolvimento.<br/>Nossa equipe confirma os detalhes pelo WhatsApp.
          </p>
        </div>

        {/* Resumo do pedido */}
        <div className="bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl p-4">
          <p className="text-[10px] font-black text-[#555] uppercase tracking-wider mb-3">Resumo do pedido</p>
          <div className="flex flex-col gap-2">
            {cart.map((i) => {
              const tam = i.produto.numero || i.produto.tamanho
              return (
                <div key={i.produto.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#888] truncate">
                    {i.produto.nome}{tam ? ` (${tam})` : ''} × {i.quantidade}
                  </span>
                  <span className="text-xs font-bold text-[#C9A840] flex-shrink-0">
                    {formatarMoeda(i.produto.preco_venda * i.quantidade)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="border-t border-[#1A1A1A] mt-3 pt-3 flex justify-between items-center">
            <span className="text-sm text-[#888]">Total</span>
            <span className="text-xl font-black text-[#C9A840]">{formatarMoeda(totalValor)}</span>
          </div>
        </div>

        {/* Botão confirmar */}
        <button
          disabled={!nome.trim() || enviando}
          onClick={enviarPedido}
          className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] text-white font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100"
          style={{ boxShadow: nome.trim() ? '0 6px 24px rgba(37,211,102,0.3)' : 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Confirmar pedido via WhatsApp
        </button>

        {!nome.trim() && (
          <p className="text-[10px] text-[#333] text-center -mt-3">Preencha seu nome para continuar</p>
        )}
      </main>
    </div>
  )

  // ── SUCESSO ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#080808] flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-6">

        {/* Ícone de sucesso */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-[#C9A840]/8 border border-[#C9A840]/20 flex items-center justify-center"
            style={{ boxShadow: '0 0 60px rgba(201,168,64,0.1)' }}>
            <svg className="w-12 h-12 text-[#C9A840]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="max-w-xs flex flex-col gap-2">
          <h2 className="text-2xl font-black text-[#EBEBEB]">Pedido enviado!</h2>
          <p className="text-sm text-[#444] leading-relaxed">
            O WhatsApp abriu com o resumo do seu pedido. Nossa equipe irá confirmar em breve.
          </p>
        </div>

        {/* Mini resumo */}
        <div className="w-full max-w-xs bg-[#0C0C0C] border border-[#1A1A1A] rounded-2xl p-4 text-left flex flex-col gap-1.5">
          <p className="text-[9px] text-[#444] uppercase tracking-wider font-black mb-1">Você pediu</p>
          {cart.map((i) => (
            <div key={i.produto.id} className="flex justify-between text-xs">
              <span className="text-[#666] truncate pr-2">{i.produto.nome} ×{i.quantidade}</span>
              <span className="text-[#888] flex-shrink-0">{formatarMoeda(i.produto.preco_venda * i.quantidade)}</span>
            </div>
          ))}
          <div className="border-t border-[#1A1A1A] pt-2 mt-1 flex justify-between">
            <span className="text-xs text-[#555]">Total</span>
            <span className="text-sm font-black text-[#C9A840]">{formatarMoeda(totalValor)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={() => { setCart([]); setBusca(''); setNome(''); setTelefone(''); setView('loja') }}
            className="w-full bg-[#C9A840] text-[#080808] font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-transform"
          >
            Ver mais produtos
          </button>
        </div>

      </main>

      <footer className="text-center py-5 text-[10px] text-[#1E1E1E] border-t border-[#0E0E0E]">
        HG Select — Moda Premium
      </footer>
    </div>
  )
}
