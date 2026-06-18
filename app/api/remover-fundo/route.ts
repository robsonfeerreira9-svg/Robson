import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada.' }, { status: 400 })
    }

    const apiKey = process.env.REMOVE_BG_API_KEY

    if (!apiKey) {
      // Sem API key — devolve original como base64 (fundo não removido)
      const bytes = await file.arrayBuffer()
      const b64 = Buffer.from(bytes).toString('base64')
      return NextResponse.json({
        url: `data:${file.type || 'image/jpeg'};base64,${b64}`,
        aviso: 'Configure REMOVE_BG_API_KEY para ativar o fundo branco automático.',
      })
    }

    // Remove.bg: remove fundo e substitui por branco puro
    const rbForm = new FormData()
    rbForm.append('image_file', file)
    rbForm.append('size', 'auto')
    rbForm.append('bg_color', 'ffffff')

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: rbForm,
    })

    if (!res.ok) {
      const errText = await res.text()
      // Remove.bg falhou — devolve original como fallback
      const bytes = await file.arrayBuffer()
      const b64 = Buffer.from(bytes).toString('base64')
      return NextResponse.json({
        url: `data:${file.type || 'image/jpeg'};base64,${b64}`,
        aviso: `Remove.bg: ${errText}`,
      })
    }

    const processed = await res.arrayBuffer()
    const b64 = Buffer.from(processed).toString('base64')
    return NextResponse.json({ url: `data:image/png;base64,${b64}` })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
