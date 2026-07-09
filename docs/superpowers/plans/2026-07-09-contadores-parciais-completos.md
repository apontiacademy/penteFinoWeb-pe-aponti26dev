# Contadores de alunos parcialmente/completamente feitos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar os stat cards de `AuditResultTable` (que hoje alternam por aba selecionada) por 3 cards fixos e sempre visíveis: Total, Parcialmente feitos e Completamente feitos, cada um com número absoluto e porcentagem.

**Architecture:** Mudança confinada a um único componente client-side já existente. A lógica de estatísticas (já roda sobre os arrays completos `naoFeitos`/`feitos`, não os filtrados/paginados) ganha dois novos derivados (`parcial`/`taxaParcial`); a lógica antiga dependente de `isNF` (`comFeitos`, `taxaFeitos`, `metricaAtiva`, `isBom`) é removida por ficar órfã. O JSX dos 3 cards deixa de alternar por `isNF`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, lucide-react.

Spec de referência: `docs/superpowers/specs/2026-07-09-contadores-parciais-completos-design.md`

---

## File Structure

- **Modify** `components/AuditResultTable.tsx` — três regiões: bloco de imports do `lucide-react` (linhas 39-48), lógica de estatísticas (linhas 174-184), JSX dos stat cards (linhas 189-239). Nenhum outro arquivo muda; os cálculos usam dados já recebidos como props (`naoFeitos`, `feitos`), sem tocar em `lib/gerar-auditoria.ts`, `lib/pente-fino.ts` ou no formato de `resultado_json`.

---

### Task 1: Sempre exibir os 3 indicadores (Total, Parcialmente feitos, Completamente feitos)

**Files:**
- Modify: `components/AuditResultTable.tsx:39-48` (imports)
- Modify: `components/AuditResultTable.tsx:174-184` (lógica de estatísticas)
- Modify: `components/AuditResultTable.tsx:189-239` (JSX dos stat cards)

- [ ] **Step 1: Atualizar o bloco de imports do `lucide-react`**

Localize (linhas 39-48 atuais):

```tsx
import {
  Download,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
```

Substitua por (troca `AlertTriangle` por `Clock` — `AlertTriangle` só era usado no card
"Pendências", que este task remove; `Clock` é o novo ícone de "Parcialmente feitos"):

```tsx
import {
  Download,
  Users,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
```

- [ ] **Step 2: Atualizar a lógica de estatísticas**

Localize o bloco "Stats always from full unfiltered data" (linhas 174-184 atuais):

```tsx
  // Stats always from full unfiltered data
  const total = naoFeitos.length
  const comAusencias = naoFeitos.filter((r) => r.totalAusencias > 0).length
  const semAusencias = total - comAusencias
  const taxa = total > 0 ? Math.round((semAusencias / total) * 100) : 0

  const comFeitos = feitos.filter((r) => r.totalFeitos > 0).length
  const taxaFeitos = total > 0 ? Math.round((comFeitos / total) * 100) : 0

  const metricaAtiva = isNF ? taxa : taxaFeitos
  const isBom = metricaAtiva >= 80
```

Substitua por:

```tsx
  // Stats always from full unfiltered data
  const total = naoFeitos.length
  const comAusencias = naoFeitos.filter((r) => r.totalAusencias > 0).length
  const semAusencias = total - comAusencias
  const taxaCompleto = total > 0 ? Math.round((semAusencias / total) * 100) : 0

  const parcial = naoFeitos.filter(
    (r) => r.totalAusencias > 0 && (feitosPorNome.get(r.nomeCompleto) ?? 0) > 0
  ).length
  const taxaParcial = total > 0 ? Math.round((parcial / total) * 100) : 0
```

Notas importantes para quem for implementar:
- `comAusencias` **continua existindo** — não é órfão. É usado no badge da aba "Não feitos"
  mais abaixo no arquivo (`{comAusencias > 0 && (<Badge>...{comAusencias}</Badge>)}`,
  por volta da linha 247-250), que não muda neste task.
- `feitosPorNome` (um `Map<string, number>` de `nomeCompleto` para `totalFeitos`) **já existe**
  na linha 129 do arquivo, construído a partir do array `feitos`, e já está em escopo antes
  deste bloco — não precisa ser criado nem movido.
- `comFeitos`, `taxaFeitos`, `metricaAtiva` e `isBom` são removidos por completo — confirmado
  (via busca no arquivo) que só eram usados dentro do bloco de JSX que o Step 3 substitui.
  Depois deste task, uma busca por esses 4 identificadores no arquivo deve retornar zero
  ocorrências.

- [ ] **Step 3: Atualizar o JSX dos stat cards**

Localize o bloco `{/* Stat cards */}` inteiro (linhas 189-239 atuais):

```tsx
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">alunos</div>
        </div>

        {isNF ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">Pendências</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-destructive">{comAusencias}</div>
            <div className="text-xs text-muted-foreground mt-0.5">com ausências</div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-700">Participaram</span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-green-700">{comFeitos}</div>
            <div className="text-xs text-muted-foreground mt-0.5">com entregas</div>
          </div>
        )}

        <div
          className={`rounded-xl border p-4 text-center ${
            isBom ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <CheckCircle2
              className={`w-3.5 h-3.5 ${isBom ? 'text-green-600' : 'text-amber-600'}`}
            />
            <span className={`text-xs font-medium ${isBom ? 'text-green-700' : 'text-amber-700'}`}>
              {isNF ? 'Cumprimento' : 'Engajamento'}
            </span>
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${isBom ? 'text-green-700' : 'text-amber-700'}`}
          >
            {metricaAtiva}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">dos alunos</div>
        </div>
      </div>
```

Substitua por:

```tsx
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">alunos</div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Parcialmente feitos</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-700">{parcial}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{taxaParcial}% dos alunos</div>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Completamente feitos</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-green-700">{semAusencias}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{taxaCompleto}% dos alunos</div>
        </div>
      </div>
```

Os 3 cards não dependem mais de `isNF` — ficam idênticos independente da aba
("Não feitos"/"Feitos") selecionada. Nada mais no componente muda: filtros, ordenação,
paginação (client-side, `PER_PAGE = 20`), a seção de Tabs + download, e o corpo da tabela
continuam exatamente como estão.

- [ ] **Step 4: Rodar lint**

Run: `npx eslint components/AuditResultTable.tsx`
Expected: sem erros (confirma que não sobrou nenhum import não usado — `AlertTriangle` some,
`Clock` é usado — e que `comFeitos`/`taxaFeitos`/`metricaAtiva`/`isBom` não deixaram
referências soltas).

- [ ] **Step 5: Rodar build**

Run: `npm run build`
Expected: build de produção passa sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add components/AuditResultTable.tsx
git commit -m "feat: exibir contadores de alunos parcialmente/completamente feitos"
```

---

### Task 2: Verificação manual e fechamento

**Files:** nenhum (só verificação; sem alterações de código esperadas nesta task)

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm run test`
Expected: todos os testes passam (este task não adiciona nem modifica nenhum teste — a
lógica alterada é derivada simples sobre arrays já recebidos como props, consistente com o
restante das estatísticas deste mesmo arquivo, que também não são testadas isoladamente).

- [ ] **Step 2: Rodar lint e build do projeto inteiro**

Run: `npm run lint`
Expected: sem erros novos (podem existir avisos/erros pré-existentes em arquivos não tocados
por esta branch — confirme comparando com `git diff develop --stat` que nenhum deles é
`components/AuditResultTable.tsx`).

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Testar manualmente no navegador**

Run: `npm run dev`, logar como admin, abrir o detalhe de uma auditoria que tenha alunos em
pelo menos um dos três estados (nenhum relatório feito, alguns feitos, todos feitos).

Checklist:
- Os 3 cards ("Total", "Parcialmente feitos", "Completamente feitos") aparecem sempre,
  independente de estar na aba "Não feitos" ou "Feitos" — não alternam mais.
- "Parcialmente feitos" mostra um número maior que zero apenas se existir pelo menos um aluno
  com `totalFeitos > 0 && totalAusencias > 0`; a porcentagem embaixo bate com
  `parcial / total` arredondado.
- "Completamente feitos" mostra o mesmo número que a soma de alunos sem nenhuma ausência; a
  cor do card é sempre verde (não fica âmbar mesmo se a porcentagem for baixa).
- "Parcialmente feitos" é sempre âmbar, mesmo que a porcentagem seja alta ou baixa.
- O badge numérico na aba "Não feitos" continua mostrando a contagem de alunos com qualquer
  ausência (não mudou).
- Trocar de aba, filtrar, ordenar ou paginar a tabela não altera os 3 cards (eles usam sempre
  os dados completos, não os filtrados/paginados) — comportamento que já existia antes desta
  mudança e não deve regredir.

- [ ] **Step 4: Se tudo passou, seguir para push + PR**

Use a skill `finishing-a-development-branch` (branch base: `develop`) para dar push e abrir o
PR. Nenhum commit é esperado nesta task a menos que a verificação manual encontre um
problema — nesse caso, corrija, repita os passos 1-3, e só então prossiga.

---

## Fora de escopo (herdado da spec)

- Card/indicador separado para alunos que não fizeram nenhum relatório (`totalFeitos === 0`).
- Mudanças no badge de contagem da aba "Não feitos".
- Mudanças em `lib/gerar-auditoria.ts`, `lib/pente-fino.ts` ou no formato de `resultado_json`.
