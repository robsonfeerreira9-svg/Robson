'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/utils/preco'

interface VendaMes {
  id: string
  total_final: number
  desconto_aplicado: number
  metodo_pagamento: string
  canal_venda: string
  criado_em: string
  vendedor_id: string
  cliente_id: string | null
  usuarios: { nome: string } | null
  clientes: { nome: string } | null
  itens_venda: {
    quantidade: number
    subtotal_item: number
    produtos: { nome: string; tamanho: string } | null
  }[]
}

export default function RelatorioPage() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [vendas, setVendas] = useState<VendaMes[]>([])
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [ano, m] = mes.split('-')
      const inicio = new Date(Number(ano), Number(m) - 1, 1).toISOString()
      const fim = new Date(Number(ano), Number(m), 1).toISOString()

      const { data } = await supabase
        .from('vendas')
        .select(`
          id, total_final, desconto_aplicado, metodo_pagamento, canal_venda, criado_em, vendedor_id, cliente_id,
          usuarios(nome), clientes(nome),
          itens_venda(quantidade, subtotal_item, produtos(nome, tamanho))
        `)
        .gte('criado_em', inicio)
        .lt('criado_em', fim)
        .order('criado_em', { ascending: false })

      setVendas((data as VendaMes[]) ?? [])
      setLoading(false)
    }
    load()
  }, [mes])

  const totalMes = vendas.reduce((s, v) => s + Number(v.total_final), 0)
  const totalDescontos = vendas.reduce((s, v) => s + Number(v.desconto_aplicado), 0)
  const ticketMedio = vendas.length > 0 ? totalMes / vendas.length : 0

  // Ranking vendedores
  const rankVend: Record<string, { nome: string; qtd: number; total: number }> = {}
  for (const v of vendas) {
    const nome = v.usuarios?.nome ?? 'Desconhecido'
    if (!rankVend[v.vendedor_id]) rankVend[v.vendedor_id] = { nome, qtd: 0, total: 0 }
    rankVend[v.vendedor_id].qtd++
    rankVend[v.vendedor_id].total += Number(v.total_final)
  }
  const ranking = Object.values(rankVend).sort((a, b) => b.total - a.total)

  // Produtos top
  const rankProd: Record<string, { nome: string; qtd: number; total: number }> = {}
  for (const v of vendas) {
    for (const item of v.itens_venda) {
      const nome = item.produtos?.nome ?? 'Produto'
      if (!rankProd[nome]) rankProd[nome] = { nome, qtd: 0, total: 0 }
      rankProd[nome].qtd += item.quantidade
      rankProd[nome].total += Number(item.subtotal_item)
    }
  }
  const produtos = Object.values(rankProd).sort((a, b) => b.qtd - a.qtd)

  // Métodos de pagamento
  const metodos: Record<string, { label: string; qtd: number; total: number }> = {}
  for (const v of vendas) {
    const labels: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro' }
    const k = v.metodo_pagamento
    if (!metodos[k]) metodos[k] = { label: labels[k] ?? k, qtd: 0, total: 0 }
    metodos[k].qtd++
    metodos[k].total += Number(v.total_final)
  }

  const mesLabel = new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const medals = ['🥇', '🥈', '🥉', '4º', '5º', '6º', '7º', '8º']

  return (
    <>
      {/* Barra de controles — não aparece no PDF */}
      <div className="no-print bg-[#1A1A1A] border-b border-[#2A2A2A] px-6 py-3 flex items-center gap-4">
        <a href="/dashboard" className="text-gold text-sm hover:underline">← Dashboard</a>
        <span className="text-[#888] text-sm">Relatório Gerencial</span>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="bg-[#0D0D0D] border border-[#2A2A2A] text-[#F0F0F0] text-sm px-3 py-1.5 rounded focus:outline-none focus:border-gold"
            style={{ colorScheme: 'dark' }}
          />
          <button
            onClick={() => window.print()}
            className="bg-[#C9A84C] text-[#0D0D0D] font-black text-sm px-5 py-2 rounded-lg uppercase tracking-wide hover:bg-[#e6b800] transition-colors"
          >
            ⬇ Salvar PDF
          </button>
        </div>
      </div>

      {/* Conteúdo do relatório */}
      <div ref={printRef} className="print-page bg-white text-[#1a1a2e] min-h-screen">

        {/* Cabeçalho */}
        <div className="header-bar" style={{ background: '#1a1a2e', color: '#fff', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 6, color: '#C9A84C', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              HG GRIFES
            </div>
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' }}>
              Sistema de Gestão — ERP
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A84C', textTransform: 'capitalize' }}>
              Relatório {mesLabel}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              Gerado em {geradoEm}
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 48px', fontFamily: 'Arial, sans-serif' }}>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando dados...</p>
          ) : (
            <>
              {/* Cards de resumo */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
                {[
                  { label: 'Total do Mês', value: formatarMoeda(totalMes), color: '#27ae60' },
                  { label: 'Vendas Realizadas', value: String(vendas.length), color: '#2980b9' },
                  { label: 'Ticket Médio', value: formatarMoeda(ticketMedio), color: '#8e44ad' },
                  { label: 'Descontos Dados', value: formatarMoeda(totalDescontos), color: '#e67e22' },
                ].map(card => (
                  <div key={card.label} style={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: 8, padding: '16px 12px', textAlign: 'center', borderTop: `4px solid ${card.color}` }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Ranking Vendedores */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '2px solid #C9A84C', paddingBottom: 6, marginBottom: 12, color: '#1a1a2e' }}>
                  Ranking de Vendedores
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555' }}>Vendedor</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555' }}>Vendas</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>Total</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>% do Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((v, i) => (
                      <tr key={v.nome} style={{ borderBottom: '1px solid #f0f0f0', background: i === 0 ? '#fffbf0' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: i === 0 ? 700 : 400 }}>{medals[i] || `${i+1}º`} {v.nome}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{v.qtd}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#27ae60' : '#333' }}>{formatarMoeda(v.total)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>
                          {totalMes > 0 ? ((v.total / totalMes) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                    {ranking.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#aaa' }}>Nenhuma venda no período</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Formas de pagamento */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '2px solid #C9A84C', paddingBottom: 6, marginBottom: 12, color: '#1a1a2e' }}>
                  Formas de Pagamento
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555' }}>Método</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555' }}>Qtd</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>Total</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(metodos).sort((a,b) => b.total - a.total).map(m => (
                      <tr key={m.label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.label}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{m.qtd}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatarMoeda(m.total)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>
                          {totalMes > 0 ? ((m.total / totalMes) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                    {Object.keys(metodos).length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#aaa' }}>Nenhuma venda</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Produtos mais vendidos */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '2px solid #C9A84C', paddingBottom: 6, marginBottom: 12, color: '#1a1a2e' }}>
                  Produtos Mais Vendidos
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#555' }}>Produto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: '#555' }}>Qtd Vendida</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.slice(0, 15).map((p, i) => (
                      <tr key={p.nome} style={{ borderBottom: '1px solid #f0f0f0', background: i === 0 ? '#fffbf0' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', color: '#888', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: i === 0 ? 700 : 400 }}>{p.nome}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{p.qtd}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatarMoeda(p.total)}</td>
                      </tr>
                    ))}
                    {produtos.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#aaa' }}>Nenhum produto vendido</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Detalhamento de Vendas */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderBottom: '2px solid #C9A84C', paddingBottom: 6, marginBottom: 12, color: '#1a1a2e' }}>
                  Detalhamento de Vendas
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#555' }}>Data</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#555' }}>Cliente</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#555' }}>Vendedor</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#555' }}>Pagamento</th>
                      <th style={{ padding: '7px 10px', textAlign: 'right', color: '#555' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((v, i) => {
                      const labels: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro' }
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '6px 10px', color: '#555' }}>
                            {new Date(v.criado_em).toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ padding: '6px 10px' }}>{v.clientes?.nome ?? '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{v.usuarios?.nome ?? '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{labels[v.metodo_pagamento] ?? v.metodo_pagamento}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{formatarMoeda(Number(v.total_final))}</td>
                        </tr>
                      )
                    })}
                    {vendas.length === 0 && <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#aaa' }}>Nenhuma venda no período</td></tr>}
                  </tbody>
                  {vendas.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#1a1a2e', color: '#fff' }}>
                        <td colSpan={4} style={{ padding: '10px 10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Total Geral — {vendas.length} venda(s)
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#C9A84C' }}>
                          {formatarMoeda(totalMes)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Rodapé */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#aaa', fontSize: 11 }}>
                <span>HG Grifes ERP · Relatório Gerencial</span>
                <span style={{ color: '#C9A84C', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>HG GRIFES</span>
                <span>Gerado em {geradoEm}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; }
          body { background: white !important; }
          @page {
            size: A4 landscape;
            margin: 15mm 12mm;
          }
        }
        @media screen {
          .print-page { max-width: 1100px; margin: 0 auto; box-shadow: 0 0 40px rgba(0,0,0,0.3); }
        }
      `}</style>
    </>
  )
}
