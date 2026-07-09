# Design: paginação nas telas de auditoria

Issue: [#32](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/32)

## Contexto

Duas telas, duas situações diferentes:

1. **Lista de execuções** (`app/(protected)/auditorias/page.tsx`, renderizada por
   `components/AuditoriasList.tsx`): busca todas as auditorias de uma vez
   (`.order('created_at', desc)`, sem `.limit()`/`.range()`) — sem paginação
   nenhuma hoje.
2. **Detalhe de uma auditoria** (`components/AuditResultTable.tsx`): já tem
   paginação client-side (`PER_PAGE = 20`, linha 67; fatiamento linhas 160-164;
   controles linhas 466-490), mas os controles são só "anterior/próximo"
   (`ChevronLeft`/`ChevronRight`), sem números de página.

O componente `Pagination` do shadcn (`npx shadcn@latest add pagination`, ainda não
instalado neste projeto) resolve os dois casos: é presentational (`PaginationLink`
renderiza um `Button` como `<a>`, padrão Base UI já usado em `Select`/`Combobox`
neste projeto), sem estado interno — aceita tanto `href` (para os links reais da
lista server-side) quanto `onClick` (para o estado local client-side da tabela de
detalhe).

## 1. Componente `Pagination`

Instalado via `npx shadcn@latest add pagination` (registry dependency: `button`,
já instalado). Exporta `Pagination`, `PaginationContent`, `PaginationItem`,
`PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`.

## 2. Helper compartilhado: janela de páginas visíveis

Ambas as telas precisam da mesma lógica de "quais números mostrar" (ex:
`1 … 4 5 [6] 7 8 … 20`). Extraído para uma função pura testável, reaproveitada
nos dois lugares — mesmo padrão de `audit-result-table-utils.ts`.

`lib/pagination.ts` (novo):

```ts
export type PaginaItem = number | 'ellipsis'

export function paginasVisiveis(paginaAtual: number, totalPaginas: number): PaginaItem[] {
  const delta = 1
  const paginas = new Set<number>([1, totalPaginas])
  for (let p = paginaAtual - delta; p <= paginaAtual + delta; p++) {
    if (p >= 1 && p <= totalPaginas) paginas.add(p)
  }
  const ordenadas = [...paginas].sort((a, b) => a - b)

  const resultado: PaginaItem[] = []
  let anterior: number | null = null
  for (const p of ordenadas) {
    if (anterior !== null && p - anterior > 1) resultado.push('ellipsis')
    resultado.push(p)
    anterior = p
  }
  return resultado
}
```

Testado com Vitest: poucas páginas (sem reticências), muitas páginas com a atual
no meio/início/fim (reticências nos lugares certos), 1 página só.

## 3. Lista de auditorias — paginação server-side

`PER_PAGE = 15` (itens da lista são cards maiores que linhas de tabela, então um
valor menor que os 20 de `AuditResultTable` fica mais equilibrado).

`app/(protected)/auditorias/page.tsx` passa a ler `searchParams.page` (`Promise`,
convenção já usada em `/esqueci-senha` e `/configuracoes/logs`) e paginar via
`.range()`. Segue o padrão de **duas consultas** já usado em
`/configuracoes/logs`: uma consulta `count`-only primeiro para saber o total,
clampar a página (`safePage = Math.min(page, totalPages)`) e só então montar o
`range()` da consulta real — evita o bug (já corrigido em `/configuracoes/logs`)
de a página exibida e os dados retornados dessincronizarem quando `page` vem
além do total real.

```ts
const PER_PAGE = 15

export default async function AuditoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const parsedPage = Math.floor(Number(pageParam))
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const supabase = await createClient()

  const { count } = await supabase
    .from('auditorias')
    .select('*', { count: 'exact', head: true })

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const { data: auditorias } = await supabase
    .from('auditorias')
    .select('id, created_at, trigger_type, relatorios_incluidos')
    .order('created_at', { ascending: false })
    .range(from, to)

  // ... renderiza <AuditoriasList auditorias={...} totalCount={count ?? 0} offset={from} />
  // ... renderiza os controles de paginação (safePage, totalPages) abaixo da lista
}
```

### Fix necessário: numeração "Auditoria #N"

`AuditoriasList` hoje numera `auditorias.length - idx` — funciona porque a lista
inteira vem de uma vez (mais antiga = #1, já que a query ordena por
`created_at desc` e o array é percorrido do mais recente ao mais antigo). Com
paginação, cada página só tem uma fatia, então esse cálculo passa a numerar
errado a partir da segunda página.

Fix: `AuditoriasList` passa a receber `totalCount: number` e `offset: number`
(o `from` da página atual) como props, e numera
`totalCount - (offset + idx)` em vez de `auditorias.length - idx`. Os controles
de paginação (`Pagination`/`paginasVisiveis`, com `href={`/auditorias?page=${n}`}`,
exibidos só quando `totalPages > 1`) são renderizados dentro de
`AuditoriasList`, abaixo da `<ul>` existente.

## 4. Detalhe da auditoria — números de página

Só troca os controles de paginação existentes em `AuditResultTable.tsx`
(linhas 466-490) — nada mais no componente muda (filtros, ordenação,
client-side slicing continuam iguais, `PER_PAGE = 20` inalterado).

```tsx
{totalPages > 1 && (
  <Pagination className="mx-0 w-auto justify-end">
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious
          href="#"
          onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }}
          className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
        />
      </PaginationItem>
      {paginasVisiveis(safePage, totalPages).map((item, i) =>
        item === 'ellipsis' ? (
          <PaginationItem key={`e${i}`}><PaginationEllipsis /></PaginationItem>
        ) : (
          <PaginationItem key={item}>
            <PaginationLink
              href="#"
              isActive={item === safePage}
              onClick={(e) => { e.preventDefault(); setPage(item) }}
            >
              {item}
            </PaginationLink>
          </PaginationItem>
        )
      )}
      <PaginationItem>
        <PaginationNext
          href="#"
          onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)) }}
          className={safePage === totalPages ? 'pointer-events-none opacity-50' : ''}
        />
      </PaginationItem>
    </PaginationContent>
  </Pagination>
)}
```

O texto "Mostrando X–Y de Z alunos" à esquerda permanece como está — só o bloco
de controles à direita é trocado.

## Fora de escopo

- Migrar `AuditResultTable` para paginação server-side — os dados já vêm
  inteiros via `resultado_json` da auditoria; a issue já registra isso como
  risco/nota para o futuro caso o volume de alunos cresça muito, não como
  trabalho desta issue.
