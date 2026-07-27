# Indicador de loading ao navegar entre páginas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um spinner contextual, acessível, ao lado de cada link de navegação client-side do app, que aparece enquanto a navegação está pendente e some quando ela conclui.

**Architecture:** Um único client component (`LinkPendingIndicator`) usa o hook `useLinkStatus` do `next/link` para saber se o `<Link>` ancestral está pendente, e é inserido como filho de todo `<Link>` de navegação do app (11 arquivos).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, `lucide-react`, `@base-ui/react` (Dropdown/Button `render` prop).

Spec de referência: `docs/superpowers/specs/2026-07-27-indicador-loading-navegacao-design.md`

---

### Task 1: `components/LinkPendingIndicator.tsx` — componente

**Files:**
- Create: `components/LinkPendingIndicator.tsx`

Sem teste automatizado (ver seção "Testes" da spec — o componente depende inteiramente de `useLinkStatus`, hook ligado ao router real do Next, mesma situação já aceita para `ScrollToTopButton`).

- [ ] **Step 1: Criar o componente**

Crie `components/LinkPendingIndicator.tsx`:

```tsx
'use client'

import { useLinkStatus } from 'next/link'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function LinkPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span className="inline-flex">
      <Spinner
        aria-hidden="true"
        role={undefined}
        className={cn('size-3.5 ml-1.5 transition-opacity', pending ? 'opacity-100' : 'opacity-0')}
      />
      <span role="status" className="sr-only">
        {pending ? 'Carregando página…' : ''}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `LinkPendingIndicator.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/LinkPendingIndicator.tsx
git commit -m "feat: componente LinkPendingIndicator"
```

---

### Task 2: `components/NavLinks.tsx`

**Files:**
- Modify: `components/NavLinks.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

No topo de `components/NavLinks.tsx`, junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador**

Troque:

```tsx
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
```

por:

```tsx
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <LinkPendingIndicator />
          </Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add components/NavLinks.tsx
git commit -m "feat: indicador de loading nos links de navegacao principal"
```

---

### Task 3: `components/UserMenu.tsx`

**Files:**
- Modify: `components/UserMenu.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

No topo de `components/UserMenu.tsx`, junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador nos dois itens do menu**

Troque:

```tsx
          <DropdownMenuItem
            render={<Link href="/perfil" />}
            className="gap-2 cursor-pointer"
          >
            <User className="w-4 h-4" />
            Minha conta
          </DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem
              render={<Link href="/configuracoes" />}
              className="gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Configurações
            </DropdownMenuItem>
          )}
```

por:

```tsx
          <DropdownMenuItem
            render={<Link href="/perfil" />}
            className="gap-2 cursor-pointer"
          >
            <User className="w-4 h-4" />
            Minha conta
            <LinkPendingIndicator />
          </DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem
              render={<Link href="/configuracoes" />}
              className="gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Configurações
              <LinkPendingIndicator />
            </DropdownMenuItem>
          )}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add components/UserMenu.tsx
git commit -m "feat: indicador de loading no menu do usuario"
```

---

### Task 4: `app/(protected)/layout.tsx`

**Files:**
- Modify: `app/(protected)/layout.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports de `components/`:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador no link do logo**

Troque:

```tsx
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <Logomark className="w-6 h-6 text-primary shrink-0" />
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-[oklch(0.710_0.191_294)] bg-clip-text text-transparent">
                Aponti
              </span>
              <span className="text-border text-sm select-none">/</span>
              <span className="text-muted-foreground text-sm font-normal hidden sm:inline">
                pente fino
              </span>
            </Link>
```

por:

```tsx
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <Logomark className="w-6 h-6 text-primary shrink-0" />
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-[oklch(0.710_0.191_294)] bg-clip-text text-transparent">
                Aponti
              </span>
              <span className="text-border text-sm select-none">/</span>
              <span className="text-muted-foreground text-sm font-normal hidden sm:inline">
                pente fino
              </span>
              <LinkPendingIndicator />
            </Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/layout.tsx"
git commit -m "feat: indicador de loading no link do logo"
```

---

### Task 5: `app/(protected)/dashboard/page.tsx`

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador**

Troque:

```tsx
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/auditorias/${ultimaAuditoria.id}`} />}
          >
            Ver última auditoria
            <ArrowRight data-icon="inline-end" />
          </Button>
```

por:

```tsx
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/auditorias/${ultimaAuditoria.id}`} />}
          >
            Ver última auditoria
            <ArrowRight data-icon="inline-end" />
            <LinkPendingIndicator />
          </Button>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/dashboard/page.tsx"
git commit -m "feat: indicador de loading no link ver ultima auditoria"
```

---

### Task 6: `components/AuditoriasList.tsx`

**Files:**
- Modify: `components/AuditoriasList.tsx`

Depende do Task 1. Dois pontos de inserção neste arquivo: o link do empty state e o link de cada linha da lista.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador no link do empty state**

Troque:

```tsx
          <Link href="/relatorios" className="text-primary underline-offset-2 hover:underline">
            Relatórios
          </Link>{' '}
```

por:

```tsx
          <Link href="/relatorios" className="text-primary underline-offset-2 hover:underline">
            Relatórios
            <LinkPendingIndicator />
          </Link>{' '}
```

- [ ] **Step 3: Inserir o indicador na linha de cada auditoria**

Troque:

```tsx
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs border ${info.badgeClass}`}>
                    {info.label}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
```

por:

```tsx
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs border ${info.badgeClass}`}>
                    {info.label}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                  <LinkPendingIndicator />
                </div>
              </Link>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add components/AuditoriasList.tsx
git commit -m "feat: indicador de loading na lista de auditorias"
```

---

### Task 7: `app/(protected)/auditorias/[id]/page.tsx`

**Files:**
- Modify: `app/(protected)/auditorias/[id]/page.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador no breadcrumb**

Troque:

```tsx
      <Link href="/auditorias">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Auditorias
        </Button>
      </Link>
```

por:

```tsx
      <Link href="/auditorias">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Auditorias
          <LinkPendingIndicator />
        </Button>
      </Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/auditorias/[id]/page.tsx"
git commit -m "feat: indicador de loading no breadcrumb de auditoria"
```

---

### Task 8: `app/(protected)/configuracoes/page.tsx`

**Files:**
- Modify: `app/(protected)/configuracoes/page.tsx`

Depende do Task 1. Dois cards neste arquivo.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador nos dois cards**

Troque:

```tsx
          <Link href="/configuracoes/usuarios">
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              Gerenciar usuários
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </Link>
```

por:

```tsx
          <Link href="/configuracoes/usuarios">
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              Gerenciar usuários
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <LinkPendingIndicator />
            </Button>
          </Link>
```

E troque:

```tsx
          <Link href="/configuracoes/logs">
            <Button variant="outline" className="gap-2">
              <ScrollText className="w-4 h-4" />
              Ver logs
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </Link>
```

por:

```tsx
          <Link href="/configuracoes/logs">
            <Button variant="outline" className="gap-2">
              <ScrollText className="w-4 h-4" />
              Ver logs
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <LinkPendingIndicator />
            </Button>
          </Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/configuracoes/page.tsx"
git commit -m "feat: indicador de loading nos cards de configuracoes"
```

---

### Task 9: `app/(protected)/configuracoes/usuarios/page.tsx`

**Files:**
- Modify: `app/(protected)/configuracoes/usuarios/page.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador no breadcrumb**

Troque:

```tsx
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
        </Button>
```

por:

```tsx
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
          <LinkPendingIndicator />
        </Button>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/configuracoes/usuarios/page.tsx"
git commit -m "feat: indicador de loading no breadcrumb de usuarios"
```

---

### Task 10: `app/(protected)/configuracoes/logs/page.tsx`

**Files:**
- Modify: `app/(protected)/configuracoes/logs/page.tsx`

Depende do Task 1. Três pontos de inserção: breadcrumb + paginação anterior + paginação próximo.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador no breadcrumb**

Troque:

```tsx
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
        </Button>
      </Link>
```

por:

```tsx
      <Link href="/configuracoes">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Configurações
          <LinkPendingIndicator />
        </Button>
      </Link>
```

- [ ] **Step 3: Inserir o indicador na paginação anterior/próximo**

Troque:

```tsx
                  <Link href={`/configuracoes/logs?page=${safePage - 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
```

por:

```tsx
                  <Link href={`/configuracoes/logs?page=${safePage - 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <LinkPendingIndicator />
                    </Button>
                  </Link>
```

E troque:

```tsx
                  <Link href={`/configuracoes/logs?page=${safePage + 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
```

por:

```tsx
                  <Link href={`/configuracoes/logs?page=${safePage + 1}`}>
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <ChevronRight className="w-3.5 h-3.5" />
                      <LinkPendingIndicator />
                    </Button>
                  </Link>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/configuracoes/logs/page.tsx"
git commit -m "feat: indicador de loading nos logs do sistema"
```

---

### Task 11: `app/(auth)/login/page.tsx`

**Files:**
- Modify: `app/(auth)/login/page.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador**

Troque:

```tsx
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                </Link>
```

por:

```tsx
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                  <LinkPendingIndicator />
                </Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "feat: indicador de loading no link esqueci minha senha"
```

---

### Task 12: `components/EsqueciSenhaForm.tsx`

**Files:**
- Modify: `components/EsqueciSenhaForm.tsx`

Depende do Task 1.

- [ ] **Step 1: Adicionar o import**

Junto aos demais imports:

```tsx
import { LinkPendingIndicator } from '@/components/LinkPendingIndicator'
```

- [ ] **Step 2: Inserir o indicador**

Troque:

```tsx
      <Link
        href="/login"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para o login
      </Link>
```

por:

```tsx
      <Link
        href="/login"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar para o login
        <LinkPendingIndicator />
      </Link>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add components/EsqueciSenhaForm.tsx
git commit -m "feat: indicador de loading no link voltar para o login"
```

---

### Task 13: Build completo e verificação manual

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build passa sem erros novos (inclui checagem de todas as rotas tocadas).

- [ ] **Step 2: Rodar o dev server**

Run: `npm run dev`

- [ ] **Step 3: Roteiro de verificação manual**

Documentar no PR:
1. Abrir `/dashboard` logado, clicar em "Auditorias" no menu superior — confirmar que um spinner pequeno aparece ao lado do texto clicado até a página carregar, depois some.
2. Repetir para "Relatórios" (admin) e para o logo (volta ao dashboard).
3. Abrir o menu do usuário (canto superior direito) e clicar em "Minha conta" — confirmar spinner ao lado do item, navegação para `/perfil`.
4. Em `/auditorias`, clicar em uma linha da lista — confirmar spinner antes de entrar em `/auditorias/[id]`.
5. Na página de detalhe da auditoria, clicar no breadcrumb "Auditorias" para voltar — confirmar spinner.
6. Em `/configuracoes` (usuário admin), clicar nos cards "Gerenciar usuários" e "Ver logs" — confirmar spinner em cada.
7. Em `/configuracoes/logs`, se houver mais de uma página, clicar em anterior/próximo — confirmar spinner nos botões de ícone.
8. Em `/login`, clicar em "Esqueci minha senha" — confirmar spinner; na página seguinte, clicar em "Voltar para o login" — confirmar spinner.
9. Testar em viewport mobile (DevTools responsivo) — mesmo comportamento, sem sobreposição ou quebra de layout.
10. Abrir a árvore de acessibilidade do DevTools (Chrome: aba Accessibility) em um dos links durante o clique e confirmar que o texto "Carregando página…" aparece/desaparece no nó `role="status"`.
11. Confirmar que nenhum link ficou sem o indicador (comparar com a tabela de pontos de montagem da spec).

- [ ] **Step 4: Registrar resultado**

Nenhum commit de código neste task — é só validação. Se algo falhar, abrir um fix conforme o problema encontrado antes de seguir para a finalização da branch.
