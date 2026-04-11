'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatarMoeda } from '@/lib/utils/preco'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ClienteStats {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  data_nascimento: string | null
  total_compras: number
  total_gasto: number
  ultima_compra: string | null
}

interface VendaResumo {
  id: string
  canal_venda: string
  metodo_pagamento: string
  subtotal: number
  desconto_aplicado: number
  total_final: number
  criado_em: string
}

interface Aniversariante {
  id: string
  nome: string
  telefone: string | null
  data_nascimento: string
  dia: number
  ehHoje: boolean
}

type Filtro = 'todos' | 'novos' | 'fieis'

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchClientesStats(): Promise<ClienteStats[]> {
  const supabase = createClient()

  // Busca TODOS os clientes cadastrados
  const { data: clientesData, error: clientesError } = await supabase
    .from('clientes')
    .select('id, nome, cpf, telefone, data_nascimento')
    .order('nome')
  if (clientesError) throw clientesError

  // Busca todas as vendas com cliente vinculado
  const { data: vendasData, error: vendasError } = await supabase
    .from('vendas')
    .select('cliente_id, total_final, criado_em')
    .not('cliente_id', 'is', null)
  if (vendasError) throw vendasError

  // Agrega vendas por cliente
  const vendasMap = new Map<string, { total_compras: number; total_gasto: number; ultima_compra: string | null }>()
  for (const v of vendasData ?? []) {
    if (!v.cliente_id) continue
    if (!vendasMap.has(v.cliente_id)) {
      vendasMap.set(v.cliente_id, { total_compras: 0, total_gasto: 0, ultima_compra: null })
    }
    const entry = vendasMap.get(v.cliente_id)!
    entry.total_compras += 1
    entry.total_gasto += v.total_final
    if (!entry.ultima_compra || v.criado_em > entry.ultima_compra) {
      entry.ultima_compra = v.criado_em
    }
  }

  // Combina: todos os clientes, com ou sem compras
  return (clientesData ?? [])
    .map((c) => {
      const stats = vendasMap.get(c.id) ?? { total_compras: 0, total_gasto: 0, ultima_compra: null }
      return { id: c.id, nome: c.nome, cpf: c.cpf, telefone: c.telefone, data_nascimento: c.data_nascimento, ...stats }
    })
    .sort((a, b) => b.total_compras - a.total_compras || b.total_gasto - a.total_gasto)
}

async function fetchAniversariantes(): Promise<Aniversariante[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, telefone, data_nascimento')
    .not('data_nascimento', 'is', null)

  if (error) throw error

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const diaAtual = hoje.getDate()

  return (data ?? [])
    .filter((c) => {
      const d = new Date(c.data_nascimento + 'T12:00:00')
      return d.getMonth() + 1 === mesAtual
    })
    .map((c) => {
      const d = new Date(c.data_nascimento + 'T12:00:00')
      const dia = d.getDate()
      return { id: c.id, nome: c.nome, telefone: c.telefone, data_nascimento: c.data_nascimento, dia, ehHoje: dia === diaAtual }
    })
    .sort((a, b) => a.dia - b.dia)
}

async function fetchVendasCliente(clienteId: string): Promise<VendaResumo[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vendas')
    .select('id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em')
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function telefoneWpp(tel: string | null, msg: string) {
  if (!tel) return '#'
  const num = tel.replace(/\D/g, '')
  const com55 = num.startsWith('55') ? num : `55${num}`
  return `https://wa.me/${com55}?text=${encodeURIComponent(msg)}`
}

function msgAniversario(nome: string) {
  return `Oi ${nome}! 🎂 A HG Grifes deseja um feliz aniversário! Como presente, preparamos um desconto especial para você. Passa na loja ou me chama aqui no WhatsApp para aproveitar! 🎁`
}

function badgeCliente(compras: number) {
  if (compras >= 5) return <Badge variant="warning">VIP</Badge>
  if (compras >= 2) return <Badge variant="default">Fiel</Badge>
  return <span className="text-xs text-[#555555] font-semibold">Novo</span>
}

function calcularIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null
  const nasc = new Date(dataNasc + 'T12:00:00')
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

function formatarCPF(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

const CANAL_LABEL: Record<string, string> = { fisico: 'Física', whatsapp: 'WhatsApp', instagram: 'Instagram' }
const PAGO_LABEL:  Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro' }

const FAIXAS = [
  { label: 'Até 17',  min: 0,  max: 17  },
  { label: '18–24',   min: 18, max: 24  },
  { label: '25–34',   min: 25, max: 34  },
  { label: '35–44',   min: 35, max: 44  },
  { label: '45–54',   min: 45, max: 54  },
  { label: '55+',     min: 55, max: 999 },
]

// ── Persona do cliente ────────────────────────────────────────────────────────
function PersonaCliente({ clientes }: { clientes: ClienteStats[] }) {
  const comIdade = clientes
    .map((c) => ({ ...c, idade: calcularIdade(c.data_nascimento) }))
    .filter((c): c is typeof c & { idade: number } => c.idade !== null)

  if (comIdade.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">Persona do Cliente</h2>
        <p className="text-xs text-[#888888]">
          Nenhum cliente com data de nascimento cadastrada ainda.
          Preencha as datas de nascimento no PDV para visualizar a persona.
        </p>
      </Card>
    )
  }

  const idadeMedia = Math.round(comIdade.reduce((s, c) => s + c.idade, 0) / comIdade.length)
  const idadeMinima = Math.min(...comIdade.map((c) => c.idade))
  const idadeMaxima = Math.max(...comIdade.map((c) => c.idade))

  const distribuicao = FAIXAS.map((f) => {
    const count = comIdade.filter((c) => c.idade >= f.min && c.idade <= f.max).length
    return { ...f, count, pct: comIdade.length > 0 ? (count / comIdade.length) * 100 : 0 }
  })

  const faixaDominante = distribuicao.reduce((a, b) => (b.count > a.count ? b : a))

  // Perfil textual da persona
  let perfilIdade = ''
  if (idadeMedia < 20) perfilIdade = 'Jovem (adolescente/jovem adulto)'
  else if (idadeMedia < 28) perfilIdade = 'Jovem adulto (18–27 anos)'
  else if (idadeMedia < 38) perfilIdade = 'Adulto jovem (28–37 anos)'
  else if (idadeMedia < 48) perfilIdade = 'Adulto (38–47 anos)'
  else perfilIdade = 'Adulto maduro (48+ anos)'

  return (
    <Card>
      <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4 flex items-center gap-2">
        Persona do Cliente
        <span className="text-xs text-[#888888] font-normal normal-case tracking-normal">
          ({comIdade.length} de {clientes.length} com nascimento cadastrado)
        </span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lado esquerdo — números */}
        <div className="flex flex-col gap-4">
          {/* Idade média em destaque */}
          <div className="bg-[#0D0D0D] rounded-xl p-4 flex items-center gap-4">
            <div className="text-center">
              <p className="text-5xl font-black text-gold leading-none">{idadeMedia}</p>
              <p className="text-xs text-[#888888] mt-1 uppercase tracking-wide">anos</p>
            </div>
            <div>
              <p className="text-sm font-bold text-[#F0F0F0]">Idade Média</p>
              <p className="text-xs text-[#888888] mt-0.5">{perfilIdade}</p>
              <p className="text-xs text-[#555555] mt-1">
                Variação: {idadeMinima}–{idadeMaxima} anos
              </p>
            </div>
          </div>

          {/* Faixa dominante */}
          <div className="bg-[#0D0D0D] rounded-xl p-4">
            <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Faixa mais comum</p>
            <p className="text-xl font-black text-[#F0F0F0]">{faixaDominante.label} anos</p>
            <p className="text-xs text-[#888888] mt-0.5">
              {faixaDominante.count} cliente{faixaDominante.count !== 1 ? 's' : ''} — {faixaDominante.pct.toFixed(0)}% da base
            </p>
          </div>
        </div>

        {/* Lado direito — distribuição */}
        <div>
          <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-3">Distribuição por Faixa</p>
          <div className="flex flex-col gap-2.5">
            {distribuicao.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={f.label === faixaDominante.label ? 'font-bold text-gold' : 'text-[#888888]'}>
                    {f.label} anos
                  </span>
                  <span className="text-[#555555]">
                    {f.count > 0 ? `${f.count} (${f.pct.toFixed(0)}%)` : '—'}
                  </span>
                </div>
                <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      f.label === faixaDominante.label ? 'bg-gold' : 'bg-[#3A3A3A]'
                    }`}
                    style={{ width: `${f.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── Modal de detalhe do cliente ───────────────────────────────────────────────
function ClienteDetalheModal({ cliente, onClose }: { cliente: ClienteStats; onClose: () => void }) {
  const { data: vendas = [], isLoading } = useSWR(
    ['vendas-cliente', cliente.id],
    () => fetchVendasCliente(cliente.id)
  )

  const idade = calcularIdade(cliente.data_nascimento)
  const ticketMedio = cliente.total_compras > 0
    ? cliente.total_gasto / cliente.total_compras
    : 0
  const nascFormatado = cliente.data_nascimento
    ? new Date(cliente.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/20 text-gold flex items-center justify-center font-black text-lg">
              {cliente.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-[#F0F0F0]">{cliente.nome}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {badgeCliente(cliente.total_compras)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-[#F0F0F0] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Dados pessoais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-0.5">CPF</p>
              <p className="text-sm font-semibold text-[#F0F0F0]">{formatarCPF(cliente.cpf)}</p>
            </div>
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-0.5">Telefone</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#F0F0F0]">{cliente.telefone ?? '—'}</p>
                {cliente.telefone && (
                  <a
                    href={telefoneWpp(cliente.telefone, `Oi ${cliente.nome}! Tudo bem? Aqui é a HG Grifes. 😊`)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-500 hover:text-green-400"
                    title="WhatsApp"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-0.5">Data de Nascimento</p>
              <p className="text-sm font-semibold text-[#F0F0F0]">
                {nascFormatado}
                {idade !== null && <span className="text-[#888888] ml-1.5 text-xs">({idade} anos)</span>}
              </p>
            </div>
            <div className="bg-[#0D0D0D] rounded-lg p-3">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-0.5">Última Compra</p>
              <p className="text-sm font-semibold text-[#F0F0F0]">
                {cliente.ultima_compra
                  ? new Date(cliente.ultima_compra).toLocaleDateString('pt-BR')
                  : '—'}
              </p>
            </div>
          </div>

          {/* Stats de compra */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0D0D0D] rounded-lg p-3 text-center">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-1">Compras</p>
              <p className="text-xl font-black text-gold">{cliente.total_compras}</p>
            </div>
            <div className="bg-[#0D0D0D] rounded-lg p-3 text-center">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-1">Total Gasto</p>
              <p className="text-sm font-black text-gold">{formatarMoeda(cliente.total_gasto)}</p>
            </div>
            <div className="bg-[#0D0D0D] rounded-lg p-3 text-center">
              <p className="text-[10px] text-[#888888] uppercase tracking-wide font-semibold mb-1">Ticket Médio</p>
              <p className="text-sm font-black text-[#F0F0F0]">{formatarMoeda(ticketMedio)}</p>
            </div>
          </div>

          {/* Histórico de compras */}
          <div>
            <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wide mb-3">Histórico de Compras</h3>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
              </div>
            ) : vendas.length === 0 ? (
              <p className="text-sm text-[#888888]">Nenhuma compra registrada</p>
            ) : (
              <div className="flex flex-col gap-2">
                {vendas.map((v) => (
                  <div key={v.id} className="flex items-center justify-between bg-[#0D0D0D] rounded-lg px-3 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#888888]">
                        {new Date(v.criado_em).toLocaleDateString('pt-BR')}
                        {' · '}
                        {CANAL_LABEL[v.canal_venda] ?? v.canal_venda}
                        {' · '}
                        {PAGO_LABEL[v.metodo_pagamento] ?? v.metodo_pagamento}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gold">{formatarMoeda(v.total_final)}</p>
                      {v.desconto_aplicado > 0 && (
                        <p className="text-[10px] text-[#888888]">
                          de {formatarMoeda(v.subtotal)} (−{formatarMoeda(v.desconto_aplicado)})
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteStats | null>(null)

  const { data: clientes = [], isLoading } = useSWR('clientes-stats', fetchClientesStats, { refreshInterval: 60000 })
  const { data: aniversariantes = [] } = useSWR('aniversariantes', fetchAniversariantes, { refreshInterval: 3600000 })

  const hoje = new Date()
  const nomesMes = MESES[hoje.getMonth()]

  const anivHoje = aniversariantes.filter((a) => a.ehHoje)
  const anivMes  = aniversariantes.filter((a) => !a.ehHoje)

  const clientesFiltrados = clientes.filter((c) => {
    if (filtro === 'novos') return c.total_compras === 1
    if (filtro === 'fieis') return c.total_compras >= 2
    return true
  })

  const totalClientes = clientes.length
  const clientesNovos = clientes.filter((c) => c.total_compras === 1).length
  const clientesFieis = clientes.filter((c) => c.total_compras >= 2).length
  const clientesVip   = clientes.filter((c) => c.total_compras >= 5).length

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Clientes</h1>
            <a href="/dashboard" className="text-xs text-[#888888] hover:text-gold transition-colors">← Dashboard</a>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Clientes',   valor: totalClientes },
            { label: 'Compraram 1x',     valor: clientesNovos },
            { label: 'Recorrentes',      valor: clientesFieis },
            { label: 'VIP (5+ compras)', valor: clientesVip  },
          ].map((k) => (
            <Card key={k.label} hover className="flex flex-col gap-1">
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">{k.label}</p>
              <p className="text-2xl font-black text-gold">{k.valor}</p>
            </Card>
          ))}
        </div>

        {/* Persona */}
        {!isLoading && <PersonaCliente clientes={clientes} />}

        {/* Aniversariantes */}
        {aniversariantes.length > 0 && (
          <div className="flex flex-col gap-3">
            {anivHoje.length > 0 && (
              <Card className="border-gold/40 bg-gold/5">
                <h2 className="text-sm font-bold text-gold uppercase tracking-wide mb-3 flex items-center gap-2">
                  🎂 Aniversário Hoje!
                  <Badge variant="warning">{anivHoje.length}</Badge>
                </h2>
                <div className="flex flex-col gap-2">
                  {anivHoje.map((a) => (
                    <div key={a.id} className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#F0F0F0]">{a.nome}</p>
                        <p className="text-xs text-[#888888]">
                          {String(a.dia).padStart(2,'0')}/{String(hoje.getMonth()+1).padStart(2,'0')}
                          {a.telefone && <> · {a.telefone}</>}
                        </p>
                      </div>
                      {a.telefone && (
                        <a
                          href={telefoneWpp(a.telefone, msgAniversario(a.nome))}
                          target="_blank" rel="noreferrer"
                          className="text-xs font-bold px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Mandar mensagem
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {anivMes.length > 0 && (
              <Card>
                <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-3 flex items-center gap-2">
                  🎁 Aniversariantes de {nomesMes}
                  <Badge variant="default">{anivMes.length}</Badge>
                </h2>
                <div className="flex flex-col gap-2">
                  {anivMes.map((a) => (
                    <div key={a.id} className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#F0F0F0]">{a.nome}</p>
                        <p className="text-xs text-[#888888]">
                          Dia {String(a.dia).padStart(2,'0')}
                          {a.telefone && <> · {a.telefone}</>}
                        </p>
                      </div>
                      {a.telefone && (
                        <a
                          href={telefoneWpp(a.telefone, msgAniversario(a.nome))}
                          target="_blank" rel="noreferrer"
                          className="text-xs font-semibold px-2.5 py-1 rounded border border-green-600/50 text-green-500 hover:bg-green-600/10 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Filtro + Ranking */}
        <Card>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">Ranking de Clientes</h2>
              <p className="text-xs text-[#888888] mt-0.5">Clique em um cliente para ver os detalhes</p>
            </div>
            <div className="flex rounded overflow-hidden border border-[#2A2A2A]">
              {([
                { value: 'todos', label: 'Todos' },
                { value: 'novos', label: '1x' },
                { value: 'fieis', label: '2+ vezes' },
              ] as { value: Filtro; label: string }[]).map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFiltro(f.value)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filtro === f.value ? 'bg-gold text-[#0D0D0D]' : 'bg-transparent text-[#888888] hover:text-gold'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <p className="text-sm text-[#888888] py-6 text-center">Nenhum cliente encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    <th className="text-left pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">#</th>
                    <th className="text-left pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Cliente</th>
                    <th className="text-center pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Compras</th>
                    <th className="text-right pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Total Gasto</th>
                    <th className="text-left pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Última Compra</th>
                    <th className="text-center pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Perfil</th>
                    <th className="text-center pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c, i) => (
                    <tr
                      key={c.id}
                      onClick={() => setClienteSelecionado(c)}
                      className="border-b border-[#2A2A2A]/50 hover:bg-[#222222] transition-colors cursor-pointer"
                    >
                      <td className="py-3 pr-3 text-xs text-[#555555] font-bold">{i + 1}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-[#F0F0F0]">{c.nome}</p>
                        {c.telefone && <p className="text-xs text-[#888888]">{c.telefone}</p>}
                      </td>
                      <td className="py-3 text-center font-bold text-[#F0F0F0]">{c.total_compras}</td>
                      <td className="py-3 text-right font-bold text-gold">{formatarMoeda(c.total_gasto)}</td>
                      <td className="py-3 text-xs text-[#888888]">
                        {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="py-3 text-center">{badgeCliente(c.total_compras)}</td>
                      <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {c.telefone ? (
                          <a
                            href={telefoneWpp(c.telefone, `Oi ${c.nome}! Tudo bem? Aqui é a HG Grifes. 😊`)}
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-600/20 text-green-500 hover:bg-green-600/40 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        ) : (
                          <span className="text-xs text-[#555555]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>

      {/* Modal de detalhe */}
      {clienteSelecionado && (
        <ClienteDetalheModal
          cliente={clienteSelecionado}
          onClose={() => setClienteSelecionado(null)}
        />
      )}
    </div>
  )
}
