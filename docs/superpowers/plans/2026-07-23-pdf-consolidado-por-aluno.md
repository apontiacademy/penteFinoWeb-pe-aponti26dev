# PDF consolidado por aluno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar, a partir de uma auditoria, um PDF consolidado por aluno (dados + respostas de cada relatório, agrupadas por mês) — sob demanda por aluno e em lote (`.zip`) pra todos os alunos da auditoria.

**Architecture:** Duas novas funções puras em `lib/` (indexação de respostas por aluno a partir de um CSV de relatório; agrupamento de relatórios por mês a partir do `created_at`), um componente React de PDF (`@react-pdf/renderer`), e duas novas rotas de API que reaproveitam essas peças — uma pra um aluno, outra em lote (baixando/indexando cada CSV uma única vez, não por aluno).

**Tech Stack:** Next.js 16 (App Router, Route Handlers), TypeScript, Supabase (Storage + Postgres), `@react-pdf/renderer`, `jszip`, Vitest.

Spec de referência: `docs/superpowers/specs/2026-07-23-pdf-consolidado-por-aluno-design.md`

Branch atual: `feat/pdf-relatorio-aluno` (já existe, criada a partir de `develop`).

---

### Task 1: Instalar dependências

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)

- [ ] **Step 1: Instalar `@react-pdf/renderer` e `jszip`**

Run: `npm install @react-pdf/renderer jszip`

- [ ] **Step 2: Verificar que a instalação não quebrou nada**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros, todos os testes existentes passando.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adicionar dependencias react-pdf/renderer e jszip"
```

---

### Task 2: `lib/pente-fino.ts` — identificador na saída + indexação de respostas

**Files:**
- Modify: `lib/pente-fino.ts`
- Modify (testes): `lib/pente-fino.test.ts`

Depende do Task 1 (precisa do Papa.parse já disponível — sem dependência nova aqui, na verdade; pode rodar em paralelo ao Task 1 se preferir, mas segue a ordem do plano por simplicidade).

- [ ] **Step 1: Escrever os testes que falham**

Adicione ao final de `lib/pente-fino.test.ts` (mantendo os imports existentes, só adicionando `indexarRespostasPorAluno` à lista importada de `./pente-fino`):

```ts
import {
  normalizarNome,
  normalizarUF,
  parsearGrupos,
  carregarAlunos,
  carregarRelatorio,
  extrairGruposRelatorio,
  aplicarFallbackGrupos,
  calcularAusencias,
  calcularPresencas,
  planilhaTemColuna,
  indexarRespostasPorAluno,
} from './pente-fino'
```

E adicione estes `describe` blocks no final do arquivo:

```ts
describe('calcularAusencias — identificador propagado', () => {
  it('inclui o identificador do aluno no resultado', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')!
    const resultado = calcularAusencias(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.identificador).toBe('A1')
  })
})

describe('calcularPresencas — identificador propagado', () => {
  it('inclui o identificador do aluno no resultado', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.identificador).toBe('A1')
  })
})

const CSV_REL_COM_PERGUNTAS = `ID,Nome completo,1. Como foi a semana?,2. Teve alguma dificuldade?
A1,João Silva,Foi tranquila,Não
P1,Pedro Lima,Corrido mas produtivo,"Sim, prazo apertado"`

describe('indexarRespostasPorAluno', () => {
  it('indexa as respostas de cada aluno pelas colunas de pergunta numeradas', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_PERGUNTAS, 'ID')
    const respostasJoao = indice.get('A1')

    expect(respostasJoao).toEqual([
      { pergunta: 'Como foi a semana?', resposta: 'Foi tranquila' },
      { pergunta: 'Teve alguma dificuldade?', resposta: 'Não' },
    ])
  })

  it('aluno ausente do CSV não aparece no índice', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_PERGUNTAS, 'ID')
    expect(indice.has('NAO_EXISTE')).toBe(false)
  })

  it('retorna mapa vazio quando a coluna de identificador está ausente', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_SEM_COLUNA, 'ID')
    expect(indice.size).toBe(0)
  })

  it('cada aluno mapeia para lista vazia quando não há coluna de pergunta numerada', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_COLUNA, 'ID')
    expect(indice.get('A1')).toEqual([])
  })

  it('identificador duplicado no CSV: a última linha vence', () => {
    const csvDuplicado = `ID,Nome completo,1. Pergunta
A1,João Primeiro,Resposta 1
A1,João Segundo,Resposta 2`
    const indice = indexarRespostasPorAluno(csvDuplicado, 'ID')
    expect(indice.get('A1')).toEqual([{ pergunta: 'Pergunta', resposta: 'Resposta 2' }])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- lib/pente-fino.test.ts`
Expected: FAIL — `identificador` undefined nos dois primeiros testes novos, e `indexarRespostasPorAluno` não exportado (erro de import/tipo).

- [ ] **Step 3: Atualizar os tipos e as funções em `lib/pente-fino.ts`**

Localize e substitua os tipos `ResultadoAusencia`/`ResultadoPresenca`:

```ts
export type ResultadoAusencia = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador: string
  relatoriosAusentes: string
  totalAusencias: number
}

export type ResultadoPresenca = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador: string
  relatoriosFeitos: string
  totalFeitos: number
}
```

Localize `calcularAusencias` e adicione `identificador: aluno.identificador,` ao objeto retornado (dentro do `.map`):

```ts
export function calcularAusencias(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoAusencia[] {
  return alunos.map((aluno) => {
    const ausentes = Object.entries(relatorios)
      .filter(([, ids]) => !ids.has(aluno.identificador))
      .map(([nome]) => nome)

    return {
      nomeCompleto: aluno.nomeCompleto,
      estado: aluno.estado,
      empresa: aluno.empresa,
      identificador: aluno.identificador,
      relatoriosAusentes: ausentes.join(', '),
      totalAusencias: ausentes.length,
    }
  })
}
```

Mesma coisa em `calcularPresencas`:

```ts
export function calcularPresencas(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoPresenca[] {
  return alunos.map((aluno) => {
    const feitos = Object.entries(relatorios)
      .filter(([, ids]) => ids.has(aluno.identificador))
      .map(([nome]) => nome)

    return {
      nomeCompleto: aluno.nomeCompleto,
      estado: aluno.estado,
      empresa: aluno.empresa,
      identificador: aluno.identificador,
      relatoriosFeitos: feitos.join(', '),
      totalFeitos: feitos.length,
    }
  })
}
```

Adicione ao final do arquivo:

```ts
export type RespostaPergunta = { pergunta: string; resposta: string }

// Chave: identificador do aluno. Ausente do mapa = aluno não enviou esse relatório.
export function indexarRespostasPorAluno(
  csvText: string,
  idColuna: string
): Map<string, RespostaPergunta[]> {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const mapa = new Map<string, RespostaPergunta[]>()
  const idKey = meta.fields?.find((f) => f === idColuna)
  if (!idKey) return mapa

  const colunasPergunta = (meta.fields ?? []).filter((f) => /^\d+\./.test(f.trim()))

  for (const row of data) {
    const identificador = (row[idKey] ?? '').trim()
    if (!identificador) continue
    mapa.set(
      identificador,
      colunasPergunta.map((col) => ({
        pergunta: col.replace(/^\d+\.\s*/, '').trim(),
        resposta: (row[col] ?? '').trim(),
      }))
    )
  }

  return mapa
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- lib/pente-fino.test.ts`
Expected: PASS, todos os testes (os já existentes + os novos).

- [ ] **Step 5: Verificar tipos no projeto inteiro**

Run: `npx tsc --noEmit`
Expected: **erros** em `lib/gerar-auditoria.ts` são esperados? Não — `calcularAusencias`/`calcularPresencas` são chamadas lá mas o retorno só é usado indiretamente (serializado via `Papa.unparse` com mapeamento explícito de campos, não spread). Adicionar um campo aos tipos de retorno NÃO deveria quebrar `gerar-auditoria.ts`. Se `tsc` acusar erro ali, leia a mensagem com atenção antes de alterar qualquer coisa fora do escopo deste task — não é esperado.

- [ ] **Step 6: Commit**

```bash
git add lib/pente-fino.ts lib/pente-fino.test.ts
git commit -m "feat: propagar identificador do aluno e indexar respostas por relatorio"
```

---

### Task 3: `lib/relatorio-mes.ts` — agrupamento por mês

**Files:**
- Create: `lib/relatorio-mes.ts`
- Create: `lib/relatorio-mes.test.ts`

Independente do Task 2 — pode ser feito em paralelo, mas segue a ordem do plano.

- [ ] **Step 1: Escrever o teste que falha**

Crie `lib/relatorio-mes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatarMesAno, agruparRelatoriosPorMes } from './relatorio-mes'

describe('formatarMesAno', () => {
  it('formata mês e ano por extenso, capitalizado, fuso América/São Paulo', () => {
    // 2026-07-15T12:00:00Z = 2026-07-15 09:00 em São Paulo (UTC-3) — mesmo dia, mesmo mês
    expect(formatarMesAno(new Date('2026-07-15T12:00:00Z'))).toBe('Julho 2026')
  })

  it('data perto da virada do mês respeita o fuso de São Paulo', () => {
    // 2026-08-01T02:00:00Z = 2026-07-31 23:00 em São Paulo (UTC-3) — ainda julho
    expect(formatarMesAno(new Date('2026-08-01T02:00:00Z'))).toBe('Julho 2026')
  })
})

describe('agruparRelatoriosPorMes', () => {
  it('agrupa relatórios do mesmo mês juntos', () => {
    const relatorios = [
      { nome: 'Relatório 1', createdAt: '2026-07-01T12:00:00Z' },
      { nome: 'Relatório 2', createdAt: '2026-07-15T12:00:00Z' },
    ]
    const grupos = agruparRelatoriosPorMes(relatorios)

    expect(grupos).toHaveLength(1)
    expect(grupos[0].mes).toBe('Julho 2026')
    expect(grupos[0].relatorios).toHaveLength(2)
  })

  it('gera grupos separados em ordem cronológica pra meses diferentes', () => {
    const relatorios = [
      { nome: 'Relatório 1', createdAt: '2026-07-01T12:00:00Z' },
      { nome: 'Relatório 2', createdAt: '2026-08-01T12:00:00Z' },
    ]
    const grupos = agruparRelatoriosPorMes(relatorios)

    expect(grupos.map((g) => g.mes)).toEqual(['Julho 2026', 'Agosto 2026'])
  })

  it('retorna lista vazia para entrada vazia', () => {
    expect(agruparRelatoriosPorMes([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/relatorio-mes.test.ts`
Expected: FAIL com "Failed to resolve import './relatorio-mes'".

- [ ] **Step 3: Implementar `lib/relatorio-mes.ts`**

```ts
export function formatarMesAno(date: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(date)
  const mes = partes.find((p) => p.type === 'month')?.value ?? ''
  const ano = partes.find((p) => p.type === 'year')?.value ?? ''
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ano}`
}

export function agruparRelatoriosPorMes<T extends { createdAt: string }>(
  relatorios: T[]
): { mes: string; relatorios: T[] }[] {
  const grupos = new Map<string, T[]>()
  for (const r of relatorios) {
    const mes = formatarMesAno(new Date(r.createdAt))
    if (!grupos.has(mes)) grupos.set(mes, [])
    grupos.get(mes)!.push(r)
  }
  return [...grupos.entries()].map(([mes, relatorios]) => ({ mes, relatorios }))
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/relatorio-mes.test.ts`
Expected: PASS, 5/5 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/relatorio-mes.ts lib/relatorio-mes.test.ts
git commit -m "feat: agrupamento de relatorios por mes (fuso America/Sao_Paulo)"
```

---

### Task 4: `lib/pdf/RelatorioAlunoPDF.tsx` — componente de PDF

**Files:**
- Create: `lib/pdf/RelatorioAlunoPDF.tsx`

Depende do Task 1 (`@react-pdf/renderer` instalado).

**Importante sobre fonte:** as fontes padrão do PDF (Helvetica) têm suporte incerto pra acentos do português. Pra evitar risco de acentos quebrados/faltando em nomes, perguntas e respostas (conteúdo real do PDF, não cosmético), esse componente registra a fonte Roboto (cobertura completa de acentos latinos, incluindo português) via URL do Google Fonts, verificada e funcionando no momento da escrita deste plano:

```
Regular (400): https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf
Bold (700):    https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf
```

Essas URLs são versionadas pelo Google (o `v51` pode mudar no futuro se o Google atualizar a fonte). Se, ao testar manualmente (Task 8), a geração do PDF falhar com erro de rede/fonte ou os acentos aparecerem quebrados, busque URLs atuais rodando:

```bash
curl -s "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" -A "Mozilla/5.0 (Linux; U; Android 2.2)"
```

(essa combinação de User-Agent faz o Google devolver os links diretos em `.ttf`, formato que o `@react-pdf/renderer` aceita — `woff2`, o formato padrão pra navegadores modernos, não é suportado) e atualize as duas URLs abaixo.

- [ ] **Step 1: Criar o componente**

Crie `lib/pdf/RelatorioAlunoPDF.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { RespostaPergunta } from '@/lib/pente-fino'

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf',
      fontWeight: 'bold',
    },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Roboto' },
  title: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: '#3c3c3c', marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  field: { flexDirection: 'row', marginBottom: 2 },
  fieldLabel: { width: 90, fontWeight: 'bold', color: '#505050' },
  fieldValue: { flex: 1 },
  monthHeader: {
    backgroundColor: '#464646',
    color: '#ffffff',
    padding: 6,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  reportHeader: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, marginTop: 8 },
  question: { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  answer: { fontSize: 9, marginBottom: 6, marginLeft: 8, color: '#3c3c3c' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#969696',
  },
})

export type RelatorioAlunoPDFProps = {
  nome: string
  estado: string
  empresa: string
  meses: {
    mes: string
    relatorios: { nome: string; respostas: RespostaPergunta[] | null }[]
  }[]
}

export function RelatorioAlunoPDF({ nome, estado, empresa, meses }: RelatorioAlunoPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório de Residência</Text>
        <Text style={styles.subtitle}>{nome}</Text>
        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Dados do Aluno</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nome:</Text>
          <Text style={styles.fieldValue}>{nome}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Núcleo:</Text>
          <Text style={styles.fieldValue}>{estado || '-'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Empresa:</Text>
          <Text style={styles.fieldValue}>{empresa || '-'}</Text>
        </View>

        {meses.map((grupo) => (
          <View key={grupo.mes}>
            <Text style={styles.monthHeader}>{grupo.mes.toUpperCase()}</Text>
            {grupo.relatorios.map((rel) => (
              <View key={rel.nome} wrap={false}>
                <Text style={styles.reportHeader}>{rel.nome}</Text>
                {rel.respostas === null ? (
                  <Text style={styles.answer}>Não enviado</Text>
                ) : (
                  rel.respostas.map((r, i) => (
                    <View key={i}>
                      <Text style={styles.question}>
                        {i + 1}. {r.pergunta}
                      </Text>
                      <Text style={styles.answer}>{r.resposta || '-'}</Text>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber }) => `Página ${pageNumber}`}
          fixed
        />
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf/RelatorioAlunoPDF.tsx
git commit -m "feat: componente RelatorioAlunoPDF"
```

---

### Task 5: Rota individual — `app/api/auditorias/[id]/pdf-aluno/[identificador]/route.tsx`

**Files:**
- Create: `app/api/auditorias/[id]/pdf-aluno/[identificador]/route.tsx`

Depende dos Tasks 2, 3 e 4. Nome do arquivo é `route.tsx` (não `route.ts`) porque usa JSX pra renderizar o componente de PDF.

Referência de padrão: `app/api/auditorias/[id]/download/route.ts` (auth via `createClient()`, operações via `createServiceClient()`, resposta via `new NextResponse(buffer, { headers })`).

- [ ] **Step 1: Criar a rota**

Crie `app/api/auditorias/[id]/pdf-aluno/[identificador]/route.tsx`:

```tsx
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
  return texto.replace(/[\\/*?:"<>|]/g, '').trim()
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

  const buffer = await renderToBuffer(
    <RelatorioAlunoPDF
      nome={aluno.nomeCompleto}
      estado={aluno.estado}
      empresa={aluno.empresa}
      meses={meses}
    />
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sanitizarCaminho(aluno.nomeCompleto)}.pdf"`,
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/api/auditorias/[id]/pdf-aluno/[identificador]/route.tsx"
git commit -m "feat: rota de geracao de pdf individual por aluno"
```

---

### Task 6: Rota em lote — `app/api/auditorias/[id]/pdf-todos/route.tsx`

**Files:**
- Create: `app/api/auditorias/[id]/pdf-todos/route.tsx`

Depende dos Tasks 2, 3, 4 e 1 (`jszip`).

- [ ] **Step 1: Criar a rota**

Crie `app/api/auditorias/[id]/pdf-todos/route.tsx`:

```tsx
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import JSZip from 'jszip'
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
  return texto.replace(/[\\/*?:"<>|]/g, '').trim()
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

    const caminho = `${sanitizarCaminho(aluno.estado || 'Sem núcleo')}/${sanitizarCaminho(
      aluno.empresa || 'Sem empresa'
    )}/${sanitizarCaminho(aluno.nomeCompleto)}.pdf`

    zip.file(caminho, buffer)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="relatorios-auditoria-${id}.zip"`,
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/api/auditorias/[id]/pdf-todos/route.tsx"
git commit -m "feat: rota de geracao de pdf em lote (zip) para todos os alunos"
```

---

### Task 7: UI — botões de download em `AuditResultTable.tsx`

**Files:**
- Modify: `components/AuditResultTable.tsx`
- Modify: `app/(protected)/auditorias/[id]/page.tsx`

Depende dos Tasks 5 e 6 (rotas precisam existir pros links funcionarem).

- [ ] **Step 1: Atualizar o tipo `Resultado` em `app/(protected)/auditorias/[id]/page.tsx`**

Localize o tipo `Resultado` no topo do arquivo e adicione `identificador` aos dois sub-tipos:

```ts
type Resultado = {
  nao_feitos: {
    nomeCompleto: string
    estado: string
    empresa: string
    identificador?: string
    relatoriosAusentes: string
    totalAusencias: number
  }[]
  feitos: {
    nomeCompleto: string
    estado: string
    empresa: string
    identificador?: string
    relatoriosFeitos: string
    totalFeitos: number
  }[]
}
```

`identificador` é opcional (`?:`) porque auditorias geradas antes do Task 2 deste plano não têm esse campo no `resultado_json` já persistido no banco.

- [ ] **Step 2: Atualizar os tipos `NaoFeito`/`Feito` em `components/AuditResultTable.tsx`**

Localize e atualize:

```ts
type NaoFeito = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador?: string
  relatoriosAusentes: string
  totalAusencias: number
}

type Feito = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador?: string
  relatoriosFeitos: string
  totalFeitos: number
}
```

- [ ] **Step 3: Adicionar import do `DropdownMenu` e ícones**

Localize os imports no topo do arquivo. Adicione:

```ts
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

E adicione `FileDown`, `ChevronDown` à lista de ícones já importada de `lucide-react`:

```ts
import {
  Download,
  Users,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileDown,
  ChevronDown,
} from 'lucide-react'
```

- [ ] **Step 4: Trocar o botão "Baixar CSV" do topo por um dropdown**

Localize:

```tsx
        <a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Baixar CSV
          </Button>
        </a>
```

Substitua por (esse projeto usa Base UI, não Radix — o padrão pra renderizar um elemento customizado dentro de `DropdownMenuTrigger`/`DropdownMenuItem` é a prop `render={<elemento />}`, não `asChild`; veja o mesmo padrão já em uso em `components/UserMenu.tsx:38-47,64-65`):

```tsx
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="gap-1.5" />}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download />}
              className="cursor-pointer"
            >
              Baixar CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/pdf-todos`} download />}
              className="cursor-pointer"
            >
              Baixar todos os PDFs (.zip)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
```

- [ ] **Step 5: Adicionar coluna/botão "Gerar PDF" por linha**

Localize o cabeçalho da tabela (dentro de `<TableRow className="bg-muted/50...">`), logo após a última `<TableHead>` (a coluna "Total"):

```tsx
              <TableHead className="py-3 w-20">
                <button
                  onClick={() => handleSort('total')}
                  className="flex items-center gap-1 ml-auto text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Total
                  <SortIcon col="total" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
            </TableRow>
```

Adicione uma nova `<TableHead>` vazia (sem ordenação, só pro botão) antes do `</TableRow>`:

```tsx
              <TableHead className="py-3 w-10" />
            </TableRow>
```

Localize o `<TableCell>` da coluna "Total" dentro do `.map()` de linhas:

```tsx
                    <TableCell className="py-3 text-right">
                      {!zerado && (
                        <Badge
                          className={
                            isNF
                              ? altaSeveridade
                                ? 'bg-destructive text-destructive-foreground font-semibold'
                                : 'bg-destructive/80 text-destructive-foreground'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }
                          variant={isNF ? 'destructive' : 'outline'}
                        >
                          {count}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
```

Adicione uma nova `<TableCell>` logo depois, antes do `</TableRow>`:

```tsx
                    <TableCell className="py-3 text-right">
                      {row.identificador && (
                        <a href={`/api/auditorias/${auditId}/pdf-aluno/${row.identificador}`} download>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Gerar PDF de ${row.nomeCompleto}`}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
```

- [ ] **Step 6: Atualizar o `colSpan` da linha de "nenhum resultado"**

Localize:

```tsx
            {dados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para os filtros aplicados.
                </TableCell>
              </TableRow>
```

A tabela ganhou uma coluna nova (de 5 pra 6). Troque `colSpan={5}` por `colSpan={6}`.

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Rodar os testes**

Run: `npm test`
Expected: todos passando (nenhum teste cobre esses dois arquivos diretamente).

- [ ] **Step 9: Commit**

```bash
git add "app/(protected)/auditorias/[id]/page.tsx" components/AuditResultTable.tsx
git commit -m "feat: botoes de gerar pdf individual e em lote na tela de auditoria"
```

---

### Task 8: Verificação manual

**Files:** nenhum (só verificação)

- [ ] **Step 1: Rodar o dev server**

Run: `npm run dev`

- [ ] **Step 2: Gerar uma auditoria nova**

As auditorias existentes no banco foram geradas antes deste plano — o `resultado_json` delas não tem `identificador`, então os botões de PDF não vão aparecer nelas. Vá em `/relatorios` e gere uma auditoria manual (botão já existente na tela) pra ter uma auditoria com o campo novo.

- [ ] **Step 3: Roteiro de verificação manual**

1. Abrir a auditoria recém-gerada em `/auditorias/{id}`.
2. Confirmar que cada linha da tabela tem um botão de "Gerar PDF" (ícone), e que clicar baixa um PDF.
3. Abrir o PDF baixado e conferir: nome/núcleo/empresa corretos, um bloco por mês (cabeçalho cinza), relatórios dentro do mês certo, perguntas/respostas legíveis, **acentos em português renderizando corretamente** (ex: "não", "período", "responsável" — se aparecerem quebrados ou como caixas, ver a nota sobre fonte no Task 4 e atualizar as URLs da fonte Roboto).
4. Testar um aluno que não enviou algum relatório específico — conferir que aparece "Não enviado" no bloco daquele relatório, não uma lista vazia de perguntas.
5. No topo da tela, clicar no botão "Baixar" — confirmar que abre um menu com "Baixar CSV" e "Baixar todos os PDFs (.zip)".
6. Clicar em "Baixar todos os PDFs (.zip)" — aguardar o download (pode demorar alguns segundos dependendo da quantidade de alunos) e abrir o zip. Conferir a estrutura de pastas `<Estado>/<Empresa>/<Nome>.pdf` e que os PDFs de alguns alunos aleatórios abrem corretamente.
7. Abrir uma auditoria **antiga** (gerada antes deste plano) e confirmar que os botões de "Gerar PDF" por linha **não aparecem** (sem `identificador` no resultado) — mas o botão "Baixar" do topo continua funcionando normalmente pro CSV (o "Baixar todos os PDFs" nesse caso vai gerar um zip vazio, já que nenhum aluno tem identificador — comportamento aceito, documentado no spec).

- [ ] **Step 4: Registrar resultado**

Nenhum commit de código neste task — é só validação. Se algo falhar (em especial a renderização de acentos no PDF), abrir um fix conforme o problema encontrado antes de finalizar a branch.
