# Paginação nas telas de auditoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar paginação de verdade às duas telas de auditoria: paginação server-side com números de página na lista de execuções (`/auditorias`), e números de página (em vez de só anterior/próximo) na tabela de detalhe de uma auditoria (`AuditResultTable`).

**Architecture:** Instala o componente `Pagination` do shadcn (presentational, `base-nova`/Base UI). Extrai a lógica de "quais números mostrar" para um helper puro testável (`lib/pagination.ts`), reaproveitado nos dois lugares. A lista de execuções passa a paginar no servidor seguindo o padrão de duas consultas (count-only depois range) já usado em `/configuracoes/logs`. A tabela de detalhe mantém sua paginação client-side existente — só troca os controles visuais.

**Tech Stack:** Next.js 16 App Router (Server Components + `searchParams` como `Promise`), React 19, TypeScript, Supabase (`@supabase/ssr`), shadcn/ui `Pagination`, Vitest.

Spec de referência: `docs/superpowers/specs/2026-07-09-paginacao-auditorias-design.md`

---

## File Structure

- **Create** `components/ui/pagination.tsx` — via `npx shadcn@latest add pagination` (registry, não editado à mão).
- **Create** `lib/pagination.ts` — helper puro `paginasVisiveis(paginaAtual, totalPaginas)`.
- **Create** `lib/pagination.test.ts` — testes do helper acima.
- **Modify** `app/(protected)/auditorias/page.tsx` — paginação server-side (`PER_PAGE = 15`, padrão de duas consultas).
- **Modify** `components/AuditoriasList.tsx` — recebe `totalCount`/`offset`/`currentPage`/`totalPages`, corrige numeração "Auditoria #N", renderiza os controles de paginação.
- **Modify** `components/AuditResultTable.tsx` — troca só o bloco de controles de paginação (linhas ~34-35 do import e ~466-490 do JSX) pelos números de página via `Pagination`/`paginasVisiveis`.

---

### Task 1: Instalar o componente `Pagination` do shadcn

**Files:**
- Create: `components/ui/pagination.tsx` (gerado pela CLI)
- Modify: `components.json` (a CLI atualiza a lista `components` automaticamente)

- [ ] **Step 1: Instalar via CLI**

Run: `npx shadcn@latest add pagination`

Expected: cria `components/ui/pagination.tsx`; a dependência de registry `button` já está instalada, não deve pedir para reinstalar nada.

- [ ] **Step 2: Ler o arquivo gerado e confirmar a API**

Abra `components/ui/pagination.tsx` e confirme que ele exporta `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`, e que `PaginationLink` aceita `href`, `onClick` e `isActive` (renderiza um `Button` como `<a>` via `render` do Base UI). Se a API vier diferente do esperado, pare e ajuste os Tasks 4 e 5 antes de prosseguir — não adapte o componente gerado à mão.

- [ ] **Step 3: Commit**

```bash
git add components/ui/pagination.tsx components.json
git commit -m "chore: adicionar componente Pagination do shadcn"
```

---

### Task 2: Helper `lib/pagination.ts` (TDD)

**Files:**
- Create: `lib/pagination.ts`
- Test: `lib/pagination.test.ts`

- [ ] **Step 1: Escrever os testes (arquivo novo)**

```ts
import { describe, it, expect } from 'vitest'
import { paginasVisiveis } from './pagination'

describe('paginasVisiveis', () => {
  it('retorna só a página 1 quando há apenas 1 página', () => {
    expect(paginasVisiveis(1, 1)).toEqual([1])
  })

  it('sem reticências quando há poucas páginas', () => {
    expect(paginasVisiveis(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('reticências dos dois lados quando a página atual está no meio', () => {
    expect(paginasVisiveis(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20])
  })

  it('reticências só à direita quando a página atual está no início', () => {
    expect(paginasVisiveis(1, 20)).toEqual([1, 2, 'ellipsis', 20])
  })

  it('reticências só à esquerda quando a página atual está no fim', () => {
    expect(paginasVisiveis(20, 20)).toEqual([1, 'ellipsis', 19, 20])
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run lib/pagination.test.ts`
Expected: FAIL — `Cannot find module './pagination'` (ou equivalente, arquivo ainda não existe).

- [ ] **Step 3: Implementar o helper**

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

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run lib/pagination.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/pagination.ts lib/pagination.test.ts
git commit -m "feat: adicionar helper paginasVisiveis"
```

---

### Task 3: Paginação server-side em `app/(protected)/auditorias/page.tsx`

**Files:**
- Modify: `app/(protected)/auditorias/page.tsx` (arquivo inteiro, 43 linhas hoje)

- [ ] **Step 1: Reescrever o arquivo com paginação server-side**

Conteúdo completo do arquivo (substitui o atual por inteiro):

```tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AuditoriasList } from '@/components/AuditoriasList'
import { BarChart3 } from 'lucide-react'

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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Auditorias</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Histórico de todas as auditorias geradas
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Histórico
          </CardTitle>
          <CardDescription>
            {count ?? 0} auditoria(s) gerada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditoriasList
            auditorias={auditorias ?? []}
            totalCount={count ?? 0}
            offset={from}
            currentPage={safePage}
            totalPages={totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

Nota: `AuditoriasList` ainda não aceita essas props novas — isso é esperado, o Task 4 corrige. O build/lint só vai passar limpo depois do Task 4.

- [ ] **Step 2: Commit**

```bash
git add "app/(protected)/auditorias/page.tsx"
git commit -m "feat: paginar lista de auditorias no servidor"
```

---

### Task 4: `AuditoriasList` — numeração correta + controles de paginação

**Files:**
- Modify: `components/AuditoriasList.tsx` (arquivo inteiro, 77 linhas hoje)

- [ ] **Step 1: Reescrever o arquivo**

Conteúdo completo do arquivo (substitui o atual por inteiro):

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { TRIGGER_INFO } from '@/lib/trigger-info'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { paginasVisiveis } from '@/lib/pagination'

type Auditoria = {
  id: string
  created_at: string
  trigger_type: 'add' | 'delete' | 'manual'
  relatorios_incluidos: string[]
}

type Props = {
  auditorias: Auditoria[]
  totalCount: number
  offset: number
  currentPage: number
  totalPages: number
}

export function AuditoriasList({
  auditorias,
  totalCount,
  offset,
  currentPage,
  totalPages,
}: Props) {
  if (!auditorias.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <ClipboardList className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">Nenhuma auditoria ainda</p>
        <p className="text-muted-foreground text-xs mt-1">
          Adicione relatórios em{' '}
          <Link href="/relatorios" className="text-primary underline-offset-2 hover:underline">
            Relatórios
          </Link>{' '}
          para gerar a primeira auditoria.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {auditorias.map((a, idx) => {
          const info = TRIGGER_INFO[a.trigger_type]
          const Icon = info.icon
          return (
            <li key={a.id}>
              <Link
                href={`/auditorias/${a.id}`}
                className="group flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${info.iconClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div>
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      Auditoria #{totalCount - (offset + idx)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}{' '}
                      ·{' '}
                      {a.relatorios_incluidos.length} relatório(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs border ${info.badgeClass}`}>
                    {info.label}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={`/auditorias?page=${currentPage - 1}`}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {paginasVisiveis(currentPage, totalPages).map((item, i) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`e${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href={`/auditorias?page=${item}`}
                    isActive={item === currentPage}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href={`/auditorias?page=${currentPage + 1}`}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
```

Nota: mesmo com `href` apontando para `currentPage - 1` (que pode ser `0`) ou `currentPage + 1` (que pode ser `totalPages + 1`) nos extremos, o link fica visualmente desabilitado (`pointer-events-none opacity-50`) — mesmo padrão de "desabilitado sem remover o Link" já usado em `/configuracoes/logs`. Página 1 e a página `page.tsx` já clampam qualquer `page` fora do intervalo real, então mesmo um clique acidental é inofensivo.

- [ ] **Step 2: Rodar lint e build para confirmar que os dois arquivos (Task 3 + Task 4) se encaixam**

Run: `npx eslint app/\(protected\)/auditorias/page.tsx components/AuditoriasList.tsx`
Expected: sem erros.

Run: `npm run build`
Expected: build passa sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add components/AuditoriasList.tsx
git commit -m "feat: numeracao correta e controles de paginacao em AuditoriasList"
```

---

### Task 5: Números de página em `AuditResultTable`

**Files:**
- Modify: `components/AuditResultTable.tsx:16-40` (imports) e `components/AuditResultTable.tsx:449-491` (bloco de paginação)

Nada mais no componente muda — filtros, ordenação, `PER_PAGE = 20` e o slicing client-side (linhas 160-164) continuam iguais.

- [ ] **Step 1: Atualizar os imports**

Em `components/AuditResultTable.tsx`, troque o bloco de imports do `lucide-react` (linhas 29-40 atuais) e adicione os imports do `Pagination`/`paginasVisiveis` logo depois do import de `audit-result-table-utils` (linha 28 atual). O resultado deve ficar assim (bloco de imports 16-40 por inteiro):

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { paginasVisiveis } from '@/lib/pagination'
import { derivarUfsDisponiveis } from './audit-result-table-utils'
import {
  Download,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
```

`ChevronLeft`/`ChevronRight` saem da lista — só eram usados no bloco de controles que este task substitui (confirme com uma busca no arquivo antes de remover: não há nenhum outro uso deles fora desse bloco).

- [ ] **Step 2: Substituir o bloco de controles de paginação**

Localize o bloco atual (dentro da `<div className="flex items-center justify-between">` de paginação, por volta da linha 466-490):

```tsx
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
```

Substitua por:

```tsx
        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault()
                    setPage((p) => Math.max(1, p - 1))
                  }}
                  className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {paginasVisiveis(safePage, totalPages).map((item, i) =>
                item === 'ellipsis' ? (
                  <PaginationItem key={`e${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      isActive={item === safePage}
                      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.preventDefault()
                        setPage(item)
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault()
                    setPage((p) => Math.min(totalPages, p + 1))
                  }}
                  className={safePage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
```

O texto "Mostrando X–Y de Z alunos" à esquerda (linhas 450-464 atuais) não muda.

- [ ] **Step 3: Rodar lint e build**

Run: `npx eslint components/AuditResultTable.tsx`
Expected: sem erros (confirma que `ChevronLeft`/`ChevronRight` não ficaram como import não usado, e que não sobrou nenhum outro uso deles).

Run: `npm run build`
Expected: build passa sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add components/AuditResultTable.tsx
git commit -m "feat: numeros de pagina no detalhe da auditoria"
```

---

### Task 6: Verificação manual e fechamento

**Files:** nenhum (só verificação; sem alterações de código esperadas nesta task)

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm run test`
Expected: todos os testes passam, incluindo os 5 novos de `lib/pagination.test.ts`.

- [ ] **Step 2: Rodar lint e build do projeto inteiro**

Run: `npm run lint`
Expected: sem erros.

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Testar `/auditorias` manualmente**

Run: `npm run dev`, logar como admin, abrir `/auditorias`.

Checklist:
- Se houver mais de 15 auditorias: a primeira página mostra "Auditoria #N" com N decrescente a partir do total (a mais recente tem o maior número); os controles de paginação aparecem embaixo da lista.
- Navegar para a página 2 via clique no número "2": a numeração continua decrescendo corretamente (não reinicia do total).
- Digitar `/auditorias?page=9999` na URL: não quebra, cai na última página real (clamp).
- Digitar `/auditorias?page=0` ou `/auditorias?page=-1`: cai na página 1 (sanitização).
- Se houver 15 ou menos auditorias no total: nenhum controle de paginação aparece (só a lista).

- [ ] **Step 4: Testar o detalhe de uma auditoria manualmente**

Abrir uma auditoria com mais de 20 alunos numa das listas (Não feitos ou Feitos).

Checklist:
- Os controles de paginação mostram números de página (não só setas), com reticências quando há muitas páginas.
- Clicar num número de página troca a página exibida sem navegar/recarregar (continua client-side).
- Trocar de aba (Não feitos ↔ Feitos), aplicar um filtro, ou reordenar uma coluna: a paginação volta pra página 1 (comportamento já existente, não deve ter regressão).
- Botões anterior/próximo continuam funcionando e ficam desabilitados (visualmente, sem clique) nos extremos.

- [ ] **Step 5: Se tudo passou, seguir para push + PR**

Use a skill `finishing-a-development-branch` (branch base: `develop`) para dar push e abrir o PR. Nenhum commit é esperado nesta task a menos que a verificação manual encontre um problema — nesse caso, corrija, repita os passos 1-4, e só então prossiga.

---

## Fora de escopo (herdado da spec)

- Migrar `AuditResultTable` para paginação server-side — dados já vêm inteiros via `resultado_json`.
- `requireAdmin()`/guard compartilhado — não faz parte desta issue.
