# Cores por faixa de severidade no ranking de Top Ausências

## Contexto

O gráfico "Top ausências" em `components/DashboardCharts.tsx` (dashboard) mostra os 10 alunos com mais ausências, todos na mesma cor (vermelho fixo, `ausenciasConfig.ausencias.color`). O pedido é diferenciar visualmente por severidade, usando uma paleta qualitativa (azul, verde, laranja, roxo, vermelho), com o vermelho reservado especificamente para quem faltou em **todos** os relatórios ativos (100% de ausência) — confirmado contra o banco real que hoje há 11 relatórios ativos, batendo com o exemplo dado ("os 11 relatórios").

## Objetivo

Colorir cada barra do ranking de ausências por faixa de `% de ausência` (`ausências do aluno / total de relatórios ativos`), com 5 faixas.

## Arquitetura

### Faixas e cores

`% ausência = ausências / totalRelatorios`, calculado por aluno, só para quem já aparece no ranking (`totalAusencias > 0`, filtro já existente).

| Faixa | % ausência | Cor | Valor oklch |
|---|---|---|---|
| 1 | 1–25% | Azul | `oklch(0.55 0.2 250)` (novo) |
| 2 | 26–50% | Verde | `oklch(0.6 0.18 150)` (já usado no gráfico de UF) |
| 3 | 51–75% | Laranja | `oklch(0.75 0.16 80)` (já usado no gráfico de UF) |
| 4 | 76–99% | Roxo | `oklch(0.452 0.286 294)` (já usado no gráfico de evolução) |
| 5 | 100% | Vermelho | `oklch(0.577 0.245 27.325)` (já usado hoje neste gráfico) |

### `app/(protected)/dashboard/page.tsx`

`rankingAusencias` passa a incluir `pct`, calculado com o `totalRelatorios` que a página já busca:

```ts
const rankingAusencias = [...naoFeitos]
  .filter((r) => r.totalAusencias > 0)
  .sort((a, b) => b.totalAusencias - a.totalAusencias)
  .slice(0, 10)
  .map((r) => ({
    nome: r.nomeCompleto.split(' ').slice(0, 2).join(' '),
    ausencias: r.totalAusencias,
    pct: totalRelatorios ? Math.round((r.totalAusencias / totalRelatorios) * 100) : 0,
  }))
```

`totalRelatorios` pode ser `null` (contagem do Supabase) — guard com `? :` evita divisão por zero, mesmo padrão já usado em `taxaCumprimento`/`distribuicaoPorUF.pct` no mesmo arquivo.

### `components/DashboardCharts.tsx`

- `Props.rankingAusencias` ganha `pct: number`.
- Novo helper `ausenciaColor(pct: number)`, mesmo padrão de `ufColor` já existente no arquivo:

```ts
function ausenciaColor(pct: number) {
  if (pct >= 100) return 'oklch(0.577 0.245 27.325)' // vermelho — faltou em todos
  if (pct >= 76) return 'oklch(0.452 0.286 294)' // roxo
  if (pct >= 51) return 'oklch(0.75 0.16 80)' // laranja
  if (pct >= 26) return 'oklch(0.6 0.18 150)' // verde
  return 'oklch(0.55 0.2 250)' // azul
}
```

- O `<Bar dataKey="ausencias" radius={[0, 4, 4, 0]} fill="var(--color-ausencias)" />` atual passa a ter `<Cell>` por barra, no mesmo padrão já usado no gráfico de UF logo abaixo no mesmo arquivo:

```tsx
<Bar dataKey="ausencias" radius={[0, 4, 4, 0]}>
  {rankingAusencias.map((entry, i) => (
    <Cell key={i} fill={ausenciaColor(entry.pct)} />
  ))}
</Bar>
```

`Cell` já está importado no arquivo (usado pelo gráfico de UF). O tooltip (`ChartTooltipContent`) já resolve a cor do indicador a partir de `item.payload?.fill` quando não há `color` explícito no config (`components/ui/chart.tsx:205`) — mesmo mecanismo que já funciona hoje no gráfico de UF — então o indicador do tooltip acompanha a cor de cada barra automaticamente, sem mudança em `chart.tsx`.

`ausenciasConfig.ausencias.color` (usado só como fallback/CSS var) não precisa mudar — os `Cell` sobrepõem visualmente.

## Nota sobre semântica de cor

No gráfico de "Cumprimento por Estado" (já existente), verde = bom, vermelho = ruim. Aqui a lógica é a oposta (verde = ausência moderada, não "bom"), já que o gráfico mede ausência, não cumprimento. São gráficos separados, cada um com seu próprio tooltip mostrando os valores reais — na avaliação de quem pediu a mudança, isso não deve confundir na prática.

## Testes

Sem lógica nova extraível como função pura testável de forma isolada e valiosa — `ausenciaColor` é uma cadeia de `if` triviais (mesmo padrão de `ufColor`, que também não tem teste dedicado hoje). Verificação visual manual no dashboard.

## Fora de escopo

- Não adiciona legenda de cores ao gráfico (o tooltip já mostra nome + contagem por barra).
- Não muda a paleta dos outros gráficos (Evolução, Cumprimento por Estado).
- Não muda o critério de quem entra no ranking (top 10 por contagem de ausências, inalterado).
