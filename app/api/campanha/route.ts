import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

interface MidiaItem {
  url: string
  tipo: 'image' | 'video'
}

async function zapiPost(instanceId: string, token: string, clientToken: string, endpoint: string, body: object) {
  const res = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      body: JSON.stringify(body),
    }
  )
  return res
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(req: NextRequest) {
  const { telefone, mensagem, midias } = await req.json() as {
    telefone: string
    mensagem: string
    midias?: MidiaItem[]
  }

  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token || !clientToken) {
    return NextResponse.json(
      { error: 'WhatsApp API não configurada. Adicione ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN.' },
      { status: 503 }
    )
  }

  if (!telefone || !mensagem) {
    return NextResponse.json({ error: 'telefone e mensagem são obrigatórios' }, { status: 400 })
  }

  const num   = String(telefone).replace(/\D/g, '')
  const phone = num.startsWith('55') ? num : `55${num}`

  try {
    if (!midias || midias.length === 0) {
      // Somente texto
      const res = await zapiPost(instanceId, token, clientToken, 'send-text', { phone, message: mensagem })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return NextResponse.json({ error: body?.message ?? `Erro ${res.status}` }, { status: res.status })
    } else {
      // Primeira mídia com caption (= a mensagem personalizada)
      const primeira = midias[0]
      const ep1 = primeira.tipo === 'video' ? 'send-video' : 'send-image'
      const bk1 = primeira.tipo === 'video' ? 'video'      : 'image'
      const res1 = await zapiPost(instanceId, token, clientToken, ep1, {
        phone,
        [bk1]: primeira.url,
        caption: mensagem,
      })
      const b1 = await res1.json().catch(() => ({}))
      if (!res1.ok) return NextResponse.json({ error: b1?.message ?? `Erro ${res1.status}` }, { status: res1.status })

      // Mídias restantes sem caption
      for (const midia of midias.slice(1)) {
        await sleep(800)
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
