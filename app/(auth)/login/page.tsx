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
    } catch { setErro('Erro inesperado.') }
    finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Inter:wght@300;400;500;600&display=swap');

        @keyframes logoIn {
          from { opacity:0; transform:scale(.88) translateY(16px); filter:blur(10px); }
          to   { opacity:1; transform:scale(1)  translateY(0);    filter:blur(0); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400% center; }
          100% { background-position:  400% center; }
        }
        @keyframes glow {
          0%,100% { opacity:.4; transform:scale(1); }
          50%     { opacity:.7; transform:scale(1.07); }
        }

        .logo-in  { animation: logoIn  1.1s cubic-bezier(.16,1,.3,1) .05s both; }
        .fade-1   { animation: fadeUp  .8s cubic-bezier(.16,1,.3,1) .6s  both; }
        .fade-2   { animation: fadeUp  .8s cubic-bezier(.16,1,.3,1) .8s  both; }
        .fade-3   { animation: fadeUp  .8s cubic-bezier(.16,1,.3,1) .95s both; }

        .brand-text {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          letter-spacing: .42em;
          text-indent: .42em;
          background: linear-gradient(90deg,
            #8A6820 0%, #C9A840 20%, #FFE98A 35%,
            #C9A840 50%, #FFE98A 65%, #C9A840 80%, #8A6820 100%);
          background-size: 400% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 5s linear 1.2s infinite;
        }

        input { background: transparent !important; }
        input::placeholder { color: #282828; }
        input:focus { outline: none !important; }
        .btn-gold:hover { filter: brightness(1.08); }
      `}</style>

      <main
        className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden"
        style={{ background: '#050403' }}
      >
        {/* ── camadas de fundo ── */}
        <div className="absolute inset-0 pointer-events-none">
          {/* glow central dourado */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(201,168,64,0.13) 0%, rgba(160,110,20,0.05) 45%, transparent 70%)',
              animation: 'glow 6s ease-in-out infinite',
            }}
          />
          {/* acento superior */}
          <div className="absolute top-0 inset-x-0 h-64"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,64,0.04) 0%, transparent 70%)' }} />
          {/* vinheta de borda */}
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)' }} />
          {/* linhas horizontais sutis */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(201,168,64,1) 0px, rgba(201,168,64,1) 1px, transparent 1px, transparent 60px)' }} />
        </div>

        {/* ── logo GRANDE no centro ── */}
        <div className="relative flex flex-col items-center gap-5 logo-in" style={{ zIndex: 5 }}>

          {/* anel de luz atrás da logo */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: 340, height: 340,
              background: 'radial-gradient(circle, rgba(201,168,64,0.16) 0%, transparent 65%)',
              animation: 'glow 5s ease-in-out 1s infinite',
            }}
          />

          {/* logo — disco de fundo para separar do preto, depois a logo por cima */}
          <div className="relative flex items-center justify-center"
            style={{ width: 240, height: 240 }}>
            {/* disco de brilho atrás */}
            <div className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(201,168,64,0.22) 0%, rgba(120,80,10,0.08) 55%, transparent 75%)',
                animation: 'glow 5s ease-in-out infinite',
              }} />
            {/* borda dourada visível */}
            <div className="absolute inset-4 rounded-full"
              style={{ boxShadow: '0 0 0 2px rgba(201,168,64,0.8), 0 0 40px rgba(201,168,64,0.25), 0 16px 60px rgba(0,0,0,0.8)' }} />
            {/* a logo em si */}
            <div className="relative rounded-full overflow-hidden" style={{ width: 208, height: 208 }}>
              <Image
                src="/hg-logo.jpg"
                alt="HG Select"
                fill
                className="object-cover"
                sizes="208px"
                priority
              />
            </div>
          </div>

          {/* nome da marca com shimmer dourado */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="brand-text" style={{ fontSize: 'clamp(1.5rem, 5vw, 2.4rem)' }}>
              HG SELECT
            </h1>
            <div className="flex items-center gap-3">
              <div className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.4))' }} />
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'0.58rem', letterSpacing:'0.5em', color:'rgba(201,168,64,0.35)', fontStyle:'italic' }}>
                MODA EXCLUSIVA
              </span>
              <div className="h-px w-10" style={{ background: 'linear-gradient(90deg, rgba(201,168,64,0.4), transparent)' }} />
            </div>
          </div>
        </div>

        {/* ── separador ── */}
        <div className="fade-1 my-8 w-px h-10" style={{ background: 'linear-gradient(180deg, transparent, rgba(201,168,64,0.3), transparent)', zIndex:5 }} />

        {/* ── formulário centralizado ── */}
        <div className="fade-2 relative w-full max-w-xs px-6" style={{ zIndex: 5 }}>
          <form onSubmit={handleLogin} className="flex flex-col gap-5">

            {/* email */}
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize:'0.6rem', letterSpacing:'0.28em', color:'#383838', textTransform:'uppercase' }}>
                Email
              </label>
              <input
                type="email" placeholder="seu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email" required
                className="w-full py-3 text-sm text-[#D8D0C0]"
                style={{ borderBottom:'1px solid rgba(201,168,64,0.2)', transition:'border-color .25s' }}
                onFocus={e => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.65)'}
                onBlur={e  => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.2)'}
              />
            </div>

            {/* senha */}
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize:'0.6rem', letterSpacing:'0.28em', color:'#383838', textTransform:'uppercase' }}>
                Senha
              </label>
              <input
                type="password" placeholder="••••••••" value={senha}
                onChange={e => setSenha(e.target.value)} autoComplete="current-password" required
                className="w-full py-3 text-sm text-[#D8D0C0]"
                style={{ borderBottom:'1px solid rgba(201,168,64,0.2)', transition:'border-color .25s' }}
                onFocus={e => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.65)'}
                onBlur={e  => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.2)'}
              />
            </div>

            {erro && (
              <p className="text-xs flex items-center gap-2" style={{ color:'#FF6060' }}>
                <span className="w-1 h-1 rounded-full bg-[#FF6060] flex-shrink-0" />{erro}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              className="btn-gold w-full py-4 mt-1 text-[11px] font-semibold uppercase tracking-[0.32em] transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background:'linear-gradient(90deg, #7A5E18, #C9A840, #EDD060, #C9A840, #7A5E18)', color:'#050403' }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Entrando
                  </span>
                : 'Entrar'}
            </button>
          </form>
        </div>

        {/* rodapé */}
        <p className="fade-3 absolute bottom-6 text-[9px] tracking-widest" style={{ color:'#1C1C1C', fontStyle:'italic', fontFamily:'Cormorant Garamond, serif', zIndex:5 }}>
          HG Select &copy; {new Date().getFullYear()} — Acesso exclusivo
        </p>
      </main>
    </>
  )
}
