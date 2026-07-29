import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

interface MidiaItem {
  url: string
  tipo: 'image' | 'video'
}

async function carregarCredenciais(): Promise<{ instanceId: string; token: string; clientToken: string } | null> {
  // Prioridade 1: env vars (GitHub Secrets via Vercel)
  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (instanceId && token && clientToken) {
    return { instanceId, token, clientToken }
  }

  // Prioridade 2: banco de dados (configuracoes)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['ZAPI_INSTANCE_ID', 'ZAPI_TOKEN', 'ZAPI_CLIENT_TOKEN'])

    const cfg: Record<string, string> = {}
    for (const row of data ?? []) cfg[row.chave] = row.valor

    const id  = instanceId  || cfg.ZAPI_INSTANCE_ID
    const tk  = token       || cfg.ZAPI_TOKEN
    const ct  = clientToken || cfg.ZAPI_CLIENT_TOKEN

    if (id && tk && ct) return { instanceId: id, token: tk, clientToken: ct }
  } catch { /* falha silenciosa */ }

  return null
}

async function zapiPost(instanceId: string, token: string, clientToken: string, endpoint: string, body: object) {
  return fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      body: JSON.stringify(body),
    }
  )
}

export async function POST(req: NextRequest) {
  const { telefone, mensagem, midias } = await req.json() as {
    telefone: string
    mensagem: string
    midias?: MidiaItem[]
  }

  if (!telefone || !mensagem) {
    return NextResponse.json({ error: 'telefone e mensagem são obrigatórios' }, { status: 400 })
  }

  const creds = await carregarCredenciais()
  if (!creds) {
    return NextResponse.json(
      { error: 'WhatsApp não configurado. Vá em Clientes → ⚙️ Configurar WhatsApp e preencha as credenciais Z-API.' },
      { status: 503 }
    )
  }

  const { instanceId, token, clientToken } = creds
  const num   = String(telefone).replace(/\D/g, '')
  const phone = num.startsWith('55') ? num : `55${num}`

  try {
    if (!midias || midias.length === 0) {
      const res = await zapiPost(instanceId, token, clientToken, 'send-text', { phone, message: mensagem })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: (body as {message?: string}).message ?? `Erro ${res.status}` }, { status: res.status })
    } else {
      const primeira = midias[0]
      const ep1 = primeira.tipo === 'video' ? 'send-video' : 'send-image'
      const bk1 = primeira.tipo === 'video' ? 'video'      : 'image'
      const res1 = await zapiPost(instanceId, token, clientToken, ep1, { phone, [bk1]: primeira.url, caption: mensagem })
      const b1 = await res1.json().catch(() => ({}))
      if (!res1.ok) return NextResponse.json({ error: (b1 as {message?: string}).message ?? `Erro ${res1.status}` }, { status: res1.status })

      for (const midia of midias.slice(1)) {
        await new Promise((r) => setTimeout(r, 800))
        const ep = midia.tipo === 'video' ? 'send-video' : 'send-image'
        const bk = midia.tipo === 'video' ? 'video'      : 'image'
        await zapiPost(instanceId, token, clientToken, ep, { phone, [bk]: midia.url })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
