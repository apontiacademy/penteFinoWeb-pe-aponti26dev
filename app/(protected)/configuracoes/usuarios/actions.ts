'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'
import { gerarSenhaAleatoria } from '@/lib/gerar-senha'
import { enviarSenhaPorEmail } from '@/lib/email/enviar-senha-usuario'

async function verificarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') throw new Error('Acesso negado')
  return user
}

export async function criarUsuario(
  prevState: {
    error?: string
    success?: boolean
    emailFalhou?: boolean
    senhaGerada?: string
  } | null,
  formData: FormData
) {
  try {
    const admin = await verificarAdmin()

    const email = formData.get('email') as string
    const role = formData.get('role') as string
    const nome = (formData.get('nome') as string) ?? ''
    const telefone = (formData.get('telefone') as string) ?? ''
    const cargo = (formData.get('cargo') as string) ?? ''
    const funcao = (formData.get('funcao') as string) ?? ''

    if (!email || !role) return { error: 'Email e perfil são obrigatórios' }

    const senha = gerarSenhaAleatoria()

    const supabase = createServiceClient()
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      app_metadata: { role },
      user_metadata: { nome, telefone, cargo, funcao },
      email_confirm: true,
    })

    if (error) return { error: error.message }

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'usuario.criar',
      target: email,
    })

    revalidatePath('/configuracoes/usuarios')

    const { error: emailError } = await enviarSenhaPorEmail({ email, nome, senha })
    if (emailError) {
      return { success: true, emailFalhou: true, senhaGerada: senha }
    }

    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

export async function atualizarUsuario(
  userId: string,
  data: { nome: string; telefone: string; cargo: string; funcao: string; role: 'admin' | 'user' }
) {
  const admin = await verificarAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { nome: data.nome, telefone: data.telefone, cargo: data.cargo, funcao: data.funcao },
    app_metadata: { role: data.role },
  })
  if (error) throw new Error(error.message)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.atualizar',
    target: userId,
    details: { role: data.role },
  })

  revalidatePath('/configuracoes/usuarios')
}

export async function desativarUsuario(userId: string) {
  const admin = await verificarAdmin()
  if (admin.id === userId) throw new Error('Não é possível desativar seu próprio usuário')

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })
  if (error) throw new Error(error.message)

  const { error: rpcError } = await supabase.rpc('revoke_user_sessions', { target_user_id: userId })
  if (rpcError) console.error('revoke_user_sessions falhou', rpcError)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.desativar',
    target: userId,
  })

  revalidatePath('/configuracoes/usuarios')
}

export async function reativarUsuario(userId: string) {
  const admin = await verificarAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (error) throw new Error(error.message)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'usuario.reativar',
    target: userId,
  })

  revalidatePath('/configuracoes/usuarios')
}
