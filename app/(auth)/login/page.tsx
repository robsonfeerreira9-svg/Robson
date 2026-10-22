'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (authError || !authData.user) { setErro('Email ou senha incorretos.'); return }
      const { data: usuario, error: userError } = await supabase.from('usuarios').select('role').eq('id', authData.user.id).single()
      if (userError || !usuario) { setErro('Usuário não encontrado no sistema.'); return }
      router.push(usuario.role === 'socio' ? '/dashboard' : '/pdv')
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center" style={{ background: '#050505' }}>

      {/* ── fundo: gradientes ambientes ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* halo dourado central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,168,64,0.07) 0%, transparent 70%)' }} />
        {/* acento canto superior */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,168,64,0.04) 0%, transparent 65%)' }} />
        {/* acento canto inferior */}
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,168,64,0.03) 0%, transparent 65%)' }} />
        {/* grade sutil */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(201,168,64,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,64,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* vinheta nas bordas */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />
      </div>

      {/* ── conteúdo central ── */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-8">

        {/* Logo 3D */}
        <div className="flex flex-col items-center gap-4">
          {/* anel / plataforma 3D com profundidade */}
          <div className="relative" style={{ perspective: '800px' }}>
            {/* sombra de profundidade (camada mais baixa) */}
            <div className="absolute inset-0 rounded-full scale-[0.88] translate-y-4 blur-xl"
              style={{ background: 'rgba(201,168,64,0.20)' }} />
            {/* anel externo brilhante */}
            <div className="absolute -inset-3 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(201,168,64,0.0) 0%, rgba(201,168,64,0.6) 25%, rgba(255,220,100,0.9) 50%, rgba(201,168,64,0.6) 75%, rgba(201,168,64,0.0) 100%)',
                filter: 'blur(6px)',
                animation: 'spinRing 6s linear infinite',
              }} />
            {/* anel intermediário */}
            <div className="absolute -inset-1.5 rounded-full"
              style={{ background: 'conic-gradient(from 180deg, rgba(201,168,64,0.0), rgba(201,168,64,0.45), rgba(255,215,80,0.7), rgba(201,168,64,0.45), rgba(201,168,64,0.0))', animation: 'spinRing 6s linear infinite' }} />
            {/* imagem da logo */}
            <div className="relative w-36 h-36 rounded-full overflow-hidden"
              style={{
                boxShadow: '0 0 0 2px rgba(201,168,64,0.6), 0 0 40px rgba(201,168,64,0.25), 0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
                transform: 'rotateX(4deg)',
              }}>
              <Image src="/hg-logo.jpg" alt="HG Select" fill className="object-cover" sizes="144px" priority />
            </div>
          </div>

          {/* nome da marca */}
          <div className="text-center mt-1">
            <h1 className="font-black uppercase tracking-[0.3em] text-2xl leading-none"
              style={{
                background: 'linear-gradient(135deg, #A07830 0%, #C9A840 30%, #FFE080 50%, #C9A840 70%, #A07830 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 8px rgba(201,168,64,0.3))',
              }}>
              HG SELECT
            </h1>
            <div className="flex items-center gap-3 mt-2 justify-center">
              <div className="h-px flex-1 max-w-[40px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.4))' }} />
              <p className="text-[9px] uppercase tracking-[0.35em] text-[#C9A840]/50 font-medium">Sistema de Gestão</p>
              <div className="h-px flex-1 max-w-[40px]" style={{ background: 'linear-gradient(90deg, rgba(201,168,64,0.4), transparent)' }} />
            </div>
          </div>
        </div>

        {/* Card de login — glass */}
        <div className="w-full rounded-2xl p-px"
          style={{ background: 'linear-gradient(135deg, rgba(201,168,64,0.25) 0%, rgba(201,168,64,0.05) 50%, rgba(201,168,64,0.15) 100%)' }}>
          <div className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)' }}>

            <p className="text-xs font-semibold text-[#555] uppercase tracking-[0.15em] text-center">Acesso restrito</p>

            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Email</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#2A2A2A] outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(201,168,64,0.12)',
                  }}
                  onFocus={(e) => e.currentTarget.style.border = '1px solid rgba(201,168,64,0.45)'}
                  onBlur={(e) => e.currentTarget.style.border = '1px solid rgba(201,168,64,0.12)'}
                />
              </div>

              {/* Senha */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">Senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm text-[#EBEBEB] placeholder:text-[#2A2A2A] outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(201,168,64,0.12)',
                  }}
                  onFocus={(e) => e.currentTarget.style.border = '1px solid rgba(201,168,64,0.45)'}
                  onBlur={(e) => e.currentTarget.style.border = '1px solid rgba(201,168,64,0.12)'}
                />
              </div>

              {/* Erro */}
              {erro && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-[#FF6060]"
                  style={{ background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)' }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {erro}
                </div>
              )}

              {/* Botão entrar */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full h-12 rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-60 overflow-hidden mt-1"
                style={{
                  background: loading
                    ? 'rgba(201,168,64,0.5)'
                    : 'linear-gradient(135deg, #A07830 0%, #C9A840 40%, #FFE080 60%, #C9A840 80%, #A07830 100%)',
                  color: '#080808',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(201,168,64,0.35), 0 0 0 1px rgba(201,168,64,0.2)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Entrando…
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-[10px] text-[#222] tracking-widest uppercase">
          HG Select &copy; {new Date().getFullYear()}
        </p>
      </div>

      {/* ── animação do anel girando ── */}
      <style>{`
        @keyframes spinRing {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}
