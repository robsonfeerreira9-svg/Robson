'use client'

import { useState, useEffect } from 'react'

const FRASES = [
  "Você não trabalha para pagar contas. Você trabalha para construir a versão mais poderosa de si mesma.",
  "Cada venda que você fecha hoje é uma prova silenciosa de que você é capaz de ir além do que imagina.",
  "O desconforto que você sente agora tem um nome: crescimento. Não fuja dele.",
  "As pessoas que chegaram longe não eram as mais talentosas. Eram as que não pararam quando ficou difícil.",
  "Sua meta não é um número numa planilha. É a promessa que você fez para si mesma.",
  "O que você faz hoje, em silêncio, vai falar por você muito alto no futuro.",
  "Cada 'não' que você ouviu foi o universo te preparando para um 'sim' maior.",
  "Você não precisa de perfeição. Você precisa de presença e intenção em cada momento.",
  "Acreditar antes de ver — essa é a diferença entre quem realiza e quem fica esperando.",
  "Você não é onde estava. Você já cresceu mais do que percebe.",
  "Uma ação consistente, todo dia, supera qualquer talento sem disciplina.",
  "O seu futuro não depende das circunstâncias. Depende das escolhas que você faz agora.",
  "Seja hoje a melhor versão que você já foi. Amanhã, supere ela.",
  "A sua história não começa quando fica fácil. Começa quando você decide não desistir.",
  "Quem você será em um ano depende do que você escolhe fazer hoje.",
  "O sucesso não vem do que você faz de vez em quando. Vem do que você faz todos os dias.",
  "Você tem dentro de si tudo o que precisa. Só precisa acreditar o suficiente para usar.",
  "A cliente que entra pela porta não está comprando uma peça. Está comprando a confiança que você transmite.",
  "Grandes resultados começam com pequenas decisões tomadas com coragem.",
  "Ninguém se lembra de quem desistiu. Todo mundo se lembra de quem foi além.",
]

interface SplashMotivacionalProps {
  userId: string
}

export default function SplashMotivacional({ userId }: SplashMotivacionalProps) {
  const [visivel, setVisivel] = useState(false)
  const [frase, setFrase] = useState('')

  useEffect(() => {
    if (!userId) return
    const hoje = new Date().toISOString().slice(0, 10)
    const chave = `splash_${userId}_${hoje}`
    if (localStorage.getItem(chave)) return

    // Escolhe frase do dia baseada no dia do ano para ser consistente
    const diaDoAno = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    )
    setFrase(FRASES[diaDoAno % FRASES.length])
    setVisivel(true)
  }, [userId])

  function fechar() {
    const hoje = new Date().toISOString().slice(0, 10)
    localStorage.setItem(`splash_${userId}_${hoje}`, '1')
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/95 backdrop-blur-sm p-6">
      <div className="max-w-lg w-full flex flex-col items-center gap-8 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-gold font-black text-3xl uppercase tracking-widest">HG</span>
          <span className="text-[#888888] text-xs uppercase tracking-widest">Grifes</span>
        </div>

        {/* Aspas decorativas */}
        <svg className="w-10 h-10 text-gold/30" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
        </svg>

        {/* Frase */}
        <p className="text-xl md:text-2xl font-semibold text-[#F0F0F0] leading-relaxed">
          {frase}
        </p>

        {/* Linha decorativa */}
        <div className="w-16 h-0.5 bg-gold/50 rounded-full" />

        {/* Botão */}
        <button
          onClick={fechar}
          className="bg-gold text-[#0D0D0D] font-black text-sm uppercase tracking-widest px-8 py-3 rounded-lg hover:bg-[#e6b800] transition-colors active:scale-95"
        >
          Bora vender!
        </button>
      </div>
    </div>
  )
}
