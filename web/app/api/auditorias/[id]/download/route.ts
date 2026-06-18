import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
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
  const modo = request.nextUrl.searchParams.get('modo') as
    | 'nao_feitos'
    | 'feitos'
    | null

  if (!modo || !['nao_feitos', 'feitos'].includes(modo)) {
    return NextResponse.json(
      { error: 'Parâmetro modo inválido. Use: nao_feitos | feitos' },
      { status: 400 }
    )
  }

  const service = createServiceClient()
  const { data: auditoria } = await service
    .from('auditorias')
    .select('resultado_nao_feitos_path, resultado_feitos_path')
    .eq('id', id)
    .single()

  if (!auditoria) {
    return NextResponse.json({ error: 'Auditoria não encontrada' }, { status: 404 })
  }

  const path =
    modo === 'nao_feitos'
      ? auditoria.resultado_nao_feitos_path
      : auditoria.resultado_feitos_path

  if (!path) {
    return NextResponse.json(
      { error: 'Arquivo de resultado não disponível' },
      { status: 404 }
    )
  }

  const { data: file, error: storageError } = await service.storage
    .from('auditorias')
    .download(path)

  if (!file || storageError) {
    return NextResponse.json(
      { error: 'Erro ao baixar arquivo do Storage' },
      { status: 500 }
    )
  }

  const filename =
    modo === 'nao_feitos' ? 'resultado-nao-feitos.csv' : 'resultado-feitos.csv'

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
