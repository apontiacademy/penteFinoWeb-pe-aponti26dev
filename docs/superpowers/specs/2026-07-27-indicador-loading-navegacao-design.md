# Indicador de loading ao navegar entre páginas

## Contexto

Issue [#108](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/108): não há hoje nenhum feedback visual quando o usuário navega entre páginas/rotas do app. Como as páginas protegidas são renderizadas no servidor (Supabase) e não têm `loading.js`, uma navegação pode levar um tempo perceptível sem que a interface indique que algo está acontecendo, gerando dúvida sobre se o clique foi registrado.

A issue sugere três formatos possíveis (barra de progresso no topo, overlay centralizado, spinner contextual no link). Após avaliar as opções, foi escolhido o **spinner contextual no link clicado**, usando o hook `useLinkStatus` do Next.js 16 (`next/link`), aplicado em todo link de navegação client-side do app.

## Objetivo

Adicionar um indicador visual e acessível que aparece ao lado do link clicado enquanto a navegação está pendente, e desaparece assim que ela conclui — sem bloquear a interação com o restante da página, sem causar layout shift, e reaproveitando o componente de spinner já existente no design system.

## Arquitetura

### `components/LinkPendingIndicator.tsx`

Client component (`'use client'`) novo, sem props, sem estado próprio — toda a lógica de pendência vem do hook `useLinkStatus` (`next/link`), que só funciona quando o componente que o chama é descendente de um `<Link>`.

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

Decisões de implementação:

- Reaproveita `Spinner` (`components/ui/spinner.tsx`, já usado em botões de formulário do app) para manter consistência visual — `Loader2Icon` com `animate-spin`.
- O `Spinner` por padrão renderiza `role="status" aria-label="Loading"`. Como esses atributos vêm antes do spread de `props` no componente `Spinner`, passar `role={undefined}` os sobrescreve; combinado com `aria-hidden="true"`, o ícone fica puramente decorativo e invisível para leitores de tela (evita duplicar/conflitar com o anúncio feito pelo `<span role="status">` abaixo, que é quem carrega o texto acessível).
- O ícone é **sempre renderizado**, alternando `opacity-0`/`opacity-100` (em vez de montar/desmontar condicionalmente) — mesmo padrão já usado no `ScrollToTopButton`, evita layout shift e permite transição suave via `transition-opacity`.
- O texto acessível (`sr-only`, dentro de `role="status"`) alterna entre string vazia e `"Carregando página…"` — a troca do conteúdo de texto dentro de uma região `role="status"` (que tem `aria-live="polite"` implícito) é o que dispara o anúncio em leitores de tela; um simples toggle de opacidade no ícone (sem mudança de texto) não seria suficiente para reativar o anúncio a cada navegação.
- `size-3.5` (14px) para combinar com o tamanho de ícone já usado em textos `text-sm` no app (ex. ícones do `NavLinks`, `w-3.5 h-3.5`).
- Sem delay artificial antes de exibir (a documentação do Next sugere isso para evitar "flash" em navegações rápidas) — mantido simples de propósito. Como nenhuma rota do app tem `loading.js` hoje, navegações para páginas dinâmicas (todas fazem chamadas ao Supabase no servidor) tendem a ser lentas o suficiente para o spinner aparecer de forma útil na maioria dos casos reais.

### Pontos de montagem

O componente é inserido como filho de cada `<Link>` client-side do app (levantamento feito buscando todo uso de `<Link` no projeto). Em todos os casos, basta adicionar `<LinkPendingIndicator />` dentro do `<Link>`, próximo ao texto/ícone existente:

| Arquivo | Link(s) |
|---|---|
| `components/NavLinks.tsx` | Dashboard, Auditorias, Relatórios |
| `components/UserMenu.tsx` | Minha conta (`/perfil`), Configurações (`/configuracoes`) |
| `app/(protected)/layout.tsx` | Logo → `/dashboard` |
| `app/(protected)/dashboard/page.tsx` | "Ver última auditoria" |
| `components/AuditoriasList.tsx` | Linha de cada auditoria (`/auditorias/[id]`) + link do empty state (`/relatorios`) |
| `app/(protected)/auditorias/[id]/page.tsx` | Breadcrumb "Auditorias" (voltar) |
| `app/(protected)/configuracoes/page.tsx` | Cards "Gerenciar usuários" e "Ver logs" |
| `app/(protected)/configuracoes/usuarios/page.tsx` | Breadcrumb "Configurações" (voltar) |
| `app/(protected)/configuracoes/logs/page.tsx` | Breadcrumb "Configurações" (voltar) + paginação anterior/próximo |
| `app/(auth)/login/page.tsx` | "Esqueci minha senha" |
| `components/EsqueciSenhaForm.tsx` | "Voltar para o login" |

Para os `<Link>` que envolvem um `<Button>` (ex. breadcrumbs, cards de `configuracoes`, "Ver última auditoria" via `render={<Link .../>}`), o indicador entra como filho do `Button`/dentro do conteúdo já existente — como o `@base-ui/react` mescla os filhos do componente com o elemento de `render`, o indicador continua sendo descendente do `<Link>` real no DOM final, o que é o único requisito do hook.

Nos botões de paginação de `configuracoes/logs/page.tsx` (ícone só, sem texto), o `ml-1.5` do indicador fica levemente deslocado ao lado do ícone — aceito como trade-off cosmético menor, não bloqueante.

## Fluxo de dados (resumo)

```
usuário clica em um <Link>
        │
        ▼
useLinkStatus() (Next.js) → pending = true
        │
        ▼
LinkPendingIndicator: ícone some de opacity-0 → opacity-100
                      texto sr-only muda para "Carregando página…"
        │
        ▼
navegação conclui (history atualizado)
        │
        ▼
useLinkStatus() → pending = false
        │
        ▼
ícone volta a opacity-0, texto sr-only volta a vazio
```

## Tratamento de erros / casos de borda

- **Navegação rápida (rota já prefetched):** o hook pode nunca reportar `pending: true` (comportamento documentado do próprio `useLinkStatus`) — o spinner simplesmente não aparece, o que é aceitável: não há necessidade de indicar loading quando não há loading perceptível.
- **Múltiplos cliques em sequência:** conforme a documentação do Next, apenas o último link clicado mostra o estado pendente — comportamento nativo do hook, sem tratamento adicional necessário.
- **Paginação numerada de `AuditoriasList` (fora de escopo, ver abaixo):** usa `<a>` nativa (via `PaginationLink`/shadcn `Pagination`), não `next/link` — navegação com reload completo do navegador, que já tem seu próprio feedback nativo (spinner da aba). Sem alteração.
- **`redefinir-senha/page.tsx` (fora de escopo):** o único redirecionamento programático do app (`router.push`) não passa por um `<Link>`, então não há onde anexar o hook.

## Testes

`LinkPendingIndicator` depende inteiramente de `useLinkStatus` (hook do Next.js ligado ao router real) — não há lógica de negócio pura para extrair e testar isoladamente com Vitest, mesma situação já aceita para outros componentes de interação do projeto (ex. `ScrollToTopButton`, que depende de `window.scroll`). Verificação será manual, cobrindo desktop e mobile, navegação por diferentes rotas listadas na tabela acima, e confirmação de que o texto `sr-only` muda (via árvore de acessibilidade do DevTools) durante uma navegação.

## Fora de escopo

- Paginação numerada de `AuditoriasList` (usa `<a>` nativa, não `next/link`) — inconsistência pré-existente no código, não faz parte desta issue corrigir.
- `redefinir-senha/page.tsx` (navegação via `router.push`, não `<Link>`).
- Qualquer delay artificial / animação de "fade in atrasado" antes de exibir o spinner.
- Barra de progresso global no topo da página ou overlay centralizado (alternativas descartadas na fase de design).
- Adicionar `prefetch={false}` aos links para forçar o estado pendente a aparecer com mais frequência — mantém o comportamento de prefetch padrão do Next, sem regressão de performance.
