'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatarMoeda } from '@/lib/utils/preco'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ItemVenda {
  id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal_item: number
  produtos: { nome: string; tamanho: string; numero: string | null } | null
}

interface VendaRow {
  id: string
  vendedor_id: string
  canal_venda: string
  metodo_pagamento: string
  subtotal: number
  desconto_aplicado: number
  total_final: number
  criado_em: string
  usuarios: { nome: string } | null
  clientes: { nome: string } | null
  itens_venda: ItemVenda[]
}

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchVendas(mes: string, vendedorFiltro: string): Promise<VendaRow[]> {
  const supabase = createClient()
  const [ano, m] = mes.split('-')
  const inicio = new Date(Number(ano), Number(m) - 1, 1).toISOString()
  const fim    = new Date(Number(ano), Number(m), 1).toISOString()

  let query = supabase
    .from('vendas')
    .select(`*, usuarios(nome), clientes(nome), itens_venda(*, produtos(nome, tamanho, numero))`)
    .gte('criado_em', inicio)
    .lt('criado_em', fim)
    .order('criado_em', { ascending: false })

  if (vendedorFiltro) query = query.eq('vendedor_id', vendedorFiltro)

  const { data, error } = await query
  if (error) throw error
  return (data as VendaRow[]) ?? []
}

async function fetchUsuarios() {
  const supabase = createClient()
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

// ── Labels ────────────────────────────────────────────────────────────────────
const LABEL_CANAL: Record<string, string> = {
  fisico: 'Loja', whatsapp: 'WhatsApp', instagram: 'Instagram',
}
const LABEL_METODO: Record<string, string> = {
  pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro',
}

const CANAL_OPTIONS = [
  { value: 'fisico', label: 'Loja' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
]
const METODO_OPTIONS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
]

// ── Modal de edição ───────────────────────────────────────────────────────────
function ModalEditar({
  venda,
  onClose,
  onSaved,
}: {
  venda: VendaRow
  onClose: () => void
  onSaved: () => void
}) {
  const [canal, setCanal] = useState(venda.canal_venda)
  const [metodo, setMetodo] = useState(venda.metodo_pagamento)
  const [data, setData] = useState(venda.criado_em.slice(0, 16))
  const [desconto, setDesconto] = useState(String(Number(venda.desconto_aplicado)))
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const subtotal = Number(venda.subtotal)
  const descontoNum = parseFloat(desconto) || 0
  const totalFinal = Math.max(subtotal - descontoNum, 0)

  const selectClass =
    'w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold'

  async function handleSalvar() {
    setLoading(true)
    setErro('')
    const supabase = createClient()

    const { error: errVenda } = await supabase
      .from('vendas')
      .update({
        canal_venda: canal,
        metodo_pagamento: metodo,
        criado_em: new Date(data).toISOString(),
        desconto_aplicado: descontoNum,
        total_final: totalFinal,
      })
      .eq('id', venda.id)

    if (errVenda) {
      setErro(`Erro ao salvar venda: ${errVenda.message}`)
      setLoading(false)
      return
    }

    const { error: errCaixa } = await supabase
      .from('movimentacao_caixa')
      .update({ valor: totalFinal })
      .eq('referencia_venda_id', venda.id)

    setLoading(false)
    if (errCaixa) {
      setErro(`Venda salva, mas erro ao atualizar caixa: ${errCaixa.message}`)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-4">Editar Venda</h3>

        <div className="flex flex-col gap-4">
          {/* Canal */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#888888] font-medium">Canal de Venda</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={selectClass}>
              {CANAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#1A1A1A]">{o.label}</option>
              ))}
            </select>
          </div>

          {/* Método */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#888888] font-medium">Método de Pagamento</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={selectClass}>
              {METODO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#1A1A1A]">{o.label}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#888888] font-medium">Data</label>
            <input
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Desconto */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#888888] font-medium">Desconto (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
            />
          </div>

          {/* Resumo */}
          <div className="bg-[#0D0D0D] rounded-lg p-3 flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#888888]">Subtotal</span>
              <span className="text-[#F0F0F0]">{formatarMoeda(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#888888]">Desconto</span>
              <span className="text-[#F0F0F0]">- {formatarMoeda(descontoNum)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-[#2A2A2A] pt-1 mt-1">
              <span className="text-[#888888]">Total Final</span>
              <span className="text-gold">{formatarMoeda(totalFinal)}</span>
            </div>
          </div>
        </div>

        {erro && <p className="text-xs text-danger mt-3">{erro}</p>}

        <div className="flex gap-2 mt-4">
          <Button variant="primary" fullWidth loading={loading} onClick={handleSalvar}>
            Salvar
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  )
}

// ── Modal confirmação de exclusão ─────────────────────────────────────────────
function ModalExcluir({
  venda,
  onClose,
  onConfirm,
}: {
  venda: VendaRow
  onClose: () => void
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleConfirm() {
    setLoading(true)
    setErro('')
    const supabase = createClient()
    const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: venda.id })
    setLoading(false)
    if (error) { setErro(`Erro: ${error.message}`); return }
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-1">Excluir Venda?</h3>
        <p className="text-xs text-[#888888] mb-3">
          Esta ação é permanente. O estoque será restaurado e a comissão removida.
        </p>
        <div className="bg-[#0D0D0D] rounded-lg p-3 mb-4 flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[#888888]">Vendedora</span>
            <span className="text-[#F0F0F0] font-semibold">{venda.usuarios?.nome ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Data</span>
            <span className="text-[#F0F0F0]">{new Date(venda.criado_em).toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888888]">Total</span>
            <span className="text-danger font-bold">{formatarMoeda(Number(venda.total_final))}</span>
          </div>
        </div>
        {erro && <p className="text-xs text-danger mb-3">{erro}</p>}
        <div className="flex gap-2">
          <Button variant="danger" fullWidth loading={loading} onClick={handleConfirm}>
            Confirmar Exclusão
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </Card>
    </div>
  )
}

// ── Linha expandível da venda ─────────────────────────────────────────────────
function VendaRow({
  venda,
  onDelete,
  onEdit,
}: {
  venda: VendaRow
  onDelete: (v: VendaRow) => void
  onEdit: (v: VendaRow) => void
}) {
  const [expandida, setExpandida] = useState(false)
  const temDesconto = Number(venda.desconto_aplicado) > 0

  return (
    <>
      <tr
        className="bg-[#1A1A1A] border-b border-[#2A2A2A] hover:bg-[#222222] transition-colors cursor-pointer"
        onClick={() => setExpandida((v) => !v)}
      >
        <td className="px-4 py-3 text-[#888888] text-xs whitespace-nowrap">
          {new Date(venda.criado_em).toLocaleDateString('pt-BR')}{' '}
          <span className="text-[#555555]">
            {new Date(venda.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </td>
        <td className="px-4 py-3 text-[#F0F0F0] font-semibold text-sm">
          {venda.usuarios?.nome ?? '—'}
        </td>
        <td className="px-4 py-3 text-[#888888] text-xs">
          {venda.clientes?.nome ?? <span className="text-[#555555]">—</span>}
        </td>
        <td className="px-4 py-3">
          <Badge variant="default">{LABEL_CANAL[venda.canal_venda] ?? venda.canal_venda}</Badge>
        </td>
        <td className="px-4 py-3">
          <Badge variant="default">{LABEL_METODO[venda.metodo_pagamento] ?? venda.metodo_pagamento}</Badge>
        </td>
        <td className="px-4 py-3 text-center text-[#888888] text-xs">
          {venda.itens_venda.reduce((a, i) => a + i.quantidade, 0)} peça{venda.itens_venda.reduce((a, i) => a + i.quantidade, 0) !== 1 ? 's' : ''}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex flex-col items-end">
            <span className="font-black text-gold text-sm">{formatarMoeda(Number(venda.total_final))}</span>
            {temDesconto && (
              <span className="text-[10px] text-[#888888]">- {formatarMoeda(Number(venda.desconto_aplicado))}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(venda) }}
              className="text-xs text-[#888888] hover:text-[#F0F0F0] border border-[#2A2A2A] hover:border-[#555555] hover:bg-[#2A2A2A] rounded px-2 py-1 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(venda) }}
              className="text-xs text-danger hover:text-white border border-danger/40 hover:border-danger hover:bg-danger/10 rounded px-2 py-1 transition-colors"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
      {expandida && (
        <tr className="bg-[#141414] border-b border-[#2A2A2A]">
          <td colSpan={8} className="px-6 py-3">
            <div className="flex flex-col gap-1.5">
              {venda.itens_venda.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-[#888888]">
                  <span className="text-[#F0F0F0]">
                    {item.produtos?.nome ?? 'Produto removido'}
                    {item.produtos?.numero
                      ? ` · Nº ${item.produtos.numero}`
                      : item.produtos?.tamanho
                        ? ` · ${item.produtos.tamanho}`
                        : ''}
                  </span>
                  <span>
                    {item.quantidade}× {formatarMoeda(Number(item.preco_unitario))} ={' '}
                    <span className="text-gold font-semibold">{formatarMoeda(Number(item.subtotal_item))}</span>
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function VendasPage() {
  const [mes, setMes] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [vendedorFiltro, setVendedorFiltro] = useState('')
  const [modalExcluir, setModalExcluir] = useState<VendaRow | null>(null)
  const [modalEditar, setModalEditar] = useState<VendaRow | null>(null)

  const cacheKey = ['vendas', mes, vendedorFiltro]
  const { data: vendas = [], isLoading } = useSWR(
    cacheKey,
    () => fetchVendas(mes, vendedorFiltro),
    { refreshInterval: 60000 }
  )
  const { data: funcionarias = [] } = useSWR('usuarios-vendas', fetchUsuarios)

  const totalMes = vendas.reduce((a, v) => a + Number(v.total_final), 0)
  const qtdVendas = vendas.length

  function handleDeleted() {
    mutate(cacheKey)
  }

  function handleEdited() {
    mutate(cacheKey)
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Vendas</h1>
            <a href="/dashboard" className="text-xs text-[#888888] hover:text-gold transition-colors">← Dashboard</a>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#888888]">
            <span>{qtdVendas} venda{qtdVendas !== 1 ? 's' : ''}</span>
            <span className="text-gold font-black text-sm">{formatarMoeda(totalMes)}</span>
          </div>
        </div>

        {/* Filtros */}
        <Card padding="sm">
          <div className="flex gap-4 flex-wrap items-end">
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#888888] font-medium">Vendedora</label>
              <select
                value={vendedorFiltro}
                onChange={(e) => setVendedorFiltro(e.target.value)}
                className="bg-[#0D0D0D] border border-[#2A2A2A] rounded px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-gold"
              >
                <option value="">Todas</option>
                {funcionarias.map((f: { id: string; nome: string }) => (
                  <option key={f.id} value={f.id} className="bg-[#1A1A1A]">{f.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-lg border border-[#2A2A2A]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Vendedora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Canal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Pagamento</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Peças</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#888888] uppercase tracking-wide">Ação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#2A2A2A]">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : vendas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-[#888888]">
                    Nenhuma venda encontrada neste período
                  </td>
                </tr>
              ) : (
                vendas.map((v) => (
                  <VendaRow key={v.id} venda={v} onDelete={setModalExcluir} onEdit={setModalEditar} />
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-[#555555] text-center">
          Clique em uma linha para ver os itens da venda · Excluir restaura o estoque automaticamente
        </p>
      </div>

      {modalExcluir && (
        <ModalExcluir
          venda={modalExcluir}
          onClose={() => setModalExcluir(null)}
          onConfirm={handleDeleted}
        />
      )}

      {modalEditar && (
        <ModalEditar
          venda={modalEditar}
          onClose={() => setModalEditar(null)}
          onSaved={handleEdited}
        />
      )}
    </div>
  )
}
