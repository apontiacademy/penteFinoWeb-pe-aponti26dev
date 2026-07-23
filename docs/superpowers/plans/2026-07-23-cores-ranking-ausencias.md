# Cores por faixa de severidade no ranking de Top Ausências Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colorir cada barra do gráfico "Top ausências" por faixa de % de ausência (5 faixas: azul/verde/laranja/roxo/vermelho), com vermelho reservado para quem faltou em 100% dos relatórios ativos.

**Architecture:** `app/(protected)/dashboard/page.tsx` calcula `pct` por aluno no ranking; `components/DashboardCharts.tsx` ganha um helper `ausenciaColor(pct)` (mesmo padrão de `ufColor` já existente) e passa a colorir cada barra via `<Cell>`, igual ao gráfico de UF logo abaixo no mesmo arquivo.

**Tech Stack:** Next.js 16 (Server Component + client chart component), TypeScript, Recharts.

Spec de referência: `docs/superpowers/specs/2026-07-23-cores-ranking-ausencias-design.md`

Branch atual: `fix/dashboard-grafico-evolucao-limit` (continua na mesma branch/PR #90, a pedido do usuário).

---

### Task 1: Colorir o ranking de ausências por faixa

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx`
- Modify: `components/DashboardCharts.tsx`

- [ ] **Step 1: Adicionar `pct` ao `rankingAusencias` em `page.tsx`**

Substitua o bloco atual:

```tsx
  const rankingAusencias = [...naoFeitos]
    .filter((r) => r.totalAusencias > 0)
    .sort((a, b) => b.totalAusencias - a.totalAusencias)
    .slice(0, 10)
    .map((r) => ({
      nome: r.nomeCompleto.split(' ').slice(0, 2).join(' '),
      ausencias: r.totalAusencias,
    }))
```

por:

```tsx
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

- [ ] **Step 2: Atualizar o tipo `Props` e adicionar `ausenciaColor` em `DashboardCharts.tsx`**

No topo do arquivo, atualize o tipo:

```tsx
type Props = {
  evolucao: { data: string; cumprimento: number }[]
  rankingAusencias: { nome: string; ausencias: number; pct: number }[]
  distribuicaoPorUF: { uf: string; pct: number; total: number }[]
}
```

Logo depois de `function ufColor(pct: number) { ... }`, adicione:

```tsx
function ausenciaColor(pct: number) {
  if (pct >= 100) return 'oklch(0.577 0.245 27.325)' // vermelho — faltou em todos
  if (pct >= 76) return 'oklch(0.452 0.286 294)' // roxo
  if (pct >= 51) return 'oklch(0.75 0.16 80)' // laranja
  if (pct >= 26) return 'oklch(0.6 0.18 150)' // verde
  return 'oklch(0.55 0.2 250)' // azul
}
```

- [ ] **Step 3: Colorir as barras por `<Cell>`**

Substitua:

```tsx
                <Bar dataKey="ausencias" radius={[0, 4, 4, 0]} fill="var(--color-ausencias)" />
```

por:

```tsx
                <Bar dataKey="ausencias" radius={[0, 4, 4, 0]}>
                  {rankingAusencias.map((entry, i) => (
                    <Cell key={i} fill={ausenciaColor(entry.pct)} />
                  ))}
                </Bar>
```

`Cell` já está importado no topo do arquivo (usado pelo `BarChart` de distribuição por UF logo abaixo) — não precisa adicionar import.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: todos passando (nenhum teste cobre esses dois arquivos diretamente — só confirma que nada mais quebrou).

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/dashboard/page.tsx" components/DashboardCharts.tsx
git commit -m "feat: colorir ranking de top ausencias por faixa de severidade"
```

---

### Task 2: Verificação manual

**Files:** nenhum (só verificação)

- [ ] **Step 1: Rodar o dev server**

Run: `npm run dev`

- [ ] **Step 2: Roteiro de verificação manual**

1. Abrir `/dashboard` logado como admin.
2. Conferir que as barras do gráfico "Top ausências" têm cores diferentes conforme a % de ausência de cada aluno (não mais tudo vermelho).
3. Passar o mouse sobre uma barra e confirmar que o tooltip mostra a contagem de ausências e que o indicador de cor no tooltip acompanha a cor da barra.
4. Se houver algum aluno com ausência em 100% dos relatórios ativos, confirmar que a barra dele aparece em vermelho.
5. Confirmar visualmente que os outros dois gráficos (Evolução, Cumprimento por Estado) continuam com as cores de antes, sem alteração.

- [ ] **Step 3: Registrar resultado**

Nenhum commit de código neste task — é só validação. Se algo falhar, abrir um fix conforme o problema encontrado.
