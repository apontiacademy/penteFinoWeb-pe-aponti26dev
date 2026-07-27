import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function sanitizarCaminho(texto: string): string {
  const limpo = texto.replace(/[\\/*?:"<>|\r\n]/g, '').trim()
  return limpo === '' || /^\.+$/.test(limpo) ? '_' : limpo
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: relatorio } = await service
    .from('relatorios')
    .select('nome, storage_path, deleted_at')
    .eq('id', id)
    .single()

  if (!relatorio || relatorio.deleted_at) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  const { data: file, error: storageError } = await service.storage
    .from('relatorios')
    .download(relatorio.storage_path)

  if (!file || storageError) {
    return NextResponse.json({ error: 'Erro ao baixar arquivo do Storage' }, { status: 500 })
  }

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sanitizarCaminho(relatorio.nome)}.csv"`,
    },
  })
}
