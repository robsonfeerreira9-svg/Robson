'use client'

import useSWR from 'swr'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatarMoeda } from '@/lib/utils/preco'

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchKPIs() {
  const supabase = createClient()
  const hoje = new Date()
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()

  const [{ data: vendasHoje }, { data: vendasMes }, { data: itensMes }] = await Promise.all([
    supabase.from('vendas').select('total_final').gte('criado_em', inicioHoje),
    supabase.from('vendas').select('total_final').gte('criado_em', inicioMes),
    supabase.from('itens_venda').select('quantidade, venda_id, vendas!inner(criado_em)')
      .gte('vendas.criado_em', inicioMes),
  ])

  const receitaHoje = (vendasHoje ?? []).reduce((a, v) => a + Number(v.total_final), 0)
  const receitaMes = (vendasMes ?? []).reduce((a, v) => a + Number(v.total_final), 0)
  const qtdVendasMes = (vendasMes ?? []).length
  const ticketMedio = qtdVendasMes > 0 ? receitaMes / qtdVendasMes : 0
  const pecasVendidas = (itensMes ?? []).reduce((a, i) => a + Number(i.quantidade), 0)

  return { receitaHoje, receitaMes, ticketMedio, pecasVendidas }
}

async function fetchGrafico() {
  const supabase = createClient()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 29)

  const { data: vendas } = await supabase
    .from('vendas')
    .select('total_final, criado_em')
    .gte('criado_em', inicio.toISOString())
    .order('criado_em')

  const mapa: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    mapa[key] = 0
  }

  for (const v of vendas ?? []) {
    const key = new Date(v.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (key in mapa) mapa[key] += Number(v.total_final)
  }

  return Object.entries(mapa).map(([data, valor]) => ({ data, valor }))
}

async function fetchRankingVendedores() {
  const supabase = createClient()
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: vendas } = await supabase
    .from('vendas')
    .select('vendedor_id, total_final, usuarios!inner(nome)')
    .gte('criado_em', inicioMes)

  const mapa: Record<string, { nome: string; total: number; qtd: number }> = {}
  for (const v of vendas ?? []) {
    const id = v.vendedor_id
    const nome = (v.usuarios as { nome: string } | null)?.nome ?? 'Desconhecido'
    if (!mapa[id]) mapa[id] = { nome, total: 0, qtd: 0 }
    mapa[id].total += Number(v.total_final)
    mapa[id].qtd++
  }

  return Object.values(mapa).sort((a, b) => b.total - a.total)
}

async function fetchInventarioStats() {
  const supabase = createClient()
  const { data: produtos } = await supabase
    .from('produtos')
    .select('custo, preco_venda, estoque(quantidade)')

  let totalInvestido = 0
  let potencialRetorno = 0

  for (const p of produtos ?? []) {
    const qty = (p.estoque as { quantidade: number }[])?.[0]?.quantidade ?? 0
    totalInvestido += Number(p.custo) * qty
    potencialRetorno += Number(p.preco_venda) * qty
  }

  return { totalInvestido, potencialRetorno }
}

async function fetchAlertas() {
  const supabase = createClient()
  const limite30dias = new Date()
  limite30dias.setDate(limite30dias.getDate() - 30)

  const { data: produtos } = await supabase
    .from('produtos')
    .select('nome, tamanho, estoque(*)')

  const critico = (produtos ?? []).filter((p) => {
    const qty = (p.estoque as { quantidade: number }[])?.[0]?.quantidade ?? 0
    return qty < 3
  })

  const parado = (produtos ?? []).filter((p) => {
    const ultima = (p.estoque as { ultima_venda_em: string | null }[])?.[0]?.ultima_venda_em
    if (!ultima) return true
    return new Date(ultima) < limite30dias
  })

  return { critico, parado }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function KpiSkeleton() {
  return <div className="skeleton h-28 rounded-lg" />
}

// ── Tooltip customizado do gráfico ───────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-gold/30 rounded-lg px-3 py-2 text-sm">
      <p className="text-[#888888] mb-0.5">{label}</p>
      <p className="font-bold text-gold">{formatarMoeda(payload[0].value)}</p>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: kpis, isLoading: kpiLoading } = useSWR('kpis', fetchKPIs, { refreshInterval: 60000 })
  const { data: grafico = [] } = useSWR('grafico', fetchGrafico, { refreshInterval: 60000 })
  const { data: ranking = [] } = useSWR('ranking', fetchRankingVendedores, { refreshInterval: 60000 })
  const { data: alertas } = useSWR('alertas-dash', fetchAlertas, { refreshInterval: 60000 })
  const { data: inventario } = useSWR('inventario-stats', fetchInventarioStats, { refreshInterval: 60000 })

  const maxRanking = ranking[0]?.total ?? 1

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Dashboard</h1>
            <p className="text-sm text-[#888888]">HG Grifes — Visão Geral</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <a href="/pdv" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">
              PDV
            </a>
            <a href="/estoque" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">
              Estoque
            </a>
            <a href="/comissoes" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">
              Comissões
            </a>
            <a href="/financeiro" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">
              Financeiro
            </a>
            <a href="/campanhas" className="text-xs text-gold hover:text-[#F0F0F0] transition-colors border border-gold/40 px-3 py-1.5 rounded hover:border-gold">
              Campanhas
            </a>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              {[
                { label: 'Receita Hoje', valor: kpis?.receitaHoje ?? 0 },
                { label: 'Receita do Mês', valor: kpis?.receitaMes ?? 0 },
                { label: 'Ticket Médio', valor: kpis?.ticketMedio ?? 0 },
              ].map((k) => (
                <Card key={k.label} hover className="flex flex-col gap-1">
                  <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">{k.label}</p>
                  <p className="text-2xl font-black text-gold">{formatarMoeda(k.valor)}</p>
                </Card>
              ))}
              <Card hover className="flex flex-col gap-1">
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">Peças Vendidas</p>
                <p className="text-2xl font-black text-gold">{kpis?.pecasVendidas ?? 0}</p>
                <p className="text-xs text-[#888888]">no mês</p>
              </Card>
            </>
          )}
        </div>

        {/* KPIs de Inventário */}
        <div className="grid grid-cols-2 gap-4">
          <Card hover className="flex flex-col gap-1">
            <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">Total Investido</p>
            <p className="text-2xl font-black text-[#F0F0F0]">{formatarMoeda(inventario?.totalInvestido ?? 0)}</p>
            <p className="text-xs text-[#888888]">custo × estoque atual</p>
          </Card>
          <Card hover className="flex flex-col gap-1">
            <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">Potencial de Retorno</p>
            <p className="text-2xl font-black text-gold">{formatarMoeda(inventario?.potencialRetorno ?? 0)}</p>
            <p className="text-xs text-[#888888]">
              {inventario && inventario.totalInvestido > 0
                ? `${(((inventario.potencialRetorno - inventario.totalInvestido) / inventario.totalInvestido) * 100).toFixed(0)}% de lucro potencial`
                : 'preço venda × estoque atual'}
            </p>
          </Card>
        </div>

        {/* Gráfico */}
        <Card>
          <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4">
            Receita — Últimos 30 dias
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={grafico} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis
                dataKey="data"
                tick={{ fill: '#888888', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: '#888888', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="#F5C518"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#F5C518', stroke: '#0D0D0D', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ranking vendedores */}
          <Card>
            <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4">
              Ranking Vendedores
            </h2>
            {ranking.length === 0 ? (
              <p className="text-sm text-[#888888]">Nenhuma venda no mês</p>
            ) : (
              <div className="flex flex-col gap-3">
                {ranking.map((v, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold text-[#0D0D0D] flex items-center justify-center text-xs font-black flex-shrink-0">
                      {v.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-[#F0F0F0] truncate">{v.nome}</span>
                        <span className="text-xs text-gold font-bold ml-2">{formatarMoeda(v.total)}</span>
                      </div>
                      <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all"
                          style={{ width: `${(v.total / maxRanking) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#888888] mt-0.5">{v.qtd} venda{v.qtd !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Alertas */}
          <div className="flex flex-col gap-4">
            {/* Estoque crítico */}
            <Card>
              <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-3 flex items-center gap-2">
                Estoque Crítico
                {alertas?.critico.length ? (
                  <Badge variant="danger">{alertas.critico.length}</Badge>
                ) : null}
              </h2>
              {!alertas?.critico.length ? (
                <p className="text-xs text-[#888888]">Nenhum produto em estado crítico</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {alertas.critico.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-[#F0F0F0] truncate">{p.nome}</span>
                      <Badge variant="danger">
                        {(p.estoque as { quantidade: number }[])?.[0]?.quantidade ?? 0} un
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Produtos parados */}
            <Card>
              <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-3 flex items-center gap-2">
                Produtos Parados
                {alertas?.parado.length ? (
                  <Badge variant="warning">{alertas.parado.length}</Badge>
                ) : null}
              </h2>
              {!alertas?.parado.length ? (
                <p className="text-xs text-[#888888]">Nenhum produto parado</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {alertas.parado.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-[#F0F0F0] truncate">{p.nome}</span>
                      <Badge variant="warning">Parado</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
