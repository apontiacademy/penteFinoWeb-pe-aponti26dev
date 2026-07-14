'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'
import { registrarLog } from '@/lib/system-log'
import { planilhaTemColuna } from '@/lib/pente-fino'

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

type ActionState = {
  error?: string
  sucesso?: { id: string; nome: string }[]
  falhas?: { nome: string; erro: string }[]
} | null

export async function adicionarRelatorios(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await verificarAdmin()
    const supabase = await createClient()

    const arquivos = formData
      .getAll('arquivos')
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (arquivos.length === 0) return { error: 'Selecione ao menos um arquivo CSV.' }

    const { data: planilhas } = await supabase
      .from('planilha_geral')
      .select('id_coluna')
      .order('uploaded_at', { ascending: false })
      .limit(1)

    const idColuna = planilhas?.[0]?.id_coluna
    if (!idColuna) {
      return {
        error:
          'Configure a coluna de identificador na planilha geral (/configuracoes) antes de anexar relatórios.',
      }
    }

    const { count } = await supabase
      .from('relatorios')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)

    let proximoNumero = (count ?? 0) + 1

    const sucesso: { id: string; nome: string }[] = []
    const falhas: { nome: string; erro: string }[] = []

    for (const arquivo of arquivos) {
      const nome = `Relatório ${proximoNumero}`
      const semana = `Semana ${proximoNumero}`

      try {
        const texto = await arquivo.text()
        if (!planilhaTemColuna(texto, idColuna)) {
          falhas.push({
            nome: arquivo.name,
            erro: `Coluna de identificador "${idColuna}" ausente.`,
          })
          continue
        }

        const relatorioId = crypto.randomUUID()
        const storagePath = `${relatorioId}/arquivo.csv`

        const { error: uploadError } = await supabase.storage
          .from('relatorios')
          .upload(storagePath, arquivo, { upsert: true })

        if (uploadError) {
          falhas.push({ nome: arquivo.name, erro: `Erro no upload: ${uploadError.message}` })
          continue
        }

        const { error: insertError } = await supabase.from('relatorios').insert({
          id: relatorioId,
          nome,
          semana,
          storage_path: storagePath,
          user_id: user.id,
        })

        if (insertError) {
          falhas.push({ nome: arquivo.name, erro: `Erro ao registrar: ${insertError.message}` })
          continue
        }

        await registrarLog({
          userId: user.id,
          userEmail: user.email!,
          action: 'relatorio.adicionar',
          target: relatorioId,
          details: { nome, semana },
        })

        sucesso.push({ id: relatorioId, nome })
        proximoNumero++
      } catch (e) {
        falhas.push({
          nome: arquivo.name,
          erro: e instanceof Error ? e.message : 'Erro desconhecido',
        })
      }
    }

    if (sucesso.length > 0) revalidatePath('/relatorios')

    return { sucesso, falhas }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

export async function deletarRelatorio(relatorioId: string) {
  const admin = await verificarAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('relatorios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relatorioId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  await registrarLog({
    userId: admin.id,
    userEmail: admin.email!,
    action: 'relatorio.deletar',
    target: relatorioId,
  })

  revalidatePath('/relatorios')
}

export async function gerarAuditoriaManual(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    const admin = await verificarAdmin()
    const supabase = await createClient()

    await gerarAuditoria(triggerType, relatorioTriggerId, supabase)

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'auditoria.gerar',
      details: { triggerType, relatorioTriggerId },
    })

    revalidatePath('/relatorios')
    revalidatePath('/auditorias')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
