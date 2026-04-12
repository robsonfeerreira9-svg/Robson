'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils/preco'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ComissaoRow {
  id: string
  venda_id: string
  vendedor_id: string
  percentual: number
  valor_comissao: number
  pago: boolean
  criado_em: string
  vendas: { total_final: number; criado_em: string } | null
  usuarios: { nome: string } | null
}

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchComissoes(vendedorFiltro: string, mes: string): Promise<ComissaoRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('comissoes')
    .select('*, vendas(total_final, criado_em), usuarios(nome)')
    .order('criado_em', { ascending: false })

  if (vendedorFiltro) query = query.eq('vendedor_id', vendedorFiltro)

  if (mes) {
    const [ano, m] = mes.split('-')
    const inicio = new Date(Number(ano), Number(m) - 1, 1).toISOString()
    const fim = new Date(Number(ano), Number(m), 1).toISOString()
    query = query.gte('criado_em', inicio).lt('criado_em', fim)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as ComissaoRow[]) ?? []
}

async function fetchVendedores() {
  const supabase = createClient()
  const { data } = await supabase.from('usuarios').select('id, nome').eq('ativo', true).order('nome')
  return data ?? []
}

// ── Modal de confirmação de pagamento ────────────────────────────────────────
function PagamentoModal({ comissao, onClose, onConfirm }: {
  comissao: ComissaoRow
  onClose: () => void
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('comissoes').update({ pago: true }).eq('id', comissao.id)
    setLoading(false)
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-2">Confirmar Pagamento</h3>
        <p className="text-sm text-[#888888] mb-1">
          Confirmar pagamento de{' '}
          <span className="text-gold font-bold">{formatarMoeda(comissao.valor_comissao)}</span>
        </p>
        <p className="text-sm text-[#888888] mb-4">
          para <span className="text-[#F0F0F0] font-semibold">{comissao.usuarios?.nome}</span>?
        </p>
        <div className="flex gap-2">
          <Button variant="primary" fullWidth loading={loading} onClick={handleConfirm}>
            Confirmar Pagamento
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ComissoesPage() {
  const [vendedorFiltro, setVendedorFiltro] = useState('')
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [pagamentoModal, setPagamentoModal] = useState<ComissaoRow | null>(null)
  const [marcandoTodas, setMarcandoTodas] = useState(false)

  async function marcarTodasPagas() {
    const pendentes = comissoes.filter((c) => !c.pago)
    if (pendentes.length === 0) return
    if (!confirm(`Marcar ${pendentes.length} comissão(ões) como pagas?`)) return
    setMarcandoTodas(true)
    const supabase = createClient()
    await supabase
      .from('comissoes')
      .update({ pago: true })
      .in('id', pendentes.map((c) => c.id))
    setMarcandoTodas(false)
    mutate(['comissoes', vendedorFiltro, mes])
  }

  const { data: comissoes = [], isLoading } = useSWR(
    ['comissoes', vendedorFiltro, mes],
    () => fetchComissoes(vendedorFiltro, mes),
    { refreshInterval: 30000 }
  )
  const { data: vendedores = [] } = useSWR('vendedores-comissoes', fetchVendedores)

  // Resumo por vendedor (apenas pendentes)
  const resumoPorVendedor: Record<string, { nome: string; total: number }> = {}
  for (const c of comissoes) {
    if (!c.pago) {
      const id = c.vendedor_id
      const nome = c.usuarios?.nome ?? 'Desconhecido'
      if (!resumoPorVendedor[id]) resumoPorVendedor[id] = { nome, total: 0 }
      resumoPorVendedor[id].total += Number(c.valor_comissao)
    }
  }
  const resumoList = Object.values(resumoPorVendedor).sort((a, b) => b.total - a.total)

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Comissões</h1>
            <a href="/dashboard" className="text-xs text-[#888888] hover:text-gold transition-colors">← Dashboard</a>
          </div>
          {comissoes.some((c) => !c.pago) && (
            <Button
              variant="primary"
              loading={marcandoTodas}
              onClick={marcarTodasPagas}
            >
              Marcar Todas como Pagas
            </Button>
          )}
        </div>

        {/* Resumo pendentes */}
        {resumoList.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {resumoList.map((r) => (
              <Card key={r.nome} padding="sm" className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gold text-[#0D0D0D] flex items-center justify-center text-xs font-black">
                  {r.nome.charAt(0)}
                </div>
                <div>
                  <p className="text-xs text-[#888888]">{r.nome}</p>
                  <p className="text-sm font-bold text-gold">{formatarMoeda(r.total)} pendente</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Filtros */}
        <Card padding="sm">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">Vendedor</label>
              <select
                value={vendedorFiltro}
                onChange={(e) => setVendedorFiltro(e.target.value)}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              >
                <option value="">Todos</option>
                {vendedores.map((v: { id: string; nome: string }) => (
                  <option key={v.id} value={v.id} className="bg-[#1A1A1A]">{v.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">Mês</label>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </Card>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-[#2A2A2A]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Data da Venda</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Valor Venda</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">% Comissão</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Comissão</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Ação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#2A2A2A]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : comissoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#888888]">
                    Nenhuma comissão encontrada
                  </td>
                </tr>
              ) : (
                comissoes.map((c) => (
                  <tr key={c.id} className="bg-[#1A1A1A] border-b border-[#2A2A2A] hover:bg-[#222222] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#F0F0F0]">{c.usuarios?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-[#888888] text-xs">
                      {c.vendas?.criado_em
                        ? new Date(c.vendas.criado_em).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[#F0F0F0]">
                      {c.vendas?.total_final != null ? formatarMoeda(Number(c.vendas.total_final)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[#888888]">{c.percentual}%</td>
                    <td className="px-4 py-3 text-right font-bold text-gold">{formatarMoeda(Number(c.valor_comissao))}</td>
                    <td className="px-4 py-3 text-center">
                      {c.pago
                        ? <Badge variant="success">Pago</Badge>
                        : <Badge variant="warning">Pendente</Badge>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!c.pago && (
                        <button
                          onClick={() => setPagamentoModal(c)}
                          className="text-xs text-gold hover:underline font-semibold"
                        >
                          Marcar Pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagamentoModal && (
        <PagamentoModal
          comissao={pagamentoModal}
          onClose={() => setPagamentoModal(null)}
          onConfirm={() => mutate(['comissoes', vendedorFiltro, mes])}
        />
      )}
    </div>
  )
}
