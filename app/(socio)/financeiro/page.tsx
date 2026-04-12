'use client'

import { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { formatarMoeda } from '@/lib/utils/preco'
import type { TipoMovimentacao, CategoriaMovimentacao, RoleUsuario } from '@/lib/database.types'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Movimentacao {
  id: string
  tipo: TipoMovimentacao
  categoria: CategoriaMovimentacao
  descricao: string | null
  valor: number
  criado_em: string
}

// ── Helpers de data ────────────────────────────────────────────────────────────
function primeiroDiaMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchMovimentacoes(tipo: string, de: string, ate: string): Promise<Movimentacao[]> {
  const supabase = createClient()
  let query = supabase
    .from('movimentacao_caixa')
    .select('*')
    .order('criado_em', { ascending: false })

  if (tipo) query = query.eq('tipo', tipo)
  if (de)  query = query.gte('criado_em', de)
  if (ate) {
    const fim = new Date(ate)
    fim.setDate(fim.getDate() + 1)
    query = query.lt('criado_em', fim.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return (data as Movimentacao[]) ?? []
}

// ── Modal genérico de movimentação ───────────────────────────────────────────
const CATEGORIAS_SAIDA: { value: CategoriaMovimentacao; label: string }[] = [
  { value: 'compra_estoque',    label: 'Compra de Estoque' },
  { value: 'custo_operacional', label: 'Custo Operacional' },
  { value: 'outro',             label: 'Outro' },
]

const CATEGORIAS_ENTRADA: { value: CategoriaMovimentacao; label: string }[] = [
  { value: 'outro', label: 'Aporte / Outros' },
]

function MovimentacaoModal({
  tipo, onClose, onSave,
}: {
  tipo: 'entrada' | 'saida'
  onClose: () => void
  onSave: () => void
}) {
  const categorias = tipo === 'saida' ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA
  const [form, setForm] = useState({
    categoria: categorias[0].value,
    descricao: '',
    valor: '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor) { setErro('Preencha todos os campos.'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('movimentacao_caixa').insert({
      tipo, categoria: form.categoria,
      descricao: form.descricao.trim(), valor,
    })
    setLoading(false)
    if (error) { setErro(`Erro: ${error.message}`); return }
    onSave()
    onClose()
  }

  const isEntrada = tipo === 'entrada'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-4">
          {isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
        </h3>
        <div className="flex flex-col gap-3">
          <Select label="Categoria" options={categorias} value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as CategoriaMovimentacao }))} />
          <Input
            label="Descrição"
            placeholder={isEntrada ? 'Ex: Aporte de caixa, transferência...' : 'Ex: Aluguel, embalagens...'}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          <Input label="Valor (R$)" type="number" min="0" step="0.01" placeholder="0,00"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} />
          {erro && <p className="text-xs text-[#FF4444]">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <Button
              variant={isEntrada ? 'primary' : 'primary'}
              fullWidth loading={loading} onClick={handleSalvar}
              className={isEntrada ? '' : 'bg-danger border-danger'}
            >
              {isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [userRole, setUserRole] = useState<RoleUsuario | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes)
  const [dataFim,    setDataFim]    = useState(hoje)
  const [showModal, setShowModal] = useState<'entrada' | 'saida' | null>(null)

  // Detectar papel do usuário
  useEffect(() => {
    async function loadRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('role').eq('id', user.id).single()
      setUserRole(data?.role as RoleUsuario ?? 'funcionario')
    }
    loadRole()
  }, [])

  const isSocio = userRole === 'socio'

  const cacheKey = ['movimentacoes', tipoFiltro, dataInicio, dataFim]
  const { data: movs = [], isLoading } = useSWR(
    cacheKey,
    () => fetchMovimentacoes(tipoFiltro, dataInicio, dataFim),
    { refreshInterval: 30000 }
  )

  const entradas = movs.filter((m) => m.tipo === 'entrada').reduce((a, m) => a + Number(m.valor), 0)
  const saidas   = movs.filter((m) => m.tipo === 'saida').reduce((a, m) => a + Number(m.valor), 0)
  const saldo    = entradas - saidas

  const labelCategoria: Record<string, string> = {
    venda: 'Venda', compra_estoque: 'Compra Estoque',
    custo_operacional: 'Custo Operacional', outro: 'Outro',
  }

  const backHref = isSocio ? '/dashboard' : '/pdv'
  const backLabel = isSocio ? '← Dashboard' : '← PDV'

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Financeiro</h1>
            <a href={backHref} className="text-xs text-[#888888] hover:text-gold transition-colors">{backLabel}</a>
          </div>
          <div className="flex gap-2">
            {isSocio && (
              <Button variant="primary" onClick={() => setShowModal('entrada')}>+ Entrada</Button>
            )}
            <Button variant="danger" onClick={() => setShowModal('saida')}>+ Saída</Button>
          </div>
        </div>

        {/* Cards resumo — somente sócio */}
        {isSocio && (
          <div className="grid grid-cols-3 gap-4">
            <Card hover>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Entradas</p>
              <p className="text-2xl font-black text-success">{formatarMoeda(entradas)}</p>
            </Card>
            <Card hover>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Saídas</p>
              <p className="text-2xl font-black text-danger">{formatarMoeda(saidas)}</p>
            </Card>
            <Card hover>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Saldo</p>
              <p className={`text-2xl font-black ${saldo >= 0 ? 'text-gold' : 'text-danger'}`}>
                {formatarMoeda(saldo)}
              </p>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card padding="sm">
          <div className="flex gap-4 flex-wrap items-end">
            {/* Tipo — só sócio filtra por tipo */}
            {isSocio && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#888888] font-medium">Tipo</label>
                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value)}
                  className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                >
                  <option value="">Todos</option>
                  <option value="entrada" className="bg-[#1A1A1A]">Entradas</option>
                  <option value="saida"   className="bg-[#1A1A1A]">Saídas</option>
                </select>
              </div>
            )}

            {/* Período — do dia ao dia */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Atalhos rápidos de período */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">Atalho</label>
              <div className="flex gap-1">
                {[
                  { label: 'Hoje', action: () => { setDataInicio(hoje()); setDataFim(hoje()) } },
                  { label: 'Mês', action: () => { setDataInicio(primeiroDiaMes()); setDataFim(hoje()) } },
                ].map((a) => (
                  <button key={a.label} onClick={a.action}
                    className="px-2.5 py-2 rounded border border-[#2A2A2A] text-xs text-[#888888] hover:border-gold hover:text-gold transition-colors">
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-[#2A2A2A]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Descrição</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Valor</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#2A2A2A]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : movs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[#888888]">
                    Nenhuma movimentação no período
                  </td>
                </tr>
              ) : (
                movs.map((m) => (
                  <tr key={m.id} className="bg-[#1A1A1A] border-b border-[#2A2A2A] hover:bg-[#222222] transition-colors">
                    <td className="px-4 py-3 text-[#888888] text-xs">
                      {new Date(m.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.tipo === 'entrada' ? 'success' : 'danger'}>
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#888888] text-xs">
                      {labelCategoria[m.categoria] ?? m.categoria}
                    </td>
                    <td className="px-4 py-3 text-[#F0F0F0] max-w-[250px] truncate">
                      {m.descricao ?? '—'}
                    </td>
                    {/* Funcionário não vê valores individuais das entradas */}
                    <td className={`px-4 py-3 text-right font-bold ${
                      m.tipo === 'entrada' ? 'text-success' : 'text-danger'
                    }`}>
                      {isSocio
                        ? `${m.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(Number(m.valor))}`
                        : m.tipo === 'saida'
                          ? `- ${formatarMoeda(Number(m.valor))}`
                          : <span className="text-[#555555]">—</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <MovimentacaoModal
          tipo={showModal}
          onClose={() => setShowModal(null)}
          onSave={() => mutate(cacheKey)}
        />
      )}
    </div>
  )
}
