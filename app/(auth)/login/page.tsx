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
      const { data: usuario } = await supabase.from('usuarios').select('role').eq('id', authData.user.id).single()
      if (!usuario) { setErro('Usuário não encontrado.'); return }
      router.push(usuario.role === 'socio' ? '/dashboard' : '/pdv')
    } catch { setErro('Erro inesperado. Tente novamente.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&display=swap');
        @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)} }
        .cf { font-family:'Cormorant Garamond',serif; }
        .af { animation:fadeIn 1.2s ease both; }
        .a1 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .1s both; }
        .a2 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .3s both; }
        .a3 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .5s both; }
        input { background:transparent!important; border-radius:0!important; }
        input::placeholder { color:#333; }
        input:focus { outline:none!important; }
      `}</style>

      <main className="relative min-h-screen w-full overflow-hidden flex">

        {/* ── FOTO DE FUNDO: homem bem vestido (Unsplash) ── */}
        <div
          className="absolute inset-0 af"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1400&q=85&fit=crop&crop=top')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />

        {/* ── OVERLAYS: escurecer e focar ── */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.82) 100%)' }} />
        {/* vinheta lateral direita mais escura (onde fica o form) */}
        <div className="absolute inset-y-0 right-0 w-[45%]" style={{ background: 'linear-gradient(270deg, rgba(0,0,0,0.88) 0%, transparent 100%)' }} />
        {/* vinheta de baixo */}
        <div className="absolute inset-x-0 bottom-0 h-48" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }} />
        {/* tom dourado quente vindo da esquerda */}
        <div className="absolute inset-y-0 left-0 w-[55%]" style={{ background: 'radial-gradient(ellipse at 20% 60%, rgba(180,130,20,0.12) 0%, transparent 70%)' }} />

        {/* ── LOGO GRANDE NO CENTRO ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div className="flex flex-col items-center gap-5 a1">

            {/* halo dourado atrás da logo */}
            <div className="absolute w-80 h-80 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(201,168,64,0.18) 0%, transparent 65%)', animation: 'pulse 5s ease-in-out infinite' }} />

            {/* logo HG Select */}
            <div className="relative rounded-full overflow-hidden"
              style={{
                width: 160, height: 160,
                border: '3px solid rgba(201,168,64,0.9)',
                boxShadow: '0 0 0 8px rgba(201,168,64,0.12), 0 0 60px rgba(201,168,64,0.3), 0 24px 80px rgba(0,0,0,0.8)',
              }}>
              <Image
                src="/hg-logo.jpg"
                alt="HG Select"
                fill
                className="object-cover"
                sizes="160px"
                priority
              />
            </div>

            {/* nome da marca */}
            <div className="flex flex-col items-center gap-2.5">
              <h1 className="cf text-center"
                style={{
                  fontSize: 'clamp(2rem, 5.5vw, 3.2rem)',
                  fontWeight: 300,
                  letterSpacing: '0.45em',
                  textIndent: '0.45em',
                  background: 'linear-gradient(180deg, #FFE990 0%, #D4AE48 35%, #A07828 70%, #C9A840 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 2px 12px rgba(201,168,64,0.35))',
                }}>
                HG SELECT
              </h1>
              <div className="flex items-center gap-4">
                <div className="h-px w-14" style={{ background: 'linear-gradient(90deg,transparent,rgba(201,168,64,0.55))' }} />
                <span className="cf text-[9px] uppercase tracking-[0.45em]" style={{ color: 'rgba(201,168,64,0.5)', fontStyle: 'italic' }}>Moda Exclusiva</span>
                <div className="h-px w-14" style={{ background: 'linear-gradient(90deg,rgba(201,168,64,0.55),transparent)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── FORMULÁRIO — painel direito ── */}
        <div className="relative ml-auto w-full md:w-[380px] flex items-end md:items-center justify-center px-7 pb-10 pt-[62vh] md:pt-0"
          style={{ zIndex: 10 }}>
          <div className="w-full max-w-xs">

            {/* borda dourada em cima */}
            <div className="h-px w-16 mb-7" style={{ background: 'linear-gradient(90deg, rgba(201,168,64,0.6), transparent)' }} />

            <div className="a2 flex flex-col gap-1.5 mb-7">
              <p className="cf text-[10px] uppercase tracking-[0.3em]" style={{ color: 'rgba(201,168,64,0.45)', fontStyle: 'italic' }}>Bem-vinda</p>
              <h2 className="text-[#D8CEB8] font-light" style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>Acesse o sistema</h2>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5 a3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.25em] text-[#484848]">Email</label>
                <input
                  type="email" placeholder="seu@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" required
                  className="w-full py-2.5 text-sm text-[#E0D8C8]"
                  style={{ borderBottom: '1px solid rgba(201,168,64,0.22)', transition: 'border-color .2s' }}
                  onFocus={e => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.7)'}
                  onBlur={e => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.22)'}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-[0.25em] text-[#484848]">Senha</label>
                <input
                  type="password" placeholder="••••••••" value={senha}
                  onChange={e => setSenha(e.target.value)} autoComplete="current-password" required
                  className="w-full py-2.5 text-sm text-[#E0D8C8]"
                  style={{ borderBottom: '1px solid rgba(201,168,64,0.22)', transition: 'border-color .2s' }}
                  onFocus={e => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.7)'}
                  onBlur={e => e.currentTarget.style.borderBottomColor = 'rgba(201,168,64,0.22)'}
                />
              </div>

              {erro && (
                <p className="text-xs flex items-center gap-2" style={{ color: '#FF6060' }}>
                  <span className="w-1 h-1 rounded-full bg-[#FF6060] flex-shrink-0" />{erro}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-4 text-[11px] font-semibold uppercase tracking-[0.3em] transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                style={{ background: 'linear-gradient(90deg, #7A5E18, #C9A840, #EDD060, #C9A840, #7A5E18)', color: '#080604' }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>Entrando
                    </span>
                  : 'Entrar'}
              </button>
            </form>

            <p className="cf text-[9px] mt-8" style={{ color: '#222', letterSpacing: '0.2em', fontStyle: 'italic' }}>
              HG Select &copy; {new Date().getFullYear()} — Acesso exclusivo
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
