# Design: filtro de UF como dropdown multi-seleção

Issue: [#31](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/31)

## Contexto

O filtro de UF em `components/AuditResultTable.tsx` é hoje um `<Input>` de texto livre
com correspondência por substring (linha 107), sem validação contra UFs válidas. O
projeto já tem um `Select` estilizado (`components/ui/select.tsx`, base
`@base-ui/react/select`) que hoje não é usado em lugar nenhum do app, e o Base UI
Select suporta nativamente `multiple` (`value`/`onValueChange` tipados como array,
popup permanece aberto entre cliques nesse modo — confirmado em
`node_modules/@base-ui/react/select/root/SelectRoot.d.ts`).

## Objetivo

Substituir o filtro de texto de UF por um dropdown de múltipla seleção, sem precisar
de um componente novo.

## 1. Fonte de dados das opções

As opções vêm dos UFs realmente presentes nos alunos daquela auditoria — não a lista
estática de 27 UFs (`UF_POR_NOME_ESTADO`/`UFS_VALIDAS` em `lib/pente-fino.ts:31-61`).

Derivadas da união de `naoFeitos` + `feitos` (ambos calculados sobre a mesma lista de
alunos, mesmos `estado`s — a união é só uma garantia extra contra divergência), não da
aba ativa (`modo`), para que as opções não mudem ao trocar de aba:

```ts
const ufsDisponiveis = useMemo(() => {
  const set = new Set<string>()
  for (const r of [...naoFeitos, ...feitos]) if (r.estado) set.add(r.estado)
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}, [naoFeitos, feitos])
```

Estados vazios (`''`) são excluídos das opções — alunos sem UF (hoje exibidos como
"sem envio"/"—") não têm opção própria no dropdown; só aparecem no resultado quando
nenhuma UF está selecionada.

## 2. Estado do filtro e lógica de matching

`filters.uf: string` (substring) vira `filters.ufs: string[]` (igualdade exata):

```ts
const [filters, setFilters] = useState({ nome: '', ufs: [] as string[], empresa: '' })

function handleUfsChange(ufs: string[]) {
  setFilters((prev) => ({ ...prev, ufs }))
  setPage(1)
}

function clearFilters() {
  setFilters({ nome: '', ufs: [], empresa: '' })
  setPage(1)
}

const hasFilters = filters.nome || filters.ufs.length > 0 || filters.empresa
```

Predicado de filtro (linhas 100-110): a condição de UF passa a ser
`(filters.ufs.length === 0 || filters.ufs.includes(row.estado))` — sem
`toLowerCase()`/`includes` de substring, já que `estado` já é normalizado (ver
`normalizarUF` em `lib/pente-fino.ts`) e as opções vêm diretamente dos valores
presentes nos dados.

## 3. Componente `Select` multi-seleção

Reaproveita `components/ui/select.tsx` sem alterar `Select`, `SelectContent`,
`SelectItem` ou `SelectSeparator` — a lib já suporta `multiple` nativamente:

- `<Select multiple value={filters.ufs} onValueChange={handleUfsChange}>`
- Um `<SelectItem value={uf}>{uf}</SelectItem>` por UF de `ufsDisponiveis`. O
  checkmark (`ItemIndicator`) que o `SelectItem` já renderiza serve como indicador de
  selecionado/não selecionado — não é preciso desenhar um checkbox customizado.
- `SelectValue` com `children` como função para formatar o resumo exibido no trigger:
  - 0 selecionados → placeholder "UF"
  - 1 selecionado → a sigla (ex: "PE")
  - 2 selecionados → "PE, SP"
  - 3+ selecionados → as duas primeiras + `+N` do restante (ex: "PE, SP +2")
- O trigger perde a largura fixa `w-20` do `Input` anterior (não cabe mais texto
  variável) e passa a usar o `w-fit` padrão do `SelectTrigger`, com um `min-w` pequeno
  para não colapsar quando vazio/placeholder.

## 4. Casos de borda

- Nenhuma UF presente nos dados (todas vazias) → dropdown sem itens, mas renderiza
  normalmente (sem crash).
- Trocar de aba (Não feitos ↔ Feitos) não reseta `filters.ufs` nem muda as opções
  disponíveis (união fixa, independente de `modo`).
- `clearFilters` zera `ufs` junto com `nome`/`empresa`, como já fazia antes.

## Fora de escopo

- Não altera `lib/pente-fino.ts` (a exportação de `UF_POR_NOME_ESTADO`/`UFS_VALIDAS`
  mencionada na issue como "sugestão" não é necessária — as opções vêm dos dados da
  auditoria, não da lista estática de UFs válidas do Brasil).
- Não adiciona opção "Sem UF" no dropdown (decisão do usuário: alunos sem UF só
  aparecem quando o filtro está limpo).
- Não adiciona ações de "selecionar todos"/"limpar" dentro do popup do dropdown — o
  botão "Limpar" já existente na barra de filtros cobre isso.
