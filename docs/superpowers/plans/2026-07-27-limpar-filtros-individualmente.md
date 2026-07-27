# Limpar Filtros Individualmente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users clear the `nome` and `empresa` filters in `AuditResultTable.tsx` individually, via a reusable `ClearableInput` component, without affecting other filters.

**Architecture:** A new presentational component `ClearableInput` wraps the existing `Input` (`components/ui/input.tsx`), adding an absolutely-positioned `X` button that appears only when `value` is non-empty and calls a caller-supplied `onClear()`. `AuditResultTable.tsx` swaps its two plain `<Input>` filter fields (nome, empresa) for `<ClearableInput>`, wiring `onClear` to the existing `handleFilter(key, '')` call. No state shape, filter logic, or the UF combobox change.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind, lucide-react icons, vitest (unit tests for pure logic only — this repo has no jsdom/React Testing Library setup, so component rendering is verified manually, not via automated tests).

---

## Spec reference

Full design: `docs/superpowers/specs/2026-07-27-limpar-filtros-individualmente-design.md`

## Note on testing approach

This repo's existing test suite (`vitest.config.ts`, `environment: 'node'`) only unit-tests pure functions extracted into `-utils.ts`/`lib/*.ts` files (e.g. `components/audit-result-table-utils.ts`, `lib/pagination.ts`). There is no jsdom or React Testing Library configured, so there's no established way to render-test a component in this codebase. `ClearableInput`'s only logic is a one-line visibility predicate (`typeof value === 'string' && value.length > 0`); extracting that into its own tested utility module would be a premature abstraction for a single boolean expression. Per the spec's "Validação" section, this feature is verified manually in the browser (Task 3 below) rather than with automated component tests. Do not add jsdom/RTL as part of this plan — that would be unrelated scope.

---

### Task 1: Create the `ClearableInput` component

**Files:**
- Create: `components/ui/clearable-input.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type ClearableInputProps = React.ComponentProps<typeof Input> & {
  onClear: () => void
}

function ClearableInput({ value, onClear, className, ...props }: ClearableInputProps) {
  const hasValue = typeof value === "string" && value.length > 0

  return (
    <div className="relative">
      <Input
        value={value}
        className={cn(hasValue && "pr-7", className)}
        {...props}
      />
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `components/ui/clearable-input.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/clearable-input.tsx
git commit -m "feat: adicionar componente ClearableInput com botao de limpar individual"
```

---

### Task 2: Use `ClearableInput` for the nome and empresa filters

**Files:**
- Modify: `components/AuditResultTable.tsx:14` (import) and `components/AuditResultTable.tsx:374-385` (filter bar inputs)

- [ ] **Step 1: Add the import**

In `components/AuditResultTable.tsx`, next to the existing `Input` import (line 15):

```tsx
import { Input } from '@/components/ui/input'
import { ClearableInput } from '@/components/ui/clearable-input'
```

- [ ] **Step 2: Replace the nome and empresa inputs**

Replace this block (current lines 374-385):

```tsx
        <Input
          placeholder="Filtrar por nome..."
          value={filters.nome}
          onChange={(e) => handleFilter('nome', e.target.value)}
          className="h-8 w-52 text-sm"
        />
        <Input
          placeholder="Empresa..."
          value={filters.empresa}
          onChange={(e) => handleFilter('empresa', e.target.value)}
          className="h-8 w-48 text-sm"
        />
```

with:

```tsx
        <ClearableInput
          placeholder="Filtrar por nome..."
          value={filters.nome}
          onChange={(e) => handleFilter('nome', e.target.value)}
          onClear={() => handleFilter('nome', '')}
          className="h-8 w-52 text-sm"
        />
        <ClearableInput
          placeholder="Empresa..."
          value={filters.empresa}
          onChange={(e) => handleFilter('empresa', e.target.value)}
          onClear={() => handleFilter('empresa', '')}
          className="h-8 w-48 text-sm"
        />
```

These were the only two `<Input` usages in this file (confirmed via grep), so `Input` becomes unused here after the replacement.

- [ ] **Step 2b: Remove the now-unused `Input` import**

`components/AuditResultTable.tsx` no longer references `Input` directly (only `ClearableInput` does, in its own file). Remove the import line:

```tsx
import { Input } from '@/components/ui/input'
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no unused-import warnings for `Input` in `components/AuditResultTable.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/AuditResultTable.tsx
git commit -m "feat: permitir limpar filtros de nome e empresa individualmente"
```

---

### Task 3: Manual verification in the browser

Use the `run` skill to start the dev server and exercise the audit result table with filters (any auditoria with results works; if none is at hand, seed one via the existing app flow).

- [ ] **Step 1: Start the app**

Use the `run` skill (or `npm run dev` if no project-specific run skill applies) and navigate to an auditoria results page that renders `AuditResultTable`.

- [ ] **Step 2: Verify the X appears/disappears correctly**

- Type into "Filtrar por nome...": confirm an `X` appears at the right edge of that input, and NOT in the empresa input.
- Clear the nome field with the `X`: confirm the field empties and the table updates (shows all rows again, modulo other active filters), and the empresa/UF filters are untouched.
- Repeat the same for "Empresa...".
- Type in both nome and empresa: confirm each has its own `X`, and clearing one leaves the other's text and its own `X` intact.

- [ ] **Step 3: Verify UF is unaffected**

- Select one or more UFs in the combobox: confirm each selected UF still shows as a chip with its own remove `X` (existing `ComboboxChip` behavior, unchanged by this work).
- Confirm there is no new "clear all UFs" button — this is intentionally out of scope per the spec.

- [ ] **Step 4: Verify combined behavior with the general "Limpar" button**

- With nome, UF and empresa all filled in, confirm the general "Limpar" button (with the `X` icon and "Limpar" text) still appears and clears all three at once.
- Confirm the "`{totalRows} de {base.length} alunos`" counter next to it appears/disappears correctly as filters are added and removed in different orders (1 filter, then 2, then 3, then back down via individual clears).

- [ ] **Step 5: Report result**

Note in the session whether all checks in Steps 2-4 passed. If any failed, fix `components/ui/clearable-input.tsx` or the integration in `components/AuditResultTable.tsx` and re-verify before moving on — do not report success without having actually observed the behavior in the browser.

---

## Self-review notes

- **Spec coverage:** "Componente ClearableInput" → Task 1. "Integração em AuditResultTable.tsx" → Task 2. "Validação" (1/2/3 filtros, ordens diferentes, contador, botão geral) → Task 3. "Fora de escopo" (UF clear-all, general Limpar button, cross-screen abstraction) → explicitly called out as untouched in Task 2/3 and covered by the testing-approach note.
- **No placeholders:** every step has literal code/commands, no "add tests for the above" or "TBD".
- **Type consistency:** `ClearableInput` props (`value`, `onClear`, `className`, rest spread) match exactly between Task 1's definition and Task 2's usage.
