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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10%       { transform: translate(-2%, -3%); }
          20%       { transform: translate(3%, 2%); }
          30%       { transform: translate(-1%, 4%); }
          40%       { transform: translate(4%, -1%); }
          50%       { transform: translate(-3%, 1%); }
          60%       { transform: translate(2%, -4%); }
          70%       { transform: translate(-4%, 3%); }
          80%       { transform: translate(1%, -2%); }
          90%       { transform: translate(-2%, 4%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoReveal {
          from { opacity: 0; transform: scale(0.92); filter: blur(8px); }
          to   { opacity: 1; transform: scale(1); filter: blur(0px); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 0.8;  transform: scale(1.08); }
        }
        .anim-fade-up-1 { animation: fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s both; }
        .anim-fade-up-2 { animation: fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.5s both; }
        .anim-fade-up-3 { animation: fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.7s both; }
        .anim-logo      { animation: logoReveal 1.2s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .anim-glow      { animation: glowPulse 4s ease-in-out infinite; }
        input::placeholder { color: #2e2e2e; }
        input:focus { outline: none; border-color: rgba(201,168,64,0.5) !important; }
      `}</style>

      <main className="relative min-h-screen flex flex-col md:flex-row overflow-hidden" style={{ background: '#0A0804' }}>

        {/* ══ PAINEL ESQUERDO — visual da marca ══ */}
        <div className="relative flex flex-col items-center justify-center flex-1 min-h-[55vh] md:min-h-screen px-8 py-16 overflow-hidden">

          {/* Textura de grain */}
          <div className="absolute inset-0 opacity-[0.18] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '180px 180px',
              animation: 'grain 7s steps(10) infinite',
            }} />

          {/* Gradientes de fundo quentes */}
          <div className="absolute inset-0 pointer-events-none">
            {/* chão dourado */}
            <div className="absolute bottom-0 left-0 right-0 h-[60%]"
              style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(180,130,30,0.18) 0%, transparent 70%)' }} />
            {/* luz de cima */}
            <div className="absolute top-0 left-0 right-0 h-[40%]"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,64,0.06) 0%, transparent 70%)' }} />
            {/* canto quente */}
            <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(180,100,20,0.08) 0%, transparent 70%)' }} />
          </div>

          {/* Logo */}
          <div className="relative flex flex-col items-center gap-6 anim-logo">
            {/* halo de luz atrás da logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full anim-glow pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(201,168,64,0.12) 0%, rgba(180,130,30,0.06) 40%, transparent 70%)' }} />

            {/* logo circular */}
            <div className="relative z-10">
              {/* moldura dourada */}
              <div className="absolute -inset-[3px] rounded-full"
                style={{ background: 'linear-gradient(145deg, rgba(255,220,100,0.9), rgba(160,110,30,0.6), rgba(255,220,100,0.7), rgba(140,100,20,0.5))', padding: '2px' }}>
                <div className="w-full h-full rounded-full" style={{ background: '#0A0804' }} />
              </div>
              <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden z-10"
                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,64,0.3)' }}>
                <Image src="/hg-logo.jpg" alt="HG Select" fill className="object-cover" sizes="192px" priority />
              </div>
            </div>

            {/* nome */}
            <div className="relative z-10 text-center flex flex-col items-center gap-3">
              <h1 style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 'clamp(2.2rem, 6vw, 3.2rem)',
                fontWeight: 300,
                letterSpacing: '0.35em',
                lineHeight: 1,
                background: 'linear-gradient(180deg, #FFE08A 0%, #C9A840 40%, #A07830 70%, #C9A840 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                HG SELECT
              </h1>
              <div className="flex items-center gap-3">
                <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.5))' }} />
                <span style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '0.6rem', letterSpacing: '0.4em', color: 'rgba(201,168,64,0.45)', fontStyle: 'italic' }}>
                  MODA EXCLUSIVA
                </span>
                <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, rgba(201,168,64,0.5), transparent)' }} />
              </div>
            </div>
          </div>

          {/* linha decorativa na base */}
          <div className="absolute bottom-0 inset-x-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.2), transparent)' }} />
        </div>

        {/* ══ PAINEL DIREITO — formulário ══ */}
        <div className="relative flex items-center justify-center md:w-[400px] px-8 py-12 md:py-0"
          style={{ background: 'rgba(4,3,2,0.7)', backdropFilter: 'blur(2px)', borderLeft: '1px solid rgba(201,168,64,0.08)' }}>

          {/* grain no painel do form também */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 200px',
            }} />

          <div className="relative z-10 w-full max-w-xs flex flex-col gap-8">

            {/* cabeçalho do form */}
            <div className="anim-fade-up-1">
              <p className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: 'rgba(201,168,64,0.5)', fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic' }}>
                Bem-vinda
              </p>
              <h2 className="text-xl font-semibold text-[#E8E0D0]" style={{ letterSpacing: '0.04em' }}>
                Acesse o sistema
              </h2>
            </div>

            {/* form */}
            <form onSubmit={handleLogin} className="flex flex-col gap-5 anim-fade-up-2">
              {/* email */}
              <div className="flex flex-col gap-2">
                <label className="text-[9px] uppercase tracking-[0.25em] text-[#444]">Email</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full px-0 py-2.5 text-sm text-[#EBEBEB] bg-transparent transition-colors"
                  style={{ borderBottom: '1px solid rgba(201,168,64,0.18)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
                  onFocus={(e) => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.65)'}
                  onBlur={(e) => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.18)'}
                />
              </div>

              {/* senha */}
              <div className="flex flex-col gap-2">
                <label className="text-[9px] uppercase tracking-[0.25em] text-[#444]">Senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full px-0 py-2.5 text-sm text-[#EBEBEB] bg-transparent transition-colors"
                  style={{ borderBottom: '1px solid rgba(201,168,64,0.18)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
                  onFocus={(e) => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.65)'}
                  onBlur={(e) => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.18)'}
                />
              </div>

              {/* erro */}
              {erro && (
                <p className="text-xs text-[#FF6060] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#FF6060] flex-shrink-0 inline-block" />
                  {erro}
                </p>
              )}

              {/* botão */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-3.5 text-xs uppercase tracking-[0.3em] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 mt-2 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #8A6820, #C9A840, #E8C860, #C9A840, #8A6820)',
                  color: '#0A0804',
                  letterSpacing: '0.25em',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Entrando
                  </span>
                ) : 'Entrar'}
              </button>
            </form>

            <p className="text-[9px] text-[#1E1E1E] uppercase tracking-widest anim-fade-up-3" style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic' }}>
              HG Select &copy; {new Date().getFullYear()} — Acesso exclusivo
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
