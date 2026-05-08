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
  vence_em: string | null
  pago: boolean
  referencia_venda_id: string | null
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

// ── Fetcher principal ─────────────────────────────────────────────────────────
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

// ── Fetcher de contas a pagar (pago=false, vence nos próximos 7 dias ou vencidas) ──
async function fetchVenceSemana(): Promise<Movimentacao[]> {
  const supabase = createClient()
  const em7Dias = new Date()
  em7Dias.setDate(em7Dias.getDate() + 7)

  const { data, error } = await supabase
    .from('movimentacao_caixa')
    .select('*')
    .eq('tipo', 'saida')
    .eq('pago', false)
    .not('vence_em', 'is', null)
    .lte('vence_em', em7Dias.toISOString().slice(0, 10))
    .order('vence_em', { ascending: true })

  if (error) throw error
  return (data as Movimentacao[]) ?? []
}

// ── Categorias ────────────────────────────────────────────────────────────────
const CATEGORIAS_SAIDA: { value: CategoriaMovimentacao; label: string }[] = [
  { value: 'compra_estoque',    label: 'Compra de Estoque' },
  { value: 'custo_operacional', label: 'Custo Operacional' },
  { value: 'outro',             label: 'Outro' },
]

const CATEGORIAS_ENTRADA: { value: CategoriaMovimentacao; label: string }[] = [
  { value: 'outro', label: 'Aporte / Outros' },
]

// ── Helpers de contas recorrentes ─────────────────────────────────────────────
const MAX_REPETICOES: Record<string, number> = { mensal: 24, quinzenal: 52, semanal: 104 }

function gerarDatas(base: string, freq: string, n: number): string[] {
  const datas = []
  for (let i = 0; i < n; i++) {
    const d = new Date(base + 'T12:00:00')
    if (freq === 'mensal') d.setMonth(d.getMonth() + i)
    else if (freq === 'quinzenal') d.setDate(d.getDate() + 15 * i)
    else d.setDate(d.getDate() + 7 * i)
    datas.push(d.toISOString().slice(0, 10))
  }
  return datas
}

function labelFreq(freq: string): string {
  if (freq === 'mensal') return 'mensais'
  if (freq === 'quinzenal') return 'quinzenais'
  return 'semanais'
}

// ── Modal de movimentação ─────────────────────────────────────────────────────
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
    vence_em: '',
  })
  const [recorrente, setRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState<'mensal' | 'quinzenal' | 'semanal'>('mensal')
  const [repeticoes, setRepeticoes] = useState(12)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const isEntrada = tipo === 'entrada'
  const temVencimento = !isEntrada && form.vence_em !== ''
  const maxRep = MAX_REPETICOES[frequencia]

  // Clamp repetições ao máximo da frequência selecionada
  function handleFrequencia(novaFreq: 'mensal' | 'quinzenal' | 'semanal') {
    setFrequencia(novaFreq)
    setRepeticoes((prev: number) => Math.min(prev, MAX_REPETICOES[novaFreq]))
  }

  // Data final calculada automaticamente
  const datasPreview = temVencimento && recorrente && repeticoes > 0
    ? gerarDatas(form.vence_em, frequencia, repeticoes)
    : []
  const dataFinalPreview = datasPreview.length > 0
    ? new Date(datasPreview[datasPreview.length - 1] + 'T12:00:00').toLocaleDateString('pt-BR')
    : null

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor) { setErro('Preencha todos os campos.'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }

    setLoading(true)
    const supabase = createClient()

    if (temVencimento && recorrente && repeticoes > 0) {
      const datas = gerarDatas(form.vence_em, frequencia, repeticoes)
      const payloads = datas.map((vence_em) => ({
        tipo,
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        valor,
        vence_em,
        pago: false,
      }))
      const { error } = await supabase.from('movimentacao_caixa').insert(payloads)
      setLoading(false)
      if (error) { setErro(`Erro: ${error.message}`); return }
    } else {
      const payload: Record<string, unknown> = {
        tipo,
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        valor,
        // Saída com vencimento = pendente (não sai do caixa ainda)
        // Saída sem vencimento = saiu agora (pago=true, default do banco)
        ...(temVencimento ? { vence_em: form.vence_em, pago: false } : {}),
      }
      const { error } = await supabase.from('movimentacao_caixa').insert(payload)
      setLoading(false)
      if (error) { setErro(`Erro: ${error.message}`); return }
    }

    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-4">
          {isEntrada ? 'Registrar Entrada' : 'Registrar Saída'}
        </h3>
        <div className="flex flex-col gap-3">
          <Select
            label="Categoria"
            options={categorias}
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as CategoriaMovimentacao }))}
          />
          <Input
            label="Descrição"
            placeholder={isEntrada ? 'Ex: Aporte de caixa...' : 'Ex: Aluguel, embalagens...'}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
          <Input
            label="Valor (R$)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          />
          {/* Vencimento — apenas saídas */}
          {!isEntrada && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">
                Data de Vencimento <span className="text-[#555555]">(opcional)</span>
              </label>
              <input
                type="date"
                value={form.vence_em}
                onChange={(e) => setForm((f) => ({ ...f, vence_em: e.target.value }))}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                style={{ colorScheme: 'dark' }}
              />
              {temVencimento && !recorrente && (
                <p className="text-[10px] text-[#F59E0B]">
                  Esta conta ficará como <strong>Pendente</strong> até você marcar como paga.
                </p>
              )}
              {!temVencimento && form.valor && (
                <p className="text-[10px] text-[#888888]">
                  Sem vencimento = saída imediata do caixa.
                </p>
              )}
            </div>
          )}
          {/* Repetir conta — apenas saídas com vencimento */}
          {temVencimento && !isEntrada && (
            <div className="flex flex-col gap-2 border border-[#2A2A2A] rounded p-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                  className="accent-gold w-4 h-4"
                />
                <span className="text-sm text-[#F0F0F0]">Repetir conta</span>
              </label>
              {recorrente && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs text-[#888888] font-medium">Frequência</label>
                      <select
                        value={frequencia}
                        onChange={(e) => handleFrequencia(e.target.value as 'mensal' | 'quinzenal' | 'semanal')}
                        className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                      >
                        <option value="mensal">Mensal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="semanal">Semanal</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 w-24">
                      <label className="text-xs text-[#888888] font-medium">Repetições</label>
                      <input
                        type="number"
                        min={1}
                        max={maxRep}
                        value={repeticoes}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(maxRep, parseInt(e.target.value) || 1))
                          setRepeticoes(v)
                        }}
                        className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold text-center"
                      />
                    </div>
                  </div>
                  {dataFinalPreview && (
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[10px] text-[#888888]">
                        Duração: até {datasPreview[datasPreview.length - 1]}
                      </p>
                      <p className="text-[10px] text-[#F59E0B]">
                        Criará <strong>{repeticoes}</strong> lançamentos {labelFreq(frequencia)} até <strong>{dataFinalPreview}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {erro && <p className="text-xs text-[#FF4444]">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <Button
              variant="primary"
              fullWidth
              loading={loading}
              onClick={handleSalvar}
              className={isEntrada ? '' : 'bg-danger border-danger'}
            >
              {isEntrada
                ? 'Registrar Entrada'
                : temVencimento && recorrente
                  ? `Lançar ${repeticoes} Parcelas`
                  : temVencimento
                    ? 'Lançar como Pendente'
                    : 'Registrar Saída'}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Modal de edição ───────────────────────────────────────────────────────────
function EditModal({
  mov, onClose, onSave,
}: {
  mov: Movimentacao
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState({
    descricao: mov.descricao ?? '',
    valor: String(mov.valor),
    vence_em: mov.vence_em ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!form.descricao.trim() || !form.valor) { setErro('Preencha todos os campos.'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Informe um valor válido.'); return }

    setLoading(true)
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      descricao: form.descricao.trim(),
      valor,
      vence_em: form.vence_em || null,
    }
    // Saída: sem vencimento = pago imediato; com vencimento = pendente
    if (mov.tipo === 'saida') {
      payload.pago = !form.vence_em
    }
    const { error } = await supabase.from('movimentacao_caixa').update(payload).eq('id', mov.id)
    setLoading(false)
    if (error) { setErro(`Erro: ${error.message}`); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-1">Editar Lançamento</h3>
        <p className="text-[10px] text-[#555555] mb-4">
          {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'} · {new Date(mov.criado_em).toLocaleDateString('pt-BR')}
        </p>
        <div className="flex flex-col gap-3">
          <Input
            label="Descrição"
            placeholder="Ex: Aluguel, embalagens..."
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
          <Input
            label="Valor (R$)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          />
          {mov.tipo === 'saida' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">
                Data de Vencimento <span className="text-[#555555]">(opcional)</span>
              </label>
              <input
                type="date"
                value={form.vence_em}
                onChange={(e) => setForm((f) => ({ ...f, vence_em: e.target.value }))}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
                style={{ colorScheme: 'dark' }}
              />
              {form.vence_em && (
                <p className="text-[10px] text-[#F59E0B]">
                  Conta ficará como <strong>Pendente</strong> até ser marcada como paga.
                </p>
              )}
              {!form.vence_em && (
                <p className="text-[10px] text-[#888888]">
                  Sem vencimento = saída imediata do caixa.
                </p>
              )}
            </div>
          )}
          {erro && <p className="text-xs text-[#FF4444]">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="primary" fullWidth loading={loading} onClick={handleSalvar}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Bloco "Contas a Pagar" (pendentes) ────────────────────────────────────────
function VenceSemana({ onPago }: { onPago: () => void }) {
  const { data: contas = [], isLoading } = useSWR('vence-semana', fetchVenceSemana, { refreshInterval: 30000 })
  const [pagandoId, setPagandoId] = useState<string | null>(null)

  if (isLoading || contas.length === 0) return null

  const hojeStr = hoje()

  function statusVenc(vence_em: string): 'vencida' | 'hoje' | 'proxima' {
    if (vence_em < hojeStr) return 'vencida'
    if (vence_em === hojeStr) return 'hoje'
    return 'proxima'
  }

  const colorMap = {
    vencida: { badge: 'danger' as const,  label: 'Vencida', text: 'text-danger' },
    hoje:    { badge: 'warning' as const, label: 'Hoje',    text: 'text-[#F59E0B]' },
    proxima: { badge: 'default' as const, label: 'Próxima', text: 'text-[#888888]' },
  }

  async function handlePagar(id: string) {
    setPagandoId(id)
    const supabase = createClient()
    await supabase.from('movimentacao_caixa').update({ pago: true }).eq('id', id)
    setPagandoId(null)
    mutate('vence-semana')
    onPago()
  }

  const total = contas.reduce((a, c) => a + Number(c.valor), 0)

  return (
    <Card className="border border-[#3A2A00]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <h2 className="text-sm font-bold text-[#F59E0B] uppercase tracking-wide">Contas a Pagar</h2>
        </div>
        <span className="text-sm font-black text-danger">{formatarMoeda(total)}</span>
      </div>
      <div className="flex flex-col divide-y divide-[#2A2A2A]">
        {contas.map((c) => {
          const status = statusVenc(c.vence_em!)
          const { badge, label, text } = colorMap[status]
          const dataFormatada = new Date(c.vence_em! + 'T12:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit',
          })
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F0F0F0] font-medium truncate">{c.descricao ?? '—'}</p>
                <p className={`text-xs ${text}`}>Vence {dataFormatada}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={badge}>{label}</Badge>
                <span className="text-sm font-bold text-danger">{formatarMoeda(Number(c.valor))}</span>
                <button
                  onClick={() => handlePagar(c.id)}
                  disabled={pagandoId === c.id}
                  className="text-xs font-bold px-2.5 py-1 rounded border border-success/50 text-success hover:bg-success/10 transition-colors disabled:opacity-40"
                >
                  {pagandoId === c.id ? '…' : 'Pagar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-[#555555] mt-2">
        Clique "Pagar" para confirmar o pagamento e registrar a saída no caixa.
      </p>
    </Card>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [userRole, setUserRole] = useState<RoleUsuario | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes)
  const [dataFim,    setDataFim]    = useState(hoje)
  const [showModal, setShowModal] = useState<'entrada' | 'saida' | null>(null)
  const [pagandoInlineId, setPagandoInlineId] = useState<string | null>(null)
  const [editingMov, setEditingMov] = useState<Movimentacao | null>(null)

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

  // Saldo considera apenas entradas/saídas já pagas
  const entradas = movs.filter((m) => m.pago && m.tipo === 'entrada').reduce((a, m) => a + Number(m.valor), 0)
  const saidas   = movs.filter((m) => m.pago && m.tipo === 'saida').reduce((a, m) => a + Number(m.valor), 0)
  const pendente = movs.filter((m) => !m.pago && m.tipo === 'saida').reduce((a, m) => a + Number(m.valor), 0)
  const saldo    = entradas - saidas

  const labelCategoria: Record<string, string> = {
    venda: 'Venda', compra_estoque: 'Compra Estoque',
    custo_operacional: 'Custo Operacional', outro: 'Outro',
  }

  const backHref = isSocio ? '/dashboard' : '/pdv'
  const backLabel = isSocio ? '← Dashboard' : '← PDV'

  function handleSaved() {
    mutate(cacheKey)
    mutate('vence-semana')
  }

  async function handlePagarInline(id: string) {
    setPagandoInlineId(id)
    const supabase = createClient()
    await supabase.from('movimentacao_caixa').update({ pago: true }).eq('id', id)
    setPagandoInlineId(null)
    mutate(cacheKey)
    mutate('vence-semana')
  }

  const colCount = isSocio ? 8 : 5

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

        {/* Contas a pagar — sempre visível para sócio */}
        {isSocio && <VenceSemana onPago={handleSaved} />}

        {/* Cards resumo — somente sócio */}
        {isSocio && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card hover>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Entradas</p>
              <p className="text-2xl font-black text-success">{formatarMoeda(entradas)}</p>
            </Card>
            <Card hover>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Saídas Pagas</p>
              <p className="text-2xl font-black text-danger">{formatarMoeda(saidas)}</p>
            </Card>
            {pendente > 0 && (
              <Card hover>
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Pendente</p>
                <p className="text-2xl font-black text-[#F59E0B]">{formatarMoeda(pendente)}</p>
              </Card>
            )}
            <Card hover>
              <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">Saldo Real</p>
              <p className={`text-2xl font-black ${saldo >= 0 ? 'text-gold' : 'text-danger'}`}>
                {formatarMoeda(saldo)}
              </p>
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card padding="sm">
          <div className="flex gap-4 flex-wrap items-end">
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">Atalho</label>
              <div className="flex gap-1">
                {[
                  { label: 'Hoje', action: () => { setDataInicio(hoje()); setDataFim(hoje()) } },
                  { label: 'Mês',  action: () => { setDataInicio(primeiroDiaMes()); setDataFim(hoje()) } },
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
                {isSocio && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Vencimento</th>
                )}
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Valor</th>
                {isSocio && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Status</th>
                )}
                {isSocio && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#2A2A2A]">
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : movs.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-12 text-[#888888]">
                    Nenhuma movimentação no período
                  </td>
                </tr>
              ) : (
                movs.map((m) => {
                  const hojeStr = hoje()
                  const vencColor = m.vence_em
                    ? m.vence_em < hojeStr
                      ? 'text-danger font-semibold'
                      : m.vence_em === hojeStr
                        ? 'text-[#F59E0B] font-semibold'
                        : 'text-[#888888]'
                    : 'text-[#444444]'
                  const isPendente = !m.pago && m.tipo === 'saida'

                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-[#2A2A2A] transition-colors ${
                        isPendente ? 'bg-[#1A1500] hover:bg-[#201900]' : 'bg-[#1A1A1A] hover:bg-[#222222]'
                      }`}
                    >
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
                      <td className="px-4 py-3 text-[#F0F0F0] max-w-[200px] truncate">
                        {m.descricao ?? '—'}
                      </td>
                      {isSocio && (
                        <td className={`px-4 py-3 text-xs ${vencColor}`}>
                          {m.vence_em
                            ? new Date(m.vence_em + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                      )}
                      <td className={`px-4 py-3 text-right font-bold ${
                        isPendente
                          ? 'text-[#F59E0B]'
                          : m.tipo === 'entrada' ? 'text-success' : 'text-danger'
                      }`}>
                        {isSocio
                          ? `${m.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(Number(m.valor))}`
                          : m.tipo === 'saida'
                            ? `- ${formatarMoeda(Number(m.valor))}`
                            : <span className="text-[#555555]">—</span>
                        }
                      </td>
                      {isSocio && (
                        <td className="px-4 py-3 text-center">
                          {isPendente ? (
                            <button
                              onClick={() => handlePagarInline(m.id)}
                              disabled={pagandoInlineId === m.id}
                              className="text-xs font-bold px-2.5 py-1 rounded border border-success/50 text-success hover:bg-success/10 transition-colors disabled:opacity-40"
                            >
                              {pagandoInlineId === m.id ? '…' : 'Pagar'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#444444]">
                              {m.tipo === 'entrada' ? '—' : 'Pago'}
                            </span>
                          )}
                        </td>
                      )}
                      {isSocio && (
                        <td className="px-4 py-3 text-center">
                          {!m.referencia_venda_id ? (
                            <button
                              onClick={() => setEditingMov(m)}
                              className="text-xs font-bold px-2.5 py-1 rounded border border-[#2A2A2A] text-[#888888] hover:border-gold hover:text-gold transition-colors"
                              title="Editar lançamento"
                            >
                              Editar
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#333333]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-[#555555] text-center">
          Saldo Real = entradas − saídas pagas. Saídas pendentes aparecem em amarelo e não afetam o saldo.
        </p>
      </div>

      {showModal && (
        <MovimentacaoModal
          tipo={showModal}
          onClose={() => setShowModal(null)}
          onSave={handleSaved}
        />
      )}
      {editingMov && (
        <EditModal
          mov={editingMov}
          onClose={() => setEditingMov(null)}
          onSave={() => {
            mutate(cacheKey)
            mutate('vence-semana')
          }}
        />
      )}
    </div>
  )
}
