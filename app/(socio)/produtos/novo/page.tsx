'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Card from '@/components/ui/Card'
import Viewer360 from '@/components/ui/Viewer360'
import { calcularPrecoVenda, formatarMoeda } from '@/lib/utils/preco'
import type { TamanhoProduto, CanalProduto, RoleUsuario } from '@/lib/database.types'

const TAMANHOS = [
  { value: 'PP',    label: 'PP' },
  { value: 'P',     label: 'P' },
  { value: 'M',     label: 'M' },
  { value: 'G',     label: 'G' },
  { value: 'GG',    label: 'GG' },
  { value: 'UNICO', label: 'ÚNICO' },
]

const CANAIS = [
  { value: 'fisico', label: 'Físico' },
  { value: 'online', label: 'Online' },
  { value: 'ambos',  label: 'Ambos' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function dataUrlParaBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// ── Tipo local das fotos ──────────────────────────────────────────────────────
interface FotoItem {
  id:          string
  file:        File
  preview:     string       // object URL da foto original (exibição imediata)
  processada:  string | null  // data URL após remoção de fundo
  processando: boolean
  aviso:       string | null  // aviso quando API não está configurada
  erro:        string | null
}

// ── Processamento de imagem via API ──────────────────────────────────────────
async function processarImagem(file: File): Promise<{ url: string; aviso: string | null; erro: string | null }> {
  const fd = new FormData()
  fd.append('image', file)
  try {
    const res  = await fetch('/api/remover-fundo', { method: 'POST', body: fd })
    const json = await res.json() as { url?: string; aviso?: string; error?: string }
    if (json.error) return { url: '', aviso: null, erro: json.error }
    return { url: json.url ?? '', aviso: json.aviso ?? null, erro: null }
  } catch (e) {
    return { url: '', aviso: null, erro: String(e) }
  }
}

export default function NovoProdutoPage() {
  const router      = useRouter()
  const dropRef     = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userRole,  setUserRole]  = useState<RoleUsuario | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [erro,      setErro]      = useState('')
  const [fotos,     setFotos]     = useState<FotoItem[]>([])
  const [dragOver,  setDragOver]  = useState(false)

  const [tipoNumeracao, setTipoNumeracao] = useState<'letra' | 'numero'>('letra')
  const [numeroValue,   setNumeroValue]   = useState('')

  const [form, setForm] = useState({
    nome:       '',
    tamanho:    'M' as TamanhoProduto,
    canal:      'ambos' as CanalProduto,
    quantidade: '1',
    custo:      '',
    markupPct:  '100',
    precoVenda: '',
  })

  const custoNum      = parseFloat(form.custo) || 0
  const markupNum     = parseFloat(form.markupPct) || 100
  const precoSugerido = custoNum > 0 ? calcularPrecoVenda(custoNum, markupNum) : 0

  useEffect(() => {
    if (precoSugerido > 0) setForm((f) => ({ ...f, precoVenda: precoSugerido.toFixed(2) }))
  }, [precoSugerido])

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('role').eq('id', user.id).single()
      setUserRole(data?.role as RoleUsuario)
    }
    loadRole()
  }, [])

  const adicionarFotos = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 8 - fotos.length)
    if (arr.length === 0) return

    // Cria itens imediatos com preview local
    const novos: FotoItem[] = arr.map((file) => ({
      id:          crypto.randomUUID(),
      file,
      preview:     URL.createObjectURL(file),
      processada:  null,
      processando: true,
      aviso:       null,
      erro:        null,
    }))

    setFotos((prev) => [...prev, ...novos])

    // Processa cada imagem em paralelo (remoção de fundo)
    await Promise.all(novos.map(async (item) => {
      const result = await processarImagem(item.file)
      setFotos((prev) => prev.map((f) =>
        f.id !== item.id ? f : {
          ...f,
          processando: false,
          processada:  result.erro ? null : result.url,
          aviso:       result.aviso,
          erro:        result.erro,
        }
      ))
    }))
  }, [fotos.length])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) adicionarFotos(e.target.files)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) adicionarFotos(e.dataTransfer.files)
  }

  function removerFoto(id: string) {
    setFotos((prev) => prev.filter((f) => f.id !== id))
  }

  function moverParaFrente(id: string) {
    setFotos((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[0], next[idx]] = [next[idx], next[0]]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!form.nome.trim()) { setErro('Nome do produto é obrigatório.'); return }
    if (fotos.some((f) => f.processando)) { setErro('Aguarde o processamento das imagens.'); return }

    setLoading(true)

    try {
      const supabase = createClient()
      const urlsUpload: string[] = []

      // Upload de cada imagem processada para o Supabase Storage
      for (const foto of fotos) {
        const srcParaUpload = foto.processada ?? foto.preview
        let blob: Blob

        if (srcParaUpload.startsWith('data:')) {
          blob = dataUrlParaBlob(srcParaUpload)
        } else {
          // object URL — converte para blob
          blob = await fetch(srcParaUpload).then((r) => r.blob())
        }

        const ext      = foto.processada ? 'png' : (foto.file.name.split('.').pop() ?? 'jpg')
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('produtos')
          .upload(fileName, blob, { cacheControl: '3600', upsert: false })

        if (uploadErr) { setErro(`Erro no upload: ${uploadErr.message}`); return }

        const { data: publicData } = supabase.storage.from('produtos').getPublicUrl(uploadData.path)
        urlsUpload.push(publicData.publicUrl)
      }

      const fotoUrl    = urlsUpload[0] ?? null
      const fotosUrls  = urlsUpload

      // Inserir produto
      const { data: produto, error: prodError } = await supabase
        .from('produtos')
        .insert({
          nome:             form.nome.trim(),
          tamanho:          tipoNumeracao === 'numero' ? 'UNICO' : form.tamanho,
          numero:           tipoNumeracao === 'numero' ? (numeroValue.trim() || null) : null,
          canal:            form.canal,
          foto_url:         fotoUrl,
          fotos_urls:       fotosUrls,
          custo:            userRole === 'socio' ? (parseFloat(form.custo) || 0) : 0,
          markup_percentual: userRole === 'socio' ? (parseFloat(form.markupPct) || 100) : 100,
          preco_venda:      userRole === 'socio' ? (parseFloat(form.precoVenda) || precoSugerido) : 0,
        })
        .select()
        .single()

      if (prodError || !produto) { setErro(`Erro ao cadastrar produto: ${prodError?.message}`); return }

      const { error: estoqueError } = await supabase.from('estoque').insert({
        produto_id: produto.id,
        quantidade: parseInt(form.quantidade) || 0,
      })

      if (estoqueError) { setErro(`Produto criado, mas erro no estoque: ${estoqueError.message}`); return }

      router.push('/estoque?success=Produto+cadastrado+com+sucesso')
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const isSocio   = userRole === 'socio'
  // Imagens para o viewer (processadas se disponíveis, preview como fallback)
  const imagensViewer = fotos.map((f) => f.processada ?? f.preview)
  const temFotos  = fotos.length > 0
  const processando = fotos.some((f) => f.processando)
  const avisoApi  = fotos.find((f) => f.aviso)?.aviso ?? null

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a href="/estoque" className="text-[#888888] hover:text-gold transition-colors">← Estoque</a>
          <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Novo Produto</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Coluna esquerda — upload e viewer 360° */}
          <div className="flex flex-col gap-4">

            {/* Viewer 360° */}
            {temFotos && (
              <div className="rounded-2xl overflow-hidden border border-[#2A2A2A] shadow-xl">
                <Viewer360
                  imagens={imagensViewer}
                  alt={form.nome || 'Produto'}
                  className="aspect-square"
                />
              </div>
            )}

            {/* Zona de upload */}
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !processando && fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer p-5 flex flex-col items-center gap-3 ${
                dragOver
                  ? 'border-gold bg-gold/5'
                  : 'border-[#2A2A2A] hover:border-[#444444] bg-[#111111]'
              } ${processando ? 'pointer-events-none opacity-60' : ''}`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-[#555555]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#F0F0F0]">
                  {temFotos ? 'Adicionar mais ângulos' : 'Selecionar fotos do produto'}
                </p>
                <p className="text-xs text-[#555555] mt-0.5">
                  Arraste ou clique · JPG/PNG · até {8 - fotos.length} foto{8 - fotos.length !== 1 ? 's' : ''} restante{8 - fotos.length !== 1 ? 's' : ''}
                </p>
              </div>
              {!temFotos && (
                <div className="flex items-center gap-2 text-[10px] text-[#444444] mt-1">
                  <span className="inline-flex items-center gap-1 bg-[#1A1A1A] px-2 py-1 rounded-md">
                    <svg className="w-3 h-3 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                    </svg>
                    IA remove o fundo automaticamente
                  </span>
                  <span className="inline-flex items-center gap-1 bg-[#1A1A1A] px-2 py-1 rounded-md">
                    ↺ Visualização 360° interativa
                  </span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />

            {/* Aviso API key */}
            {avisoApi && (
              <div className="text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg px-3 py-2">
                <strong>Aviso IA:</strong> {avisoApi}
              </div>
            )}

            {/* Miniaturas das fotos */}
            {temFotos && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#888888] font-semibold uppercase tracking-wide">
                  Ângulos ({fotos.length}/8) · Clique em ★ para definir como capa
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {fotos.map((foto, idx) => (
                    <div key={foto.id} className="relative group aspect-square rounded-lg overflow-hidden border border-[#2A2A2A] bg-white">
                      {/* Imagem */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto.processada ?? foto.preview}
                        alt={`Ângulo ${idx + 1}`}
                        className="w-full h-full object-contain"
                        style={{ pointerEvents: 'none' }}
                      />

                      {/* Overlay de processamento */}
                      {foto.processando && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                          <svg className="w-5 h-5 text-gold animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          <span className="text-[9px] text-white/70">IA</span>
                        </div>
                      )}

                      {/* Badge AI processado */}
                      {!foto.processando && foto.processada && !foto.aviso && (
                        <div className="absolute top-1 left-1 bg-green-600/80 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                          IA ✓
                        </div>
                      )}

                      {/* Erro */}
                      {foto.erro && (
                        <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                          <span className="text-[9px] text-red-300 text-center px-1">Erro</span>
                        </div>
                      )}

                      {/* Ações no hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => moverParaFrente(foto.id)}
                            title="Definir como capa"
                            className="w-6 h-6 rounded-full bg-gold text-[#0D0D0D] flex items-center justify-center text-xs font-black hover:scale-110 transition-transform"
                          >
                            ★
                          </button>
                        )}
                        {idx === 0 && (
                          <div className="w-6 h-6 rounded-full bg-gold/30 text-gold flex items-center justify-center text-xs font-black">
                            ★
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removerFoto(foto.id)}
                          title="Remover"
                          className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-black hover:scale-110 transition-transform"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Slot vazio para adicionar mais */}
                  {fotos.length < 8 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-[#2A2A2A] flex items-center justify-center text-[#555555] hover:border-gold hover:text-gold transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita — formulário */}
          <Card>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* Nome */}
              <Input
                label="Nome do Produto *"
                placeholder="Ex: Camiseta Básica Oversize"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                required
              />

              {/* Numeração */}
              <div>
                <label className="block text-sm font-medium text-[#F0F0F0] mb-1.5">Tipo de Numeração</label>
                <div className="flex rounded overflow-hidden border border-[#2A2A2A] mb-2">
                  {(['letra', 'numero'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoNumeracao(t)}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        tipoNumeracao === t ? 'bg-gold text-[#0D0D0D]' : 'bg-transparent text-[#888888] hover:text-gold'
                      }`}
                    >
                      {t === 'letra' ? 'PP / P / M / G / GG' : 'Números (38/39/40…)'}
                    </button>
                  ))}
                </div>
                {tipoNumeracao === 'letra' ? (
                  <Select
                    label="Tamanho"
                    options={TAMANHOS}
                    value={form.tamanho}
                    onChange={(e) => setForm((f) => ({ ...f, tamanho: e.target.value as TamanhoProduto }))}
                  />
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[#F0F0F0] mb-1">Número</label>
                    <input
                      type="text"
                      placeholder="Ex: 38, 39, 40, 42..."
                      value={numeroValue}
                      onChange={(e) => setNumeroValue(e.target.value)}
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-md px-3 py-2.5 text-sm text-[#F0F0F0] placeholder:text-[#888888] focus:outline-none focus:border-gold"
                    />
                  </div>
                )}
              </div>

              {/* Canal */}
              <Select
                label="Canal"
                options={CANAIS}
                value={form.canal}
                onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value as CanalProduto }))}
              />

              {/* Quantidade */}
              <Input
                label="Quantidade inicial em estoque"
                type="number"
                min="0"
                placeholder="0"
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
              />

              {/* Precificação — só sócio */}
              {isSocio && (
                <div className="border-t border-[#2A2A2A] pt-4">
                  <p className="text-xs text-gold font-bold uppercase tracking-wide mb-4">Precificação (Sócio)</p>
                  <div className="flex flex-col gap-4">
                    <Input
                      label="Custo unitário (R$)"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={form.custo}
                      onChange={(e) => setForm((f) => ({ ...f, custo: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-4 items-end">
                      <Input
                        label="Markup %"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="100"
                        value={form.markupPct}
                        onChange={(e) => setForm((f) => ({ ...f, markupPct: e.target.value }))}
                        hint={precoSugerido > 0 ? `Sugerido: ${formatarMoeda(precoSugerido)}` : undefined}
                      />
                      <Input
                        label="Preço de venda (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={form.precoVenda}
                        onChange={(e) => setForm((f) => ({ ...f, precoVenda: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Aviso processamento */}
              {processando && (
                <div className="flex items-center gap-2 text-xs text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Processando imagens com IA — aguarde...
                </div>
              )}

              {/* Erro */}
              {erro && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-[#FF4444]">
                  {erro}
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                  disabled={processando}
                >
                  {processando ? 'Processando imagens...' : 'Cadastrar Produto'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push('/estoque')}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
