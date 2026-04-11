'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import { formatarMoeda } from '@/lib/utils/preco'
import SplashMotivacional from '@/components/SplashMotivacional'

interface PerfilData {
  nome: string
  qtdVendas: number
  totalVendas: number
  meta: number | null
}

async function fetchPerfil(userId: string): Promise<PerfilData> {
  const supabase = createClient()
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).toISOString()

  const [{ data: usuario }, { data: vendas }] = await Promise.all([
    supabase.from('usuarios').select('nome, meta_mensal').eq('id', userId).single(),
    supabase.from('vendas').select('total_final')
      .eq('vendedor_id', userId)
      .gte('criado_em', inicioMes)
      .lt('criado_em', fimMes),
  ])

  const qtdVendas = vendas?.length ?? 0
  const totalVendas = (vendas ?? []).reduce((a, v) => a + Number(v.total_final), 0)

  return {
    nome: usuario?.nome ?? '',
    qtdVendas,
    totalVendas,
    meta: usuario?.meta_mensal ?? null,
  }
}

function mesAtual() {
  const d = new Date()
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export default function PerfilPage() {
  const [userId, setUserId] = useState('')
  const [perfil, setPerfil] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const data = await fetchPerfil(user.id)
      setPerfil(data)
      setLoading(false)
    }
    load()
  }, [])

  const pct = perfil?.meta && perfil.meta > 0
    ? Math.min(100, (perfil.totalVendas / perfil.meta) * 100)
    : 0

  const falta = perfil?.meta
    ? Math.max(0, perfil.meta - perfil.totalVendas)
    : null

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6">
      {/* Splash motivacional — uma vez por dia */}
      {userId && <SplashMotivacional userId={userId} />}

      <div className="max-w-lg mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#F0F0F0] uppercase tracking-wide">Meu Perfil</h1>
            <p className="text-xs text-[#888888]">{mesAtual()}</p>
          </div>
          <a href="/pdv" className="text-xs text-[#888888] hover:text-gold transition-colors">
            ← PDV
          </a>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="skeleton h-28 rounded-lg" />
            <div className="skeleton h-32 rounded-lg" />
            <div className="skeleton h-40 rounded-lg" />
          </div>
        ) : perfil && (
          <>
            {/* Card de identidade */}
            <Card hover>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gold text-[#0D0D0D] flex items-center justify-center text-2xl font-black flex-shrink-0">
                  {perfil.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-black text-[#F0F0F0]">{perfil.nome}</p>
                  <span className="text-[10px] font-bold text-gold uppercase tracking-widest border border-gold/40 px-2 py-0.5 rounded">
                    Vendedora
                  </span>
                </div>
              </div>
            </Card>

            {/* Cards de vendas do mês */}
            <div className="grid grid-cols-2 gap-4">
              <Card hover>
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">
                  Vendas no Mês
                </p>
                <p className="text-3xl font-black text-gold">{perfil.qtdVendas}</p>
                <p className="text-[10px] text-[#888888] mt-1">
                  {perfil.qtdVendas === 1 ? 'venda realizada' : 'vendas realizadas'}
                </p>
              </Card>
              <Card hover>
                <p className="text-xs text-[#888888] uppercase tracking-wide font-semibold mb-1">
                  Faturado no Mês
                </p>
                <p className="text-2xl font-black text-success">{formatarMoeda(perfil.totalVendas)}</p>
                <p className="text-[10px] text-[#888888] mt-1">valor total</p>
              </Card>
            </div>

            {/* Card de meta */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide">
                  Meta do Mês
                </p>
                {perfil.meta && (
                  <span className="text-xs font-bold text-gold">{formatarMoeda(perfil.meta)}</span>
                )}
              </div>

              {!perfil.meta ? (
                <p className="text-sm text-[#888888]">Meta não definida ainda — fale com o sócio.</p>
              ) : (
                <>
                  {/* Barra de progresso */}
                  <div className="h-3 bg-[#2A2A2A] rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        pct >= 100 ? 'bg-success' : pct >= 70 ? 'bg-gold' : 'bg-[#F5A623]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#888888]">
                      {pct.toFixed(0)}% concluído
                    </span>
                    {falta !== null && falta > 0 ? (
                      <span className="text-xs font-bold text-[#F0F0F0]">
                        Faltam {formatarMoeda(falta)}
                      </span>
                    ) : (
                      <span className="text-xs font-black text-success uppercase tracking-wide">
                        Meta batida!
                      </span>
                    )}
                  </div>

                  {/* Mensagem motivacional inline baseada no progresso */}
                  {pct < 100 && (
                    <p className="text-[10px] text-[#888888] mt-3 italic">
                      {pct < 30
                        ? 'O começo é só o começo. Você tem muito espaço para crescer hoje.'
                        : pct < 60
                        ? 'Você já passou da metade do caminho. Cada venda conta.'
                        : 'Você está quase lá. Não para agora.'}
                    </p>
                  )}
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
