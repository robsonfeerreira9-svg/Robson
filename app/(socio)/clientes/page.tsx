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
  telefone: string | null
  data_nascimento: string | null
  total_compras: number
  total_gasto: number
  ultima_compra: string | null
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
  const { data, error } = await supabase
    .from('vendas')
    .select('cliente_id, total_final, criado_em, clientes(id, nome, telefone, data_nascimento)')
    .not('cliente_id', 'is', null)

  if (error) throw error

  const map = new Map<string, ClienteStats>()

  for (const venda of data ?? []) {
    const c = venda.clientes as { id: string; nome: string; telefone: string | null; data_nascimento: string | null } | null
    if (!c) continue

    if (!map.has(c.id)) {
      map.set(c.id, {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        data_nascimento: c.data_nascimento,
        total_compras: 0,
        total_gasto: 0,
        ultima_compra: null,
      })
    }

    const entry = map.get(c.id)!
    entry.total_compras += 1
    entry.total_gasto += venda.total_final
    if (!entry.ultima_compra || venda.criado_em > entry.ultima_compra) {
      entry.ultima_compra = venda.criado_em
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_compras - a.total_compras || b.total_gasto - a.total_gasto)
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
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        data_nascimento: c.data_nascimento,
        dia,
        ehHoje: dia === diaAtual,
      }
    })
    .sort((a, b) => a.dia - b.dia)
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

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── Página ────────────────────────────────────────────────────────────────────
export default function ClientesPage() {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const { data: clientes = [], isLoading } = useSWR('clientes-stats', fetchClientesStats, { refreshInterval: 60000 })
  const { data: aniversariantes = [] } = useSWR('aniversariantes', fetchAniversariantes, { refreshInterval: 3600000 })

  const hoje = new Date()
  const nomesMes = MESES[hoje.getMonth()]

  const anivHoje = aniversariantes.filter((a) => a.ehHoje)
  const anivMes  = aniversariantes.filter((a) => !a.ehHoje)

  const clientesFiltrados = clientes.filter((c) => {
    if (filtro === 'novos')  return c.total_compras === 1
    if (filtro === 'fieis')  return c.total_compras >= 2
    return true
  })

  const totalClientes   = clientes.length
  const clientesNovos   = clientes.filter((c) => c.total_compras === 1).length
  const clientesFieis   = clientes.filter((c) => c.total_compras >= 2).length
  const clientesVip     = clientes.filter((c) => c.total_compras >= 5).length

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
            { label: 'Total Clientes', valor: totalClientes, fmt: 'num' },
            { label: 'Compraram 1x',   valor: clientesNovos,  fmt: 'num' },
            { label: 'Recorrentes',    valor: clientesFieis,  fmt: 'num' },
            { label: 'VIP (5+ compras)', valor: clientesVip,  fmt: 'num' },
          ].map((k) => (
            <Card key={k.label} hover className="flex flex-col gap-1">
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold">{k.label}</p>
              <p className="text-2xl font-black text-gold">{k.valor}</p>
            </Card>
          ))}
        </div>

        {/* Aniversariantes */}
        {aniversariantes.length > 0 && (
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
                        <a
                          href={telefoneWpp(a.telefone, msgAniversario(a.nome))}
                          target="_blank"
                          rel="noreferrer"
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

            {/* Resto do mês */}
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
                          target="_blank"
                          rel="noreferrer"
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
            <h2 className="text-sm font-bold text-[#F0F0F0] uppercase tracking-wide">
              Ranking de Clientes
            </h2>
            {/* Filtro */}
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
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-12 rounded" />
              ))}
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
                    <th className="text-center pb-2 text-xs font-semibold text-[#888888] uppercase tracking-wide">Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c, i) => {
                    const ultimaStr = c.ultima_compra
                      ? new Date(c.ultima_compra).toLocaleDateString('pt-BR')
                      : '—'

                    return (
                      <tr key={c.id} className="border-b border-[#2A2A2A]/50 hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 pr-3 text-xs text-[#555555] font-bold">{i + 1}</td>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-[#F0F0F0]">{c.nome}</p>
                          {c.telefone && (
                            <p className="text-xs text-[#888888]">{c.telefone}</p>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-bold text-[#F0F0F0]">{c.total_compras}</span>
                        </td>
                        <td className="py-3 text-right font-bold text-gold">
                          {formatarMoeda(c.total_gasto)}
                        </td>
                        <td className="py-3 text-xs text-[#888888]">{ultimaStr}</td>
                        <td className="py-3 text-center">{badgeCliente(c.total_compras)}</td>
                        <td className="py-3 text-center">
                          {c.telefone ? (
                            <a
                              href={telefoneWpp(c.telefone, `Oi ${c.nome}! Tudo bem? Aqui é a HG Grifes. 😊`)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 rounded bg-green-600/20 text-green-500 hover:bg-green-600/40 transition-colors"
                              title="Abrir no WhatsApp"
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}
