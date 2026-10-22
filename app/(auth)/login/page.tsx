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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes breathe { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.8;transform:scale(1.06)} }
        @keyframes grain   {
          0%,100%{transform:translate(0,0)} 20%{transform:translate(-3%,2%)}
          40%{transform:translate(2%,-3%)} 60%{transform:translate(-2%,3%)} 80%{transform:translate(3%,-2%)}
        }
        .cf { font-family:'Cormorant Garamond',serif; }
        .a1 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .15s both; }
        .a2 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .35s both; }
        .a3 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .55s both; }
        .a4 { animation:slideUp .9s cubic-bezier(.16,1,.3,1) .7s  both; }
        .af { animation:fadeIn 1.4s ease .05s both; }
        input { background:transparent!important; }
        input::placeholder { color:#2a2a2a; }
        input:focus { outline:none!important; }
      `}</style>

      <main className="relative min-h-screen w-full overflow-hidden flex items-stretch"
        style={{ background: 'linear-gradient(160deg, #0C0906 0%, #080604 40%, #0D0A07 100%)' }}>

        {/* ── FUNDO: camadas de profundidade ── */}
        <div className="absolute inset-0 pointer-events-none af">
          {/* luz lateral esquerda quente */}
          <div className="absolute top-0 left-0 bottom-0 w-[55%]"
            style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(180,130,40,0.13) 0%, transparent 65%)' }} />
          {/* chão iluminado */}
          <div className="absolute bottom-0 inset-x-0 h-[45%]"
            style={{ background: 'radial-gradient(ellipse at 50% 110%, rgba(160,110,20,0.15) 0%, transparent 60%)' }} />
          {/* sombra direita */}
          <div className="absolute top-0 right-0 bottom-0 w-[35%]"
            style={{ background: 'linear-gradient(270deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }} />
          {/* sombra topo */}
          <div className="absolute top-0 inset-x-0 h-32"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)' }} />
          {/* grain */}
          <div className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize:'160px 160px', animation:'grain 8s steps(10) infinite',
            }} />
        </div>

        {/* ── SILHUETA: homem de terno ── */}
        <div className="absolute bottom-0 left-[8%] md:left-[12%] h-[92%] flex items-end pointer-events-none af"
          style={{ zIndex: 2 }}>
          <svg viewBox="0 0 320 820" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="h-full w-auto opacity-90"
            style={{ filter: 'drop-shadow(0 0 60px rgba(180,130,30,0.18)) drop-shadow(-20px 0 80px rgba(200,160,50,0.1))' }}>

            {/* ─── CABEÇA ─── */}
            <ellipse cx="160" cy="58" rx="34" ry="40" fill="#1A1208"/>
            {/* cabelo */}
            <ellipse cx="160" cy="38" rx="34" ry="18" fill="#0D0906"/>
            {/* rosto leve highlight */}
            <ellipse cx="153" cy="62" rx="14" ry="18" fill="#241A0D" opacity=".7"/>

            {/* ─── PESCOÇO ─── */}
            <rect x="148" y="94" width="24" height="28" rx="6" fill="#1A1208"/>

            {/* ─── CAMISA (colarinho) ─── */}
            <path d="M148 108 L136 130 L148 126 L160 140 L172 126 L184 130 L172 108 Z" fill="#E8DFC8" opacity=".85"/>

            {/* ─── TERNO: corpo ─── */}
            {/* lapela esquerda */}
            <path d="M148 120 L88 160 L82 320 L158 320 L158 210 L148 120Z" fill="#1C140A"/>
            {/* lapela direita */}
            <path d="M172 120 L232 160 L238 320 L162 320 L162 210 L172 120Z" fill="#181108"/>
            {/* faixa da lapela esquerda dourada */}
            <path d="M148 120 L120 165 L110 165 L148 115Z" fill="#C9A840" opacity=".25"/>
            {/* faixa da lapela direita */}
            <path d="M172 120 L200 165 L210 165 L172 115Z" fill="#C9A840" opacity=".2"/>
            {/* botões */}
            <circle cx="160" cy="200" r="3" fill="#C9A840" opacity=".6"/>
            <circle cx="160" cy="225" r="3" fill="#C9A840" opacity=".5"/>
            <circle cx="160" cy="250" r="3" fill="#C9A840" opacity=".4"/>
            {/* gravata */}
            <path d="M156 132 L152 180 L160 196 L168 180 L164 132 L160 142Z" fill="#8A0020" opacity=".75"/>
            <path d="M160 132 L156 148 L160 144 L164 148Z" fill="#6A0018" opacity=".8"/>

            {/* ─── OMBROS / MANGAS ─── */}
            {/* ombro esquerdo */}
            <path d="M88 155 L54 185 L46 320 L82 320 L82 175Z" fill="#1C140A"/>
            {/* manga esq */}
            <path d="M46 315 L42 500 L70 510 L78 320Z" fill="#1A1208"/>
            {/* punho esq */}
            <path d="M42 498 L38 540 L68 545 L70 508Z" fill="#141009"/>
            <path d="M38 535 L36 548 L68 552 L68 542Z" fill="#E8DFC8" opacity=".7"/>

            {/* ombro direito */}
            <path d="M232 155 L266 185 L274 320 L238 320 L238 175Z" fill="#181108"/>
            {/* manga dir */}
            <path d="M274 315 L278 500 L250 510 L242 320Z" fill="#161008"/>
            {/* punho dir */}
            <path d="M278 498 L282 540 L252 545 L250 508Z" fill="#121008"/>
            <path d="M282 535 L284 548 L252 552 L252 542Z" fill="#E8DFC8" opacity=".7"/>

            {/* mão direita (bolso) */}
            <path d="M270 490 L278 540 L255 544 L250 495Z" fill="#1A1208" opacity=".9"/>
            <path d="M268 510 L258 530 L255 528 L265 508Z" fill="#241A0D" opacity=".6"/>

            {/* ─── CALÇA ─── */}
            {/* corpo calça */}
            <path d="M82 318 L82 440 L108 440 L128 780 L100 780 L100 820 L220 820 L220 780 L192 780 L212 440 L238 440 L238 318Z" fill="#141009"/>
            {/* vinco calça esq */}
            <path d="M108 440 L120 780 L128 780 L116 440Z" fill="#1C1610" opacity=".5"/>
            {/* vinco calça dir */}
            <path d="M212 440 L200 780 L192 780 L204 440Z" fill="#181410" opacity=".5"/>

            {/* ─── SAPATOS ─── */}
            <path d="M98 816 L98 830 L152 830 L152 818 L128 814Z" fill="#0A0806"/>
            <path d="M202 816 L202 830 L222 830 L224 818 L208 814Z" fill="#0A0806"/>
            {/* brilho sapato */}
            <path d="M102 820 L120 820 L120 822 L102 822Z" fill="#C9A840" opacity=".15"/>

            {/* ─── LENÇO de bolso dourado ─── */}
            <path d="M210 168 L225 158 L228 172 L218 178Z" fill="#C9A840" opacity=".7"/>
            <path d="M218 158 L232 150 L234 162 L220 168Z" fill="#E8C840" opacity=".55"/>

            {/* ─── luz ambiente no terno ─── */}
            <path d="M88 160 L82 320 L88 320 L94 165Z" fill="white" opacity=".025"/>
            <path d="M232 160 L238 320 L232 320 L226 165Z" fill="white" opacity=".02"/>
          </svg>
        </div>

        {/* luz dramatica sobre a silhueta */}
        <div className="absolute bottom-0 left-0 w-[50%] h-[85%] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 25% 80%, rgba(201,168,64,0.07) 0%, transparent 55%)', zIndex: 3 }} />

        {/* ── CENTRO: logo flutuante ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div className="flex flex-col items-center gap-5 a1">
            {/* halo de luz */}
            <div className="absolute w-72 h-72 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(201,168,64,0.1) 0%, transparent 70%)', animation: 'breathe 5s ease-in-out infinite' }} />

            {/* logo */}
            <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden"
              style={{
                boxShadow: '0 0 0 2px rgba(201,168,64,0.7), 0 0 0 5px rgba(201,168,64,0.12), 0 20px 80px rgba(0,0,0,0.9), 0 4px 20px rgba(201,168,64,0.2)',
                zIndex: 1,
              }}>
              <Image src="/hg-logo.jpg" alt="HG Select" fill className="object-cover" sizes="144px" priority />
            </div>

            {/* nome */}
            <div className="flex flex-col items-center gap-2">
              <h1 className="cf text-center"
                style={{
                  fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
                  fontWeight: 300,
                  letterSpacing: '0.45em',
                  background: 'linear-gradient(180deg, #FFE490 0%, #C9A840 35%, #A07830 65%, #C9A840 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                HG SELECT
              </h1>
              <div className="flex items-center gap-4">
                <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.45))' }} />
                <p className="cf text-[9px] uppercase tracking-[0.5em]" style={{ color: 'rgba(201,168,64,0.4)', fontStyle: 'italic' }}>Moda Exclusiva</p>
                <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, rgba(201,168,64,0.45), transparent)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── FORMULÁRIO — painel direito ── */}
        <div className="relative ml-auto w-full md:w-[400px] flex items-end md:items-center justify-center px-8 pb-10 pt-[55vh] md:pt-0"
          style={{ zIndex: 10 }}>

          {/* vidro escuro */}
          <div className="w-full max-w-xs rounded-2xl p-px"
            style={{ background: 'linear-gradient(145deg, rgba(201,168,64,0.2), rgba(201,168,64,0.04), rgba(201,168,64,0.12))' }}>
            <div className="rounded-2xl px-7 py-8 flex flex-col gap-6"
              style={{ background: 'rgba(5,4,2,0.88)', backdropFilter: 'blur(24px)' }}>

              <div className="a2">
                <p className="cf text-[10px] uppercase tracking-[0.3em] mb-0.5" style={{ color: 'rgba(201,168,64,0.45)', fontStyle: 'italic' }}>Bem-vinda</p>
                <h2 className="text-[#D8CEB8] font-light" style={{ fontSize: '1.15rem', letterSpacing: '0.06em' }}>Acesse o sistema</h2>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-5 a3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase tracking-[0.25em] text-[#3A3A3A]">Email</label>
                  <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="email" required
                    className="w-full py-2.5 text-sm text-[#D8CEB8] transition-all"
                    style={{ borderBottom: '1px solid rgba(201,168,64,0.18)', borderTop:'none', borderLeft:'none', borderRight:'none', borderRadius:0 }}
                    onFocus={e => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.6)'}
                    onBlur={e => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.18)'}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase tracking-[0.25em] text-[#3A3A3A]">Senha</label>
                  <input type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)}
                    autoComplete="current-password" required
                    className="w-full py-2.5 text-sm text-[#D8CEB8] transition-all"
                    style={{ borderBottom: '1px solid rgba(201,168,64,0.18)', borderTop:'none', borderLeft:'none', borderRight:'none', borderRadius:0 }}
                    onFocus={e => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.6)'}
                    onBlur={e => e.currentTarget.style.borderBottomColor='rgba(201,168,64,0.18)'}
                  />
                </div>

                {erro && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: '#FF6060' }}>
                    <span className="w-1 h-1 rounded-full bg-[#FF6060] flex-shrink-0" />{erro}
                  </p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 text-[11px] uppercase font-semibold tracking-[0.3em] transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                  style={{ background: 'linear-gradient(90deg, #8A6820, #C9A840, #EDD060, #C9A840, #8A6820)', color: '#080604', letterSpacing: '0.25em' }}>
                  {loading
                    ? <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>Entrando
                      </span>
                    : 'Entrar'}
                </button>
              </form>

              <p className="cf text-[9px] text-center a4" style={{ color: '#1A1A1A', letterSpacing: '0.2em', fontStyle: 'italic' }}>
                HG Select &copy; {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>

        {/* linha dourada de rodapé */}
        <div className="absolute bottom-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,64,0.25), transparent)', zIndex: 20 }} />
      </main>
    </>
  )
}
