# Separar "anexar relatório" de "gerar auditoria" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop auto-generating an auditoria as a side-effect of anexar/excluir relatório; make it an explicit user choice via confirmation dialog, plus a standalone "Gerar auditoria" button.

**Architecture:** `adicionarRelatorio` and `deletarRelatorio` server actions ([app/(protected)/relatorios/actions.ts](../../../app/(protected)/relatorios/actions.ts)) stop calling `gerarAuditoria`. A new server action `gerarAuditoriaManual` wraps `gerarAuditoria` and is called from three UI entry points: a confirmation dialog after upload, a confirmation dialog after delete, and a standalone button. The `auditorias.trigger_type` column gets a third allowed value, `'manual'`, requiring a DB constraint migration.

**Tech Stack:** Next.js Server Actions, Supabase (Postgres + Storage), React (`useActionState`, `useTransition`), Base UI `AlertDialog`, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-01-separar-anexar-relatorio-gerar-auditoria-design.md](../specs/2026-07-01-separar-anexar-relatorio-gerar-auditoria-design.md)

**Confirmed during planning (via Supabase MCP against project `chuppzvaanyasljuknen`):**
- `auditorias_trigger_type_check` constraint currently: `CHECK ((trigger_type = ANY (ARRAY['add'::text, 'delete'::text])))` — must be updated to include `'manual'`.
- `relatorio_trigger_id` is already nullable — no change needed there.
- The project has no test harness for React components or server actions (no `@testing-library/react`, Vitest env is `node`). Existing tests only cover pure functions in `lib/pente-fino.ts`. This plan follows that pattern: pure-logic changes get Vitest coverage where there's logic to test; UI/server-action wiring is verified manually via the dev server (Task 11), consistent with how this codebase already tests itself.

---

### Task 1: Migration — allow `'manual'` trigger_type

**What:** Update the CHECK constraint on `public.auditorias.trigger_type` to allow `'manual'` in addition to `'add'` and `'delete'`.

- [ ] **Step 1: Apply the migration via the Supabase MCP `apply_migration` tool**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "chuppzvaanyasljuknen"` and:

```sql
alter table public.auditorias
  drop constraint auditorias_trigger_type_check;

alter table public.auditorias
  add constraint auditorias_trigger_type_check
  check (trigger_type = any (array['add'::text, 'delete'::text, 'manual'::text]));
```

- [ ] **Step 2: Verify the constraint**

Call `mcp__claude_ai_Supabase__execute_sql` with the same `project_id` and:

```sql
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.auditorias'::regclass
  and conname = 'auditorias_trigger_type_check';
```

Expected: `def` contains `'manual'::text` alongside `'add'::text` and `'delete'::text`.

No git commit for this step (it's a remote DB change, not a file change).

---

### Task 2: Widen `gerarAuditoria` trigger type

**Files:**
- Modify: `lib/gerar-auditoria.ts:12-16`

- [ ] **Step 1: Update the function signature**

In `lib/gerar-auditoria.ts`, change:

```ts
export async function gerarAuditoria(
  triggerType: 'add' | 'delete',
  relatorioTriggerId: string,
  supabase: SupabaseClient
): Promise<void> {
```

to:

```ts
export async function gerarAuditoria(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null,
  supabase: SupabaseClient
): Promise<void> {
```

No other changes in this file — the two `supabase.from('auditorias').insert({ trigger_type: triggerType, relatorio_trigger_id: relatorioTriggerId, ... })` calls (lines ~44-49 and ~122-130) already pass these through untouched, and the column already accepts `null`.

- [ ] **Step 2: Type-check**

Run: `npm run build` (or `npx tsc --noEmit` if faster) and confirm no new type errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/gerar-auditoria.ts
git commit -m "feat: permitir trigger_type manual em gerarAuditoria"
```

---

### Task 3: Decouple `adicionarRelatorio` from auditoria generation

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts:1-62`

- [ ] **Step 1: Remove the automatic `gerarAuditoria` call and return the new relatório id**

Replace the whole file's top section (imports + `ActionState` + `adicionarRelatorio`) with:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarAuditoria } from '@/lib/gerar-auditoria'

async function verificarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    throw new Error('Acesso negado: apenas administradores')
  }
  return user
}

type ActionState = { error?: string; success?: boolean; relatorioId?: string } | null

export async function adicionarRelatorio(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await verificarAdmin()
    const supabase = await createClient()

    const nome = formData.get('nome') as string
    const semana = formData.get('semana') as string
    const arquivo = formData.get('arquivo') as File

    if (!nome || !semana) return { error: 'Preencha nome e semana.' }
    if (!arquivo || arquivo.size === 0) return { error: 'Selecione um arquivo CSV.' }

    const relatorioId = crypto.randomUUID()
    const storagePath = `${relatorioId}/arquivo.csv`

    const { error: uploadError } = await supabase.storage
      .from('relatorios')
      .upload(storagePath, arquivo, { upsert: true })

    if (uploadError) return { error: `Erro no upload: ${uploadError.message}` }

    const { error: insertError } = await supabase.from('relatorios').insert({
      id: relatorioId,
      nome,
      semana,
      storage_path: storagePath,
      user_id: user.id,
    })

    if (insertError) return { error: `Erro ao registrar: ${insertError.message}` }

    revalidatePath('/relatorios')
    return { success: true, relatorioId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

Note: `gerarAuditoria` import stays in this file because `deletarRelatorio` (Task 4) and `gerarAuditoriaManual` (Task 5) still live here and still use it.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: `components/AdicionarRelatorioForm.tsx` will show a type error referencing `state.success` text — that's expected and gets fixed in Task 6. No errors should come from `actions.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: anexar relatorio nao gera auditoria automaticamente"
```

---

### Task 4: Decouple `deletarRelatorio` from auditoria generation

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts` (the `deletarRelatorio` function, currently lines 64-79 before Task 3's edit)

- [ ] **Step 1: Remove the automatic `gerarAuditoria` call**

Replace the current `deletarRelatorio` function:

```ts
export async function deletarRelatorio(relatorioId: string) {
  await verificarAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('relatorios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relatorioId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  await gerarAuditoria('delete', relatorioId, supabase)

  revalidatePath('/relatorios')
  revalidatePath('/auditorias')
}
```

with:

```ts
export async function deletarRelatorio(relatorioId: string) {
  await verificarAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('relatorios')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relatorioId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  revalidatePath('/relatorios')
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: excluir relatorio nao gera auditoria automaticamente"
```

---

### Task 5: Add `gerarAuditoriaManual` server action

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts` (append new export)

- [ ] **Step 1: Add the action**

Append to the end of `app/(protected)/relatorios/actions.ts`:

```ts
export async function gerarAuditoriaManual(
  triggerType: 'add' | 'delete' | 'manual',
  relatorioTriggerId: string | null
): Promise<{ error?: string; success?: boolean }> {
  try {
    await verificarAdmin()
    const supabase = await createClient()

    await gerarAuditoria(triggerType, relatorioTriggerId, supabase)

    revalidatePath('/relatorios')
    revalidatePath('/auditorias')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "feat: adicionar action gerarAuditoriaManual"
```

---

### Task 6: Confirmation dialog after anexar relatório

**Files:**
- Modify: `components/AdicionarRelatorioForm.tsx`

- [ ] **Step 1: Replace the component to add the confirmation dialog**

Replace the full contents of `components/AdicionarRelatorioForm.tsx` with:

```tsx
'use client'

import { useActionState, useRef, useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UploadCloud, FileCheck2, AlertCircle, Loader2 } from 'lucide-react'
import { adicionarRelatorio, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function AdicionarRelatorioForm() {
  const [state, action, pending] = useActionState(adicionarRelatorio, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [showGerarDialog, setShowGerarDialog] = useState(false)
  const [gerarError, setGerarError] = useState<string | null>(null)
  const [gerando, startGerarTransition] = useTransition()

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setFileName(null)
      setGerarError(null)
      setShowGerarDialog(true)
    }
  }, [state?.success])

  function handleGerarAuditoria() {
    if (!state?.relatorioId) return
    startGerarTransition(async () => {
      const res = await gerarAuditoriaManual('add', state.relatorioId!)
      if (res.error) {
        setGerarError(res.error)
        return
      }
      setShowGerarDialog(false)
    })
  }

  return (
    <>
      <form ref={formRef} action={action} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do relatório</Label>
            <Input
              id="nome"
              name="nome"
              required
              placeholder="ex: Relatório 1"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="semana">Semana</Label>
            <Input
              id="semana"
              name="semana"
              required
              placeholder="ex: Semana 1"
              disabled={pending}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Arquivo CSV (exportado do Moodle)</Label>
          <label
            htmlFor="arquivo-rel"
            className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-8 px-4 text-center
              ${pending ? 'opacity-50 cursor-not-allowed' : ''}
              ${fileName
                ? 'border-primary/50 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-primary/3'
              }`}
          >
            {fileName ? (
              <>
                <FileCheck2 className="w-7 h-7 text-primary mb-2" />
                <span className="text-sm font-medium text-primary truncate max-w-full px-4">
                  {fileName}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Clique para trocar o arquivo
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">
                  Clique para selecionar um arquivo
                </span>
                <span className="text-xs text-muted-foreground mt-1">CSV exportado do Moodle</span>
              </>
            )}
          </label>
          <Input
            id="arquivo-rel"
            name="arquivo"
            type="file"
            accept=".csv"
            required
            disabled={pending}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>

        {state?.error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              Adicionar relatório
            </>
          )}
        </Button>
      </form>

      <AlertDialog
        open={showGerarDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowGerarDialog(false)
            setGerarError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relatório anexado</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório foi anexado com sucesso. Deseja gerar a auditoria agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {gerarError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {gerarError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarAuditoria} disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, sign in as an admin user, go to `/relatorios`, upload a CSV. Confirm:
- The button says "Adicionar relatório" (not "...e gerar auditoria") before submit.
- After a successful upload, the dialog "Relatório anexado" opens automatically.
- Clicking "Cancelar" closes the dialog without creating a new row in `auditorias` (check `/auditorias` list did not grow).
- Clicking "Gerar auditoria" shows "Gerando...", then closes the dialog and a new entry appears in `/auditorias`.

- [ ] **Step 4: Commit**

```bash
git add components/AdicionarRelatorioForm.tsx
git commit -m "feat: perguntar antes de gerar auditoria ao anexar relatorio"
```

---

### Task 7: Confirmation dialog after excluir relatório

**Files:**
- Modify: `components/RelatoriosList.tsx`

- [ ] **Step 1: Add a second, controlled `AlertDialog` chained after delete**

Replace the full contents of `components/RelatoriosList.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, InboxIcon, AlertCircle } from 'lucide-react'
import { deletarRelatorio, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

type Relatorio = {
  id: string
  nome: string
  semana: string
  created_at: string
}

export function RelatoriosList({ relatorios }: { relatorios: Relatorio[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [relatorioExcluidoId, setRelatorioExcluidoId] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [gerarError, setGerarError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deletarRelatorio(id)
      setGerarError(null)
      setRelatorioExcluidoId(id)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleGerarAuditoria() {
    if (!relatorioExcluidoId) return
    setGerando(true)
    try {
      const res = await gerarAuditoriaManual('delete', relatorioExcluidoId)
      if (res.error) {
        setGerarError(res.error)
        return
      }
      setRelatorioExcluidoId(null)
    } finally {
      setGerando(false)
    }
  }

  if (!relatorios.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center mb-3">
          <InboxIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">Nenhum relatório adicionado</p>
        <p className="text-muted-foreground text-xs mt-1">
          Faça upload do CSV exportado do Moodle acima.
        </p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-2">
        {relatorios.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.nome}</p>
                <div className="flex gap-2 mt-1 items-center">
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-0"
                  >
                    {r.semana}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0 ml-2"
                />
              }>
                <Trash2 className="w-3.5 h-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai remover <strong>{r.nome}</strong>. Esta ação não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingId === r.id ? 'Deletando...' : 'Confirmar exclusão'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={relatorioExcluidoId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRelatorioExcluidoId(null)
            setGerarError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relatório excluído</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório foi excluído. Deseja gerar a auditoria agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {gerarError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {gerarError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarAuditoria} disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With `npm run dev` running, go to `/relatorios`, delete a relatório. Confirm:
- "Confirmar exclusão" dialog behaves as before.
- After confirming, that dialog closes and the "Relatório excluído" dialog opens.
- "Cancelar" closes it without a new `/auditorias` entry; "Gerar auditoria" creates one.

- [ ] **Step 4: Commit**

```bash
git add components/RelatoriosList.tsx
git commit -m "feat: perguntar antes de gerar auditoria ao excluir relatorio"
```

---

### Task 8: Standalone "Gerar auditoria" button + page copy update

**Files:**
- Create: `components/GerarAuditoriaButton.tsx`
- Modify: `app/(protected)/relatorios/page.tsx:42-53` (card copy) and `:55-61` (card header, to add the button)

- [ ] **Step 1: Create the button component**

Create `components/GerarAuditoriaButton.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react'
import { gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function GerarAuditoriaButton() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await gerarAuditoriaManual('manual', null)
      setResult(res)
    })
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={pending} className="gap-1.5">
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ClipboardList className="w-3.5 h-3.5" />
        )}
        Gerar auditoria
      </Button>
      {result?.error && (
        <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/8 border border-destructive/20 px-2.5 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {result.error}
        </div>
      )}
      {result?.success && (
        <div className="flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 px-2.5 py-2 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Auditoria gerada com sucesso.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the page and update copy**

In `app/(protected)/relatorios/page.tsx`, change the import section to add:

```ts
import { GerarAuditoriaButton } from '@/components/GerarAuditoriaButton'
```

Change the "Adicionar relatório" card description from:

```tsx
          <CardDescription>
            Faça upload do CSV exportado do Moodle. Uma nova auditoria será gerada
            automaticamente.
          </CardDescription>
```

to:

```tsx
          <CardDescription>
            Faça upload do CSV exportado do Moodle. Depois de anexado, você poderá optar
            por gerar uma nova auditoria.
          </CardDescription>
```

Change the "Relatórios ativos" card header from:

```tsx
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Relatórios ativos</CardTitle>
          <CardDescription>
            {relatorios?.length ?? 0} relatório(s) incluídos na próxima auditoria
          </CardDescription>
        </CardHeader>
```

to:

```tsx
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Relatórios ativos</CardTitle>
            <CardDescription>
              {relatorios?.length ?? 0} relatório(s) incluídos na próxima auditoria
            </CardDescription>
          </div>
          <GerarAuditoriaButton />
        </CardHeader>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

On `/relatorios`, confirm the "Gerar auditoria" button appears next to "Relatórios ativos", and clicking it (with at least one active relatório and a planilha geral uploaded in `/configuracoes`) creates a new `/auditorias` entry and shows the green success message.

- [ ] **Step 5: Commit**

```bash
git add components/GerarAuditoriaButton.tsx "app/(protected)/relatorios/page.tsx"
git commit -m "feat: adicionar botao fixo para gerar auditoria manualmente"
```

---

### Task 9: Show `'manual'` trigger_type in the auditorias list

**Files:**
- Modify: `components/AuditoriasList.tsx`

- [ ] **Step 1: Replace the two-way `isAdd` branch with a three-way lookup**

Replace the top of `components/AuditoriasList.tsx` (imports + type + the `isAdd` line and the icon/badge JSX) — full new file contents:

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, PlusCircle, MinusCircle, ClipboardList } from 'lucide-react'

type Auditoria = {
  id: string
  created_at: string
  trigger_type: 'add' | 'delete' | 'manual'
  relatorios_incluidos: string[]
}

const TRIGGER_INFO = {
  add: {
    label: 'adição',
    icon: PlusCircle,
    iconClass: 'bg-primary/10 text-primary',
    badgeClass: 'border-primary/30 text-primary bg-primary/5',
  },
  delete: {
    label: 'exclusão',
    icon: MinusCircle,
    iconClass: 'bg-destructive/10 text-destructive',
    badgeClass: 'border-destructive/30 text-destructive bg-destructive/5',
  },
  manual: {
    label: 'manual',
    icon: ClipboardList,
    iconClass: 'bg-muted text-muted-foreground',
    badgeClass: 'border-border text-muted-foreground bg-muted/50',
  },
} as const

export function AuditoriasList({ auditorias }: { auditorias: Auditoria[] }) {
  if (!auditorias.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <ClipboardList className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">Nenhuma auditoria ainda</p>
        <p className="text-muted-foreground text-xs mt-1">
          Adicione relatórios em{' '}
          <Link href="/relatorios" className="text-primary underline-offset-2 hover:underline">
            Relatórios
          </Link>{' '}
          para gerar a primeira auditoria.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {auditorias.map((a, idx) => {
        const info = TRIGGER_INFO[a.trigger_type]
        const Icon = info.icon
        return (
          <li key={a.id}>
            <Link
              href={`/auditorias/${a.id}`}
              className="group flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${info.iconClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div>
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">
                    Auditoria #{auditorias.length - idx}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(a.created_at).toLocaleString('pt-BR')} ·{' '}
                    {a.relatorios_incluidos.length} relatório(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs border ${info.badgeClass}`}>
                  {info.label}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AuditoriasList.tsx
git commit -m "feat: exibir trigger_type manual na lista de auditorias"
```

---

### Task 10: Show `'manual'` trigger_type on the auditoria detail page

**Files:**
- Modify: `app/(protected)/auditorias/[id]/page.tsx:1-102`

- [ ] **Step 1: Replace the `isAdd`-based hero section with the same three-way lookup**

Change the imports (line 8) from:

```tsx
import { ArrowLeft, PlusCircle, MinusCircle, Calendar, FileText } from 'lucide-react'
```

to:

```tsx
import { ArrowLeft, PlusCircle, MinusCircle, ClipboardList, Calendar, FileText } from 'lucide-react'
```

Add this constant right after the `Resultado` type definition (after line 25):

```ts
const TRIGGER_INFO = {
  add: {
    label: 'adição',
    icon: PlusCircle,
    iconClass: 'bg-primary/10 text-primary',
    badgeClass: 'border-primary/30 text-primary bg-primary/5',
  },
  delete: {
    label: 'exclusão',
    icon: MinusCircle,
    iconClass: 'bg-destructive/10 text-destructive',
    badgeClass: 'border-destructive/30 text-destructive bg-destructive/5',
  },
  manual: {
    label: 'manual',
    icon: ClipboardList,
    iconClass: 'bg-muted text-muted-foreground',
    badgeClass: 'border-border text-muted-foreground bg-muted/50',
  },
} as const
```

Replace:

```ts
  const resultado = auditoria.resultado_json as Resultado | null
  const isAdd = auditoria.trigger_type === 'add'
```

with:

```ts
  const resultado = auditoria.resultado_json as Resultado | null
  const info = TRIGGER_INFO[auditoria.trigger_type as keyof typeof TRIGGER_INFO]
  const Icon = info.icon
```

Replace the hero icon/badge block:

```tsx
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isAdd ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {isAdd ? (
              <PlusCircle className="w-6 h-6" />
            ) : (
              <MinusCircle className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">Auditoria</h1>
              <Badge
                variant="outline"
                className={`text-xs ${
                  isAdd
                    ? 'border-primary/30 text-primary bg-primary/5'
                    : 'border-destructive/30 text-destructive bg-destructive/5'
                }`}
              >
                {isAdd ? 'adição' : 'exclusão'}
              </Badge>
            </div>
```

with:

```tsx
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${info.iconClass}`}
          >
            <Icon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">Auditoria</h1>
              <Badge variant="outline" className={`text-xs ${info.badgeClass}`}>
                {info.label}
              </Badge>
            </div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/auditorias/[id]/page.tsx"
git commit -m "feat: exibir trigger_type manual no detalhe da auditoria"
```

---

### Task 11: Full regression pass

- [ ] **Step 1: Run the existing test suite**

Run: `npm run test`
Expected: all existing tests in `lib/pente-fino.test.ts` still pass (this plan didn't touch that file's logic).

- [ ] **Step 2: Run the full build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: End-to-end manual walkthrough**

With `npm run dev` running and signed in as admin:
1. Upload a relatório → confirm dialog appears → click "Cancelar" → confirm no new auditoria was created (`/auditorias` count unchanged).
2. Upload another relatório → confirm dialog appears → click "Gerar auditoria" → confirm a new `'add'`-triggered auditoria appears in `/auditorias`.
3. Delete a relatório → confirm "Confirmar exclusão" → then "Relatório excluído" dialog → click "Gerar auditoria" → confirm a new `'delete'`-triggered auditoria appears.
4. Click the standalone "Gerar auditoria" button on `/relatorios` → confirm a new `'manual'`-triggered auditoria appears in `/auditorias`, with a distinct "manual" badge.
5. Open that manual auditoria's detail page (`/auditorias/[id]`) → confirm the "manual" badge and icon render correctly.

- [ ] **Step 4: Final commit (only if any fixups were needed above)**

```bash
git add -A
git commit -m "fix: ajustes de regressao apos separar anexar relatorio de gerar auditoria"
```
