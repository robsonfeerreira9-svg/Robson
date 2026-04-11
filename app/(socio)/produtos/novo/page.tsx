'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Card from '@/components/ui/Card'
import { calcularPrecoVenda, formatarMoeda } from '@/lib/utils/preco'
import type { TamanhoProduto, CanalProduto, RoleUsuario } from '@/lib/database.types'

const TAMANHOS = [
  { value: 'PP', label: 'PP' },
  { value: 'P', label: 'P' },
  { value: 'M', label: 'M' },
  { value: 'G', label: 'G' },
  { value: 'GG', label: 'GG' },
  { value: 'UNICO', label: 'ÚNICO' },
]

const CANAIS = [
  { value: 'fisico', label: 'Físico' },
  { value: 'online', label: 'Online' },
  { value: 'ambos', label: 'Ambos' },
]

export default function NovoProdutoPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userRole, setUserRole] = useState<RoleUsuario | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  const [tipoNumeracao, setTipoNumeracao] = useState<'letra' | 'numero'>('letra')
  const [numeroValue, setNumeroValue] = useState('')

  const [form, setForm] = useState({
    nome: '',
    tamanho: 'M' as TamanhoProduto,
    canal: 'ambos' as CanalProduto,
    quantidade: '1',
    custo: '',
    markupPct: '100',
    precoVenda: '',
  })

  // Calcular preço sugerido em tempo real
  const custoNum = parseFloat(form.custo) || 0
  const markupNum = parseFloat(form.markupPct) || 100
  const precoSugerido = custoNum > 0 ? calcularPrecoVenda(custoNum, markupNum) : 0

  // Ao mudar custo ou markup, atualizar preço de venda com sugerido
  useEffect(() => {
    if (precoSugerido > 0) {
      setForm((f) => ({ ...f, precoVenda: precoSugerido.toFixed(2) }))
    }
  }, [precoSugerido])

  // Carregar role do usuário
  useEffect(() => {
    async function loadRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(data?.role as RoleUsuario)
    }
    loadRole()
  }, [])

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const url = URL.createObjectURL(file)
    setFotoPreview(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!form.nome.trim()) {
      setErro('Nome do produto é obrigatório.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      let fotoUrl: string | null = null

      // Upload da foto
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const fileName = `${Date.now()}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('produtos')
          .upload(fileName, fotoFile, { cacheControl: '3600', upsert: false })

        if (uploadError) {
          setErro(`Erro ao fazer upload da foto: ${uploadError.message}`)
          return
        }

        const { data: publicData } = supabase.storage.from('produtos').getPublicUrl(uploadData.path)
        fotoUrl = publicData.publicUrl
      }

      // Inserir produto
      const { data: produto, error: prodError } = await supabase
        .from('produtos')
        .insert({
          nome: form.nome.trim(),
          tamanho: tipoNumeracao === 'numero' ? 'UNICO' : form.tamanho,
          numero: tipoNumeracao === 'numero' ? numeroValue.trim() || null : null,
          canal: form.canal,
          foto_url: fotoUrl,
          custo: userRole === 'socio' ? (parseFloat(form.custo) || 0) : 0,
          markup_percentual: userRole === 'socio' ? (parseFloat(form.markupPct) || 100) : 100,
          preco_venda: userRole === 'socio' ? (parseFloat(form.precoVenda) || precoSugerido) : 0,
        })
        .select()
        .single()

      if (prodError || !produto) {
        setErro(`Erro ao cadastrar produto: ${prodError?.message}`)
        return
      }

      // Inserir no estoque
      const { error: estoqueError } = await supabase.from('estoque').insert({
        produto_id: produto.id,
        quantidade: parseInt(form.quantidade) || 0,
      })

      if (estoqueError) {
        setErro(`Produto criado, mas erro no estoque: ${estoqueError.message}`)
        return
      }

      router.push('/estoque?success=Produto+cadastrado+com+sucesso')
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const isSocio = userRole === 'socio'

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a href="/estoque" className="text-[#888888] hover:text-gold transition-colors">
            ← Estoque
          </a>
          <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">
            Novo Produto
          </h1>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Foto */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#F0F0F0]">Foto do Produto</label>
              <div className="flex items-center gap-4">
                {fotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoPreview}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded-lg border border-[#2A2A2A]"
                  />
                ) : (
                  <div className="w-24 h-24 bg-[#0D0D0D] border border-dashed border-[#2A2A2A] rounded-lg flex items-center justify-center text-[#888888]">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {fotoPreview ? 'Trocar foto' : 'Selecionar foto'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </div>
            </div>

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
                    {t === 'letra' ? 'Letras (PP/P/M/G/GG)' : 'Números (38/39/40…)'}
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
                    placeholder="Ex: 38, 39, 40, M, 42..."
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

            {/* Campos exclusivos do sócio */}
            {isSocio && (
              <>
                <div className="border-t border-[#2A2A2A] pt-4">
                  <p className="text-xs text-gold font-bold uppercase tracking-wide mb-4">
                    Precificação (Sócio)
                  </p>

                  {/* Custo */}
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

                    {/* Markup + Preço sugerido */}
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
              </>
            )}

            {/* Erro */}
            {erro && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-[#FF4444]">
                {erro}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" fullWidth loading={loading}>
                Cadastrar Produto
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/estoque')}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
