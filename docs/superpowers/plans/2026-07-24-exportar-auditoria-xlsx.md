# Exportar resultado da auditoria em XLSX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um terceiro item "Baixar XLSX" ao dropdown de download da tela de auditoria, gerando um único arquivo `.xlsx` com duas abas ("Não feitos" e "Feitos") a partir do `resultado_json` já persistido.

**Architecture:** Nova função pura `gerarXlsxAuditoria` em `lib/gerar-xlsx.ts` (usa `exceljs`), consumida sob demanda por um novo branch `formato=xlsx` em `app/api/auditorias/[id]/download/route.ts` (rota existente, hoje só serve CSV persistido no Storage). UI: novo item no dropdown já existente em `components/AuditResultTable.tsx`.

**Tech Stack:** Next.js 15 (Route Handlers), TypeScript, `exceljs`, Vitest.

---

### Task 1: Instalar dependência

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar `exceljs`**

Run: `npm install exceljs`

- [ ] **Step 2: Confirmar instalação**

Run: `npm view exceljs version` (deve bater com a versão em `package.json` após o install)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adicionar dependencia exceljs"
```

---

### Task 2: `lib/gerar-xlsx.ts` — geração do workbook

**Files:**
- Create: `lib/gerar-xlsx.ts`
- Create: `lib/gerar-xlsx.test.ts`

Depende do Task 1. Independente das Tasks 3 e 4 — pode ser feito em paralelo, mas segue a ordem do plano.

- [ ] **Step 1: Escrever o teste que falha**

Crie `lib/gerar-xlsx.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { gerarXlsxAuditoria } from './gerar-xlsx'
import type { ResultadoAusencia, ResultadoPresenca } from './pente-fino'

const naoFeitosExemplo: ResultadoAusencia[] = [
  {
    nomeCompleto: 'João Silva',
    estado: 'RJ',
    empresa: 'Empresa X',
    identificador: 'A1',
    relatoriosAusentes: 'Relatório 1, Relatório 2',
    totalAusencias: 2,
  },
]

const feitosExemplo: ResultadoPresenca[] = [
  {
    nomeCompleto: 'Maria Souza',
    estado: 'SP',
    empresa: 'Empresa Y',
    identificador: 'A2',
    relatoriosFeitos: 'Relatório 1',
    totalFeitos: 1,
  },
]

async function lerWorkbook(buffer: ExcelJS.Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

describe('gerarXlsxAuditoria', () => {
  it('gera duas abas: Não feitos e Feitos', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    expect(workbook.worksheets.map((w) => w.name)).toEqual(['Não feitos', 'Feitos'])
  })

  it('aba Não feitos tem cabeçalho correto e dados mapeados', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Não feitos')!

    expect(aba.getRow(1).values).toEqual([
      undefined,
      'Nome Completo',
      'Estado',
      'Empresa',
      'Relatórios Ausentes',
      'Total Ausências',
    ])
    expect(aba.getRow(2).values).toEqual([
      undefined,
      'João Silva',
      'RJ',
      'Empresa X',
      'Relatório 1, Relatório 2',
      2,
    ])
  })

  it('aba Feitos tem cabeçalho correto e dados mapeados', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Feitos')!

    expect(aba.getRow(1).values).toEqual([
      undefined,
      'Nome Completo',
      'Estado',
      'Empresa',
      'Relatórios Feitos',
      'Total Feitos',
    ])
    expect(aba.getRow(2).values).toEqual([
      undefined,
      'Maria Souza',
      'SP',
      'Empresa Y',
      'Relatório 1',
      1,
    ])
  })

  it('cabeçalho vem em negrito', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Não feitos')!
    expect(aba.getRow(1).font?.bold).toBe(true)
  })

  it('campo extra sem coluna correspondente (identificador) não aparece no XLSX', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Não feitos')!
    // índice 0 é sempre undefined (ExcelJS é 1-based); 5 colunas definidas = 6 posições
    expect(aba.getRow(1).values).toHaveLength(6)
  })

  it('gera abas válidas (só cabeçalho) quando os arrays estão vazios', async () => {
    const buffer = await gerarXlsxAuditoria([], [])
    const workbook = await lerWorkbook(buffer)
    const abaNF = workbook.getWorksheet('Não feitos')!
    const abaF = workbook.getWorksheet('Feitos')!
    expect(abaNF.rowCount).toBe(1)
    expect(abaF.rowCount).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/gerar-xlsx.test.ts`
Expected: FAIL com "Failed to resolve import './gerar-xlsx'".

- [ ] **Step 3: Implementar `lib/gerar-xlsx.ts`**

```ts
import ExcelJS from 'exceljs'
import type { ResultadoAusencia, ResultadoPresenca } from './pente-fino'

export async function gerarXlsxAuditoria(
  naoFeitos: ResultadoAusencia[],
  feitos: ResultadoPresenca[]
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()

  const abaNaoFeitos = workbook.addWorksheet('Não feitos')
  abaNaoFeitos.columns = [
    { header: 'Nome Completo', key: 'nomeCompleto', width: 30 },
    { header: 'Estado', key: 'estado', width: 10 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Relatórios Ausentes', key: 'relatoriosAusentes', width: 40 },
    { header: 'Total Ausências', key: 'totalAusencias', width: 15 },
  ]
  abaNaoFeitos.addRows(naoFeitos)
  abaNaoFeitos.getRow(1).font = { bold: true }

  const abaFeitos = workbook.addWorksheet('Feitos')
  abaFeitos.columns = [
    { header: 'Nome Completo', key: 'nomeCompleto', width: 30 },
    { header: 'Estado', key: 'estado', width: 10 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Relatórios Feitos', key: 'relatoriosFeitos', width: 40 },
    { header: 'Total Feitos', key: 'totalFeitos', width: 15 },
  ]
  abaFeitos.addRows(feitos)
  abaFeitos.getRow(1).font = { bold: true }

  return workbook.xlsx.writeBuffer()
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/gerar-xlsx.test.ts`
Expected: PASS, 6/6 testes.

Se o teste "cabeçalho vem em negrito" falhar (round-trip de estilo não preservado como esperado), investigue a causa raiz antes de alterar o teste — não é esperado, mas se acontecer, documente o comportamento real encontrado e ajuste a asserção pra refletir o que o ExcelJS realmente retorna após `.load()`, sem remover a cobertura do negrito.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add lib/gerar-xlsx.ts lib/gerar-xlsx.test.ts
git commit -m "feat: gerar workbook xlsx com abas nao-feitos e feitos"
```

---

### Task 3: Rota — suportar `formato=xlsx`

**Files:**
- Modify: `app/api/auditorias/[id]/download/route.ts`

Depende do Task 2.

**Importante:** a validação de `modo` hoje acontece antes de qualquer outra lógica. Para `formato=xlsx`, `modo` não é obrigatório — o branch de xlsx precisa vir ANTES da validação de `modo`, retornando cedo, sem tocar no restante da função (que fica exatamente como está hoje, servindo CSV).

- [ ] **Step 1: Adicionar o branch de xlsx**

Conteúdo atual de `app/api/auditorias/[id]/download/route.ts`:

```ts
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
```

Substitua o corpo inteiro por:

```ts
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

    const buffer = await gerarXlsxAuditoria(resultado.nao_feitos, resultado.feitos)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="resultado-auditoria.xlsx"',
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
```

Note que `createServiceClient()` foi movido pra antes do branch de `formato`, já que os dois caminhos (`xlsx` e `csv`) precisam dele — o resto da lógica de CSV permanece idêntica, só reordenada pra depois do branch de xlsx.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `new NextResponse(buffer, ...)` (onde `buffer` é o retorno de `gerarXlsxAuditoria`, tipo `ExcelJS.Buffer`) der erro de tipo `BodyInit`, envolva em `new Uint8Array(buffer)` — mesmo ajuste já usado em outra rota deste projeto pra um problema idêntico com `@react-pdf/renderer`'s `Buffer`.

- [ ] **Step 3: Rodar os testes**

Run: `npm test`
Expected: todos passando (nenhum teste cobre `route.ts` diretamente — mesma situação já aceita pras outras rotas deste projeto).

- [ ] **Step 4: Commit**

```bash
git add "app/api/auditorias/[id]/download/route.ts"
git commit -m "feat: suportar formato=xlsx na rota de download da auditoria"
```

---

### Task 4: UI — terceiro item no dropdown

**Files:**
- Modify: `components/AuditResultTable.tsx`

Depende do Task 3.

- [ ] **Step 1: Adicionar o item no dropdown**

Localize (dentro do `<DropdownMenuContent align="end">`):

```tsx
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download />}
              className="cursor-pointer"
            >
              Baixar CSV
            </DropdownMenuItem>
            {temIdentificador && (
              <DropdownMenuItem onClick={handleBaixarZip} className="cursor-pointer">
                Baixar todos os PDFs (.zip)
              </DropdownMenuItem>
            )}
```

Adicione o item de XLSX logo após "Baixar CSV" (antes do zip):

```tsx
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download />}
              className="cursor-pointer"
            >
              Baixar CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/download?formato=xlsx`} download />}
              className="cursor-pointer"
            >
              Baixar XLSX
            </DropdownMenuItem>
            {temIdentificador && (
              <DropdownMenuItem onClick={handleBaixarZip} className="cursor-pointer">
                Baixar todos os PDFs (.zip)
              </DropdownMenuItem>
            )}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar os testes**

Run: `npm test`
Expected: todos passando.

- [ ] **Step 4: Commit**

```bash
git add components/AuditResultTable.tsx
git commit -m "feat: adicionar opcao de baixar xlsx no dropdown de download"
```

---

### Task 5: Verificação manual

Sem código — checklist pro usuário validar na tela real (`/auditorias/[id]`):

- [ ] Abrir uma auditoria com resultado (`resultado_json` presente).
- [ ] Clicar em "Baixar" → confirmar que aparecem 3 opções: "Baixar CSV", "Baixar XLSX", e (se a auditoria tiver `identificador`) "Baixar todos os PDFs (.zip)".
- [ ] Clicar em "Baixar XLSX" e abrir o arquivo no Excel (ou Google Sheets/LibreOffice):
  - Duas abas: "Não feitos" e "Feitos".
  - Cabeçalho em negrito.
  - Dados batendo com o que aparece na tabela da tela.
  - Acentuação/caracteres especiais (nomes, "Não feitos") corretos, sem mojibake.
- [ ] Baixar o CSV normalmente depois — confirmar que continua funcionando exatamente como antes (regressão).
- [ ] Testar em uma auditoria sem alunos (se existir) ou confirmar visualmente que o XLSX não quebra com abas vazias.

---
