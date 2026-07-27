# Unificar Numeração de Relatórios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant `semana` field (e.g. "Semana 3") from the whole system — generation, storage, queries, display, and the database column — leaving `nome` ("Relatório 3") as the single source of truth for report numbering.

**Architecture:** `semana` is generated in one Server Action (`app/(protected)/relatorios/actions.ts`) as a mirror of `nome` (same sequential number, different prefix), then flows through two independent read paths: the `/relatorios` management screen (`app/(protected)/relatorios/page.tsx` → `components/RelatoriosList.tsx`) and the auditoria detail screen (`app/(protected)/auditorias/[id]/page.tsx` → `components/RelatoriosIncluidosCard.tsx`). Each path gets `semana` stripped from its Supabase `select`, its TypeScript type, and its JSX. The database column is dropped last, in its own migration file — written locally in this plan, but **applied to the live database as a manual, human-confirmed step outside of subagent execution** (see "Database migration" section below for why).

**Tech Stack:** Next.js (App Router, Server Actions), Supabase (Postgres), TypeScript, Tailwind, vitest (no automated tests touch this surface — see Task 5).

---

## Spec reference

Full design: `docs/superpowers/specs/2026-07-27-unificar-numeracao-relatorios-design.md`

## Important: no Supabase MCP/CLI available in this environment right now

Earlier work on this codebase (see `docs/superpowers/plans/2026-07-14-identificador-unico-cruzamento.md`) applied a migration via `mcp__claude_ai_Supabase__apply_migration` and related MCP tools. **Those tools are not connected in this session** (verified via `ToolSearch` — no `mcp__claude_ai_Supabase__*` tools resolve), and the Supabase CLI is not installed locally either (`supabase --version` → command not found). Do not assume either becomes available mid-plan without re-checking.

Because of this — and because schema changes on a shared production database are hard-to-reverse — **no task in this plan applies any migration to the live database**. Tasks 4a and 4b (below) only write SQL files locally. Applying them is called out as an explicit manual step at the end of this plan (see "Applying the migrations" section), to be done by the human directly (Supabase dashboard SQL editor) or by the controller only after re-confirming a migration tool is available AND getting the user's explicit go-ahead at that moment — not as an automatic consequence of "the plan says to."

## Critical deployment-ordering issue (found during Task 1 code review, fixed in this plan)

`relatorios.semana` is `NOT NULL` in the live database today, with no default. Task 1 makes the Server Action stop supplying `semana` on insert. **Deployed by itself, with no DB change, this breaks every report upload** (`insert` violates the `NOT NULL` constraint) until a human relaxes or drops the constraint. Conversely, dropping the column before the code stops referencing it would break selects/inserts the other way. Neither ordering is safe on its own — this needs the standard **expand/contract** two-migration pattern:

- **Expand (Task 4a, do this first, independent of code deploy):** `alter table relatorios alter column semana drop not null;` — safe in any order relative to the code deploy, reversible, low-risk. This must be applied (manually, per the tooling caveat above) **before or immediately as** Task 1's code ships, not "whenever convenient" — otherwise production report uploads break in the gap.
- **Contract (Task 4b, only after Task 1-3's code is confirmed live):** `alter table relatorios drop column semana;` — the original Task 4, unchanged, still deliberately manual and deferred.

See "Applying the migrations" at the end of this plan for the full ordering.

---

### Task 1: Remove `semana` from the Server Action

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts:77-125` (inside `adicionarRelatorios`)

- [ ] **Step 1: Remove `semana` generation, insert, and log field**

In `app/(protected)/relatorios/actions.ts`, replace this block (current lines 77-125):

```ts
    for (const arquivo of arquivos) {
      const nome = `Relatório ${proximoNumero}`
      const semana = `Semana ${proximoNumero}`

      try {
        const texto = await arquivo.text()
        if (!planilhaTemColuna(texto, idColuna)) {
          falhas.push({
            nome: arquivo.name,
            erro: `Coluna de identificador "${idColuna}" ausente.`,
          })
          continue
        }

        const relatorioId = crypto.randomUUID()
        const storagePath = `${relatorioId}/arquivo.csv`

        const { error: uploadError } = await supabase.storage
          .from('relatorios')
          .upload(storagePath, arquivo, { upsert: true })

        if (uploadError) {
          falhas.push({ nome: arquivo.name, erro: `Erro no upload: ${uploadError.message}` })
          continue
        }

        const { error: insertError } = await supabase.from('relatorios').insert({
          id: relatorioId,
          nome,
          semana,
          storage_path: storagePath,
          user_id: user.id,
        })

        if (insertError) {
          falhas.push({ nome: arquivo.name, erro: `Erro ao registrar: ${insertError.message}` })
          continue
        }

        await registrarLog({
          userId: user.id,
          userEmail: user.email!,
          action: 'relatorio.adicionar',
          target: relatorioId,
          details: { nome, semana },
        })

        sucesso.push({ id: relatorioId, nome })
        proximoNumero++
      } catch (e) {
        falhas.push({
          nome: arquivo.name,
          erro: e instanceof Error ? e.message : 'Erro desconhecido',
        })
      }
    }
```

with:

```ts
    for (const arquivo of arquivos) {
      const nome = `Relatório ${proximoNumero}`

      try {
        const texto = await arquivo.text()
        if (!planilhaTemColuna(texto, idColuna)) {
          falhas.push({
            nome: arquivo.name,
            erro: `Coluna de identificador "${idColuna}" ausente.`,
          })
          continue
        }

        const relatorioId = crypto.randomUUID()
        const storagePath = `${relatorioId}/arquivo.csv`

        const { error: uploadError } = await supabase.storage
          .from('relatorios')
          .upload(storagePath, arquivo, { upsert: true })

        if (uploadError) {
          falhas.push({ nome: arquivo.name, erro: `Erro no upload: ${uploadError.message}` })
          continue
        }

        const { error: insertError } = await supabase.from('relatorios').insert({
          id: relatorioId,
          nome,
          storage_path: storagePath,
          user_id: user.id,
        })

        if (insertError) {
          falhas.push({ nome: arquivo.name, erro: `Erro ao registrar: ${insertError.message}` })
          continue
        }

        await registrarLog({
          userId: user.id,
          userEmail: user.email!,
          action: 'relatorio.adicionar',
          target: relatorioId,
          details: { nome },
        })

        sucesso.push({ id: relatorioId, nome })
        proximoNumero++
      } catch (e) {
        falhas.push({
          nome: arquivo.name,
          erro: e instanceof Error ? e.message : 'Erro desconhecido',
        })
      }
    }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: remover geracao e gravacao de semana ao adicionar relatorio"
```

---

### Task 2: Remove `semana` from the `/relatorios` list screen

**Files:**
- Modify: `app/(protected)/relatorios/page.tsx:26`
- Modify: `components/RelatoriosList.tsx:22-27` (type) and `:186-203` (JSX)

- [ ] **Step 1: Drop `semana` from the query**

In `app/(protected)/relatorios/page.tsx`, replace:

```ts
    .select('id, nome, semana, created_at')
```

with:

```ts
    .select('id, nome, created_at')
```

- [ ] **Step 2: Drop `semana` from the `Relatorio` type**

In `components/RelatoriosList.tsx`, replace:

```tsx
type Relatorio = {
  id: string
  nome: string
  semana: string
  created_at: string
}
```

with:

```tsx
type Relatorio = {
  id: string
  nome: string
  created_at: string
}
```

- [ ] **Step 3: Remove the semana badge from the list item**

In `components/RelatoriosList.tsx`, replace this block (current lines 186-203):

```tsx
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.nome}</p>
                <div className="flex gap-2 mt-1 items-center">
                  <Badge variant="secondary" className="text-xs px-2 py-0">
                    {r.semana}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
```

with:

```tsx
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.nome}</p>
                <div className="mt-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
```

- [ ] **Step 4: Remove the now-unused `Badge` import**

`Badge` (imported at `components/RelatoriosList.tsx:17`, `import { Badge } from '@/components/ui/badge'`) has exactly one usage in this file — the block just removed in Step 3 (confirmed via grep before writing this plan). Remove the import line.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new issues in `app/(protected)/relatorios/page.tsx` or `components/RelatoriosList.tsx` (pre-existing issues in unrelated files don't count — compare against `develop` if anything looks ambiguous).

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/relatorios/page.tsx" components/RelatoriosList.tsx
git commit -m "feat: remover semana da tela de listagem de relatorios"
```

---

### Task 3: Remove `semana` from the auditoria detail screen

**Files:**
- Modify: `app/(protected)/auditorias/[id]/page.tsx:49`
- Modify: `components/RelatoriosIncluidosCard.tsx:8-12` (type) and `:36-46` (JSX)

- [ ] **Step 1: Drop `semana` from the query**

In `app/(protected)/auditorias/[id]/page.tsx`, replace:

```ts
    .select('id, nome, semana')
```

with:

```ts
    .select('id, nome')
```

- [ ] **Step 2: Drop `semana` from the `Relatorio` type**

In `components/RelatoriosIncluidosCard.tsx`, replace:

```tsx
type Relatorio = {
  id: string
  nome: string
  semana: string
}
```

with:

```tsx
type Relatorio = {
  id: string
  nome: string
}
```

- [ ] **Step 3: Remove the semana span and its divider**

In `components/RelatoriosIncluidosCard.tsx`, replace this block (current lines 36-46):

```tsx
            {relatorios.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">{r.nome}</span>
                <span className="w-px h-3 bg-border" />
                <span className="text-xs text-muted-foreground">{r.semana}</span>
              </div>
            ))}
```

with:

```tsx
            {relatorios.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">{r.nome}</span>
              </div>
            ))}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new issues in `app/(protected)/auditorias/[id]/page.tsx` or `components/RelatoriosIncluidosCard.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/auditorias/[id]/page.tsx" components/RelatoriosIncluidosCard.tsx
git commit -m "feat: remover semana do card de relatorios incluidos na auditoria"
```

---

### Task 4a: Write the "expand" migration file (relax NOT NULL — local file only, do not apply)

**Files:**
- Create: `supabase/migrations/<timestamp_a>_relax_semana_not_null_in_relatorios.sql`

This migration must exist and — per the "Applying the migrations" section — be applied to the live database before or immediately as Task 1's code ships, to avoid breaking report uploads. See "Critical deployment-ordering issue" above for why.

- [ ] **Step 1: Determine the timestamp prefix**

Supabase migration filenames use a `YYYYMMDDHHMMSS` prefix. Look at the most recent file in `supabase/migrations/` (currently `20260722163959_add_revoke_user_sessions_function.sql`) and pick a new timestamp later than that one, matching today's date at the time this task is executed (format: `YYYYMMDDHHMMSS`, e.g. `20260727143000`). Call it `<timestamp_a>`.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/<timestamp_a>_relax_semana_not_null_in_relatorios.sql`:

```sql
alter table relatorios alter column semana drop not null;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "docs: adicionar migration para tornar semana nullable em relatorios"
```

**Do NOT run this SQL against any database in this task.** This task only creates the local file. See "Applying the migrations" below — this one specifically needs to be applied before/with Task 1's code deploy, not "whenever convenient."

---

### Task 4b: Write the "contract" migration file (drop column — local file only, do not apply)

**Files:**
- Create: `supabase/migrations/<timestamp_b>_drop_semana_from_relatorios.sql`

- [ ] **Step 1: Determine the timestamp prefix**

Pick a timestamp later than `<timestamp_a>` from Task 4a (format: `YYYYMMDDHHMMSS`). Call it `<timestamp_b>`.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/<timestamp_b>_drop_semana_from_relatorios.sql`:

```sql
alter table relatorios drop column semana;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "docs: adicionar migration para remover coluna semana de relatorios"
```

**Do NOT run this SQL against any database in this task.** This is the final "contract" step — it must only be applied after Tasks 1-3's code is confirmed live in production (no code anywhere, including any in-flight old instance during a rolling deploy, still references `semana`). See "Applying the migrations" below.

---

### Task 5: Manual verification in the browser

- [ ] **Step 1: Start the app**

Use the `run` skill if available, or `npm run dev`, and log in as an admin (this feature is admin-only per `verificarAdmin()` in `actions.ts` and the `role !== 'admin'` redirect in `relatorios/page.tsx`).

- [ ] **Step 2: Verify `/relatorios`**

- Navigate to `/relatorios`.
- Confirm existing relatórios in the list show name + date, with no "Semana X" badge.
- Upload a new CSV report. Confirm it's added successfully, appears in the list with a name like "Relatório N" and a date, no semana badge, and no console/server errors.

- [ ] **Step 3: Verify the auditoria detail screen**

- Navigate to `/auditorias` and open any existing auditoria's detail page (or generate a new one via "Gerar auditoria" after the upload in Step 2).
- Expand the "Relatórios incluídos" card. Confirm each entry shows only the report name (e.g. "Relatório 3"), with no divider or "Semana X" text after it.

- [ ] **Step 4: Confirm no runtime errors**

Check the terminal running `npm run dev` and the browser console for any errors related to the `semana` column. If Task 4a's "expand" migration (`alter column semana drop not null`) has already been applied to the database this dev environment points at, uploads should succeed cleanly. If it has NOT been applied yet, uploading a new report in Step 2 will fail with a `null value in column "semana"` error from Postgres — that's the exact deployment-ordering hazard described earlier in this plan, not a bug in this code. If you hit that error, stop and get the Task 4a migration applied (see "Applying the migrations" below) before re-testing, rather than treating it as a Task 1-3 code defect.

- [ ] **Step 5: Report result**

Note whether all checks in Steps 2-4 passed. Do not report success without having actually observed the behavior in the browser.

---

## Applying the migrations (manual step, outside subagent execution)

This is **not** a task for an implementer subagent, and it's **two separate actions at two separate times**, not one:

**1. Task 4a's migration (`alter column semana drop not null`) — apply this FIRST, before or immediately as Tasks 1-3's code ships.** This is what prevents the "every upload fails" hazard described above. It's low-risk and reversible (as long as no row has `NULL` in `semana` at the time, `alter column semana set not null` reverts it). Options, in order of preference:
   - **The user applies it directly** via the Supabase dashboard's SQL editor for project `chuppzvaanyasljuknen` (org `aponti-pente-fino`).
   - **The controller applies it**, only if a Supabase MCP tool or the CLI becomes available, after confirming the correct project and getting explicit go-ahead at that moment.

**2. Task 4b's migration (`drop column semana`) — apply this LAST, only after Tasks 1-3's code has been live in production for a while and confirmed working**, with no old code instance still running anywhere that might reference `semana`. Same application options as above. This one is irreversible — the design doc confirms no real data loss occurs (the column is fully redundant with `nome`), but "no data loss in theory" is not the same bar as "safe to run unattended."

**Do not apply Task 4b before Task 4a, and do not apply Task 4b before the code deploy is confirmed.** Applying them out of order reintroduces exactly the breakage this plan update was written to avoid.

---

## Self-review notes

- **Spec coverage:** actions.ts changes → Task 1. `/relatorios` query + list display → Task 2. Auditoria detail query + card display → Task 3. Expand migration (relax NOT NULL) → Task 4a. Contract migration (drop column) → Task 4b. Manual validation from the spec's "Validação" section → Task 5 + the "Applying the migrations" section. "Fora de escopo" (README/CHANGELOG/tests wording) → correctly untouched, no task references them.
- **No placeholders:** every step has literal code or exact commands; the only "TBD"-shaped items (the two migration timestamps) are mechanical, well-defined lookups (pick a value later than the last existing file / than Task 4a's), not unresolved design questions.
- **Type consistency:** `Relatorio` type in `RelatoriosList.tsx` (Task 2) and in `RelatoriosIncluidosCard.tsx` (Task 3) both drop `semana` independently — they're separate local types in separate files, not shared, so no cross-task inconsistency risk.
- **Ordering (revised after Task 1 code review found a critical gap):** the original single-migration plan only protected against one direction of the deploy/migration race (code outliving the column) and missed the other (column still `NOT NULL` outliving the code's insert). Task 4a now closes that gap as a mandatory, low-risk, early step; Task 4b remains the deliberate, deferred, irreversible one. Task 5's Step 4 explicitly tells whoever verifies manually what to expect if Task 4a hasn't been applied yet, so a real deployment-ordering failure isn't mistaken for a Task 1-3 code bug.
