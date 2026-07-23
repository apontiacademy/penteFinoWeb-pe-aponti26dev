# Botão flutuante "voltar ao topo" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão flutuante "voltar ao topo" em todas as páginas protegidas, aparecendo após rolar a página, com scroll suave ao clicar.

**Architecture:** Uma função pura (`deveExibirBotaoTopo`) decide a visibilidade a partir do `scrollY`; um client component (`ScrollToTopButton`) usa essa função num listener de `scroll` em `window` e é montado uma única vez em `app/(protected)/layout.tsx`, reaproveitando o `<Button>` do design system.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, `lucide-react`, Vitest.

Spec de referência: `docs/superpowers/specs/2026-07-23-botao-voltar-ao-topo-design.md`

---

### Task 1: `lib/scroll.ts` — regra de visibilidade

**Files:**
- Create: `lib/scroll.ts`
- Test: `lib/scroll.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `lib/scroll.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deveExibirBotaoTopo } from './scroll'

describe('deveExibirBotaoTopo', () => {
  it('não exibe quando o scroll está abaixo do limiar', () => {
    expect(deveExibirBotaoTopo(100, 500)).toBe(false)
  })

  it('não exibe quando o scroll está exatamente no limiar', () => {
    expect(deveExibirBotaoTopo(500, 500)).toBe(false)
  })

  it('exibe quando o scroll ultrapassa o limiar', () => {
    expect(deveExibirBotaoTopo(600, 500)).toBe(true)
  })

  it('não exibe no topo da página (scroll zero)', () => {
    expect(deveExibirBotaoTopo(0, 500)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/scroll.test.ts`
Expected: FAIL com algo como "Failed to resolve import './scroll'" ou "deveExibirBotaoTopo is not a function".

- [ ] **Step 3: Implementar `lib/scroll.ts`**

```ts
export function deveExibirBotaoTopo(scrollY: number, limiar: number): boolean {
  return scrollY > limiar
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/scroll.test.ts`
Expected: PASS, 4/4 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/scroll.ts lib/scroll.test.ts
git commit -m "feat: regra pura de visibilidade do botao voltar ao topo"
```

---

### Task 2: `components/ScrollToTopButton.tsx`

**Files:**
- Create: `components/ScrollToTopButton.tsx`

Depende do Task 1 (`lib/scroll.ts`) já existir.

Referências de convenção no projeto: `components/ui/button.tsx` (props `variant`/`size`, `size="icon-lg"` = `size-9`), `lib/utils.ts` (export `cn`), ícones de `lucide-react` já usados em outros componentes (ex. `components/UsuariosList.tsx`).

- [ ] **Step 1: Criar o componente**

Crie `components/ScrollToTopButton.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deveExibirBotaoTopo } from '@/lib/scroll'
import { cn } from '@/lib/utils'

export function ScrollToTopButton() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setVisivel(deveExibirBotaoTopo(window.scrollY, window.innerHeight))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function handleClick() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Button
      type="button"
      variant="default"
      size="icon-lg"
      aria-label="Voltar ao topo"
      onClick={handleClick}
      className={cn(
        'fixed bottom-6 left-6 z-40 rounded-full shadow-lg transition-opacity',
        visivel ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <ArrowUp />
    </Button>
  )
}
```

Nota: o limiar é lido via `window.innerHeight` diretamente dentro do handler de scroll, a cada evento — em vez de calculado uma vez e guardado numa constante de módulo, o que (a) quebraria em SSR (`window` não existe no servidor) e (b) ficaria desatualizado se a janela fosse redimensionada antes do primeiro scroll.

- [ ] **Step 2: Verificar tipos**

Run: `npm run build` (ou `npx tsc --noEmit` se preferir mais rápido)
Expected: sem erros relacionados a `ScrollToTopButton.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ScrollToTopButton.tsx
git commit -m "feat: componente ScrollToTopButton"
```

---

### Task 3: Montar no layout protegido

**Files:**
- Modify: `app/(protected)/layout.tsx`

Depende do Task 2.

Estado atual do arquivo (para referência exata de onde editar):

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NavLinks } from '@/components/NavLinks'
import { UserMenu } from '@/components/UserMenu'
import { Logomark } from '@/components/Logomark'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const isAdmin = user.app_metadata?.role === 'admin'
  const name = (user.user_metadata?.nome as string | undefined) || user.email?.split('@')[0] || 'Usuário'
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 h-14 max-w-5xl">
          ...
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-5xl">{children}</main>
    </div>
  )
}
```

- [ ] **Step 1: Adicionar o import**

Em `app/(protected)/layout.tsx`, adicione junto aos demais imports de `components/`:

```tsx
import { ScrollToTopButton } from '@/components/ScrollToTopButton'
```

- [ ] **Step 2: Renderizar o botão**

Adicione `<ScrollToTopButton />` logo após o `</main>`, ainda dentro da `<div className="min-h-screen">`:

```tsx
      <main className="container mx-auto px-4 py-8 max-w-5xl">{children}</main>
      <ScrollToTopButton />
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos e lint**

Run: `npm run build`
Expected: build passa sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/layout.tsx"
git commit -m "feat: montar ScrollToTopButton no layout protegido"
```

---

### Task 4: Verificação manual (desktop + mobile)

**Files:** nenhum (só verificação)

Não há automação de browser disponível neste ambiente — esta verificação é manual, feita pelo usuário, seguindo este roteiro:

- [ ] **Step 1: Rodar o dev server**

Run: `npm run dev`

- [ ] **Step 2: Roteiro de verificação manual**

Documentar no PR (não precisa marcar aqui, é checklist pro usuário/revisor):
1. Abrir qualquer página protegida com conteúdo longo (ex. `/configuracoes/usuarios` com vários usuários, ou uma página de relatório extensa).
2. Confirmar que o botão não aparece no topo da página.
3. Rolar para baixo além de uma tela de altura — botão deve aparecer com transição suave, no canto inferior esquerdo, sem sobrepor o `Toaster` (canto inferior direito) nem nenhum outro elemento.
4. Clicar no botão — página deve rolar suavemente até o topo, botão deve sumir novamente ao chegar lá.
5. Testar em viewport mobile (DevTools responsivo ou dispositivo real) — mesmo comportamento, sem sobreposição com outros elementos da tela.
6. Testar navegação por teclado: `Tab` até o botão (quando visível), confirmar foco visível, `Enter`/`Espaço` aciona o scroll.
7. Confirmar que o botão NÃO aparece em `/login` (fora do layout protegido).

- [ ] **Step 3: Registrar resultado**

Nenhum commit de código neste task — é só validação. Se algo falhar, abrir um fix conforme o problema encontrado antes de seguir para a finalização da branch.
