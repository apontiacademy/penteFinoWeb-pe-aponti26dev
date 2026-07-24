import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { gerarXlsxAuditoria } from '@/lib/gerar-xlsx'
import type { ResultadoAusencia, ResultadoPresenca } from '@/lib/pente-fino'

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
  const service = createServiceClient()
  const formato = request.nextUrl.searchParams.get('formato') ?? 'csv'

  if (formato === 'xlsx') {
    const { data: auditoria } = await service
      .from('auditorias')
      .select('resultado_json')
      .eq('id', id)
      .single()

    if (!auditoria) {
      return NextResponse.json({ error: 'Auditoria não encontrada' }, { status: 404 })
    }

    const resultado = auditoria.resultado_json as
      | { nao_feitos: ResultadoAusencia[]; feitos: ResultadoPresenca[] }
      | null

    if (!resultado) {
      return NextResponse.json({ error: 'Resultado não disponível' }, { status: 404 })
    }

    let buffer
    try {
      buffer = await gerarXlsxAuditoria(resultado.nao_feitos ?? [], resultado.feitos ?? [])
    } catch (error) {
      console.error('Falha ao gerar XLSX da auditoria', error)
      return NextResponse.json({ error: 'Falha ao gerar o XLSX' }, { status: 500 })
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="resultado-auditoria-${id}.xlsx"`,
      },
    })
  }

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
