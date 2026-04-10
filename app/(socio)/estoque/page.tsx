'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { formatarMoeda } from '@/lib/utils/preco'
import type { ProdutoComEstoque, TamanhoProduto, CanalProduto } from '@/lib/database.types'

// ── Busca de dados ────────────────────────────────────────────────────────────
async function fetchEstoque(): Promise<ProdutoComEstoque[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('produtos')
    .select('*, estoque(*)')
    .order('nome')
  if (error) throw error
  return (data as ProdutoComEstoque[]) ?? []
}

// ── Helpers de alerta ────────────────────────────────────────────────────────
function isEstoqueBaixo(qty: number) { return qty < 3 }
function isProdutoParado(ultimaVenda: string | null) {
  if (!ultimaVenda) return true
  const diff = Date.now() - new Date(ultimaVenda).getTime()
  return diff > 30 * 24 * 60 * 60 * 1000 // 30 dias
}

// ── Modal de ajuste de quantidade ───────────────────────────────────────────
interface AjusteModalProps {
  produto: ProdutoComEstoque
  onClose: () => void
  onSave: () => void
}

function AjusteModal({ produto, onClose, onSave }: AjusteModalProps) {
  const estoqueAtual = produto.estoque?.[0]
  const [novaQty, setNovaQty] = useState(String(estoqueAtual?.quantidade ?? 0))
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    const qty = parseInt(novaQty)
    if (isNaN(qty) || qty < 0) {
      setErro('Informe uma quantidade válida.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('estoque')
        .update({ quantidade: qty, atualizado_em: new Date().toISOString() })
        .eq('produto_id', produto.id)

      if (error) throw error
      onSave()
      onClose()
    } catch (e) {
      setErro('Erro ao atualizar estoque.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-1">Ajustar Estoque</h3>
        <p className="text-sm text-[#888888] mb-4">{produto.nome} — {produto.tamanho}</p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-[#F0F0F0]">Nova quantidade</label>
            <input
              type="number"
              min="0"
              value={novaQty}
              onChange={(e) => setNovaQty(e.target.value)}
              className="mt-1.5 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              autoFocus
            />
          </div>
          {erro && <p className="text-xs text-[#FF4444]">{erro}</p>}
          <div className="flex gap-2">
            <Button variant="primary" fullWidth loading={loading} onClick={handleSalvar}>
              Confirmar
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
function EstoquePageInner() {
  const params = useSearchParams()
  const [toast, setToast] = useState<string | null>(null)
  const [ajusteModal, setAjusteModal] = useState<ProdutoComEstoque | null>(null)

  const [filtroTamanho, setFiltroTamanho] = useState<TamanhoProduto | 'todos'>('todos')
  const [filtroCanal, setFiltroCanal] = useState<CanalProduto | 'todos'>('todos')
  const [filtroAlerta, setFiltroAlerta] = useState(false)

  const { data: produtos = [], isLoading } = useSWR('estoque-socio', fetchEstoque, {
    refreshInterval: 60000,
  })

  // Toast de sucesso vindo da URL
  useEffect(() => {
    const msg = params.get('success')
    if (msg) {
      setToast(decodeURIComponent(msg))
      setTimeout(() => setToast(null), 4000)
    }
  }, [params])

  const produtosFiltrados = produtos.filter((p) => {
    const qty = p.estoque?.[0]?.quantidade ?? 0
    const ultima = p.estoque?.[0]?.ultima_venda_em ?? null
    const baixo = isEstoqueBaixo(qty)
    const parado = isProdutoParado(ultima)

    if (filtroTamanho !== 'todos' && p.tamanho !== filtroTamanho) return false
    if (filtroCanal !== 'todos' && p.canal !== filtroCanal) return false
    if (filtroAlerta && !baixo && !parado) return false
    return true
  })

  const TAMANHOS = ['todos', 'PP', 'P', 'M', 'G', 'GG', 'UNICO'] as const
  const CANAIS = ['todos', 'fisico', 'online', 'ambos'] as const
  const labelCanal: Record<string, string> = { todos: 'Todos', fisico: 'Físico', online: 'Online', ambos: 'Ambos' }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Estoque</h1>
            <a href="/dashboard" className="text-xs text-[#888888] hover:text-gold transition-colors">← Dashboard</a>
          </div>
          <Button variant="primary" onClick={() => window.location.href = '/produtos/novo'}>
            + Novo Produto
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-4" padding="sm">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1 flex-wrap">
              {TAMANHOS.map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTamanho(t === 'todos' ? 'todos' : t as TamanhoProduto)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                    filtroTamanho === t
                      ? 'bg-gold text-[#0D0D0D] border-gold'
                      : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold'
                  }`}
                >
                  {t === 'todos' ? 'Todos tamanhos' : t}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {CANAIS.map((c) => (
                <button
                  key={c}
                  onClick={() => setFiltroCanal(c === 'todos' ? 'todos' : c as CanalProduto)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                    filtroCanal === c
                      ? 'bg-gold text-[#0D0D0D] border-gold'
                      : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold'
                  }`}
                >
                  {labelCanal[c]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFiltroAlerta((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                filtroAlerta
                  ? 'bg-[#FF4444] text-white border-[#FF4444]'
                  : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-[#FF4444] hover:text-[#FF4444]'
              }`}
            >
              Só alertas
            </button>
          </div>
        </Card>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-[#2A2A2A]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Foto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Tamanho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Canal</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Qtd</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Custo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Preço</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Margem</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Última venda</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Alertas</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#2A2A2A]">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[#888888]">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map((produto) => {
                  const est = produto.estoque?.[0]
                  const qty = est?.quantidade ?? 0
                  const ultima = est?.ultima_venda_em ?? null
                  const baixo = isEstoqueBaixo(qty)
                  const parado = isProdutoParado(ultima)

                  const margem = produto.custo > 0
                    ? (((produto.preco_venda - produto.custo) / produto.custo) * 100).toFixed(0)
                    : '—'

                  const ultimaStr = ultima
                    ? new Date(ultima).toLocaleDateString('pt-BR')
                    : 'Nunca'

                  return (
                    <tr
                      key={produto.id}
                      className={`border-b border-[#2A2A2A] transition-colors ${
                        baixo
                          ? 'bg-red-500/5 hover:bg-red-500/10'
                          : parado
                          ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                          : 'bg-[#1A1A1A] hover:bg-[#222222]'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="relative w-10 h-10 bg-[#0D0D0D] rounded overflow-hidden">
                          {produto.foto_url ? (
                            <Image src={produto.foto_url} alt={produto.nome} fill className="object-cover" sizes="40px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#2A2A2A]">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#F0F0F0] max-w-[200px] truncate">{produto.nome}</td>
                      <td className="px-4 py-3"><Badge variant="default">{produto.tamanho}</Badge></td>
                      <td className="px-4 py-3 text-[#888888] capitalize">{produto.canal}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#F0F0F0]">{qty}</td>
                      <td className="px-4 py-3 text-right text-[#888888]">{formatarMoeda(produto.custo)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gold">{formatarMoeda(produto.preco_venda)}</td>
                      <td className="px-4 py-3 text-right text-[#888888]">{margem}%</td>
                      <td className="px-4 py-3 text-[#888888] text-xs">{ultimaStr}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {baixo && <Badge variant="danger">Estoque Baixo</Badge>}
                          {parado && <Badge variant="warning">Parado</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setAjusteModal(produto)}
                          className="text-xs text-gold hover:underline font-semibold"
                        >
                          Ajustar Qtd
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ajuste */}
      {ajusteModal && (
        <AjusteModal
          produto={ajusteModal}
          onClose={() => setAjusteModal(null)}
          onSave={() => mutate('estoque-socio')}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-semibold">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

export default function EstoquePage() {
  return (
    <Suspense>
      <EstoquePageInner />
    </Suspense>
  )
}
