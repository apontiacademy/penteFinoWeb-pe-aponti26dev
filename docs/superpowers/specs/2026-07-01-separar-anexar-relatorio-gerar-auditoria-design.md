# Separar "anexar relatório" de "gerar auditoria"

## Contexto

Hoje, em `/relatorios`, anexar um novo relatório ou excluir um existente **sempre** dispara a geração de uma auditoria automaticamente, como parte da mesma server action (`adicionarRelatorio` e `deletarRelatorio` em [app/(protected)/relatorios/actions.ts](../../../app/(protected)/relatorios/actions.ts)). O usuário não tem escolha: o efeito colateral é implícito e ocorre mesmo se ele só quisesse organizar os relatórios sem gerar uma nova auditoria naquele momento.

## Objetivo

Separar as duas responsabilidades:
1. Anexar/excluir relatório é uma operação independente, sem side-effects.
2. Gerar auditoria passa a ser uma decisão explícita do usuário, perguntada logo após anexar ou excluir um relatório, e também disponível a qualquer momento via um botão fixo na página.

## Arquitetura

### Server actions (`app/(protected)/relatorios/actions.ts`)

- `adicionarRelatorio(prev, formData)`: remove a chamada a `gerarAuditoria('add', ...)`. Continua fazendo upload do CSV e insert do registro. Passa a retornar `{ success: true, relatorioId }` (além do já existente `{ error }`). `revalidatePath` só para `/relatorios` (não mais para `/auditorias`, já que nenhuma auditoria é gerada aqui).
- `deletarRelatorio(relatorioId)`: remove a chamada a `gerarAuditoria('delete', ...)`. Continua fazendo o soft-delete (`deleted_at`). `revalidatePath` só para `/relatorios`. Passa a retornar (em vez de `void`) algo que confirme sucesso, para o client encadear o próximo passo.
- Nova action `gerarAuditoriaManual(triggerType: 'add' | 'delete' | 'manual', relatorioTriggerId: string | null)`: valida admin, chama `gerarAuditoria(triggerType, relatorioTriggerId, supabase)`, e faz `revalidatePath` de `/relatorios` e `/auditorias`. Usada pelos três pontos de entrada: modal pós-anexar, modal pós-excluir e botão fixo.

### `lib/gerar-auditoria.ts`

- Assinatura de `triggerType` passa de `'add' | 'delete'` para `'add' | 'delete' | 'manual'`.
- `relatorioTriggerId` passa a aceitar `string | null` (nulo no caso `'manual'`, já que não há um relatório específico disparando a geração).
- Nenhuma outra mudança na lógica de cálculo de ausências/presenças.

### Banco de dados

- Confirmar, durante a implementação, se a coluna `trigger_type` da tabela `auditorias` tem alguma constraint (CHECK/enum) que precise ser atualizada para aceitar `'manual'`.
- Confirmar que `relatorio_trigger_id` aceita `NULL` (necessário para o trigger `'manual'`). Se não aceitar, será necessária uma migration via Supabase.

## UI

### Anexar relatório ([components/AdicionarRelatorioForm.tsx](../../../components/AdicionarRelatorioForm.tsx))

- Ao receber `state.success` com `relatorioId`, abre um `AlertDialog` (mesmo componente usado em exclusão, `components/ui/alert-dialog.tsx`):
  - Título: "Relatório anexado"
  - Descrição: "O relatório foi anexado com sucesso. Deseja gerar a auditoria agora?"
  - Ações: "Cancelar" (fecha o dialog, sem gerar) / "Gerar auditoria" (chama `gerarAuditoriaManual('add', relatorioId)`, mostra estado de carregamento, fecha ao concluir).
- Texto do botão de submit muda de "Adicionar e gerar auditoria" para "Adicionar relatório".
- A mensagem de sucesso inline atual ("Relatório adicionado! Auditoria gerada automaticamente.") é substituída pela abertura do modal — não faz mais sentido manter as duas.

### Excluir relatório ([components/RelatoriosList.tsx](../../../components/RelatoriosList.tsx))

- Mantém o `AlertDialog` de "Confirmar exclusão" já existente.
- Após `deletarRelatorio(id)` concluir com sucesso, encadeia um segundo `AlertDialog`: "Relatório excluído. Deseja gerar a auditoria agora?" com as mesmas ações (Cancelar / Gerar auditoria → `gerarAuditoriaManual('delete', id)`).
- Descrição do dialog de confirmação de exclusão é ajustada (não menciona mais geração automática).

### Botão fixo "Gerar auditoria"

- Novo componente `components/GerarAuditoriaButton.tsx`, posicionado no header do card "Relatórios ativos" em [app/(protected)/relatorios/page.tsx](../../../app/(protected)/relatorios/page.tsx).
- Ao clicar, chama diretamente `gerarAuditoriaManual('manual', null)` (sem modal de confirmação prévio, já que é uma ação explícita e não-destrutiva) e mostra feedback inline de sucesso/erro (mesmo padrão dos outros componentes: cores de sucesso/erro já usadas no projeto).
- Desabilitado com spinner enquanto pendente.

### Textos

- Descrição do card "Adicionar relatório" em `page.tsx` muda de "Uma nova auditoria será gerada automaticamente." para "Depois de anexado, você poderá optar por gerar uma nova auditoria."

### Exibição do novo trigger_type "manual"

- [components/AuditoriasList.tsx](../../../components/AuditoriasList.tsx) e [app/(protected)/auditorias/[id]/page.tsx](../../../app/(protected)/auditorias/[id]/page.tsx): hoje só tratam `isAdd = trigger_type === 'add'` (ícone/badge "adição" vs "exclusão"). Passam a tratar três casos: `'add'` → "adição" (ícone `PlusCircle`), `'delete'` → "exclusão" (ícone `MinusCircle`), `'manual'` → "manual" (ícone `ClipboardList`, cor neutra).

## Tratamento de erros

- Se `gerarAuditoriaManual` falhar (ex.: planilha geral ausente, erro de storage), o dialog/botão que a chamou exibe a mensagem de erro inline, sem fechar o dialog automaticamente, permitindo tentar novamente.
- Anexar/excluir relatório continuam com seu próprio tratamento de erro já existente, agora independente da geração de auditoria.

## Fora de escopo

- Não altera a lógica de cálculo de ausências/presenças em `lib/pente-fino.ts`.
- Não adiciona geração automática/agendada de auditorias.
- Não altera o comportamento da página `/auditorias` além da exibição do novo trigger_type.
