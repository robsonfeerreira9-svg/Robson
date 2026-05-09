import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const RESEND_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_OWNER = 'Robsonfeerreira9@gmail.com'
const EMAILS_ALL = ['Robsonfeerreira9@gmail.com', 'hugobrener1@gmail.com']

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export async function POST() {
  try {
    if (!RESEND_KEY) {
      return NextResponse.json({ ok: false, error: 'RESEND_API_KEY não configurado' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const hoje = new Date().toISOString().slice(0, 10)
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // Vendas hoje
    const { data: vendasHoje } = await supabase
      .from('vendas')
      .select('total_final, desconto_aplicado')
      .gte('criado_em', hoje + 'T00:00:00')
    const qtdHoje = vendasHoje?.length ?? 0
    const totalHoje = vendasHoje?.reduce((s, v) => s + Number(v.total_final), 0) ?? 0

    // Vendas do mês
    const { data: vendasMes } = await supabase
      .from('vendas')
      .select('total_final, vendedor_id, cliente_id, criado_em, itens_venda(quantidade, subtotal_item, produto_id, produtos(nome))')
      .gte('criado_em', inicioMes)
    const qtdMes = vendasMes?.length ?? 0
    const totalMes = vendasMes?.reduce((s, v) => s + Number(v.total_final), 0) ?? 0

    // Ranking vendedores
    const { data: usuarios } = await supabase.from('usuarios').select('id, nome')
    const rankMap: Record<string, { nome: string; qtd: number; total: number }> = {}
    for (const v of vendasMes ?? []) {
      if (!v.vendedor_id) continue
      const nome = usuarios?.find(u => u.id === v.vendedor_id)?.nome ?? 'Desconhecido'
      if (!rankMap[v.vendedor_id]) rankMap[v.vendedor_id] = { nome, qtd: 0, total: 0 }
      rankMap[v.vendedor_id].qtd++
      rankMap[v.vendedor_id].total += Number(v.total_final)
    }
    const ranking = Object.values(rankMap).sort((a, b) => b.total - a.total).slice(0, 5)

    // Produtos top
    const prodMap: Record<string, { nome: string; qtd: number; total: number }> = {}
    for (const v of vendasMes ?? []) {
      for (const item of (v.itens_venda as any[]) ?? []) {
        const nome = item.produtos?.nome ?? 'Produto'
        if (!prodMap[nome]) prodMap[nome] = { nome, qtd: 0, total: 0 }
        prodMap[nome].qtd += item.quantidade
        prodMap[nome].total += Number(item.subtotal_item)
      }
    }
    const produtos = Object.values(prodMap).sort((a, b) => b.qtd - a.qtd).slice(0, 5)

    // Clientes novos vs recorrentes (hoje)
    const clientesHoje = new Set((vendasHoje ?? []).filter(v => (v as any).cliente_id).map(v => (v as any).cliente_id))

    // Contas a pagar
    const { data: contas } = await supabase
      .from('movimentacao_caixa')
      .select('descricao, valor, vence_em')
      .eq('tipo', 'saida')
      .or('pago.is.null,pago.eq.false')
      .not('vence_em', 'is', null)
      .order('vence_em')
      .limit(10)

    const dataHoje = new Date().toLocaleDateString('pt-BR')
    const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Ranking HTML
    const medals = ['🥇', '🥈', '🥉', '4º', '5º']
    const vendRows = ranking.map((v, i) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${medals[i]} ${i === 0 ? `<b>${v.nome}</b>` : v.nome}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${v.qtd}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${i === 0 ? `<b>${brl(v.total)}</b>` : brl(v.total)}</td>
      </tr>`).join('')

    const prodRows = produtos.map((p, i) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${i === 0 ? `<b>${p.nome}</b>` : p.nome}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${p.qtd}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${brl(p.total)}</td>
      </tr>`).join('')

    const contaRows = (contas ?? []).map(c => {
      const venc = c.vence_em ? new Date(c.vence_em + 'T12:00:00').toLocaleDateString('pt-BR') : ''
      const hoje2 = new Date().toISOString().slice(0, 10)
      const status = c.vence_em < hoje2 ? 'VENCIDA' : c.vence_em === hoje2 ? 'VENCE HOJE' : 'A VENCER'
      const cor = status === 'VENCIDA' ? '#c0392b' : status === 'VENCE HOJE' ? '#e67e22' : '#27ae60'
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${c.descricao}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${brl(Number(c.valor))}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${venc}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center"><span style="background:${cor};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px">${status}</span></td>
      </tr>`
    }).join('')

    const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e">
  <div style="background:#1a1a2e;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">HG Grifes ERP — Relatório de Vendas</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:.85">${dataHoje} · Enviado após nova venda</p>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div style="flex:1;min-width:120px;background:#f8f9fa;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
        <div style="font-size:28px;font-weight:700;color:#1a1a2e">${qtdHoje}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Vendas hoje</div>
      </div>
      <div style="flex:1;min-width:120px;background:#f8f9fa;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
        <div style="font-size:22px;font-weight:700;color:#27ae60">${brl(totalHoje)}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Total hoje</div>
      </div>
      <div style="flex:1;min-width:120px;background:#f8f9fa;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
        <div style="font-size:22px;font-weight:700;color:#2980b9">${brl(totalMes)}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Total ${mesNome}</div>
      </div>
      <div style="flex:1;min-width:120px;background:#f8f9fa;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
        <div style="font-size:22px;font-weight:700;color:#8e44ad">${qtdMes}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">Vendas no mês</div>
      </div>
    </div>

    <h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a2e">Ranking de Vendedores — ${mesNome}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;text-align:left">Vendedor</th>
        <th style="padding:8px 12px;text-align:center">Vendas</th>
        <th style="padding:8px 12px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${vendRows || '<tr><td colspan="3" style="padding:10px;color:#888;text-align:center">Nenhuma venda este mês</td></tr>'}</tbody>
    </table>

    <h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a2e">Produtos Mais Vendidos — ${mesNome}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;text-align:left">Produto</th>
        <th style="padding:8px 12px;text-align:center">Qtd</th>
        <th style="padding:8px 12px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${prodRows || '<tr><td colspan="3" style="padding:10px;color:#888;text-align:center">Nenhum produto vendido</td></tr>'}</tbody>
    </table>

    <h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a2e">Contas a Pagar</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0f0f0">
        <th style="padding:8px 12px;text-align:left">Descrição</th>
        <th style="padding:8px 12px;text-align:right">Valor</th>
        <th style="padding:8px 12px;text-align:center">Vencimento</th>
        <th style="padding:8px 12px;text-align:center">Status</th>
      </tr></thead>
      <tbody>${contaRows || '<tr><td colspan="4" style="padding:10px;color:#888;text-align:center">Nenhuma conta a pagar</td></tr>'}</tbody>
    </table>

    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#aaa;font-size:11px;margin:0">HG Grifes ERP · Relatório automático pós-venda</p>
  </div>
</div>`

    const subject = `HG Grifes ${dataHoje} — ${qtdHoje} venda(s) hoje · ${brl(totalHoje)} | Mês: ${brl(totalMes)}`

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HG Grifes ERP <onboarding@resend.dev>',
        to: [EMAIL_OWNER],
        subject,
        html,
      }),
    })

    const data = await resp.json()

    if (data.id) {
      return NextResponse.json({ ok: true, id: data.id })
    } else {
      return NextResponse.json({ ok: false, error: data })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
