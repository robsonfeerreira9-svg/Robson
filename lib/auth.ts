'use server'

import { createServerSupabaseClient } from './supabase'
import { redirect } from 'next/navigation'
import type { RoleUsuario } from './database.types'

export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(): Promise<RoleUsuario | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as RoleUsuario) ?? null
}

export async function requireRole(role: RoleUsuario | RoleUsuario[]) {
  const currentRole = await getUserRole()

  if (!currentRole) {
    redirect('/login')
  }

  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(currentRole)) {
    if (currentRole === 'funcionario') {
      redirect('/pdv')
    } else {
      redirect('/dashboard')
    }
  }

  return currentRole
}

export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
