# Botão de acesso à auditoria mais recente no dashboard

## Contexto

Issue: https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/80

Hoje, para ver a auditoria mais recente (a mesma que já alimenta os KPIs do dashboard), o usuário precisa entrar na aba "Auditorias" (`app/(protected)/auditorias/page.tsx`) e clicar no primeiro item da lista — ela é ordenada por `created_at` decrescente e o link de detalhe fica em `components/AuditoriasList.tsx:65` (`href={`/auditorias/${a.id}`}`).

O dashboard (`app/(protected)/dashboard/page.tsx:40-45`) já busca essa mesma auditoria mais recente para montar os KPIs, mas a query não seleciona o `id`, então hoje não há como linkar direto para `/auditorias/[id]` a partir de lá.

## Objetivo

Adicionar um botão no dashboard que leve direto para `/auditorias/[id]` da auditoria mais recente, evitando o caminho indireto via aba Auditorias.

## Decisões

- **Posição:** ao lado do título "Dashboard", no header da página (não dentro de um card de KPI).
- **Texto:** "Ver última auditoria", com ícone `ArrowRight` (lucide) no final, seguindo o padrão `data-icon="inline-end"` do componente `Button`.
- **Sem auditoria ainda (`ultimaAuditoria` nulo):** o botão simplesmente não é renderizado — mesmo critério usado pelo estado vazio dos gráficos logo abaixo (`totalAlunos > 0` / auditoria inexistente).
- **Composição:** usa o padrão Base UI já estabelecido no projeto — `<Button render={<Link href="..." />}>`, igual ao usado em `components/UserMenu.tsx:65`. Sem `asChild` (esse não é o padrão Radix).

## Arquitetura

Mudança isolada em um único arquivo: `app/(protected)/dashboard/page.tsx`.

1. **Query** (linha 42): incluir `id` no `select` de `ultimaAuditoria`:
   ```ts
   supabase
     .from('auditorias')
     .select('id, created_at, resultado_json')
     .order('created_at', { ascending: false })
     .limit(1)
     .maybeSingle(),
   ```

2. **Imports:** adicionar `Link` de `next/link`, `Button` de `@/components/ui/button`, e o ícone `ArrowRight` de `lucide-react` (junto aos ícones já importados de `lucide-react`).

3. **Header** (linhas 154-159), trocar por:
   ```tsx
   <div className="flex items-center justify-between">
     <div>
       <h1 className="text-2xl font-bold">Dashboard</h1>
       <p className="text-muted-foreground text-sm mt-1">
         Visão geral do acompanhamento de relatórios
       </p>
     </div>
     {ultimaAuditoria && (
       <Button variant="outline" render={<Link href={`/auditorias/${ultimaAuditoria.id}`} />}>
         Ver última auditoria
         <ArrowRight data-icon="inline-end" />
       </Button>
     )}
   </div>
   ```

Nenhuma mudança de schema, de rota ou de outros componentes — `/auditorias/[id]` já existe e é a mesma página acessada hoje via `AuditoriasList.tsx`.

## Tratamento de erros

Não há novo caminho de erro: `ultimaAuditoria` já é tratado como possivelmente nulo hoje (usado via `?.resultado_json` nas linhas seguintes). O botão só usa esse mesmo valor, condicionado à sua existência.

## Testes

Não há suíte de testes automatizados para páginas do dashboard (server component simples que só busca dados e renderiza). Validação é manual:
- Com auditorias existentes: botão aparece e leva para a mesma página que "Auditorias → primeiro item da lista" abriria.
- Sem nenhuma auditoria (banco vazio): botão não aparece, junto com o estado vazio dos gráficos.

## Fora de escopo

- Qualquer mudança de layout responsivo além do `flex justify-between` já padrão no projeto.
- Alterações na aba "Auditorias" ou em `AuditoriasList.tsx`.
