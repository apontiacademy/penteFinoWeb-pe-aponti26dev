'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function verificarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    throw new Error('Acesso negado: apenas administradores')
  }
  return user
}

type ActionState = { error?: string; success?: boolean } | null

export async function uploadPlanilhaGeral(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await verificarAdmin()
    const supabase = await createClient()

    const arquivo = formData.get('arquivo') as File
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const planilhaId = crypto.randomUUID()
    const storagePath = `${planilhaId}/arquivo.csv`

    const { error: uploadError } = await supabase.storage
      .from('planilha-geral')
      .upload(storagePath, arquivo, { upsert: true })

    if (uploadError) return { error: `Erro no upload: ${uploadError.message}` }

    const { error: insertError } = await supabase.from('planilha_geral').insert({
      storage_path: storagePath,
      user_id: user.id,
    })

    if (insertError) return { error: `Erro ao registrar: ${insertError.message}` }

    revalidatePath('/configuracoes')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
