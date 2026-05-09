'use client'

import { useState, useRef } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatarMoeda } from '@/lib/utils/preco'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ModoGrafico = 'mensal' | 'anual'

interface PeriodoMes { ano: number; mes: number }

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchKPIs(ano: number, mes: number) {
  const supabase = createClient()
  const hoje = new Date()
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioMes  = new Date(ano, mes - 1, 1).toISOString()
  const fimMes     = new Date(ano, mes, 1).toISOString()

  const [{ data: vendasHoje }, { data: vendasMes }, { data: itensMes }] = await Promise.all([
    supabase.from('vendas').select('total_final').gte('criado_em', inicioHoje),
    supabase.from('vendas').select('total_final').gte('criado_em', inicioMes).lt('criado_em', fimMes),
    supabase.from('itens_venda').select('quantidade, venda_id, vendas!inner(criado_em)')
      .gte('vendas.criado_em', inicioMes).lt('vendas.criado_em', fimMes),
  ])

  const receitaHoje  = (vendasHoje ?? []).reduce((a, v) => a + Number(v.total_final), 0)
  const receitaMes   = (vendasMes ?? []).reduce((a, v) => a + Number(v.total_final), 0)
  const qtdVendasMes = (vendasMes ?? []).length
  const ticketMedio  = qtdVendasMes > 0 ? receitaMes / qtdVendasMes : 0
  const pecasVendidas = (itensMes ?? []).reduce((a, i) => a + Number(i.quantidade), 0)

  return { receitaHoje, receitaMes, ticketMedio, pecasVendidas }
}

async function fetchGraficoMensal(p: PeriodoMes) {
  const supabase = createClient()
  const inicio = new Date(p.ano, p.mes - 1, 1).toISOString()
  const fim    = new Date(p.ano, p.mes, 0, 23, 59, 59).toISOString()
  const { data: vendas } = await supabase
    .from('vendas').select('total_final, criado_em')
    .gte('criado_em', inicio).lte('criado_em', fim)

  const diasNoMes = new Date(p.ano, p.mes, 0).getDate()
  const mapa: Record<string, number> = {}
  for (let d = 1; d <= diasNoMes; d++) mapa[String(d).padStart(2, '0')] = 0
  for (const v of vendas ?? []) {
    const k = String(new Date(v.criado_em).getDate()).padStart(2, '0')
    if (k in mapa) mapa[k] += Number(v.total_final)
  }
  return Object.entries(mapa).map(([label, valor]) => ({ label, valor }))
}

async function fetchGraficoAnual(ano: number) {
  const supabase = createClient()
  const inicio = new Date(ano, 0, 1).toISOString()
  const fim    = new Date(ano, 11, 31, 23, 59, 59).toISOString()
  const { data: vendas } = await supabase
    .from('vendas').select('total_final, criado_em')
    .gte('criado_em', inicio).lte('criado_em', fim)

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const mapa: Record<number, number> = {}
  for (let m = 0; m < 12; m++) mapa[m] = 0
  for (const v of vendas ?? []) {
    mapa[new Date(v.criado_em).getMonth()] += Number(v.total_final)
  }
  return MESES.map((label, i) => ({ label, valor: mapa[i] }))
}

async function fetchRankingVendedores(ano: number, mes: number) {
  const supabase = createClient()
  const inicio = new Date(ano, mes - 1, 1).toISOString()
  const fim    = new Date(ano, mes, 1).toISOString()
  const { data: vendas } = await supabase
    .from('vendas').select('vendedor_id, total_final, usuarios!inner(nome)')
    .gte('criado_em', inicio).lt('criado_em', fim)

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

async function fetchAlertas() {
  const supabase = createClient()
  const limite30dias = new Date()
  limite30dias.setDate(limite30dias.getDate() - 30)
  const { data: produtos } = await supabase.from('produtos').select('nome, tamanho, estoque(*)')
  const critico = (produtos ?? []).filter((p) => ((p.estoque as {quantidade:number}[])?.[0]?.quantidade ?? 0) < 3)
  const parado  = (produtos ?? []).filter((p) => {
    const ultima = (p.estoque as {ultima_venda_em:string|null}[])?.[0]?.ultima_venda_em
    if (!ultima) return true
    return new Date(ultima) < limite30dias
  })
  return { critico, parado }
}

interface FuncionariaMeta {
  id: string
  nome: string
  meta_mensal: number | null
}

async function fetchFuncionariasMeta(): Promise<FuncionariaMeta[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, meta_mensal')
    .eq('role', 'funcionario')
    .eq('ativo', true)
    .order('nome')
  return (data as FuncionariaMeta[]) ?? []
}

async function fetchRankingTamanhos() {
  const supabase = createClient()
  const inicioAno = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const { data } = await supabase
    .from('itens_venda')
    .select('quantidade, produtos!inner(tamanho, numero), vendas!inner(criado_em)')
    .gte('vendas.criado_em', inicioAno)

  const tamMapa: Record<string, number> = {}
  const numMapa: Record<string, number> = {}
  for (const item of data ?? []) {
    const p = item.produtos as { tamanho: string; numero: string | null } | null
    if (!p) continue
    if (p.numero) {
      numMapa[p.numero] = (numMapa[p.numero] ?? 0) + Number(item.quantidade)
    } else {
      tamMapa[p.tamanho] = (tamMapa[p.tamanho] ?? 0) + Number(item.quantidade)
    }
  }
  const tamanhos = Object.entries(tamMapa).map(([k, v]) => ({ label: k, qtd: v })).sort((a, b) => b.qtd - a.qtd)
  const numeros  = Object.entries(numMapa).map(([k, v]) => ({ label: k, qtd: v })).sort((a, b) => b.qtd - a.qtd)
  return { tamanhos, numeros }
}

interface ContaPagar {
  id: string
  descricao: string | null
  valor: number
  vence_em: string
}

async function fetchContasAPagar(): Promise<ContaPagar[]> {
  const supabase = createClient()
  const em7Dias = new Date()
  em7Dias.setDate(em7Dias.getDate() + 7)
  const { data } = await supabase
    .from('movimentacao_caixa')
    .select('id, descricao, valor, vence_em')
    .eq('tipo', 'saida')
    .eq('pago', false)
    .not('vence_em', 'is', null)
    .lte('vence_em', em7Dias.toISOString().slice(0, 10))
    .order('vence_em', { ascending: true })
  return (data as ContaPagar[]) ?? []
}

async function fetchInventarioStats() {
  const supabase = createClient()
  const { data: produtos } = await supabase.from('produtos').select('custo, preco_venda, estoque(quantidade)')
  let totalInvestido = 0, potencialRetorno = 0
  for (const p of produtos ?? []) {
    const qty = (p.estoque as {quantidade:number}[])?.[0]?.quantidade ?? 0
    totalInvestido  += Number(p.custo) * qty
    potencialRetorno += Number(p.preco_venda) * qty
  }
  return { totalInvestido, potencialRetorno }
}

// ── Helpers de período ────────────────────────────────────────────────────────
function mesAnterior(p: PeriodoMes): PeriodoMes {
  return p.mes === 1 ? { ano: p.ano - 1, mes: 12 } : { ano: p.ano, mes: p.mes - 1 }
}
function labelMes(p: PeriodoMes) {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${MESES[p.mes - 1]}/${p.ano}`
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: {value:number; name:string; color:string}[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#888888] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {formatarMoeda(p.value)}</p>
      ))}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function KpiSkeleton() { return <div className="skeleton h-28 rounded-lg" /> }

// ── Componente de seleção de mês ──────────────────────────────────────────────
function MesPicker({ value, onChange }: { value: PeriodoMes; onChange: (p: PeriodoMes) => void }) {
  const hoje = new Date()
  const opcoes: PeriodoMes[] = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    opcoes.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 })
  }
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return (
    <select
      value={`${value.ano}-${value.mes}`}
      onChange={(e) => {
        const [a, m] = e.target.value.split('-')
        onChange({ ano: Number(a), mes: Number(m) })
      }}
      className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs text-[#F0F0F0] focus:outline-none focus:border-gold"
    >
      {opcoes.map((o) => (
        <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`} className="bg-[#1A1A1A]">
          {MESES[o.mes - 1]}/{o.ano}
        </option>
      ))}
    </select>
  )
}

function AnoPicker({ value, onChange }: { value: number; onChange: (a: number) => void }) {
  const anoAtual = new Date().getFullYear()
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2, anoAtual - 3]
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs text-[#F0F0F0] focus:outline-none focus:border-gold"
    >
      {anos.map((a) => <option key={a} value={a} className="bg-[#1A1A1A]">{a}</option>)}
    </select>
  )
}

// ── Editor de meta inline ─────────────────────────────────────────────────────
function MetaEditor({ funcionaria, onSaved }: { funcionaria: FuncionariaMeta; onSaved: () => void }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(funcionaria.meta_mensal ?? ''))
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function iniciarEdicao() {
    setValor(String(funcionaria.meta_mensal ?? ''))
    setEditando(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function salvar() {
    setSalvando(true)
    const supabase = createClient()
    const metaNum = parseFloat(valor) || null
    await supabase.from('usuarios').update({ meta_mensal: metaNum } as never).eq('id', funcionaria.id)
    setSalvando(false)
    setEditando(false)
    onSaved()
  }

  if (editando) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#888888]">R$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="100"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false) }}
          className="w-28 bg-[#0D0D0D] border border-gold rounded px-2 py-1 text-xs text-[#F0F0F0] focus:outline-none"
          placeholder="0,00"
        />
        <button
          onClick={salvar}
          disabled={salvando}
          className="text-success text-xs font-bold hover:opacity-80 transition-opacity"
        >
          {salvando ? '...' : '✓'}
        </button>
        <button
          onClick={() => setEditando(false)}
          className="text-[#888888] text-xs hover:text-[#FF4444] transition-colors"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold ${funcionaria.meta_mensal ? 'text-gold' : 'text-[#555555]'}`}>
        {funcionaria.meta_mensal ? formatarMoeda(funcionaria.meta_mensal) : 'Sem meta'}
      </span>
      <button
        onClick={iniciarEdicao}
        className="text-[10px] text-[#888888] hover:text-gold transition-colors underline"
      >
        {funcionaria.meta_mensal ? 'editar' : 'definir'}
      </button>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const hoje = new Date()
  const [modo, setModo] = useState<ModoGrafico>('mensal')
  const [comparar, setComparar] = useState(false)

  // Período principal (mensal)
  const [periodoA, setPeriodoA] = useState<PeriodoMes>({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
  const [periodoB, setPeriodoB] = useState<PeriodoMes>(mesAnterior({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }))

  // Período principal (anual)
  const [anoA, setAnoA] = useState(hoje.getFullYear())
  const [anoB, setAnoB] = useState(hoje.getFullYear() - 1)

  // ── SWR ────────────────────────────────────────────────────────────────────
  const { data: kpis, isLoading: kpiLoading } = useSWR(
    ['kpis', periodoA.ano, periodoA.mes],
    () => fetchKPIs(periodoA.ano, periodoA.mes),
    { refreshInterval: 60000 }
  )

  // Gráfico: mensal
  const { data: graficoMesA = [] } = useSWR(
    ['graf-mes', periodoA.ano, periodoA.mes],
    () => fetchGraficoMensal(periodoA),
    { refreshInterval: 60000 }
  )
  const { data: graficoMesB = [] } = useSWR(
    ['graf-mes', periodoB.ano, periodoB.mes],
    () => fetchGraficoMensal(periodoB),
    { refreshInterval: 60000 }
  )

  // Gráfico: anual
  const { data: graficoAnoA = [] } = useSWR(
    ['graf-ano', anoA],
    () => fetchGraficoAnual(anoA),
    { refreshInterval: 60000 }
  )
  const { data: graficoAnoB = [] } = useSWR(
    ['graf-ano', anoB],
    () => fetchGraficoAnual(anoB),
    { refreshInterval: 60000 }
  )

  const { data: ranking = [] } = useSWR(
    ['ranking', periodoA.ano, periodoA.mes],
    () => fetchRankingVendedores(periodoA.ano, periodoA.mes),
    { refreshInterval: 60000 }
  )
  const { data: alertas }    = useSWR('alertas-dash',    fetchAlertas,        { refreshInterval: 60000 })
  const { data: inventario } = useSWR('inventario-stats', fetchInventarioStats, { refreshInterval: 60000 })
  const { data: funcionariasMeta = [] } = useSWR('funcionarias-meta', fetchFuncionariasMeta)
  const { data: rankingTamanhos } = useSWR('ranking-tamanhos', fetchRankingTamanhos, { refreshInterval: 300000 })
  const { data: contasAPagar = [] } = useSWR('contas-a-pagar-dash', fetchContasAPagar, { refreshInterval: 30000 })

  // ── Dados do gráfico mesclados ─────────────────────────────────────────────
  const chartData = modo === 'mensal'
    ? graficoMesA.map((p, i) => ({
        label: p.label,
        [labelMes(periodoA)]: p.valor,
        [labelMes(periodoB)]: graficoMesB[i]?.valor ?? 0,
      }))
    : graficoAnoA.map((p, i) => ({
        label: p.label,
        [`${anoA}`]: p.valor,
        [`${anoB}`]: graficoAnoB[i]?.valor ?? 0,
      }))

  const keyA = modo === 'mensal' ? labelMes(periodoA) : `${anoA}`
  const keyB = modo === 'mensal' ? labelMes(periodoB) : `${anoB}`

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
            <a href="/pdv"       className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">PDV</a>
            <a href="/vendas"    className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">Vendas</a>
            <a href="/estoque"   className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">Estoque</a>
            <a href="/clientes"  className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">Clientes</a>
            <a href="/comissoes" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">Comissões</a>
            <a href="/financeiro" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">Financeiro</a>
            <a href="/campanhas" className="text-xs text-[#888888] hover:text-gold transition-colors border border-[#2A2A2A] px-3 py-1.5 rounded hover:border-gold">Campanhas</a>
            <a href="/relatorio" className="text-xs text-gold font-bold hover:text-[#F0F0F0] transition-colors border border-gold/40 px-3 py-1.5 rounded hover:border-gold">📄 Relatório PDF</a>
            <button
              onClick={async () => { await createClient().auth.signOut(); window.location.href = '/login' }}
              className="text-xs text-[#FF4444] hover:text-white transition-colors border border-[#FF4444]/40 px-3 py-1.5 rounded hover:border-[#FF4444] hover:bg-[#FF4444]/10"
            >
              Sair
            </button>
          </div>
        </div>

        {/* ── Contas a Pagar desta semana ── */}
        {(() => {
          const hojeStr = new Date().toISOString().slice(0, 10)
          const totalPendente = contasAPagar.reduce((a, c) => a + Number(c.valor), 0)
          if (contasAPagar.length === 0) return null
          return (
            <div className="bg-[#1A1000] border border-[#F59E0B]/40 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <h2 className="text-sm font-black text-[#F59E0B] uppercase tracking-wide">
                    Contas a Pagar Esta Semana
                  </h2>
                  <span className="bg-danger/20 text-danger text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {contasAPagar.length}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-black text-danger">{formatarMoeda(totalPendente)}</span>
                  <a href="/financeiro" className="text-[10px] text-[#888888] hover:text-gold underline transition-colors">
                    Gerenciar →
                  </a>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {contasAPagar.map((c) => {
                  const vencida = c.vence_em < hojeStr
                  const hoje    = c.vence_em === hojeStr
                  const dataFmt = new Date(c.vence_em + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 bg-[#0D0D00] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                          vencida ? 'bg-danger/20 text-danger' : hoje ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#2A2A2A] text-[#888888]'
                        }`}>
                          {vencida ? 'VENCIDA' : hoje ? 'HOJE' : dataFmt}
                        </span>
                        <span className="text-xs text-[#F0F0F0] truncate">{c.descricao ?? '—'}</span>
                      </div>
                      <span className="text-xs font-bold text-danger flex-shrink-0">{formatarMoeda(Number(c.valor))}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* KPIs do mês selecionado */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              {[
                { label: `Receita Hoje`,          valor: kpis?.receitaHoje  ?? 0 },
                { label: `Receita ${labelMes(periodoA)}`, valor: kpis?.receitaMes  ?? 0 },
                { label: 'Ticket Médio',           valor: kpis?.ticketMedio  ?? 0 },
              ].map((k) => (
                <Card key={k.label} hover className="flex flex-col gap-1">
                  <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">{k.label}</p>
                  <p className="text-2xl font-black text-gold">{formatarMoeda(k.valor)}</p>
                </Card>
              ))}
              <Card hover className="flex flex-col gap-1">
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">Peças Vendidas</p>
                <p className="text-2xl font-black text-gold">{kpis?.pecasVendidas ?? 0}</p>
                <p className="text-xs text-[#888888]">{labelMes(periodoA)}</p>
              </Card>
            </>
          )}
        </div>

        {/* KPIs de estoque/investimento */}
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

        {/* Gráfico com filtro de período */}
        <Card>
          {/* Controles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">Receita</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Toggle Diário / Anual */}
              <div className="flex rounded overflow-hidden border border-[#2A2A2A]">
                {(['mensal', 'anual'] as ModoGrafico[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setModo(m); setComparar(false) }}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                      modo === m ? 'bg-gold text-[#0D0D0D]' : 'bg-transparent text-[#888888] hover:text-gold'
                    }`}
                  >
                    {m === 'mensal' ? 'Dias do Mês' : 'Mês a Mês'}
                  </button>
                ))}
              </div>

              {/* Seletor de períodos */}
              <div className="flex items-center gap-2 text-xs">
                {modo === 'mensal' ? (
                  <>
                    <MesPicker value={periodoA} onChange={setPeriodoA} />
                    {comparar && (
                      <>
                        <span className="text-[#888888]">vs</span>
                        <MesPicker value={periodoB} onChange={setPeriodoB} />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <AnoPicker value={anoA} onChange={setAnoA} />
                    {comparar && (
                      <>
                        <span className="text-[#888888]">vs</span>
                        <AnoPicker value={anoB} onChange={setAnoB} />
                      </>
                    )}
                  </>
                )}
                <button
                  onClick={() => setComparar((v) => !v)}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
                    comparar
                      ? 'bg-[#2A2A2A] text-[#F0F0F0] border-[#444444]'
                      : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:text-gold hover:border-gold'
                  }`}
                >
                  {comparar
                    ? (modo === 'mensal' ? 'Mês vs Mês ✓' : 'Ano vs Ano ✓')
                    : '+ Comparar'}
                </button>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#888888', fontSize: 10 }}
                tickLine={false} axisLine={false}
                interval={modo === 'mensal' ? 4 : 0}
              />
              <YAxis
                tick={{ fill: '#888888', fontSize: 10 }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                width={46}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(v) => <span style={{ color: '#888888' }}>{v}</span>}
              />
              <Line
                type="monotone" dataKey={keyA} stroke="#F5C518" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#F5C518', stroke: '#0D0D0D', strokeWidth: 2 }}
              />
              {comparar && (
                <Line
                  type="monotone" dataKey={keyB} stroke="#555555" strokeWidth={1.5}
                  strokeDasharray="4 4" dot={false}
                  activeDot={{ r: 3, fill: '#555555', stroke: '#0D0D0D', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Rankings + Alertas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ranking vendedores */}
          <Card>
            <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4">
              Ranking — {labelMes(periodoA)}
            </h2>
            {ranking.length === 0 ? (
              <p className="text-sm text-[#888888]">Nenhuma venda no período</p>
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
                        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(v.total / maxRanking) * 100}%` }} />
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
            <Card>
              <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-3 flex items-center gap-2">
                Estoque Crítico
                {alertas?.critico.length ? <Badge variant="danger">{alertas.critico.length}</Badge> : null}
              </h2>
              {!alertas?.critico.length ? (
                <p className="text-xs text-[#888888]">Nenhum produto em estado crítico</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {alertas.critico.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-[#F0F0F0] truncate">{p.nome}</span>
                      <Badge variant="danger">{(p.estoque as {quantidade:number}[])?.[0]?.quantidade ?? 0} un</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-3 flex items-center gap-2">
                Produtos Parados
                {alertas?.parado.length ? <Badge variant="warning">{alertas.parado.length}</Badge> : null}
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

        {/* Metas das vendedoras */}
        {/* Ranking de tamanhos mais vendidos — ano atual */}
        {rankingTamanhos && (rankingTamanhos.tamanhos.length > 0 || rankingTamanhos.numeros.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rankingTamanhos.tamanhos.length > 0 && (
              <Card>
                <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4">
                  Tamanhos Mais Vendidos
                  <span className="text-[#555555] font-normal normal-case text-xs ml-2">ano atual</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {rankingTamanhos.tamanhos.slice(0, 6).map((t, i) => {
                    const max = rankingTamanhos.tamanhos[0]?.qtd ?? 1
                    return (
                      <div key={t.label} className="flex items-center gap-3">
                        <span className={`w-8 text-xs font-black text-center ${i === 0 ? 'text-gold' : 'text-[#888888]'}`}>
                          {t.label}
                        </span>
                        <div className="flex-1 h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${i === 0 ? 'bg-gold' : 'bg-[#555555]'}`}
                            style={{ width: `${(t.qtd / max) * 100}%` }} />
                        </div>
                        <span className="text-xs text-[#888888] w-12 text-right">{t.qtd} pç</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
            {rankingTamanhos.numeros.length > 0 && (
              <Card>
                <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4">
                  Numerações Mais Vendidas
                  <span className="text-[#555555] font-normal normal-case text-xs ml-2">ano atual</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {rankingTamanhos.numeros.slice(0, 6).map((n, i) => {
                    const max = rankingTamanhos.numeros[0]?.qtd ?? 1
                    return (
                      <div key={n.label} className="flex items-center gap-3">
                        <span className={`w-8 text-xs font-black text-center ${i === 0 ? 'text-gold' : 'text-[#888888]'}`}>
                          {n.label}
                        </span>
                        <div className="flex-1 h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${i === 0 ? 'bg-gold' : 'bg-[#555555]'}`}
                            style={{ width: `${(n.qtd / max) * 100}%` }} />
                        </div>
                        <span className="text-xs text-[#888888] w-12 text-right">{n.qtd} pç</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {funcionariasMeta.length > 0 && (
          <Card>
            <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4">
              Metas Mensais — Vendedoras
            </h2>
            <div className="flex flex-col gap-4">
              {funcionariasMeta.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#2A2A2A] text-gold flex items-center justify-center text-xs font-black flex-shrink-0">
                      {f.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-[#F0F0F0] truncate">{f.nome}</span>
                  </div>
                  <MetaEditor
                    funcionaria={f}
                    onSaved={() => swrMutate('funcionarias-meta')}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}
