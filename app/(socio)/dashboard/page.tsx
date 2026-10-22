'use client'

import { useState, useRef } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
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
  const mapaReceita: Record<string, number> = {}
  const mapaVolume:  Record<string, number> = {}
  for (let d = 1; d <= diasNoMes; d++) {
    const k = String(d).padStart(2, '0')
    mapaReceita[k] = 0
    mapaVolume[k]  = 0
  }
  for (const v of vendas ?? []) {
    const k = String(new Date(v.criado_em).getDate()).padStart(2, '0')
    if (k in mapaReceita) {
      mapaReceita[k] += Number(v.total_final)
      mapaVolume[k]  += 1
    }
  }
  return Object.keys(mapaReceita)
    .sort((a, b) => Number(a) - Number(b))
    .map((label) => ({
      label,
      valor:  mapaReceita[label],
      volume: mapaVolume[label],
    }))
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
  const { data: produtos } = await supabase.from('produtos').select('nome, tamanho, estoque(*)').eq('ativo', true)
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
  const { data: produtos } = await supabase.from('produtos').select('custo, preco_venda, estoque(quantidade)').eq('ativo', true)
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
  active?: boolean; payload?: {value:number; name:string; color:string; dataKey:string}[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#888888] mb-1">Dia {label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.dataKey === 'volume' ? `${p.value} venda${p.value !== 1 ? 's' : ''}` : formatarMoeda(p.value)}
        </p>
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
        volume: (p as { volume?: number }).volume ?? 0,
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
    <div className="min-h-screen bg-[#080808] p-4 md:p-6 fade-up">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div>
          <p className="text-[11px] text-[#444] uppercase tracking-[0.2em] font-medium mb-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <h1 className="text-3xl font-black text-[#EBEBEB] tracking-tight">Visão Geral</h1>
        </div>

        {/* ── Contas a Pagar desta semana ── */}
        {(() => {
          const hojeStr = new Date().toISOString().slice(0, 10)
          const totalPendente = contasAPagar.reduce((a, c) => a + Number(c.valor), 0)
          if (contasAPagar.length === 0) return null
          return (
            <div className="border border-[#E53E3E]/25 rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(229,62,62,0.04)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E53E3E] animate-pulse" />
                  <h2 className="text-xs font-bold text-[#EBEBEB] uppercase tracking-[0.12em]">
                    Contas a Pagar — Esta Semana
                  </h2>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(229,62,62,0.15)', color: '#E53E3E' }}>
                    {contasAPagar.length}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black" style={{ color: '#E53E3E' }}>{formatarMoeda(totalPendente)}</span>
                  <a href="/financeiro" className="text-[10px] text-[#555] hover:text-gold transition-colors">
                    Ver tudo →
                  </a>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {contasAPagar.map((c) => {
                  const vencida = c.vence_em < hojeStr
                  const isHoje  = c.vence_em === hojeStr
                  const dataFmt = new Date(c.vence_em + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          vencida ? 'text-[#E53E3E]' : isHoje ? 'text-[#D69E2E]' : 'text-[#555]'
                        }`} style={{ background: vencida ? 'rgba(229,62,62,0.12)' : isHoje ? 'rgba(214,158,46,0.12)' : 'rgba(255,255,255,0.05)' }}>
                          {vencida ? 'VENCIDA' : isHoje ? 'HOJE' : dataFmt}
                        </span>
                        <span className="text-xs text-[#EBEBEB] truncate">{c.descricao ?? '—'}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#E53E3E] flex-shrink-0">{formatarMoeda(Number(c.valor))}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* KPIs principais — 2 colunas no mobile, 4 no desktop */}
        {(() => {
          const mesStr = `${periodoA.ano}-${String(periodoA.mes).padStart(2, '0')}`
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiLoading ? (
                Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
              ) : (
                <>
                  <a href="/vendas?filtro=hoje" className="block">
                    <Card hover className="flex flex-col gap-1.5 h-full">
                      <p className="text-[10px] text-[#454545] uppercase tracking-[0.12em] font-semibold">Receita Hoje</p>
                      <p className="text-gold-glow font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>{formatarMoeda(kpis?.receitaHoje ?? 0)}</p>
                      <p className="text-[10px] text-[#333] mt-auto">ver vendas de hoje →</p>
                    </Card>
                  </a>
                  <a href={`/vendas?mes=${mesStr}`} className="block">
                    <Card hover className="flex flex-col gap-1.5 h-full">
                      <p className="text-[10px] text-[#454545] uppercase tracking-[0.12em] font-semibold">Receita do Mês</p>
                      <p className="text-gold-glow font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>{formatarMoeda(kpis?.receitaMes ?? 0)}</p>
                      <p className="text-[10px] text-[#333] mt-auto">{labelMes(periodoA)} →</p>
                    </Card>
                  </a>
                  <a href={`/vendas?mes=${mesStr}`} className="block">
                    <Card hover className="flex flex-col gap-1.5 h-full">
                      <p className="text-[10px] text-[#454545] uppercase tracking-[0.12em] font-semibold">Ticket Médio</p>
                      <p className="text-[#A8A8A8] font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1rem, 3.5vw, 1.4rem)' }}>{formatarMoeda(kpis?.ticketMedio ?? 0)}</p>
                      <p className="text-[10px] text-[#333] mt-auto">ver vendas →</p>
                    </Card>
                  </a>
                  <a href={`/vendas?mes=${mesStr}`} className="block">
                    <Card hover className="flex flex-col gap-1.5 h-full">
                      <p className="text-[10px] text-[#454545] uppercase tracking-[0.12em] font-semibold">Peças no Mês</p>
                      <p className="text-gold font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)' }}>{kpis?.pecasVendidas ?? 0}</p>
                      <p className="text-[10px] text-[#333] mt-auto">ver vendas →</p>
                    </Card>
                  </a>
                </>
              )}
            </div>
          )
        })()}

        {/* KPIs de estoque/investimento */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/estoque" className="block">
            <Card hover className="flex flex-col gap-1.5 h-full">
              <p className="text-[10px] text-[#454545] uppercase tracking-[0.12em] font-semibold">Investido</p>
              <p className="text-[#A8A8A8] font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1rem, 3.5vw, 1.4rem)' }}>{formatarMoeda(inventario?.totalInvestido ?? 0)}</p>
              <p className="text-[10px] text-[#333] mt-auto">ver estoque →</p>
            </Card>
          </a>
          <a href="/estoque" className="block">
            <Card hover className="flex flex-col gap-1.5 h-full">
              <p className="text-[10px] text-[#454545] uppercase tracking-[0.12em] font-semibold">Retorno Potencial</p>
              <p className="text-gold-glow font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1rem, 3.5vw, 1.4rem)' }}>{formatarMoeda(inventario?.potencialRetorno ?? 0)}</p>
              <p className="text-[10px] text-[#333] mt-auto">
                {inventario && inventario.totalInvestido > 0
                  ? `+${(((inventario.potencialRetorno - inventario.totalInvestido) / inventario.totalInvestido) * 100).toFixed(0)}% lucro potencial →`
                  : 'ver estoque →'}
              </p>
            </Card>
          </a>
        </div>

        {/* Gráfico com filtro de período */}
        <Card>
          {/* Controles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em]">Receita</h2>
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

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#181818" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#888888', fontSize: 10 }}
                tickLine={false} axisLine={false}
                interval={4}
              />
              <YAxis
                yAxisId="receita"
                tick={{ fill: '#888888', fontSize: 10 }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                width={46}
              />
              {modo === 'mensal' && !comparar && (
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  tick={{ fill: '#4A9EFF', fontSize: 10 }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}v`}
                  width={30}
                  allowDecimals={false}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                formatter={(v) => <span style={{ color: '#888888' }}>{v}</span>}
              />
              <Line
                yAxisId="receita"
                type="monotone" dataKey={keyA} name="Receita" stroke="#C9A840" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#C9A840', stroke: '#080808', strokeWidth: 2 }}
              />
              {modo === 'mensal' && !comparar && (
                <Bar
                  yAxisId="volume"
                  dataKey="volume" name="Vendas/dia"
                  fill="#4A9EFF" opacity={0.25} radius={[2, 2, 0, 0]}
                />
              )}
              {comparar && (
                <Line
                  yAxisId="receita"
                  type="monotone" dataKey={keyB} name={keyB} stroke="#555555" strokeWidth={1.5}
                  strokeDasharray="4 4" dot={false}
                  activeDot={{ r: 3, fill: '#555555', stroke: '#0D0D0D', strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Rankings + Alertas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ranking vendedores */}
          <Card>
            <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em] mb-4">
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
                      <div className="h-1.5 bg-[#141414] rounded-full overflow-hidden">
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
              <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em] mb-3 flex items-center gap-2">
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
              <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em] mb-3 flex items-center gap-2">
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
                <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em] mb-4">
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
                        <div className="flex-1 h-2 bg-[#141414] rounded-full overflow-hidden">
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
                <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em] mb-4">
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
                        <div className="flex-1 h-2 bg-[#141414] rounded-full overflow-hidden">
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
            <h2 className="text-xs font-semibold text-[#606060] uppercase tracking-[0.12em] mb-4">
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
