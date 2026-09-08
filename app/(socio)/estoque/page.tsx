'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR, { mutate } from 'swr'
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
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return (data as ProdutoComEstoque[]) ?? []
}

// ── Fetcher de ranking de vendas por modelo e tamanho ────────────────────────
async function fetchRankingVendas() {
  const supabase = createClient()
  const { data } = await supabase
    .from('itens_venda')
    .select('quantidade, produto:produtos(nome, tamanho, numero)')

  if (!data) return { modelos: [] as {nome:string,qty:number}[], tamanhos: [] as {tam:string,qty:number}[] }

  const modeloMap: Record<string, number> = {}
  const tamanhoMap: Record<string, number> = {}

  for (const item of data) {
    const prod = item.produto as { nome: string; tamanho: string; numero: string | null } | null
    if (!prod) continue
    const qty  = item.quantidade ?? 1
    modeloMap[prod.nome] = (modeloMap[prod.nome] ?? 0) + qty
    const tam = prod.numero ?? prod.tamanho
    tamanhoMap[tam] = (tamanhoMap[tam] ?? 0) + qty
  }

  const modelos  = Object.entries(modeloMap).sort(([,a],[,b]) => b-a).slice(0,8).map(([nome,qty]) => ({nome,qty}))
  const tamanhos = Object.entries(tamanhoMap).sort(([,a],[,b]) => b-a).map(([tam,qty]) => ({tam,qty}))
  return { modelos, tamanhos }
}

// ── Helpers de alerta ────────────────────────────────────────────────────────
function isEstoqueBaixo(qty: number) { return qty < 3 }
function isProdutoParado(ultimaVenda: string | null) {
  if (!ultimaVenda) return true
  const diff = Date.now() - new Date(ultimaVenda).getTime()
  return diff > 30 * 24 * 60 * 60 * 1000 // 30 dias
}

// ── Modal de edição completa ─────────────────────────────────────────────────
const TAMANHOS_OPCOES = ['PP', 'P', 'M', 'G', 'GG', 'UNICO'] as const

interface EditarProdutoModalProps {
  produto: ProdutoComEstoque
  onClose: () => void
  onSave: () => void
}

function EditarProdutoModal({ produto, onClose, onSave }: EditarProdutoModalProps) {
  const estoqueAtual = produto.estoque?.[0]
  const temNumero = !!produto.numero

  const [nome, setNome] = useState(produto.nome)
  const [tipoNumeracao, setTipoNumeracao] = useState<'letra' | 'numero'>(temNumero ? 'numero' : 'letra')
  const [tamanho, setTamanho] = useState<TamanhoProduto>(produto.tamanho)
  const [numero, setNumero] = useState(produto.numero ?? '')
  const [custo, setCusto] = useState(String(produto.custo))
  const [preco, setPreco] = useState(String(produto.preco_venda))
  const [qty, setQty] = useState(String(estoqueAtual?.quantidade ?? 0))
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    const custoNum = parseFloat(custo)
    if (isNaN(custoNum) || custoNum < 0) { setErro('Custo inválido.'); return }
    const precoNum = parseFloat(preco)
    if (isNaN(precoNum) || precoNum < 0) { setErro('Preço inválido.'); return }
    const qtyNum = parseInt(qty)
    if (isNaN(qtyNum) || qtyNum < 0) { setErro('Quantidade inválida.'); return }
    if (tipoNumeracao === 'numero' && !numero.trim()) { setErro('Informe o número.'); return }

    setLoading(true)
    try {
      const supabase = createClient()

      const { error: prodErr } = await supabase
        .from('produtos')
        .update({
          nome: nome.trim(),
          tamanho: tipoNumeracao === 'letra' ? tamanho : 'UNICO',
          numero: tipoNumeracao === 'numero' ? numero.trim() : null,
          custo: custoNum,
          preco_venda: precoNum,
        })
        .eq('id', produto.id)
      if (prodErr) throw prodErr

      const { error: estErr } = await supabase
        .from('estoque')
        .update({ quantidade: qtyNum, atualizado_em: new Date().toISOString() })
        .eq('produto_id', produto.id)
      if (estErr) throw estErr

      onSave()
      onClose()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-4">Editar Produto</h3>

        <div className="flex flex-col gap-4">
          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1.5 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              autoFocus
            />
          </div>

          {/* Tipo de numeração */}
          <div>
            <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Numeração</label>
            <div className="mt-1.5 flex rounded overflow-hidden border border-[#2A2A2A]">
              {(['letra', 'numero'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoNumeracao(t)}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                    tipoNumeracao === t ? 'bg-gold text-[#0D0D0D]' : 'bg-transparent text-[#888888] hover:text-gold'
                  }`}
                >
                  {t === 'letra' ? 'Letras (PP/P/M…)' : 'Números (38/39/40…)'}
                </button>
              ))}
            </div>
            {tipoNumeracao === 'letra' ? (
              <select
                value={tamanho}
                onChange={(e) => setTamanho(e.target.value as TamanhoProduto)}
                className="mt-2 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              >
                {TAMANHOS_OPCOES.map((t) => (
                  <option key={t} value={t} className="bg-[#1A1A1A]">{t}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Ex: 38, 39, 40, 42..."
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="mt-2 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              />
            )}
          </div>

          {/* Custo + Preço de venda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Custo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                className="mt-1.5 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Preço de Venda (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="mt-1.5 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          {/* Preview Markup / Margem */}
          {(() => {
            const c = parseFloat(custo)
            const p = parseFloat(preco)
            if (!c || !p || c <= 0 || p <= 0) return null
            const lucro = p - c
            const mkup  = ((lucro / c) * 100).toFixed(1)
            const mg    = ((lucro / p) * 100).toFixed(1)
            return (
              <div className="rounded-lg border border-[#2A2A2A] bg-[#111111] p-3">
                <div className="grid grid-cols-3 gap-3 divide-x divide-[#2A2A2A]">
                  <div className="text-center px-1">
                    <p className="text-[9px] text-[#555555] uppercase tracking-wide mb-1">Lucro por peça</p>
                    <p className={`text-base font-black ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatarMoeda(lucro)}</p>
                  </div>
                  <div className="text-center px-3">
                    <p className="text-[9px] text-[#555555] uppercase tracking-wide mb-1">Markup</p>
                    <p className="text-base font-black text-orange-400">{mkup}%</p>
                    <p className="text-[9px] text-[#444444] mt-0.5">lucro ÷ custo</p>
                  </div>
                  <div className="text-center px-3">
                    <p className="text-[9px] text-[#555555] uppercase tracking-wide mb-1">Margem</p>
                    <p className="text-base font-black text-green-400">{mg}%</p>
                    <p className="text-[9px] text-[#444444] mt-0.5">lucro ÷ preço</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#1A1A1A] flex gap-4 justify-center">
                  <span className="text-[9px] text-[#444444]">
                    <span className="text-orange-400 font-bold">Markup:</span> quanto colocou a mais sobre o custo
                  </span>
                  <span className="text-[9px] text-[#444444]">
                    <span className="text-green-400 font-bold">Margem:</span> % do preço que é lucro
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Quantidade */}
          <div>
            <label className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Quantidade</label>
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="mt-1.5 w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
            />
          </div>

          {erro && <p className="text-xs text-[#FF4444]">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="primary" fullWidth loading={loading} onClick={handleSalvar}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>

          <button
            onClick={async () => {
              if (!confirm(`Ocultar "${produto.nome}" do sistema?`)) return
              const supabase = createClient()
              await supabase.from('produtos').update({ ativo: false } as any).eq('id', produto.id)
              onSave()
              onClose()
            }}
            className="w-full text-xs text-red-400 hover:text-red-300 py-1.5 border border-red-500/20 rounded-md hover:bg-red-500/10 transition-colors"
          >
            Ocultar produto do sistema
          </button>
        </div>
      </Card>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
function EstoquePageInner() {
  const params = useSearchParams()
  const [toast, setToast] = useState<string | null>(null)
  const [editarModal, setEditarModal] = useState<ProdutoComEstoque | null>(null)
  const [filtroTamanho, setFiltroTamanho] = useState<TamanhoProduto | 'todos'>('todos')
  const [filtroCanal, setFiltroCanal] = useState<CanalProduto | 'todos'>('todos')
  const [filtroAlerta, setFiltroAlerta] = useState(false)
  const [mostrarZerados, setMostrarZerados] = useState(false)
  const [modoGrade, setModoGrade] = useState(false)
  const { data: produtos = [], isLoading } = useSWR('estoque-socio', fetchEstoque, { refreshInterval: 60000 })
  const { data: ranking } = useSWR('ranking-vendas', fetchRankingVendas, { refreshInterval: 300000 })

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

    if (!mostrarZerados && qty === 0) return false
    if (filtroTamanho !== 'todos' && p.tamanho !== filtroTamanho) return false
    if (filtroCanal !== 'todos' && p.canal !== filtroCanal) return false
    if (filtroAlerta && !baixo && !parado) return false
    return true
  })

  // Grade de variações: agrupa por nome do produto
  const gruposPorNome = produtosFiltrados.reduce<Record<string, typeof produtosFiltrados>>((acc, p) => {
    if (!acc[p.nome]) acc[p.nome] = []
    acc[p.nome].push(p)
    return acc
  }, {})
  const gruposOrdenados = Object.entries(gruposPorNome).sort(([a], [b]) => a.localeCompare(b))

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

        {/* Ranking de Vendas */}
        {ranking && (ranking.modelos.length > 0 || ranking.tamanhos.length > 0) && (
          <Card className="mb-4" padding="sm">
            <p className="text-xs font-bold text-[#888888] uppercase tracking-widest mb-4">Análise de Vendas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Modelos */}
              {ranking.modelos.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[#555555] uppercase tracking-wide mb-3">Modelos que mais vendem</p>
                  <div className="flex flex-col gap-3">
                    {ranking.modelos.map(({ nome, qty }, i) => {
                      const max = ranking.modelos[0].qty
                      const pct = Math.round((qty / max) * 100)
                      const medal = i === 0 ? 'text-[#FFD700]' : i === 1 ? 'text-[#C0C0C0]' : i === 2 ? 'text-[#CD7F32]' : 'text-[#444444]'
                      return (
                        <div key={nome} className="flex items-center gap-3">
                          <span className={`text-sm font-black w-5 text-center ${medal}`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-semibold text-[#F0F0F0] truncate pr-2">{nome}</span>
                              <span className="text-xs font-black text-gold whitespace-nowrap">{qty} un</span>
                            </div>
                            <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${i === 0 ? 'bg-gold' : 'bg-[#444444]'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tamanhos */}
              {ranking.tamanhos.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[#555555] uppercase tracking-wide mb-3">Tamanhos que mais vendem</p>
                  <div className="flex flex-col gap-2">
                    {ranking.tamanhos.map(({ tam, qty }, i) => {
                      const max = ranking.tamanhos[0].qty
                      const pct = Math.round((qty / max) * 100)
                      const isTop = i === 0
                      return (
                        <div key={tam} className="flex items-center gap-3">
                          <div className={`w-10 h-8 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0 border ${
                            isTop ? 'bg-gold/15 border-gold text-gold' : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#888888]'
                          }`}>
                            {tam}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden flex-1 mr-3">
                                <div
                                  className={`h-full rounded-full ${isTop ? 'bg-gold' : 'bg-[#333333]'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold whitespace-nowrap ${isTop ? 'text-gold' : 'text-[#888888]'}`}>{qty} un</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

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
            <button
              onClick={() => setMostrarZerados((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                mostrarZerados
                  ? 'bg-[#555555] text-white border-[#555555]'
                  : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-[#555555]'
              }`}
            >
              {mostrarZerados ? 'Ocultar zerados' : 'Mostrar zerados'}
            </button>
            <button
              onClick={() => setModoGrade((v) => !v)}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                modoGrade
                  ? 'bg-gold text-[#0D0D0D] border-gold'
                  : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold hover:text-gold'
              }`}
            >
              {modoGrade ? 'Grade ▦' : 'Grade'}
            </button>
            <span className="text-xs text-[#555555] ml-auto self-center">
              {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
            </span>
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
                <th className="text-right px-4 py-3">
                  <span className="text-xs font-semibold text-[#888888] uppercase tracking-wide block">Markup / Margem</span>
                  <span className="text-[9px] text-[#444444] font-normal block mt-0.5">sobre custo / sobre preço</span>
                </th>
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
                    {!mostrarZerados ? 'Nenhum produto com estoque. Ative "Mostrar zerados" para ver todos.' : 'Nenhum produto encontrado.'}
                  </td>
                </tr>
              ) : modoGrade ? (
                // ── Modo Grade: agrupado por nome ──────────────────────────
                gruposOrdenados.map(([nome, variantes]) => {
                  const totalQty = variantes.reduce((s, v) => s + (v.estoque?.[0]?.quantidade ?? 0), 0)
                  const foto = variantes.find((v) => v.foto_url)?.foto_url ?? null
                  const preco = variantes[0]?.preco_venda ?? 0
                  const custo = variantes[0]?.custo ?? 0
                  const lucroGrp  = preco - custo
                  const markupGrp = custo > 0 ? ((lucroGrp / custo) * 100).toFixed(1) : null
                  const margemGrp = preco > 0 ? ((lucroGrp / preco) * 100).toFixed(1) : null
                  const temAlerta = variantes.some((v) => {
                    const q = v.estoque?.[0]?.quantidade ?? 0
                    return isEstoqueBaixo(q) || isProdutoParado(v.estoque?.[0]?.ultima_venda_em ?? null)
                  })
                  return (
                    <>
                      {/* Linha cabeçalho do grupo */}
                      <tr key={`grp-${nome}`} className="border-b border-[#2A2A2A] bg-[#141414]">
                        <td className="px-4 py-3">
                          <div className="w-10 h-10 bg-[#0D0D0D] rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                            {foto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={foto} alt={nome} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#2A2A2A]">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" /></svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#F0F0F0]" colSpan={2}>
                          {nome}
                          {temAlerta && <span className="ml-2 text-[10px] text-[#F59E0B]">⚠</span>}
                        </td>
                        <td className="px-4 py-3 text-[#888888] capitalize text-xs">{variantes[0]?.canal}</td>
                        <td className="px-4 py-3 text-right font-black text-gold">{totalQty}</td>
                        <td className="px-4 py-3 text-right text-[#888888] text-xs">{formatarMoeda(custo)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gold text-xs">{formatarMoeda(preco)}</td>
                        <td className="px-4 py-3 text-right">
                          {markupGrp !== null ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-[#555555] font-medium">MARKUP</span>
                                <span className="text-xs font-black text-orange-400">{markupGrp}%</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-[#555555] font-medium">MARGEM</span>
                                <span className="text-xs font-bold text-green-400">{margemGrp}%</span>
                              </div>
                            </div>
                          ) : <span className="text-[#555555] text-xs">—</span>}
                        </td>
                        <td colSpan={2} className="px-4 py-3 text-xs text-[#555555]">{variantes.length} variação{variantes.length !== 1 ? 'ões' : ''}</td>
                        <td className="px-4 py-3" />
                      </tr>
                      {/* Linhas de cada variação */}
                      {variantes.map((produto) => {
                        const est = produto.estoque?.[0]
                        const qty = est?.quantidade ?? 0
                        const ultima = est?.ultima_venda_em ?? null
                        const baixo = isEstoqueBaixo(qty)
                        const parado = isProdutoParado(ultima)
                        return (
                          <tr key={produto.id} className={`border-b border-[#1E1E1E] transition-colors ${baixo ? 'bg-red-500/5 hover:bg-red-500/10' : parado ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : 'bg-[#111111] hover:bg-[#1A1A1A]'}`}>
                            <td className="px-4 py-2 pl-8">
                              <div className="w-1 h-4 bg-[#2A2A2A] rounded-full" />
                            </td>
                            <td className="px-4 py-2 text-[#888888] text-xs pl-2">— variação</td>
                            <td className="px-4 py-2"><Badge variant="default">{produto.numero || produto.tamanho}</Badge></td>
                            <td className="px-4 py-2 text-[#555555] text-xs capitalize">{produto.canal}</td>
                            <td className={`px-4 py-2 text-right font-bold text-sm ${qty === 0 ? 'text-[#555555]' : qty < 3 ? 'text-red-400' : 'text-[#F0F0F0]'}`}>{qty}</td>
                            <td colSpan={3} />
                            <td className="px-4 py-2 text-[#555555] text-xs">{ultima ? new Date(ultima).toLocaleDateString('pt-BR') : 'Nunca'}</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1">
                                {baixo && <Badge variant="danger">Baixo</Badge>}
                                {parado && <Badge variant="warning">Parado</Badge>}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => setEditarModal(produto)} className="text-xs text-gold hover:underline font-semibold">Editar</button>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })
              ) : (
                // ── Modo Lista: flat, igual ao anterior ────────────────────
                produtosFiltrados.map((produto) => {
                  const est = produto.estoque?.[0]
                  const qty = est?.quantidade ?? 0
                  const ultima = est?.ultima_venda_em ?? null
                  const baixo = isEstoqueBaixo(qty)
                  const parado = isProdutoParado(ultima)

                  const lucro   = produto.preco_venda - produto.custo
                  const markup  = produto.custo > 0 ? ((lucro / produto.custo) * 100).toFixed(1) : null
                  const margem  = produto.preco_venda > 0 ? ((lucro / produto.preco_venda) * 100).toFixed(1) : null

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
                        <div className="w-10 h-10 bg-[#0D0D0D] rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                          {produto.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={produto.foto_url} alt={produto.nome} className="w-full h-full object-cover" loading="lazy" />
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
                      <td className="px-4 py-3"><Badge variant="default">{produto.numero || produto.tamanho}</Badge></td>
                      <td className="px-4 py-3 text-[#888888] capitalize">{produto.canal}</td>
                      <td className={`px-4 py-3 text-right font-bold ${qty === 0 ? 'text-[#555555]' : qty < 3 ? 'text-red-400' : 'text-[#F0F0F0]'}`}>{qty}</td>
                      <td className="px-4 py-3 text-right text-[#888888]">{formatarMoeda(produto.custo)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gold">{formatarMoeda(produto.preco_venda)}</td>
                      <td className="px-4 py-3 text-right">
                        {markup !== null ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-[#555555] font-medium">MARKUP</span>
                              <span className="text-xs font-black text-orange-400">{markup}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-[#555555] font-medium">MARGEM</span>
                              <span className="text-xs font-bold text-green-400">{margem}%</span>
                            </div>
                          </div>
                        ) : <span className="text-[#555555]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#888888] text-xs">{ultimaStr}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {baixo && <Badge variant="danger">Estoque Baixo</Badge>}
                          {parado && <Badge variant="warning">Parado</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setEditarModal(produto)}
                          className="text-xs text-gold hover:underline font-semibold"
                        >
                          Editar
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

      {/* Modal editar */}
      {editarModal && (
        <EditarProdutoModal
          produto={editarModal}
          onClose={() => setEditarModal(null)}
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
