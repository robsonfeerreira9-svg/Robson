'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatarMoeda } from '@/lib/utils/preco'
import type { Campanha } from '@/lib/database.types'

// ── Fetcher ───────────────────────────────────────────────────────────────────
async function fetchCampanhas(): Promise<Campanha[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campanhas')
    .select('*')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data as Campanha[]) ?? []
}

// ── Modal nova campanha ───────────────────────────────────────────────────────
function NovaCampanhaModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ nome: '', descricao: '', desconto_pct: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    const pct = parseFloat(form.desconto_pct)
    if (isNaN(pct) || pct <= 0 || pct > 100) { setErro('Desconto deve ser entre 0.1 e 100%.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('campanhas').insert({
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      desconto_pct: pct,
      ativa: true,
    })
    setLoading(false)

    if (error) { setErro(`Erro: ${error.message}`); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-[#F0F0F0] mb-4">Nova Campanha</h3>
        <div className="flex flex-col gap-3">
          <Input
            label="Nome da campanha *"
            placeholder="Ex: Liquidação de Inverno"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: 10% off em toda a loja"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
          <Input
            label="Desconto %"
            type="number"
            min="0.1"
            max="100"
            step="0.5"
            placeholder="Ex: 10"
            value={form.desconto_pct}
            onChange={(e) => setForm((f) => ({ ...f, desconto_pct: e.target.value }))}
          />
          {erro && <p className="text-xs text-[#FF4444]">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="primary" fullWidth loading={loading} onClick={handleSalvar}>
              Criar Campanha
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function CampanhasPage() {
  const [showModal, setShowModal] = useState(false)

  const { data: campanhas = [], isLoading } = useSWR('campanhas-socio', fetchCampanhas, {
    refreshInterval: 30000,
  })

  async function toggleAtiva(campanha: Campanha) {
    const supabase = createClient()
    await supabase.from('campanhas').update({ ativa: !campanha.ativa }).eq('id', campanha.id)
    mutate('campanhas-socio')
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir esta campanha?')) return
    const supabase = createClient()
    await supabase.from('campanhas').delete().eq('id', id)
    mutate('campanhas-socio')
  }

  const ativas = campanhas.filter((c) => c.ativa)
  const inativas = campanhas.filter((c) => !c.ativa)

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Campanhas</h1>
            <a href="/dashboard" className="text-xs text-[#888888] hover:text-gold transition-colors">← Dashboard</a>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + Nova Campanha
          </Button>
        </div>

        {/* Resumo */}
        {!isLoading && (
          <div className="flex gap-3 flex-wrap">
            <Card padding="sm" className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm text-[#F0F0F0] font-semibold">{ativas.length} ativa{ativas.length !== 1 ? 's' : ''}</span>
            </Card>
            {ativas.length > 0 && (
              <Card padding="sm" className="flex items-center gap-2">
                <span className="text-xs text-[#888888]">Desconto máximo ativo:</span>
                <span className="text-sm font-bold text-gold">
                  {Math.max(...ativas.map((c) => c.desconto_pct))}%
                </span>
              </Card>
            )}
          </div>
        )}

        {/* Lista de campanhas */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        ) : campanhas.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-[#888888] mb-4">Nenhuma campanha criada ainda.</p>
            <Button variant="primary" onClick={() => setShowModal(true)}>
              Criar primeira campanha
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Ativas primeiro */}
            {ativas.map((c) => (
              <CampanhaCard key={c.id} campanha={c} onToggle={toggleAtiva} onExcluir={handleExcluir} />
            ))}
            {inativas.length > 0 && (
              <>
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mt-2">Inativas</p>
                {inativas.map((c) => (
                  <CampanhaCard key={c.id} campanha={c} onToggle={toggleAtiva} onExcluir={handleExcluir} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <NovaCampanhaModal
          onClose={() => setShowModal(false)}
          onSave={() => mutate('campanhas-socio')}
        />
      )}
    </div>
  )
}

// ── Card da campanha ──────────────────────────────────────────────────────────
function CampanhaCard({
  campanha,
  onToggle,
  onExcluir,
}: {
  campanha: Campanha
  onToggle: (c: Campanha) => void
  onExcluir: (id: string) => void
}) {
  return (
    <Card
      hover
      className={`flex items-center gap-4 ${campanha.ativa ? 'border-gold/20' : 'opacity-60'}`}
    >
      {/* Desconto destaque */}
      <div className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
        campanha.ativa ? 'bg-gold/10 border border-gold/30' : 'bg-[#2A2A2A]'
      }`}>
        <span className={`text-xl font-black ${campanha.ativa ? 'text-gold' : 'text-[#888888]'}`}>
          {campanha.desconto_pct}%
        </span>
        <span className="text-[10px] text-[#888888]">OFF</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-bold text-[#F0F0F0] truncate">{campanha.nome}</p>
          <Badge variant={campanha.ativa ? 'success' : 'default'}>
            {campanha.ativa ? 'Ativa' : 'Inativa'}
          </Badge>
        </div>
        {campanha.descricao && (
          <p className="text-xs text-[#888888] truncate">{campanha.descricao}</p>
        )}
        <p className="text-[10px] text-[#888888] mt-1">
          Criada em {new Date(campanha.criado_em).toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onToggle(campanha)}
          className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors ${
            campanha.ativa
              ? 'text-[#888888] border-[#2A2A2A] hover:border-[#FF4444] hover:text-[#FF4444]'
              : 'text-gold border-gold/30 hover:border-gold'
          }`}
        >
          {campanha.ativa ? 'Pausar' : 'Ativar'}
        </button>
        <button
          onClick={() => onExcluir(campanha.id)}
          className="text-xs text-[#888888] hover:text-[#FF4444] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </Card>
  )
}
