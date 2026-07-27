# Unificar numeração de relatórios em "Relatório X" (issue #79)

## Contexto

A issue #79 descreve um cenário onde o admin digitava manualmente dois números redundantes ao anexar um relatório: `nome` ("Relatório 1") e `semana` ("Semana 1"). Esse cenário já não existe mais no código atual — outra feature (anexar múltiplos relatórios, ver `docs/superpowers/specs/2026-07-14-anexar-multiplos-relatorios-design.md`) automatizou a geração de ambos os campos no servidor, e o formulário (`components/AdicionarRelatorioForm.tsx`) hoje só tem upload de CSV, sem nenhum input de texto para nome/semana.

O que sobrou do problema original: `app/(protected)/relatorios/actions.ts:78-79` ainda gera os dois valores a partir do mesmo número sequencial (`proximoNumero`):

```ts
const nome = `Relatório ${proximoNumero}`
const semana = `Semana ${proximoNumero}`
```

`semana` é sempre um espelho de `nome` (mesmo número, prefixo diferente) — não carrega nenhuma informação adicional. Mesmo assim, ainda é gravado no banco, selecionado nas queries e exibido como badge redundante em duas telas:

- `components/RelatoriosList.tsx:25,188-191` — badge `{r.semana}` ao lado do nome, na lista de relatórios em `/relatorios`.
- `components/RelatoriosIncluidosCard.tsx:11,43-44` — span com `{r.semana}` ao lado do nome, no card "Relatórios incluídos" da página de detalhe de auditoria (`app/(protected)/auditorias/[id]/page.tsx`).

A coluna `semana` na tabela `relatorios` é `NOT NULL` hoje. Essa tabela não tem migration própria neste repositório (foi criada diretamente no Supabase antes da adoção de migrations versionadas) — a primeira migration tocando `relatorios` neste projeto será a que remove essa coluna.

## Proposta

Eliminar `semana` de todo o sistema: geração, gravação, leitura, exibição e da própria coluna no banco. `nome` (com o formato "Relatório N") passa a ser a única numeração.

Decisão confirmada com o usuário: **a coluna será removida do banco (`DROP COLUMN`)**, não apenas descontinuada. Não há perda real de informação, já que todo valor de `semana` gerado pelo sistema atual é 100% derivável de `nome` (mesmo número sequencial). Registros antigos criados antes da automação (quando o campo era digitado à mão) podem ter `semana` com valores não numéricos ou dessincronizados de `nome`, mas isso não importa — `nome` continua sendo a fonte da verdade após a remoção, independente do que `semana` continha.

## Mudanças de código

### `app/(protected)/relatorios/actions.ts`

Em `adicionarRelatorios`:
- Remover a linha `const semana = \`Semana ${proximoNumero}\`` (linha 79).
- Remover `semana` do objeto passado a `supabase.from('relatorios').insert({...})` (linha 106) — mantém `id`, `nome`, `storage_path`, `user_id`.
- Remover `semana` de `details: { nome, semana }` na chamada a `registrarLog` (linha 121) — vira `details: { nome }`.

### `app/(protected)/relatorios/page.tsx`

Trocar o select (linha 26):
```ts
.select('id, nome, semana, created_at')
```
por:
```ts
.select('id, nome, created_at')
```

### `components/RelatoriosList.tsx`

- Remover `semana: string` do tipo `Relatorio` (linha 25).
- Remover o `Badge` que exibe `{r.semana}` (linhas 189-191), mantendo apenas o `span` de data ao lado (linhas 192-201), sem o `Badge` irmão nem o `div` wrapper `flex gap-2` se ficar com um único filho — simplificar para o span de data direto, sem gap/flex desnecessário caso não sobre mais nada para alinhar ao lado.

### `app/(protected)/auditorias/[id]/page.tsx`

Trocar o select (linha 49):
```ts
.select('id, nome, semana')
```
por:
```ts
.select('id, nome')
```

### `components/RelatoriosIncluidosCard.tsx`

- Remover `semana: string` do tipo `Relatorio` (linha 11).
- Remover o divisor `<span className="w-px h-3 bg-border" />` (linha 43) e o `<span className="text-xs text-muted-foreground">{r.semana}</span>` (linha 44) — o card passa a mostrar só `{r.nome}` por relatório, sem nada depois.

## Migration do banco

Nova migration, aplicada via MCP do Supabase (mesmo fluxo já usado para `add_id_coluna_to_planilha_geral` em `docs/superpowers/plans/2026-07-14-identificador-unico-cruzamento.md`): confirmar que o projeto Supabase conectado é `chuppzvaanyasljuknen` (org `aponti-pente-fino`) antes de aplicar, rodar

```sql
alter table relatorios drop column semana;
```

via `mcp__claude_ai_Supabase__apply_migration`, descobrir a versão atribuída via `mcp__claude_ai_Supabase__list_migrations`, e então criar o arquivo local `supabase/migrations/<version>_drop_semana_from_relatorios.sql` com o mesmo SQL, para manter o histórico de migrations do repositório em sincronia com o banco.

**Ordem de aplicação:** o código (server action, queries, componentes) deve parar de referenciar `semana` ANTES da migration rodar, para evitar uma janela em que o código ainda tenta inserir/selecionar uma coluna que não existe mais. Como o deploy do PR e a aplicação da migration não são atômicos entre si, a migration só deve ser aplicada depois que o código correspondente estiver mergeado/deployado (ou, no mínimo, na mesma sessão de implementação, migration por último).

## Fora de escopo

- Outras ocorrências de "semana"/"semanal" no repositório (README.md, CHANGELOG.md, `lib/pente-fino.test.ts`, specs/plans antigos) usam o termo como adjetivo genérico ("relatórios semanais" = relatórios que chegam com cadência semanal), não como o campo de dados `semana` sendo removido aqui. Não serão alteradas.
- Não há mudança de UI para o admin digitar nome/semana manualmente — esse fluxo já não existe (automatizado por outra feature). Esta issue trata só da remoção do campo redundante que sobrou.

## Validação

- Rodar `npx tsc --noEmit` e `npm run lint` após as mudanças de código.
- Rodar `npm test` — nenhum teste existente referencia `semana` como campo de dados (confirmado via busca; ocorrências em `lib/pente-fino.test.ts` são sobre outro assunto).
- Verificar manualmente em `/relatorios` que a lista de relatórios mostra nome e data, sem badge de semana.
- Verificar manualmente em uma página de detalhe de auditoria (`/auditorias/[id]`) que o card "Relatórios incluídos" mostra só o nome de cada relatório.
- Confirmar que anexar um novo relatório CSV continua funcionando (upload, geração de auditoria) sem erros relacionados à coluna removida.
- Confirmar, antes de aplicar a migration, que o projeto Supabase MCP conectado é `chuppzvaanyasljuknen`.
