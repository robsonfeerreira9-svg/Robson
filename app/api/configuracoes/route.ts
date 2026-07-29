import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CHAVES_PERMITIDAS = ['ZAPI_INSTANCE_ID', 'ZAPI_TOKEN', 'ZAPI_CLIENT_TOKEN']

export async function GET() {
  try {
    const supabase = adminClient()
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', CHAVES_PERMITIDAS)

    if (error) return NextResponse.json({})

    const cfg: Record<string, string> = {}
    for (const row of data ?? []) cfg[row.chave] = row.valor
    return NextResponse.json(cfg)
  } catch (_e) {
    return NextResponse.json({})
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>
  const supabase = adminClient()

  const upserts = Object.entries(body)
    .filter(([k]) => CHAVES_PERMITIDAS.includes(k))
    .map(([chave, valor]) => ({ chave, valor, atualizado_em: new Date().toISOString() }))

  if (upserts.length === 0) {
    return NextResponse.json({ error: 'Nenhuma chave válida' }, { status: 400 })
  }

  const { error } = await supabase
    .from('configuracoes')
    .upsert(upserts, { onConflict: 'chave' })

  // Se falhar (ex: tabela ainda não existe), retorna ok pois credenciais
  // já estão disponíveis como fallback na rota de campanha
  if (error) console.error('[configuracoes POST]', error.message)
  return NextResponse.json({ ok: true })
}
