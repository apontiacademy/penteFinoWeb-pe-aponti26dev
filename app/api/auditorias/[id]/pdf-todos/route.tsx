import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import JSZip from 'jszip'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { indexarRespostasPorAluno, type RespostaPergunta } from '@/lib/pente-fino'
import { agruparRelatoriosPorMes } from '@/lib/relatorio-mes'
import { RelatorioAlunoPDF } from '@/lib/pdf/RelatorioAlunoPDF'

export const maxDuration = 300

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
  return texto.replace(/[\\/*?:"<>|\r\n]/g, '').trim()
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

  const { data: auditoria } = await service
    .from('auditorias')
    .select('relatorios_incluidos, resultado_json')
    .eq('id', id)
    .single()

  if (!auditoria) {
    return NextResponse.json({ error: 'Auditoria não encontrada' }, { status: 404 })
  }

  const resultado = auditoria.resultado_json as ResultadoJson | null
  const alunos = (resultado?.nao_feitos ?? []).filter(
    (a): a is AlunoResultado & { identificador: string } => !!a.identificador
  )

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

  const relatoriosIndexados: {
    nome: string
    createdAt: string
    indice: Map<string, RespostaPergunta[]>
  }[] = []

  for (const rel of relatorios ?? []) {
    const { data: relFile } = await service.storage.from('relatorios').download(rel.storage_path)
    if (!relFile) continue

    const texto = await relFile.text()
    relatoriosIndexados.push({
      nome: rel.nome,
      createdAt: rel.created_at,
      indice: indexarRespostasPorAluno(texto, idColuna),
    })
  }

  const mesesBase = agruparRelatoriosPorMes(relatoriosIndexados)

  const zip = new JSZip()
  const caminhosUsados = new Set<string>()

  for (const aluno of alunos) {
    const meses = mesesBase.map((grupo) => ({
      mes: grupo.mes,
      relatorios: grupo.relatorios.map((rel) => ({
        nome: rel.nome,
        respostas: rel.indice.get(aluno.identificador) ?? null,
      })),
    }))

    const buffer = await renderToBuffer(
      <RelatorioAlunoPDF
        nome={aluno.nomeCompleto}
        estado={aluno.estado}
        empresa={aluno.empresa}
        meses={meses}
      />
    )

    let caminho = `${sanitizarCaminho(aluno.estado || 'Sem núcleo')}/${sanitizarCaminho(
      aluno.empresa || 'Sem empresa'
    )}/${sanitizarCaminho(aluno.nomeCompleto)}.pdf`

    if (caminhosUsados.has(caminho)) {
      caminho = `${sanitizarCaminho(aluno.estado || 'Sem núcleo')}/${sanitizarCaminho(
        aluno.empresa || 'Sem empresa'
      )}/${sanitizarCaminho(aluno.nomeCompleto)}-${aluno.identificador}.pdf`
    }
    caminhosUsados.add(caminho)

    zip.file(caminho, buffer)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="relatorios-auditoria-${id}.zip"`,
    },
  })
}
