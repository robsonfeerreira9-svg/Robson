'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import {
  formatarMoeda,
  formatarCPF,
  formatarTelefone,
} from '@/lib/utils/preco'
import type { ProdutoComEstoque, CanalVenda, MetodoPagamento, Usuario, Campanha } from '@/lib/database.types'

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface CartItem {
  produto: ProdutoComEstoque
  quantidade: number
}

interface DadosCliente {
  nome: string
  cpf: string
  telefone: string
  dataNascimento: string
}

interface CartProps {
  items: CartItem[]
  onUpdateQty: (produtoId: string, qty: number) => void
  onRemove: (produtoId: string) => void
  onClear: () => void
  onVendaRealizada: () => void
}

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchVendedores(): Promise<Usuario[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data ?? []
}

async function fetchCampanhasAtivas(): Promise<Campanha[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('campanhas')
    .select('*')
    .eq('ativa', true)
    .order('desconto_pct', { ascending: false })
  return (data as Campanha[]) ?? []
}

// ── Métodos de pagamento ──────────────────────────────────────────────────────
const METODOS: { value: MetodoPagamento; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
]

const CANAIS_VENDA: { value: CanalVenda; label: string }[] = [
  { value: 'fisico', label: 'Física' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
]

// ── Toast simples ─────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function show(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  return { toast, show }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Cart({ items, onUpdateQty, onRemove, onClear, onVendaRealizada }: CartProps) {
  const { data: vendedores = [] } = useSWR('vendedores', fetchVendedores)
  const { data: campanhasAtivas = [] } = useSWR('campanhas-pdv', fetchCampanhasAtivas, { refreshInterval: 60000 })
  const { toast, show } = useToast()

  const [vendedorId, setVendedorId] = useState('')
  const [canalVenda, setCanalVenda] = useState<CanalVenda>('fisico')
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('pix')
  const [loading, setLoading] = useState(false)
  const [campanhaId, setCampanhaId] = useState('')
  const [descontoManualPct, setDescontoManualPct] = useState('')

  // Dados do cliente
  const [cliente, setCliente] = useState<DadosCliente>({
    nome: '',
    cpf: '',
    telefone: '',
    dataNascimento: '',
  })

  // ── Cálculos ────────────────────────────────────────────────────────────
  const subtotal = items.reduce((acc, i) => acc + i.produto.preco_venda * i.quantidade, 0)
  const campanhaSelecionada = campanhasAtivas.find((c) => c.id === campanhaId) ?? null
  const descontoCampanha = campanhaSelecionada && subtotal > 0
    ? Number((subtotal * campanhaSelecionada.desconto_pct / 100).toFixed(2))
    : 0
  const descontoManualPctNum = Math.max(0, Math.min(100, parseFloat(descontoManualPct) || 0))
  const descontoManual = descontoManualPctNum > 0 && subtotal > 0
    ? Number(((subtotal - descontoCampanha) * descontoManualPctNum / 100).toFixed(2))
    : 0
  const totalDesconto = descontoCampanha + descontoManual
  const totalFinal = subtotal - totalDesconto

  // ── Finalizar venda ──────────────────────────────────────────────────────
  async function handleFinalizarVenda() {
    if (items.length === 0 || !vendedorId) return
    setLoading(true)

    try {
      const supabase = createClient()

      const itens = items.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        preco_unitario: i.produto.preco_venda,
        subtotal_item: Number((i.produto.preco_venda * i.quantidade).toFixed(2)),
      }))

      const { error } = await supabase.rpc('realizar_venda', {
        p_vendedor_id: vendedorId,
        p_canal_venda: canalVenda,
        p_metodo_pagamento: metodoPagamento,
        p_subtotal: Number(subtotal.toFixed(2)),
        p_desconto_aplicado: Number(totalDesconto.toFixed(2)),
        p_total_final: Number(totalFinal.toFixed(2)),
        p_itens: itens,
        p_cliente_cpf: cliente.cpf.replace(/\D/g, '') || undefined,
        p_cliente_nome: cliente.nome || undefined,
        p_cliente_telefone: cliente.telefone.replace(/\D/g, '') || undefined,
        p_cliente_nascimento: cliente.dataNascimento || undefined,
      } as never)

      if (error) {
        show(`Erro: ${error.message}`, 'error')
        return
      }

      show('Venda realizada com sucesso!', 'success')
      onClear()
      onVendaRealizada()
      setCliente({ nome: '', cpf: '', telefone: '', dataNascimento: '' })
      setCampanhaId('')
      setDescontoManualPct('')
    } catch (err) {
      show('Erro inesperado. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const podeFinalizarVenda = items.length > 0 && vendedorId !== ''

  return (
    <div className="flex flex-col h-full bg-[#1A1A1A] border-l border-[#2A2A2A]">
      {/* Header */}
      <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between">
        <h2 className="font-bold text-[#F0F0F0] uppercase tracking-wide text-sm">
          Carrinho
        </h2>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-[#888888] hover:text-[#FF4444] transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Itens do carrinho */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#888888] p-4">
            <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.produto.id}
                className="flex items-center gap-3 p-2 bg-[#0D0D0D] rounded-lg border border-[#2A2A2A]"
              >
                {/* Foto miniatura */}
                <div className="relative w-12 h-12 flex-shrink-0 bg-[#1A1A1A] rounded overflow-hidden">
                  {item.produto.foto_url ? (
                    <Image src={item.produto.foto_url} alt={item.produto.nome} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#2A2A2A]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Detalhes */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#F0F0F0] truncate">{item.produto.nome}</p>
                  <p className="text-[10px] text-[#888888]">{item.produto.numero || item.produto.tamanho} · {formatarMoeda(item.produto.preco_venda)}</p>
                  <p className="text-xs font-bold text-gold">{formatarMoeda(item.produto.preco_venda * item.quantidade)}</p>
                </div>

                {/* Controle de quantidade */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQty(item.produto.id, item.quantidade - 1)}
                    className="w-6 h-6 rounded bg-[#2A2A2A] text-[#F0F0F0] text-xs flex items-center justify-center hover:bg-[#3A3A3A]"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-[#F0F0F0]">
                    {item.quantidade}
                  </span>
                  <button
                    onClick={() => {
                      const estoqueMax = item.produto.estoque?.[0]?.quantidade ?? 0
                      if (item.quantidade < estoqueMax) {
                        onUpdateQty(item.produto.id, item.quantidade + 1)
                      }
                    }}
                    className="w-6 h-6 rounded bg-[#2A2A2A] text-[#F0F0F0] text-xs flex items-center justify-center hover:bg-[#3A3A3A]"
                  >
                    +
                  </button>
                </div>

                {/* Remover */}
                <button
                  onClick={() => onRemove(item.produto.id)}
                  className="text-[#888888] hover:text-[#FF4444] transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#2A2A2A] mx-3 my-1" />

        {/* Dados do cliente */}
        <div className="p-3">
          <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">
            Dados do Cliente
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Nome completo"
              value={cliente.nome}
              onChange={(e) => setCliente((c) => ({ ...c, nome: e.target.value }))}
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2.5 py-2 text-xs text-[#F0F0F0] placeholder:text-[#888888] focus:outline-none focus:border-gold"
            />
            <input
              type="text"
              placeholder="CPF (000.000.000-00)"
              value={cliente.cpf}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
                setCliente((c) => ({ ...c, cpf: formatarCPF(raw) }))
              }}
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2.5 py-2 text-xs text-[#F0F0F0] placeholder:text-[#888888] focus:outline-none focus:border-gold"
            />
            <input
              type="text"
              placeholder="Telefone (00) 00000-0000"
              value={cliente.telefone}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
                setCliente((c) => ({ ...c, telefone: formatarTelefone(raw) }))
              }}
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2.5 py-2 text-xs text-[#F0F0F0] placeholder:text-[#888888] focus:outline-none focus:border-gold"
            />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888888]">Data de nascimento</label>
              <input
                type="date"
                value={cliente.dataNascimento}
                onChange={(e) => setCliente((c) => ({ ...c, dataNascimento: e.target.value }))}
                className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2.5 py-2 text-xs text-[#F0F0F0] focus:outline-none focus:border-gold"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#2A2A2A] mx-3 my-1" />

        {/* Vendedor */}
        <div className="p-3">
          <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">
            Vendedor
          </p>
          <select
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2.5 py-2 text-xs text-[#F0F0F0] focus:outline-none focus:border-gold"
          >
            <option value="">Selecionar vendedor...</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#1A1A1A]">
                {v.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Canal da venda */}
        <div className="px-3 pb-3">
          <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">Canal</p>
          <div className="flex gap-1.5">
            {CANAIS_VENDA.map((c) => (
              <button
                key={c.value}
                onClick={() => setCanalVenda(c.value)}
                className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                  canalVenda === c.value
                    ? 'bg-gold text-[#0D0D0D] border-gold'
                    : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Método de pagamento */}
        <div className="px-3 pb-3">
          <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">
            Pagamento
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {METODOS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetodoPagamento(m.value)}
                className={`py-2 rounded text-xs font-bold border transition-colors ${
                  metodoPagamento === m.value
                    ? 'bg-gold text-[#0D0D0D] border-gold'
                    : 'bg-transparent text-[#888888] border-[#2A2A2A] hover:border-gold'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desconto manual % */}
        <div className="px-3 pb-3">
          <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">Desconto</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              placeholder="0"
              value={descontoManualPct}
              onChange={(e) => setDescontoManualPct(e.target.value)}
              className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded px-2.5 py-2 text-xs text-[#F0F0F0] placeholder:text-[#888888] focus:outline-none focus:border-gold"
            />
            <span className="text-sm font-bold text-[#888888] flex-shrink-0">%</span>
            {descontoManualPctNum > 0 && (
              <span className="text-xs text-gold font-semibold flex-shrink-0">
                − {formatarMoeda(descontoManual)}
              </span>
            )}
          </div>
        </div>

        {/* Campanha / Desconto */}
        <div className="px-3 pb-3">
          <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide mb-2">
            Campanha
          </p>
          {campanhasAtivas.length === 0 ? (
            <p className="text-xs text-[#888888]">Nenhuma campanha ativa</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setCampanhaId('')}
                className={`w-full text-left py-1.5 px-2.5 rounded text-xs border transition-colors ${
                  campanhaId === ''
                    ? 'bg-[#2A2A2A] border-[#2A2A2A] text-[#F0F0F0]'
                    : 'bg-transparent border-[#2A2A2A] text-[#888888] hover:border-gold'
                }`}
              >
                Sem campanha
              </button>
              {campanhasAtivas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCampanhaId(c.id)}
                  className={`w-full text-left py-1.5 px-2.5 rounded text-xs border transition-colors flex justify-between items-center ${
                    campanhaId === c.id
                      ? 'bg-gold/10 border-gold text-gold'
                      : 'bg-transparent border-[#2A2A2A] text-[#888888] hover:border-gold'
                  }`}
                >
                  <span className="truncate">{c.nome}</span>
                  <span className="font-bold ml-2 flex-shrink-0">{c.desconto_pct}% OFF</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé com totais e botão */}
      <div className="border-t border-[#2A2A2A] p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between text-[#888888]">
            <span>Subtotal</span>
            <span>{formatarMoeda(subtotal)}</span>
          </div>
          {campanhaSelecionada && descontoCampanha > 0 && (
            <div className="flex justify-between text-gold font-semibold">
              <span>{campanhaSelecionada.nome} ({campanhaSelecionada.desconto_pct}%)</span>
              <span>− {formatarMoeda(descontoCampanha)}</span>
            </div>
          )}
          {descontoManual > 0 && (
            <div className="flex justify-between text-gold font-semibold">
              <span>Desconto ({descontoManualPctNum}%)</span>
              <span>− {formatarMoeda(descontoManual)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-[#F0F0F0] text-base pt-1 border-t border-[#2A2A2A] mt-1">
            <span>Total</span>
            <span className="text-gold">{formatarMoeda(totalFinal)}</span>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!podeFinalizarVenda}
          onClick={handleFinalizarVenda}
          className="h-13 text-sm"
        >
          {!vendedorId
            ? 'Selecione um vendedor'
            : items.length === 0
            ? 'Carrinho vazio'
            : 'Finalizar Venda'}
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-green-500/20 border border-green-500/40 text-green-400'
              : 'bg-red-500/20 border border-red-500/40 text-red-400'
          }`}
        >
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  )
}
