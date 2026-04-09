'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

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

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })

      if (authError || !authData.user) {
        setErro('Email ou senha incorretos. Tente novamente.')
        return
      }

      // Buscar role do usuário
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (userError || !usuario) {
        setErro('Usuário não encontrado no sistema.')
        return
      }

      if (usuario.role === 'socio') {
        router.push('/dashboard')
      } else {
        router.push('/pdv')
      }
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black uppercase tracking-widest text-gold mb-2">
            HG GRIFES
          </h1>
          <p className="text-[#888888] text-sm tracking-wide">Sistema de Gestão</p>
        </div>

        {/* Card de login */}
        <Card className="shadow-2xl">
          <h2 className="text-lg font-semibold text-[#F0F0F0] mb-6">Entrar no sistema</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />

            {/* Mensagem de erro */}
            {erro && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30">
                <svg className="w-4 h-4 text-[#FF4444] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-[#FF4444]">{erro}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              className="h-12 text-base mt-2"
            >
              Entrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-[#888888] mt-6">
          HG Grifes &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
