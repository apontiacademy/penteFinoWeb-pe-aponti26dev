# Exportar resultado da auditoria em XLSX

## Contexto

Issue [#76](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/76): hoje o resultado de uma auditoria (abas "feitos"/"não feitos") só pode ser exportado em CSV. O CSV é gerado em `lib/gerar-auditoria.ts` via `Papa.unparse`, persistido no Storage (`auditorias/<id>/resultado-nao-feitos.csv` e `resultado-feitos.csv`) e servido por `app/api/auditorias/[id]/download/route.ts`, acionado pelo dropdown "Baixar" em `components/AuditResultTable.tsx`. O time da Aponti trabalha majoritariamente com `.xlsx`, então o CSV atual exige conversão manual.

## Objetivo

Adicionar um terceiro item no dropdown "Baixar" ("Baixar XLSX") que gera um único arquivo `.xlsx` com duas abas ("Não feitos" e "Feitos"), mantendo o CSV existente inalterado (por modo, como hoje).

## Decisões

- **Biblioteca**: `exceljs`, não `xlsx`/SheetJS. O pacote `xlsx` no npm está sem manutenção e tem uma vulnerabilidade de severidade alta sem correção disponível via npm ([CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9), ReDoS) — o próprio mantenedor recomenda usar o CDN deles em vez do npm. `exceljs` está ativo (v4.4.0), sem vulnerabilidades conhecidas em versões atuais (o único advisory histórico é de 2018, corrigido na v1.6.0).
- **Estrutura**: um arquivo `.xlsx` com duas abas, não um arquivo por modo — reflete melhor o uso real da planilha no Excel.
- **Quando gerar**: sob demanda, na rota de download, reaproveitando `resultado_json` (já persistido na tabela `auditorias`, mesmo dado usado pela tabela de resultado e pelos PDFs). Não muda `gerarAuditoria.ts` nem o Storage — sem custo extra pra auditorias que nunca baixam XLSX.
- **Acentuação**: XLSX (OOXML) trata Unicode nativamente — diferente do PDF (`@react-pdf/renderer`), não precisa registrar fontes nem tratar acentos manualmente.

## Arquitetura

### `lib/gerar-xlsx.ts` (novo)

Função pura (dado os arrays já calculados, sem I/O) que monta o workbook:

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

`addRows` aceita os objetos diretamente porque cada `column.key` bate com o nome do campo em `ResultadoAusencia`/`ResultadoPresenca` (`nomeCompleto`, `estado`, `empresa`, `relatoriosAusentes`/`relatoriosFeitos`, `totalAusencias`/`totalFeitos`) — colunas extras nesses tipos (como `identificador`, adicionado na feature de PDF) são ignoradas automaticamente por não terem `column` correspondente, sem precisar de `.map()` para descartar campos.

Colunas e cabeçalhos espelham exatamente o que `Papa.unparse` já produz hoje em `gerarAuditoria.ts` — sem adicionar dado novo.

### `app/api/auditorias/[id]/download/route.ts` (modificar)

Novo parâmetro `formato` (`'csv' | 'xlsx'`, default `'csv'` — mantém compatibilidade com links existentes que só passam `modo`):

- Se `formato === 'xlsx'`: ignora `modo` (não obrigatório nesse caso), busca `resultado_json` da auditoria (não os paths de Storage do CSV), gera o buffer via `gerarXlsxAuditoria`, responde com `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e `Content-Disposition: attachment; filename="resultado-auditoria.xlsx"`.
- Se `formato` ausente ou `'csv'`: comportamento atual inalterado (exige `modo`, serve o CSV persistido no Storage).

```ts
// dentro do GET, após validar `id`:
const formato = request.nextUrl.searchParams.get('formato') ?? 'csv'

if (formato === 'xlsx') {
  const { data: auditoria } = await service
    .from('auditorias')
    .select('resultado_json')
    .eq('id', id)
    .single()

  const resultado = auditoria?.resultado_json as
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

// resto da função: comportamento CSV atual, inalterado
```

Nota de implementação: `workbook.xlsx.writeBuffer()` retorna o tipo `ExcelJS.Buffer` (declarado como `ArrayBuffer` nos tipos do pacote, não o `Buffer` do Node) — ao contrário do que aconteceu com `@react-pdf/renderer`'s `renderToBuffer` (que retorna `Buffer` do Node e exigiu `new Uint8Array(buffer)` pra satisfazer o tipo `BodyInit`), este provavelmente não precisa do mesmo wrap. Confirmar com `npx tsc --noEmit` durante a implementação; se der erro de tipo, aplicar o mesmo wrap `new Uint8Array(buffer)`.

### `components/AuditResultTable.tsx` (modificar)

Terceiro item no dropdown "Baixar", mesmo padrão simples do CSV (link direto, sem loading/spinner — ler `resultado_json` e montar duas abas é uma operação rápida, sem o custo de renderização do PDF):

```tsx
<DropdownMenuItem
  render={<a href={`/api/auditorias/${auditId}/download?formato=xlsx`} download />}
  className="cursor-pointer"
>
  Baixar XLSX
</DropdownMenuItem>
```

Adicionado como terceiro item, após "Baixar CSV" e antes/depois de "Baixar todos os PDFs (.zip)" (ordem exata a definir na implementação, sem impacto funcional).

## Fluxo de dados (resumo)

```
GET /api/auditorias/[id]/download?formato=xlsx
        │
        ▼
busca auditoria.resultado_json (mesmo dado da tabela/PDFs)
        │
        ▼
gerarXlsxAuditoria(resultado.nao_feitos, resultado.feitos)
  → workbook com 2 abas, cabeçalho em negrito
        │
        ▼
workbook.xlsx.writeBuffer()
        │
        ▼
NextResponse (Content-Type xlsx, Content-Disposition attachment)
```

## Tratamento de erros

- Auditoria não encontrada: 404 (`select().single()` retorna `null`, mesmo padrão já usado no restante da rota).
- `resultado_json` ausente/null (auditoria sem planilha geral processada): 404 "Resultado não disponível" — mesma mensagem/situação já usada em outros pontos da tela de auditoria.
- `formato` com valor diferente de `csv`/`xlsx`: tratado como `csv` (fallback ao comportamento atual, sem erro) — evita quebrar links existentes por engano de digitação no parâmetro.
- Auditoria sem alunos (`nao_feitos`/`feitos` vazios): gera XLSX válido com as duas abas vazias (só cabeçalho) — sem tela de erro, mesmo tratamento já usado na geração em lote de PDFs pra esse caso.

## Testes

`gerarXlsxAuditoria` é testável com Vitest: gera o buffer, lê de volta com `ExcelJS.Workbook().xlsx.load(buffer)` (round-trip) e confere nome das abas, cabeçalhos e valores das células. Casos: dados básicos nas duas abas, cabeçalho em negrito, arrays vazios geram abas válidas só com cabeçalho, colunas extras no objeto de entrada (`identificador`) não vazam pro XLSX.

A rota (`route.ts`) não ganha teste automatizado — mesma situação já aceita pras outras rotas deste projeto que dependem de Supabase real. Verificação manual (baixar um XLSX de uma auditoria real e abrir no Excel) fica no plano de implementação.

## Fora de escopo

- Não altera a exportação em CSV existente (formato, colunas, Storage).
- Não adiciona `identificador` nem nenhuma coluna nova ao XLSX — mesmos dados do CSV atual.
- Não persiste o XLSX gerado no Storage.
- Não adiciona estilos além do cabeçalho em negrito (sem cores, bordas, formatação condicional).
- Não restringe a admins — mesmo nível de permissão do CSV/PDF hoje (qualquer usuário autenticado).
