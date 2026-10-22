'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import useSWR from 'swr'
import { createBrowserClient } from '@supabase/ssr'
import { formatarMoeda } from '@/lib/utils/preco'
import type { Database } from '@/lib/database.types'
import type { ProdutoComEstoque } from '@/lib/database.types'

// ─── tipos locais ────────────────────────────────────────────────────────────
interface CartItem { produto: ProdutoComEstoque; quantidade: number }

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
  return (data as ProdutoComEstoque[]).filter(
    (p) => (p.estoque?.[0]?.quantidade ?? 0) > 0
  )
}

// ─── página ──────────────────────────────────────────────────────────────────
export default function LojaPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [view, setView] = useState<'loja' | 'carrinho' | 'pedido' | 'ok'>('loja')
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
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

  // Gera mensagem de WhatsApp com o pedido
  const enviarPedido = async () => {
    if (!nome.trim()) return
    setEnviando(true)

    const linhas = cart.map((i) => {
      const tam = i.produto.numero || i.produto.tamanho || ''
      return `• ${i.produto.nome}${tam ? ` (${tam})` : ''} × ${i.quantidade} = ${formatarMoeda(i.produto.preco_venda * i.quantidade)}`
    })
    const msg = [
      `🛍️ *Pedido HG Select*`,
      ``,
      `*Cliente:* ${nome.trim()}`,
      telefone ? `*Telefone:* ${telefone.trim()}` : '',
      ``,
      `*Itens:*`,
      ...linhas,
      ``,
      `*Total: ${formatarMoeda(totalValor)}*`,
    ].filter(Boolean).join('\n')

    // Abre WhatsApp com a mensagem pré-preenchida
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(whatsappUrl, '_blank')

    setView('ok')
    setEnviando(false)
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#080808] flex flex-col">

      {/* Header da loja */}
      <header className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur border-b border-[#181818] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#C9A840]/30 flex-shrink-0">
            <Image src="/hg-logo.jpg" alt="HG Select" width={40} height={40} className="object-cover w-full h-full" />
          </div>
          <div>
            <p className="text-sm font-black text-[#C9A840] uppercase tracking-[0.15em] leading-none">HG Select</p>
            <p className="text-[10px] text-[#555] leading-none mt-0.5">Catálogo Online</p>
          </div>
        </div>
        {totalItens > 0 && view === 'loja' && (
          <button
            onClick={() => setView('carrinho')}
            className="flex items-center gap-2 bg-[#C9A840] text-[#080808] font-black text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
          >
            <span className="bg-[#080808]/20 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{totalItens}</span>
            Carrinho
          </button>
        )}
        {view !== 'loja' && (
          <button onClick={() => setView('loja')} className="text-xs text-[#555] hover:text-[#C9A840] transition-colors">
            ← Voltar
          </button>
        )}
      </header>

      {/* ── LOJA ── */}
      {view === 'loja' && (
        <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-[#0E0E0E] border border-[#1E1E1E] rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#444] focus:outline-none focus:border-[#C9A840]/50"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
              ))}
            </div>
          ) : gruposArr.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#333]">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
              <p className="text-sm">Nenhum produto disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {gruposArr.map(([, variantes]) => {
                const nome = variantes[0].nome.trim()
                const foto = variantes.find((v) => v.foto_url)?.foto_url ?? null
                const preco = variantes[0].preco_venda
                const totalNoCarrinho = variantes.reduce((s, v) => s + getQtd(v.id), 0)

                return (
                  <div key={nome} className="bg-[#0E0E0E] border border-[#181818] rounded-xl overflow-hidden flex flex-col">
                    {/* Foto */}
                    <div className="relative w-full aspect-[3/4] bg-[#080808]">
                      {foto ? (
                        <Image src={foto} alt={nome} fill className="object-cover" sizes="(max-width: 640px) 50vw, 300px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#222]">
                          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {totalNoCarrinho > 0 && (
                        <span className="absolute top-2 right-2 bg-[#C9A840] text-[#080808] text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center">
                          {totalNoCarrinho}
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0E0E0E] to-transparent pointer-events-none" />
                      <div className="absolute bottom-2.5 left-3">
                        <p className="text-sm font-black text-[#C9A840]">{formatarMoeda(preco)}</p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2.5 flex flex-col gap-2">
                      <p className="text-xs font-semibold text-[#EBEBEB] line-clamp-2 leading-snug">{nome}</p>
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
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                                noCarrinho > 0
                                  ? 'bg-[#C9A840] text-[#080808] border-[#C9A840]'
                                  : disponivel > 0
                                  ? 'bg-transparent text-[#EBEBEB] border-[#2A2A2A] hover:border-[#C9A840]'
                                  : 'opacity-20 cursor-not-allowed border-[#1A1A1A] text-[#444]'
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

          {/* Barra flutuante de carrinho */}
          {totalItens > 0 && (
            <div className="fixed bottom-6 inset-x-4 max-w-2xl mx-auto z-20">
              <button
                onClick={() => setView('carrinho')}
                className="w-full flex items-center justify-between bg-[#C9A840] text-[#080808] font-black text-sm rounded-2xl px-5 py-4 shadow-2xl active:scale-[0.98] transition-transform"
                style={{ boxShadow: '0 8px 32px rgba(201,168,64,0.35)' }}
              >
                <span className="flex items-center gap-2">
                  <span className="bg-[#080808]/20 text-[#080808] text-xs font-black w-7 h-7 rounded-full flex items-center justify-center">
                    {totalItens}
                  </span>
                  Ver Carrinho
                </span>
                <span className="text-base">{formatarMoeda(totalValor)}</span>
              </button>
            </div>
          )}

          {/* Espaço para a barra flutuante */}
          {totalItens > 0 && <div className="h-24" />}
        </main>
      )}

      {/* ── CARRINHO ── */}
      {view === 'carrinho' && (
        <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-4">
          <h2 className="text-base font-black text-[#EBEBEB]">Seu carrinho</h2>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#333]">
              <p className="text-sm">Carrinho vazio</p>
              <button onClick={() => setView('loja')} className="mt-4 text-xs text-[#C9A840]">← Ver produtos</button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {cart.map((item) => {
                  const tam = item.produto.numero || item.produto.tamanho
                  const foto = item.produto.foto_url
                  return (
                    <div key={item.produto.id} className="flex items-center gap-3 bg-[#0E0E0E] border border-[#181818] rounded-xl p-3">
                      {foto ? (
                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative">
                          <Image src={foto} alt={item.produto.nome} fill className="object-cover" sizes="56px" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-[#141414] flex-shrink-0 flex items-center justify-center text-[#222]">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#EBEBEB] truncate">{item.produto.nome}</p>
                        {tam && <p className="text-[10px] text-[#555]">Tam: {tam}</p>}
                        <p className="text-sm font-black text-[#C9A840] mt-0.5">{formatarMoeda(item.produto.preco_venda * item.quantidade)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => updateQty(item.produto.id, item.quantidade - 1)}
                          className="w-7 h-7 rounded-full bg-[#181818] text-[#EBEBEB] text-base font-bold flex items-center justify-center active:scale-90">
                          −
                        </button>
                        <span className="text-xs font-bold text-[#EBEBEB] w-4 text-center">{item.quantidade}</span>
                        <button onClick={() => updateQty(item.produto.id, item.quantidade + 1)}
                          className="w-7 h-7 rounded-full bg-[#181818] text-[#EBEBEB] text-base font-bold flex items-center justify-center active:scale-90">
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between border-t border-[#181818] pt-3">
                <span className="text-sm text-[#888]">Total</span>
                <span className="text-lg font-black text-[#C9A840]">{formatarMoeda(totalValor)}</span>
              </div>

              <button
                onClick={() => setView('pedido')}
                className="w-full bg-[#C9A840] text-[#080808] font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-transform"
              >
                Finalizar Pedido →
              </button>
            </>
          )}
        </main>
      )}

      {/* ── DADOS DO PEDIDO ── */}
      {view === 'pedido' && (
        <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-5">
          <div>
            <h2 className="text-base font-black text-[#EBEBEB] mb-1">Finalizar pedido</h2>
            <p className="text-xs text-[#555]">Preencha seus dados para enviar o pedido via WhatsApp</p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-wider font-semibold block mb-1.5">Seu nome *</label>
              <input
                type="text"
                placeholder="Ex: Maria Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-[#0E0E0E] border border-[#1E1E1E] focus:border-[#C9A840]/50 rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#333] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-wider font-semibold block mb-1.5">Telefone / WhatsApp</label>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full bg-[#0E0E0E] border border-[#1E1E1E] focus:border-[#C9A840]/50 rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#333] outline-none transition-colors"
              />
            </div>
          </div>

          {/* Resumo do pedido */}
          <div className="bg-[#0E0E0E] border border-[#181818] rounded-xl p-4">
            <p className="text-[10px] text-[#555] uppercase tracking-wider font-semibold mb-3">Resumo</p>
            <div className="flex flex-col gap-1.5">
              {cart.map((i) => {
                const tam = i.produto.numero || i.produto.tamanho
                return (
                  <div key={i.produto.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#EBEBEB] truncate">
                      {i.produto.nome}{tam ? ` (${tam})` : ''} × {i.quantidade}
                    </span>
                    <span className="text-xs font-bold text-[#C9A840] flex-shrink-0">{formatarMoeda(i.produto.preco_venda * i.quantidade)}</span>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[#181818] mt-3 pt-3 flex justify-between">
              <span className="text-sm text-[#888]">Total</span>
              <span className="text-base font-black text-[#C9A840]">{formatarMoeda(totalValor)}</span>
            </div>
          </div>

          <button
            disabled={!nome.trim() || enviando}
            onClick={enviarPedido}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Enviar pedido via WhatsApp
          </button>

          {!nome.trim() && (
            <p className="text-[10px] text-[#444] text-center -mt-2">Preencha seu nome para continuar</p>
          )}
        </main>
      )}

      {/* ── PEDIDO ENVIADO ── */}
      {view === 'ok' && (
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-[#25D366]/10 border-2 border-[#25D366]/40 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-[#EBEBEB] mb-2">Pedido enviado!</h2>
            <p className="text-sm text-[#555] leading-relaxed">
              O WhatsApp abriu com o resumo do seu pedido.<br/>
              Aguarde o contato da HG Select para confirmar.
            </p>
          </div>
          <button
            onClick={() => { setCart([]); setBusca(''); setNome(''); setTelefone(''); setView('loja') }}
            className="text-sm font-bold text-[#C9A840] border border-[#C9A840]/30 px-6 py-3 rounded-xl hover:border-[#C9A840]"
          >
            Ver mais produtos
          </button>
        </main>
      )}

      {/* Rodapé */}
      <footer className="text-center py-4 text-[10px] text-[#2A2A2A] border-t border-[#111]">
        HG Select — todos os preços em reais
      </footer>
    </div>
  )
}
