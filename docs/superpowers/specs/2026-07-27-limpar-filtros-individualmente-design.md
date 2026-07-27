# Limpar filtros individualmente (issue #81)

## Contexto

`components/AuditResultTable.tsx` tem três filtros independentes: `nome` (input de texto), `ufs` (multi-select via `Combobox`/chips) e `empresa` (input de texto). Hoje só existe um botão "Limpar" (linha ~388) que zera os três de uma vez. Não há como limpar apenas um campo sem apagar manualmente o texto ou usar o "Limpar" geral e refazer os outros filtros.

O filtro `ufs` já é multi-select com chips, e cada chip (`ComboboxChip`, em `components/ui/combobox.tsx`) já tem um `X` de remoção individual por valor (`showRemove` é `true` por padrão). Isso já atende "limpeza individual" para UF — não é necessário nenhum botão adicional para esse campo.

Os campos `nome` e `empresa` (inputs de texto simples) não têm nenhum mecanismo de limpeza individual hoje.

## Proposta

Criar um componente `ClearableInput` em `components/ui/clearable-input.tsx`, reaproveitando o `Input` (`components/ui/input.tsx`) existente, que exibe um ícone `X` sobreposto à direita do campo quando há texto digitado, permitindo limpar aquele campo especificamente sem afetar os outros.

Usar `ClearableInput` nos dois filtros de texto do `AuditResultTable.tsx` (nome e empresa). O filtro de UF não é alterado.

Esse componente fica em `components/ui/`, disponível para qualquer tela futura que precise do mesmo padrão de campo de filtro com limpeza individual (conforme observado na issue).

## Componente `ClearableInput`

Wrapper fino sobre `Input`: aceita todas as props de `Input` (`React.ComponentProps<typeof Input>`) mais uma prop obrigatória `onClear: () => void`.

- Renderiza um `<div className="relative">` contendo o `Input` e, condicionalmente, um `<button>` com ícone `X` (lucide-react) absolutamente posicionado à direita, verticalmente centralizado.
- O botão só aparece quando `value` é uma string não vazia (`typeof value === 'string' && value.length > 0`).
- Ao clicar no botão, chama `onClear()`. O componente não gerencia estado próprio — quem usa o componente decide o que "limpar" significa (ex.: `handleFilter('nome', '')`).
- O `onChange` original passa direto para o `Input`, sem interferência — a digitação continua funcionando exatamente como hoje.
- Quando o botão de limpar está visível, o `Input` recebe padding extra à direita (`pr-7`) para o texto não ficar atrás do ícone.
- `aria-label="Limpar filtro"` no botão para acessibilidade.

```tsx
type ClearableInputProps = React.ComponentProps<typeof Input> & { onClear: () => void }

function ClearableInput({ value, onClear, className, ...props }: ClearableInputProps) {
  const hasValue = typeof value === 'string' && value.length > 0
  return (
    <div className="relative">
      <Input value={value} className={cn(hasValue && 'pr-7', className)} {...props} />
      {hasValue && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar filtro"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export { ClearableInput }
```

## Integração em `AuditResultTable.tsx`

Substituir os dois `<Input>` de nome e empresa (linhas ~374-385) por `<ClearableInput>`, mantendo `placeholder`, `value`, `onChange` e `className` como estão, e adicionando:

- `onClear={() => handleFilter('nome', '')}` no campo de nome.
- `onClear={() => handleFilter('empresa', '')}` no campo de empresa.

Nenhuma outra função muda: `handleFilter`, `handleUfsChange`, `clearFilters`, `hasFilters` (linha ~211) e a lógica de contagem `{totalRows} de {base.length} alunos` (linhas ~397-401) continuam funcionando sem alteração, pois todos derivam do estado `filters` já existente — limpar um campo individualmente é indistinguível, para essa lógica, de o usuário ter digitado uma string vazia naquele campo.

## Fora de escopo

- Não adicionar botão de "limpar tudo" no campo de UF — o multi-select já resolve isso via remoção de chips individuais.
- Não alterar o botão "Limpar" geral.
- Não criar abstração para outras telas além de deixar o componente disponível em `components/ui/` — nenhuma outra tela do sistema tem filtros hoje.

## Validação

Testar manualmente com 1, 2 e 3 filtros preenchidos (nome, UF, empresa em combinações), limpando-os em ordens diferentes, e confirmar que:
- O `X` de cada input aparece só quando há texto naquele campo.
- Limpar um campo não afeta os outros.
- O botão "Limpar" geral continua limpando os três de uma vez.
- O contador "X de Y alunos" e o botão "Limpar" geral aparecem/somem corretamente (`hasFilters`) em todas as combinações.
