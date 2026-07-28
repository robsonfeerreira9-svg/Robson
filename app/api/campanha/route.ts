import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { telefone, mensagem } = await req.json()

  const instanceId   = process.env.ZAPI_INSTANCE_ID
  const token        = process.env.ZAPI_TOKEN
  const clientToken  = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token || !clientToken) {
    return NextResponse.json(
      { error: 'WhatsApp API não configurada. Adicione ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nas variáveis de ambiente.' },
      { status: 503 }
    )
  }

  if (!telefone || !mensagem) {
    return NextResponse.json({ error: 'telefone e mensagem são obrigatórios' }, { status: 400 })
  }

  const num   = String(telefone).replace(/\D/g, '')
  const phone = num.startsWith('55') ? num : `55${num}`

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken,
        },
        body: JSON.stringify({ phone, message: mensagem }),
      }
    )

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { error: body?.message ?? `Z-API erro ${res.status}` },
        { status: res.status }
      )
    }

    return NextResponse.json({ ok: true, zapiResponse: body })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
