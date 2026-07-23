# Botão flutuante "voltar ao topo"

## Contexto

Issue [#75](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/75): páginas protegidas podem ficar longas (ex. listas de usuários, relatórios) e não há forma rápida de voltar ao topo sem rolar manualmente. A issue pede um botão flutuante global, que aparece após rolar um pouco, some quando não é necessário, rola suavemente até o topo ao ser clicado, é implementado uma única vez (não duplicado por página), é acessível, e não sobrepõe outros elementos fixos da tela.

## Objetivo

Adicionar um botão flutuante "voltar ao topo" que aparece em todas as páginas protegidas, montado uma única vez no layout compartilhado.

## Arquitetura

### `lib/scroll.ts`

Função pura, sem dependência de `window`, isolando a decisão de exibir o botão:

```ts
export function deveExibirBotaoTopo(scrollY: number, limiar: number): boolean {
  return scrollY > limiar
}
```

Permite testar a regra de negócio (o limiar) sem simular scroll de browser.

### `components/ScrollToTopButton.tsx`

Client component (`'use client'`), montado uma vez em `app/(protected)/layout.tsx`.

- `useState<boolean>` para visibilidade.
- `useEffect` registra um listener `scroll` passivo em `window` (`{ passive: true }`), chamando `deveExibirBotaoTopo(window.scrollY, window.innerHeight)` a cada evento — `window.innerHeight` como limiar, conforme sugerido na própria issue (aparece depois de rolar aproximadamente uma tela). Listener removido no cleanup do efeito.
- Visibilidade controlada via classes CSS de opacidade/`pointer-events` (`opacity-0 pointer-events-none` ↔ `opacity-100`) em vez de montar/desmontar o botão — evita layout shift e permite uma transição suave (`transition-opacity`).
- Ao clicar: `window.scrollTo({ top: 0, behavior: 'smooth' })`.
- Reaproveita o `<Button>` já existente (`components/ui/button.tsx`) para manter consistência visual com o resto do app: `variant="default"`, `size="icon-lg"`, com `className` adicional para virar um FAB — `fixed bottom-6 left-6 z-40 rounded-full shadow-lg transition-opacity`.
- Ícone `ArrowUp` do `lucide-react` (biblioteca de ícones já usada em todo o projeto).
- `aria-label="Voltar ao topo"` — como é renderizado via `<Button>` (elemento `<button>` real), foco visível e navegação por teclado (Tab/Enter/Espaço) já vêm de graça.

### Posicionamento

Canto inferior esquerdo (`bottom-6 left-6`), para não conflitar com o `<Toaster />` do Sonner, que usa a posição padrão (canto inferior direito) e é renderizado globalmente em `app/layout.tsx`. Não há hoje nenhum outro elemento fixo no rodapé das páginas protegidas (sem bottom-nav mobile), então não há mais nenhum conflito de sobreposição a considerar.

`z-40` fica abaixo do header (`z-50`, `sticky top-0`) e de diálogos/dropdowns (`z-50`), evitando disputa de camadas.

### Montagem

Uma única vez em `app/(protected)/layout.tsx`, após `{children}` dentro do `<main>` (ou logo depois do `</main>`, ambos funcionam já que o botão é `fixed`) — cobre automaticamente todas as páginas protegidas, sem precisar duplicar nada por página.

## Fluxo de dados (resumo)

```
usuário rola a página (window scroll)
        │
        ▼
listener 'scroll' → deveExibirBotaoTopo(window.scrollY, window.innerHeight)
        │
        ├─► false → botão com opacity-0 pointer-events-none (invisível, não clicável)
        └─► true  → botão com opacity-100 (visível, clicável)

usuário clica no botão
        │
        ▼
window.scrollTo({ top: 0, behavior: 'smooth' })
```

## Tratamento de erros / casos de borda

- Página já carrega com scroll no topo (`scrollY = 0`): botão começa invisível, sem "flash" — o estado inicial de `useState` é `false`.
- Página curta, que nunca ultrapassa o limiar: botão nunca aparece, sem necessidade de checagem extra (a regra já cobre isso naturalmente).
- Resize da janela mudando `window.innerHeight` durante o uso: não há listener de `resize` dedicado — o próximo evento de `scroll` já recalcula com o valor atual de `innerHeight`, o que é suficiente pra esse caso de uso (não crítico o bastante para justificar um segundo listener).
- Múltiplos cliques rápidos: `scrollTo` é idempotente, sem efeito colateral acumulado.

## Testes

`deveExibirBotaoTopo` é pura — testada com Vitest cobrindo os casos: abaixo do limiar (false), acima do limiar (true), exatamente no limiar (false, já que é `>` estrito).

O componente em si (listener de scroll, `scrollTo`) não tem teste automatizado — mesma situação já aceita para outros componentes de interação neste projeto (ex. `ScrollToTopButton` depende de APIs de browser que não valem o custo de mock). Verificação manual (desktop + mobile) fica no plano de implementação.

## Fora de escopo

- Suporte a `safe-area-inset` para dispositivos com notch — fica com o `bottom-6 left-6` padrão do Tailwind.
- Qualquer prop de configuração (posição, limiar, cor) — o componente não recebe props, é fixo.
- Aplicação em páginas públicas (`/login`) — só páginas protegidas, conforme decisão do usuário.
- Listener de `resize` dedicado para recalcular o limiar em tempo real.
