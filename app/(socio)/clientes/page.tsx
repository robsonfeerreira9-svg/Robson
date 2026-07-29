'use client'

import { useState, useEffect } from 'react'
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

interface ComportamentoStats {
  canal: Record<string, number>
  pagamento: Record<string, number>
  totalVendas: number
  ticketMedioGeral: number
}

async function fetchComportamento(): Promise<ComportamentoStats> {
  const supabase = createClient()
  const { data } = await supabase.from('vendas').select('canal_venda, metodo_pagamento, total_final')
  const canal: Record<string, number> = {}
  const pagamento: Record<string, number> = {}
  let totalReceita = 0
  for (const v of data ?? []) {
    canal[v.canal_venda] = (canal[v.canal_venda] || 0) + 1
    pagamento[v.metodo_pagamento] = (pagamento[v.metodo_pagamento] || 0) + 1
    totalReceita += v.total_final
  }
  const totalVendas = data?.length ?? 0
  return { canal, pagamento, totalVendas, ticketMedioGeral: totalVendas > 0 ? totalReceita / totalVendas : 0 }
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
  return `Parabéns ${nome}! 🥳 Hoje é o seu dia especial e a nossa loja preparou um presente exclusivo para você! 🎉\n\n*Você ganhou 20% de DESCONTO* em qualquer peça da loja, válido exclusivamente para o dia de hoje! Não dá para perder essa chance de se mimar. 🎁\n\n👇 Estou enviando abaixo os modelos incríveis que acabaram de chegar no seu tamanho para você dar uma olhada:\n[Carregar fotos do estoque]`
}

function msgCampanhaTenis(nome: string) {
  return `Oi ${nome}! 👟✨\n\nOlha, separei essa mensagem porque ela é *extremamente especial* para você! ⚠️ *A HG ENLOUQUECEU de vez!* ⚠️\n\nA partir de AGORA, *TODOS os tênis nacionais do nosso estoque estão saindo com 50% de DESCONTO!* Sim, metade do preço original! É a oportunidade perfeita para você garantir aquele modelo que estava namorando. 👟🔥\n\n👇 Dá uma olhada nos modelos que separei especialmente para você e corre, porque o estoque vai zerar rápido:\n[Carregar fotos dos tênis em estoque]\n\nResponde aqui que eu te atendo na hora! 😉`
}

function badgeCliente(compras: number) {
  if (compras >= 5) return <Badge variant="warning">VIP</Badge>
  if (compras >= 2) return <Badge variant="default">Fiel</Badge>
  return <span className="text-xs text-[#555555] font-semibold">Novo</span>
}

function calcularIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null
  // Suporta YYYY-MM-DD (ISO) e DD/MM/YYYY (brasileiro)
  let nasc: Date
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataNasc)) {
    const [d, m, y] = dataNasc.split('/')
    nasc = new Date(`${y}-${m}-${d}T12:00:00`)
  } else {
    nasc = new Date(dataNasc + (dataNasc.includes('T') ? '' : 'T12:00:00'))
  }
  if (isNaN(nasc.getTime())) return null
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  // Descarta idades fora do intervalo razoável (evita dados corrompidos)
  if (idade < 5 || idade > 100) return null
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

function WppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function diasDesdeUltimaCompra(ultimaCompra: string | null): number | null {
  if (!ultimaCompra) return null
  return Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / (1000 * 60 * 60 * 24))
}

function msgReativacao(nome: string) {
  return `Oi ${nome}! Tudo bem? 💛 Sentimos sua falta aqui na HG Grifes! Passando pra avisar que chegaram novidades incríveis. Que tal dar uma olhadinha? 🛍️`
}

// ── Modelos de mensagem WPP ───────────────────────────────────────────────────
const MSG_ANIVERSARIO_TEMPLATE = `Parabéns! 🥳 Hoje é o seu dia especial e a nossa loja preparou um presente exclusivo para você! 🎉

*Você ganhou 20% de DESCONTO* em qualquer peça da loja, válido exclusivamente para o dia de hoje! Não dá para perder essa chance de se mimar. 🎁

👇 Estou enviando abaixo os modelos incríveis que acabaram de chegar no seu tamanho para você dar uma olhada:
[Carregar fotos do estoque]`

const MSG_CAMPANHA_TENIS = `Olha, separei essa mensagem porque ela é extremamente especial para você! ⚠️ *A HG ENLOUQUECEU de vez!* ⚠️

A partir de AGORA, *TODOS os tênis nacionais do nosso estoque estão saindo com 50% de DESCONTO!* Sim, metade do preço original! É a oportunidade perfeita para você garantir aquele modelo que estava namorando. 👟

👇 Dá uma olhada nos modelos que separei para você e corre, porque o estoque vai zerar rápido:
[Carregar fotos dos tênis em estoque]`

const TEMPLATES_PADRAO = [
  { key: 'aniversario', label: '🎂 Aniversário 20% OFF', texto: MSG_ANIVERSARIO_TEMPLATE },
  { key: 'tenis',       label: '👟 Campanha Tênis 50%',  texto: MSG_CAMPANHA_TENIS },
]

function ModelosMensagem() {
  const [copiado, setCopiado] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({
    aniversario: MSG_ANIVERSARIO_TEMPLATE,
    tenis: MSG_CAMPANHA_TENIS,
  })

  async function copiar(key: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(key)
      setTimeout(() => setCopiado(null), 2500)
    } catch {
      const el = document.createElement('textarea')
      el.value = texto
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiado(key)
      setTimeout(() => setCopiado(null), 2500)
    }
  }

  const modelos = [
    {
      key: 'aniversario',
      titulo: '🎂 Aniversariantes do Dia',
      subtitulo: 'Dispara para clientes que fazem aniversário hoje — inclui 20% OFF',
      cor: 'border-gold/30 bg-gold/5',
      corBotao: 'bg-gold text-[#0D0D0D] hover:bg-[#D4A800]',
    },
    {
      key: 'tenis',
      titulo: '👟 Campanha Tênis 50% OFF',
      subtitulo: 'Queima de estoque — enviado para toda a base de clientes',
      cor: 'border-green-500/30 bg-green-500/5',
      corBotao: 'bg-green-600 text-white hover:bg-green-500',
    },
  ]

  return (
    <Card>
      <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-1 flex items-center gap-2">
        📣 Modelos de Mensagem
      </h2>
      <p className="text-xs text-[#888888] mb-4">Copie e cole no WhatsApp — edite o nome e adicione as fotos antes de enviar.</p>
      <div className="flex flex-col gap-4">
        {modelos.map((m) => (
          <div key={m.key} className={`border rounded-xl p-4 ${m.cor}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-[#F0F0F0]">{m.titulo}</p>
                <p className="text-xs text-[#888888] mt-0.5">{m.subtitulo}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditando(editando === m.key ? null : m.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#3A3A3A] text-[#888888] hover:text-[#F0F0F0] hover:border-[#555555] transition-colors"
                >
                  {editando === m.key ? 'Fechar' : 'Editar'}
                </button>
                <button
                  onClick={() => copiar(m.key, textos[m.key])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${m.corBotao}`}
                >
                  {copiado === m.key ? '✓ Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
            {editando === m.key ? (
              <textarea
                value={textos[m.key]}
                onChange={(e) => setTextos((prev) => ({ ...prev, [m.key]: e.target.value }))}
                rows={8}
                className="w-full text-[11px] text-[#F0F0F0] bg-[#0D0D0D] rounded-lg p-3 font-sans leading-relaxed border border-[#3A3A3A] focus:outline-none focus:border-gold resize-y"
              />
            ) : (
              <pre className="text-[11px] text-[#888888] whitespace-pre-wrap leading-relaxed bg-[#0D0D0D] rounded-lg p-3 font-sans">
                {textos[m.key]}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Clientes inativos ─────────────────────────────────────────────────────────
function ClientesInativos({ clientes }: { clientes: ClienteStats[] }) {
  const [limiar, setLimiar] = useState<30 | 60 | 90>(30)

  // Só clientes que já compraram e estão inativos há X dias
  const inativos = clientes
    .map((c) => ({ ...c, dias: diasDesdeUltimaCompra(c.ultima_compra) }))
    .filter((c): c is typeof c & { dias: number } => c.dias !== null && c.dias >= limiar)
    .sort((a, b) => b.dias - a.dias)

  function corBadge(dias: number) {
    if (dias >= 90) return 'text-[#FF4444] border-[#FF4444]/40 bg-[#FF4444]/10'
    if (dias >= 60) return 'text-orange-400 border-orange-400/40 bg-orange-400/10'
    return 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10'
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide flex items-center gap-2">
            Clientes para Reativar
            {inativos.length > 0 && (
              <span className="text-xs font-bold text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/30 px-1.5 py-0.5 rounded">
                {inativos.length}
              </span>
            )}
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">Compraram mas não voltaram há {limiar}+ dias</p>
        </div>
        {/* Toggle de limiar */}
        <div className="flex rounded overflow-hidden border border-[#2A2A2A]">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setLimiar(d)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                limiar === d ? 'bg-gold text-[#0D0D0D]' : 'bg-transparent text-[#888888] hover:text-gold'
              }`}
            >
              {d}+ dias
            </button>
          ))}
        </div>
      </div>

      {inativos.length === 0 ? (
        <p className="text-xs text-[#888888] py-2">Nenhum cliente inativo há {limiar}+ dias.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {inativos.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 bg-[#0D0D0D] rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#F0F0F0] truncate">{c.nome}</p>
                <p className="text-xs text-[#888888]">
                  Última compra: {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('pt-BR') : '—'}
                  {c.telefone && <> · {c.telefone}</>}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border flex-shrink-0 ${corBadge(c.dias)}`}>
                {c.dias}d
              </span>
              {c.telefone ? (
                <a
                  href={telefoneWpp(c.telefone, msgReativacao(c.nome))}
                  target="_blank" rel="noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded bg-green-600/20 text-green-500 hover:bg-green-600/40 border border-green-600/30 transition-colors"
                >
                  <WppIcon size={12} /> Chamar
                </a>
              ) : (
                <span className="text-xs text-[#555555] flex-shrink-0">Sem tel.</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

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
  const { data: comportamento } = useSWR('comportamento-vendas', fetchComportamento)

  const comIdade = clientes
    .map((c) => ({ ...c, idade: calcularIdade(c.data_nascimento) }))
    .filter((c): c is typeof c & { idade: number } => c.idade !== null)

  const idadeMedia = comIdade.length > 0
    ? Math.round(comIdade.reduce((s, c) => s + c.idade, 0) / comIdade.length)
    : null
  const idadeMinima = comIdade.length > 0 ? Math.min(...comIdade.map((c) => c.idade)) : null
  const idadeMaxima = comIdade.length > 0 ? Math.max(...comIdade.map((c) => c.idade)) : null

  const distribuicao = FAIXAS.map((f) => {
    const count = comIdade.filter((c) => c.idade >= f.min && c.idade <= f.max).length
    return { ...f, count, pct: comIdade.length > 0 ? (count / comIdade.length) * 100 : 0 }
  })

  const faixaDominante = distribuicao.length > 0 ? distribuicao.reduce((a, b) => (b.count > a.count ? b : a)) : null

  let perfilIdade = ''
  if (idadeMedia !== null) {
    if (idadeMedia < 20) perfilIdade = 'Jovem (adolescente/jovem adulto)'
    else if (idadeMedia < 28) perfilIdade = 'Jovem adulto (18–27 anos)'
    else if (idadeMedia < 38) perfilIdade = 'Adulto jovem (28–37 anos)'
    else if (idadeMedia < 48) perfilIdade = 'Adulto (38–47 anos)'
    else perfilIdade = 'Adulto maduro (48+ anos)'
  }

  const CANAL_CORES: Record<string, string> = { fisico: 'bg-gold', whatsapp: 'bg-green-500', instagram: 'bg-purple-400' }
  const PAGO_CORES: Record<string, string> = { pix: 'bg-blue-400', credito: 'bg-indigo-400', debito: 'bg-cyan-400', dinheiro: 'bg-emerald-400' }

  function barrasComportamento(mapa: Record<string, number>, cores: Record<string, string>, labels: Record<string, string>) {
    const total = Object.values(mapa).reduce((a, b) => a + b, 0)
    if (total === 0) return null
    return Object.entries(mapa)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => {
        const pct = (count / total) * 100
        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#888888]">{labels[key] ?? key}</span>
              <span className="text-[#555555]">{count} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${cores[key] ?? 'bg-[#3A3A3A]'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })
  }

  if (comIdade.length === 0 && !comportamento) {
    return (
      <Card>
        <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">Persona do Cliente</h2>
        <p className="text-xs text-[#888888]">
          Nenhum cliente com data de nascimento cadastrada ainda. Preencha as datas de nascimento no PDV para visualizar a persona.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-4 flex items-center gap-2">
        Persona do Cliente
        {comIdade.length > 0 && (
          <span className="text-xs text-[#888888] font-normal normal-case tracking-normal">
            ({comIdade.length} de {clientes.length} com nascimento cadastrado)
          </span>
        )}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lado esquerdo — idade */}
        <div className="flex flex-col gap-4">
          {idadeMedia !== null ? (
            <>
              <div className="bg-[#0D0D0D] rounded-xl p-4 flex items-center gap-4">
                <div className="text-center">
                  <p className="text-5xl font-black text-gold leading-none">{idadeMedia}</p>
                  <p className="text-xs text-[#888888] mt-1 uppercase tracking-wide">anos</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F0F0F0]">Idade Média</p>
                  <p className="text-xs text-[#888888] mt-0.5">{perfilIdade}</p>
                  <p className="text-xs text-[#555555] mt-1">Variação: {idadeMinima}–{idadeMaxima} anos</p>
                </div>
              </div>
              {faixaDominante && (
                <div className="bg-[#0D0D0D] rounded-xl p-4">
                  <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Faixa mais comum</p>
                  <p className="text-xl font-black text-[#F0F0F0]">{faixaDominante.label} anos</p>
                  <p className="text-xs text-[#888888] mt-0.5">
                    {faixaDominante.count} cliente{faixaDominante.count !== 1 ? 's' : ''} — {faixaDominante.pct.toFixed(0)}% da base
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#0D0D0D] rounded-xl p-4">
              <p className="text-xs text-[#888888]">Sem dados de nascimento. Preencha no PDV.</p>
            </div>
          )}

          {/* Ticket médio geral */}
          {comportamento && comportamento.totalVendas > 0 && (
            <div className="bg-[#0D0D0D] rounded-xl p-4">
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Ticket Médio Geral</p>
              <p className="text-2xl font-black text-gold">{formatarMoeda(comportamento.ticketMedioGeral)}</p>
              <p className="text-xs text-[#555555] mt-0.5">{comportamento.totalVendas} vendas totais</p>
            </div>
          )}
        </div>

        {/* Lado direito — distribuição etária + canal + pagamento */}
        <div className="flex flex-col gap-4">
          {comIdade.length > 0 && (
            <div>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-3">Distribuição por Faixa Etária</p>
              <div className="flex flex-col gap-2.5">
                {distribuicao.map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={faixaDominante && f.label === faixaDominante.label ? 'font-bold text-gold' : 'text-[#888888]'}>
                        {f.label} anos
                      </span>
                      <span className="text-[#555555]">
                        {f.count > 0 ? `${f.count} (${f.pct.toFixed(0)}%)` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          faixaDominante && f.label === faixaDominante.label ? 'bg-gold' : 'bg-[#3A3A3A]'
                        }`}
                        style={{ width: `${f.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {comportamento && (
            <>
              <div>
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-3">Canal de Vendas</p>
                <div className="flex flex-col gap-2.5">
                  {barrasComportamento(comportamento.canal, CANAL_CORES, CANAL_LABEL)}
                </div>
              </div>
              <div>
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-3">Método de Pagamento</p>
                <div className="flex flex-col gap-2.5">
                  {barrasComportamento(comportamento.pagamento, PAGO_CORES, PAGO_LABEL)}
                </div>
              </div>
            </>
          )}
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

// ── Modal de Campanha ─────────────────────────────────────────────────────────
// ── Modal Configurar WhatsApp (Z-API) ────────────────────────────────────────
function ConfigWppModal({ onClose }: { onClose: () => void }) {
  const [instanceId,  setInstanceId]  = useState('')
  const [token,       setToken]       = useState('')
  const [clientToken, setClientToken] = useState('')
  const [salvando,    setSalvando]    = useState(false)
  const [msg,         setMsg]         = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Carrega valores existentes
  useEffect(() => {
    fetch('/api/configuracoes')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.ZAPI_INSTANCE_ID)  setInstanceId(cfg.ZAPI_INSTANCE_ID)
        if (cfg.ZAPI_TOKEN)        setToken(cfg.ZAPI_TOKEN)
        if (cfg.ZAPI_CLIENT_TOKEN) setClientToken(cfg.ZAPI_CLIENT_TOKEN)
      })
      .catch(() => {})
  }, [])

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    const res = await fetch('/api/configuracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ZAPI_INSTANCE_ID:  instanceId.trim(),
        ZAPI_TOKEN:        token.trim(),
        ZAPI_CLIENT_TOKEN: clientToken.trim(),
      }),
    })
    setSalvando(false)
    if (res.ok) {
      setMsg({ tipo: 'ok', texto: '✅ Credenciais salvas! Campanha pronta para envio.' })
    } else {
      const d = await res.json().catch(() => ({}))
      setMsg({ tipo: 'erro', texto: `Erro: ${d.error ?? 'desconhecido'}` })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
          <div>
            <h2 className="font-bold text-[#F0F0F0]">⚙️ Configurar WhatsApp</h2>
            <p className="text-xs text-[#888888] mt-0.5">Credenciais Z-API para envio automático</p>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-[#F0F0F0]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <>
            <div>
              <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide block mb-1.5">Instance ID</label>
                <input
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="Ex: 3F6D0EBC6CADA21029F252B7684F8B2A"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] font-mono focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide block mb-1.5">Token</label>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Ex: 9C9CF55B9B6FE700C6A751A0"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] font-mono focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide block mb-1.5">
                  Client-Token
                  <span className="text-[#555555] ml-1 normal-case font-normal">(opcional)</span>
                </label>
                <input
                  value={clientToken}
                  onChange={(e) => setClientToken(e.target.value)}
                  placeholder="Opcional — deixe em branco se não tiver"
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] font-mono focus:outline-none focus:border-gold"
                />
                <p className="text-[10px] text-[#555555] mt-1">
                  Se existir, fica no ícone do perfil do z-api.io. Contas mais novas podem não ter este campo.
                </p>
              </div>

              {msg && (
                <p className={`text-sm font-semibold rounded-lg px-3 py-2 ${msg.tipo === 'ok' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                  {msg.texto}
                </p>
              )}

              <button
                onClick={salvar}
                disabled={salvando || !instanceId || !token}
                className="w-full py-2.5 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {salvando ? 'Salvando...' : 'Salvar e Ativar'}
              </button>
          </>
        </div>
      </div>
    </div>
  )
}

type StatusEnvio = 'aguardando' | 'enviando' | 'ok' | 'erro'

interface MidiaItem {
  url: string
  tipo: 'image' | 'video'
  nome: string
  preview?: string // object URL para imagens
}

const OPCOES_COMPRAS = [
  { valor: 1,  label: '1x' },
  { valor: 2,  label: '2x' },
  { valor: 3,  label: '3x' },
  { valor: 4,  label: '4x' },
  { valor: -1, label: '5x+' },
]

function CampanhaModal({
  clientes,
  onClose,
}: {
  clientes: ClienteStats[]
  onClose: () => void
}) {
  const [msgTemplate, setMsgTemplate] = useState('personalizada')
  const [msgTexto, setMsgTexto] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState<Record<string, StatusEnvio>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [apiDisponivel, setApiDisponivel] = useState<boolean | null>(null)
  const [midias, setMidias] = useState<MidiaItem[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [filtroAniversario, setFiltroAniversario] = useState(false)
  const [filtroCompras, setFiltroCompras] = useState<number[]>([])

  const mesAtual = new Date().getMonth() + 1

  // Aplica filtros de aniversário e compras antes do filtro de busca
  const clientesComFiltros = clientes.filter((c) => {
    if (!c.telefone) return false
    if (filtroAniversario) {
      if (!c.data_nascimento) return false
      const d = new Date(c.data_nascimento + 'T12:00:00')
      if (d.getMonth() + 1 !== mesAtual) return false
    }
    if (filtroCompras.length > 0) {
      const match = filtroCompras.some((f) => f === -1 ? c.total_compras >= 5 : c.total_compras === f)
      if (!match) return false
    }
    return true
  })

  const clientesFiltrados = clientesComFiltros.filter((c) =>
    busca === '' || c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function toggleCliente(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleFiltroCompras(valor: number) {
    setFiltroCompras((prev) =>
      prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]
    )
  }

  function selecionarTodos() {
    setSelecionados(new Set(clientesFiltrados.map((c) => c.id)))
  }

  function desmarcarTodos() {
    setSelecionados(new Set())
  }

  function aplicarTemplate(key: string) {
    setMsgTemplate(key)
    const t = TEMPLATES_PADRAO.find((t) => t.key === key)
    if (t) setMsgTexto(t.texto)
    else setMsgTexto('')
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadando(true)
    const supabase = createClient()
    const novas: MidiaItem[] = []

    for (const file of Array.from(files)) {
      const tipo: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image'
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_')
      const path = `${Date.now()}_${safeName}`

      const { error } = await supabase.storage
        .from('campanhas')
        .upload(path, file, { upsert: true })

      if (error) {
        console.error('Upload erro:', error.message)
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from('campanhas').getPublicUrl(path)
      const preview = tipo === 'image' ? URL.createObjectURL(file) : undefined
      novas.push({ url: publicUrl, tipo, nome: file.name, preview })
    }

    setMidias((prev) => [...prev, ...novas])
    setUploadando(false)
  }

  function removerMidia(index: number) {
    setMidias((prev) => {
      const next = [...prev]
      if (next[index].preview) URL.revokeObjectURL(next[index].preview!)
      next.splice(index, 1)
      return next
    })
  }

  const clientesSelecionados = clientes.filter((c) => selecionados.has(c.id))

  function msgParaCliente(nome: string) {
    return msgTexto.replace(/\{nome\}/gi, nome)
  }

  const totalSelecionados = selecionados.size
  const totalEnviados   = Object.values(status).filter((s) => s === 'ok').length
  const totalErros      = Object.values(status).filter((s) => s === 'erro').length
  const totalProcessado = totalEnviados + totalErros
  const concluido       = enviando && totalProcessado >= clientesSelecionados.length

  async function iniciarEnvio() {
    setEnviando(true)
    setStatus({})
    setErros({})

    let primeiroChecked = false

    for (const cliente of clientesSelecionados) {
      setStatus((prev) => ({ ...prev, [cliente.id]: 'enviando' }))

      const res = await fetch('/api/campanha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: cliente.telefone,
          mensagem: msgParaCliente(cliente.nome),
          midias: midias.map((m) => ({ url: m.url, tipo: m.tipo })),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!primeiroChecked) {
        primeiroChecked = true
        if (res.status === 503) {
          setApiDisponivel(false)
          setEnviando(false)
          setStatus({})
          return
        }
        setApiDisponivel(true)
      }

      if (res.ok) {
        setStatus((prev) => ({ ...prev, [cliente.id]: 'ok' }))
      } else {
        setStatus((prev) => ({ ...prev, [cliente.id]: 'erro' }))
        setErros((prev) => ({ ...prev, [cliente.id]: data?.error ?? 'Erro desconhecido' }))
      }

      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl flex flex-col my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
          <div>
            <h2 className="font-bold text-[#F0F0F0] text-base">📣 Nova Campanha</h2>
            <p className="text-xs text-[#888888] mt-0.5">Selecione os clientes e personalize a mensagem</p>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-[#F0F0F0] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* Aviso API não configurada */}
          {apiDisponivel === false && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-sm font-bold text-[#F59E0B]">⚠️ WhatsApp API não configurada</p>
              <p className="text-xs text-[#888888]">Para envio automático, adicione as variáveis abaixo nos <strong>GitHub Secrets</strong> e faça um novo deploy:</p>
              <ul className="text-xs text-[#F0F0F0] font-mono bg-[#0D0D0D] rounded-lg p-3 flex flex-col gap-1">
                <li>ZAPI_INSTANCE_ID</li>
                <li>ZAPI_TOKEN</li>
                <li>ZAPI_CLIENT_TOKEN</li>
              </ul>
              <p className="text-xs text-[#888888]">Crie uma conta em <strong>z-api.io</strong>, conecte o número da loja escaneando o QR Code e copie as credenciais.</p>
            </div>
          )}

          {!enviando ? (
            <>
              {/* Mensagem */}
              <div>
                <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide block mb-2">Mensagem</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  <button
                    onClick={() => aplicarTemplate('personalizada')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${msgTemplate === 'personalizada' ? 'border-gold text-gold bg-gold/10' : 'border-[#3A3A3A] text-[#888888] hover:border-[#555555]'}`}
                  >
                    Personalizada
                  </button>
                  {TEMPLATES_PADRAO.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => aplicarTemplate(t.key)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${msgTemplate === t.key ? 'border-gold text-gold bg-gold/10' : 'border-[#3A3A3A] text-[#888888] hover:border-[#555555]'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={msgTexto}
                  onChange={(e) => setMsgTexto(e.target.value)}
                  placeholder="Digite a mensagem... Use {nome} para personalizar com o nome do cliente."
                  rows={5}
                  className="w-full text-sm text-[#F0F0F0] bg-[#0D0D0D] rounded-lg p-3 border border-[#3A3A3A] focus:outline-none focus:border-gold resize-y font-sans leading-relaxed"
                />
                <p className="text-[10px] text-[#555555] mt-1">Use <span className="text-gold">{'{nome}'}</span> para personalizar com o nome de cada cliente.</p>
              </div>

              {/* Upload de Mídias */}
              <div>
                <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide block mb-2">
                  Fotos e Vídeos
                  <span className="text-[#555555] ml-1 normal-case font-normal">(opcional — enviados após a mensagem)</span>
                </label>
                {midias.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {midias.map((m, i) => (
                      <div key={i} className="relative group">
                        {m.tipo === 'image' && m.preview ? (
                          <img src={m.preview} alt={m.nome} className="w-16 h-16 object-cover rounded-lg border border-[#3A3A3A]" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg border border-[#3A3A3A] bg-[#0D0D0D] flex flex-col items-center justify-center gap-0.5">
                            <span className="text-xl">🎥</span>
                            <span className="text-[9px] text-[#555555] truncate w-14 text-center px-1">{m.nome}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removerMidia(i)}
                          className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none w-5 h-5"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#3A3A3A] text-xs text-[#888888] cursor-pointer hover:border-gold hover:text-gold transition-colors ${uploadando ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={uploadando}
                  />
                  {uploadando ? '⏳ Enviando arquivos...' : '+ Adicionar fotos ou vídeos'}
                </label>
              </div>

              {/* Filtros */}
              <div>
                <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide block mb-2">Filtrar Clientes</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroAniversario((v) => !v)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${filtroAniversario ? 'border-gold text-gold bg-gold/10' : 'border-[#3A3A3A] text-[#888888] hover:border-[#555555]'}`}
                  >
                    🎂 Aniversariantes do mês
                  </button>
                  {OPCOES_COMPRAS.map((op) => (
                    <button
                      key={op.valor}
                      onClick={() => toggleFiltroCompras(op.valor)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${filtroCompras.includes(op.valor) ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-[#3A3A3A] text-[#888888] hover:border-[#555555]'}`}
                    >
                      {op.label}
                    </button>
                  ))}
                  {(filtroAniversario || filtroCompras.length > 0) && (
                    <button
                      onClick={() => { setFiltroAniversario(false); setFiltroCompras([]) }}
                      className="px-2.5 py-1 rounded text-xs font-semibold border border-[#3A3A3A] text-[#555555] hover:text-danger hover:border-danger transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Seleção de clientes */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                  <label className="text-xs text-[#888888] font-semibold uppercase tracking-wide">
                    Clientes com telefone
                    <span className="text-gold ml-1">({clientesComFiltros.length})</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={selecionarTodos} className="text-xs px-2.5 py-1 rounded border border-[#3A3A3A] text-[#888888] hover:text-gold hover:border-gold transition-colors">
                      Selecionar visíveis
                    </button>
                    {totalSelecionados > 0 && (
                      <button onClick={desmarcarTodos} className="text-xs px-2.5 py-1 rounded border border-[#3A3A3A] text-[#888888] hover:text-danger hover:border-danger transition-colors">
                        Desmarcar tudo
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full mb-2 bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] placeholder-[#555555] focus:outline-none focus:border-gold"
                />
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] p-2">
                  {clientesFiltrados.length === 0 ? (
                    <p className="text-xs text-[#555555] p-2">Nenhum cliente encontrado com esses filtros</p>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 p-2 rounded hover:bg-[#1A1A1A] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selecionados.has(c.id)}
                          onChange={() => toggleCliente(c.id)}
                          className="accent-gold w-3.5 h-3.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F0F0F0] font-semibold truncate">{c.nome}</p>
                          <p className="text-xs text-[#555555]">{c.telefone}</p>
                        </div>
                        <span className="text-xs text-[#555555]">{c.total_compras}x</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Rodapé */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#2A2A2A]">
                <div>
                  <p className="text-sm text-[#888888]">
                    {totalSelecionados > 0
                      ? <span className="text-[#F0F0F0] font-bold">{totalSelecionados} cliente{totalSelecionados !== 1 ? 's' : ''}</span>
                      : 'Nenhum selecionado'}
                  </p>
                  {midias.length > 0 && (
                    <p className="text-[10px] text-[#888888]">{midias.length} mídia{midias.length !== 1 ? 's' : ''} anexada{midias.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <button
                  onClick={iniciarEnvio}
                  disabled={totalSelecionados === 0 || msgTexto.trim() === '' || uploadando}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <WppIcon size={14} />
                  Disparar Campanha
                </button>
              </div>
            </>
          ) : (
            /* Tela de progresso de envio */
            <div className="flex flex-col gap-4">
              <div className="text-center py-2">
                <p className="text-lg font-black text-[#F0F0F0]">
                  {concluido
                    ? `✅ Concluído — ${totalEnviados} enviado${totalEnviados !== 1 ? 's' : ''}${totalErros > 0 ? `, ${totalErros} com erro` : ''}`
                    : `Enviando... ${totalProcessado} de ${clientesSelecionados.length}`}
                </p>
                <p className="text-xs text-[#888888] mt-1">
                  {concluido ? 'Campanha finalizada.' : 'Aguarde — enviando 1 a cada 1,5s para não ser bloqueado.'}
                </p>
                <div className="mt-3 h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: clientesSelecionados.length > 0 ? `${(totalProcessado / clientesSelecionados.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {clientesSelecionados.map((c) => {
                  const s = status[c.id] ?? 'aguardando'
                  return (
                    <div key={c.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                      s === 'ok'      ? 'border-green-600/30 bg-green-600/10'
                      : s === 'erro'  ? 'border-red-600/30 bg-red-600/10'
                      : s === 'enviando' ? 'border-gold/40 bg-gold/5'
                      : 'border-[#2A2A2A] bg-[#0D0D0D]'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${s === 'ok' ? 'text-[#555555]' : 'text-[#F0F0F0]'}`}>{c.nome}</p>
                        {s === 'erro' && erros[c.id] && (
                          <p className="text-[10px] text-red-400 mt-0.5 truncate">{erros[c.id]}</p>
                        )}
                        {s !== 'erro' && <p className="text-xs text-[#555555]">{c.telefone}</p>}
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${
                        s === 'ok'       ? 'text-green-500'
                        : s === 'erro'   ? 'text-red-400'
                        : s === 'enviando' ? 'text-gold'
                        : 'text-[#555555]'
                      }`}>
                        {s === 'ok' ? '✓ Enviado' : s === 'erro' ? '✗ Erro' : s === 'enviando' ? '⏳ Enviando…' : 'Aguardando'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {concluido && (
                <button onClick={onClose} className="w-full py-2 rounded-lg bg-gold text-[#0D0D0D] text-sm font-bold hover:bg-[#D4A800] transition-colors">
                  Fechar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteStats | null>(null)
  const [showCampanha, setShowCampanha] = useState(false)
  const [showConfigWpp, setShowConfigWpp] = useState(false)

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfigWpp(true)}
              title="Configurar WhatsApp"
              className="px-3 py-2 rounded-lg border border-[#2A2A2A] text-[#888888] text-sm hover:border-gold hover:text-gold transition-colors"
            >
              ⚙️
            </button>
            <button
              onClick={() => setShowCampanha(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-600 transition-colors"
            >
              <WppIcon size={14} />
              Campanha
            </button>
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

        {/* Aniversariantes — sempre visível */}
        <div className="flex flex-col gap-3">
          {/* Hoje */}
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
                      <a href={telefoneWpp(a.telefone, msgAniversario(a.nome))} target="_blank" rel="noreferrer"
                        className="text-xs font-bold px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-1.5">
                        <WppIcon size={14} /> Mandar mensagem
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Mês inteiro */}
          <Card>
            <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide mb-3 flex items-center gap-2">
              🎁 Aniversariantes de {nomesMes}
              {anivMes.length > 0 && <Badge variant="default">{anivMes.length}</Badge>}
            </h2>
            {aniversariantes.length === 0 ? (
              <p className="text-xs text-[#888888]">Nenhum aniversariante este mês.</p>
            ) : anivMes.length === 0 ? (
              <p className="text-xs text-[#888888]">Todos os aniversariantes de {nomesMes} já foram listados acima.</p>
            ) : (
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
                      <a href={telefoneWpp(a.telefone, msgAniversario(a.nome))} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold px-2.5 py-1 rounded border border-green-600/50 text-green-500 hover:bg-green-600/10 transition-colors flex items-center gap-1.5">
                        <WppIcon size={12} /> WhatsApp
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Clientes inativos */}
        {!isLoading && <ClientesInativos clientes={clientes} />}

        {/* Modelos de Mensagem WhatsApp */}
        <ModelosMensagem />

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
                    <th className="text-right pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Ticket Médio</th>
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
                      <td className="py-3 text-right text-sm text-[#F0F0F0]">
                        {c.total_compras > 0 ? formatarMoeda(c.total_gasto / c.total_compras) : '—'}
                      </td>
                      <td className="py-3 text-xs text-[#888888]">
                        {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="py-3 text-center">{badgeCliente(c.total_compras)}</td>
                      <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {c.telefone ? (() => {
                          const ehAniv = anivHoje.some((a) => a.id === c.id)
                          const msg = ehAniv ? msgAniversario(c.nome) : msgCampanhaTenis(c.nome)
                          return (
                            <a
                              href={telefoneWpp(c.telefone, msg)}
                              target="_blank" rel="noreferrer"
                              title={ehAniv ? '🎂 Enviar parabéns + 20% OFF' : '👟 Campanha Tênis 50% OFF'}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
                                ehAniv
                                  ? 'bg-gold/20 text-gold hover:bg-gold/40'
                                  : 'bg-green-600/20 text-green-500 hover:bg-green-600/40'
                              }`}
                            >
                              {ehAniv ? '🎂' : (
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              )}
                            </a>
                          )
                        })() : (
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

      {/* Modal Configurar WhatsApp */}
      {showConfigWpp && (
        <ConfigWppModal onClose={() => setShowConfigWpp(false)} />
      )}

      {/* Modal de Campanha */}
      {showCampanha && (
        <CampanhaModal
          clientes={clientes}
          onClose={() => setShowCampanha(false)}
        />
      )}
    </div>
  )
}
