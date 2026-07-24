import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { indexarRespostasPorAluno, type RespostaPergunta } from '@/lib/pente-fino'
import { agruparRelatoriosPorMes } from '@/lib/relatorio-mes'
import { RelatorioAlunoPDF } from '@/lib/pdf/RelatorioAlunoPDF'

type AlunoResultado = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador?: string
}

type ResultadoJson = {
  nao_feitos: AlunoResultado[]
  feitos: AlunoResultado[]
}

function sanitizarCaminho(texto: string): string {
  const limpo = texto.replace(/[\\/*?:"<>|\r\n]/g, '').trim()
  return limpo === '' || /^\.+$/.test(limpo) ? '_' : limpo
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; identificador: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id, identificador } = await params
  const service = createServiceClient()

  const { data: auditoria } = await service
    .from('auditorias')
    .select('relatorios_incluidos, resultado_json')
    .eq('id', id)
    .single()

  if (!auditoria) {
    return NextResponse.json({ error: 'Auditoria não encontrada' }, { status: 404 })
  }

  const resultado = auditoria.resultado_json as ResultadoJson | null
  const aluno =
    resultado?.nao_feitos.find((a) => a.identificador === identificador) ??
    resultado?.feitos.find((a) => a.identificador === identificador)

  if (!aluno) {
    return NextResponse.json({ error: 'Aluno não encontrado nessa auditoria' }, { status: 404 })
  }

  const { data: planilhas } = await service
    .from('planilha_geral')
    .select('id_coluna')
    .order('uploaded_at', { ascending: false })
    .limit(1)

  const idColuna = planilhas?.[0]?.id_coluna
  if (!idColuna) {
    return NextResponse.json(
      { error: 'Nenhuma coluna de identificador configurada em /configuracoes' },
      { status: 500 }
    )
  }

  const { data: relatorios } = await service
    .from('relatorios')
    .select('id, nome, storage_path, created_at')
    .in('id', auditoria.relatorios_incluidos ?? [])
    .order('created_at', { ascending: true })

  const relatoriosComRespostas: {
    nome: string
    createdAt: string
    respostas: RespostaPergunta[] | null
  }[] = []

  for (const rel of relatorios ?? []) {
    const { data: relFile } = await service.storage.from('relatorios').download(rel.storage_path)
    if (!relFile) continue

    const texto = await relFile.text()
    const indice = indexarRespostasPorAluno(texto, idColuna)

    relatoriosComRespostas.push({
      nome: rel.nome,
      createdAt: rel.created_at,
      respostas: indice.get(identificador) ?? null,
    })
  }

  const meses = agruparRelatoriosPorMes(relatoriosComRespostas)

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(
      <RelatorioAlunoPDF
        nome={aluno.nomeCompleto}
        estado={aluno.estado}
        empresa={aluno.empresa}
        meses={meses}
      />
    )
  } catch (error) {
    console.error('Falha ao renderizar PDF do aluno', error)
    return NextResponse.json({ error: 'Falha ao gerar o PDF' }, { status: 500 })
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sanitizarCaminho(aluno.nomeCompleto)}.pdf"`,
    },
  })
}
