# Perfil + Alterar Senha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #28 — a `/perfil` page where any authenticated user can edit their own nome/telefone and change their own password (with current-password reauthentication) — plus extract a reusable `PasswordInput` (show/hide toggle) and apply it to every password field in the app.

**Architecture:** A new reusable `PasswordInput` component (wraps the existing `Input`), retrofitted into the 3 existing password fields (login, redefinir-senha, criar usuário) and used in 3 new fields on `/perfil`. The `/perfil` page itself follows the same layout pattern as `/configuracoes` (Card-based sections), with two independent forms (`PerfilForm`, `AlterarSenhaForm`) each calling its own server action on the normal authenticated Supabase client (never the service client — these actions only ever touch the calling user's own account).

**Tech Stack:** Next.js 16 App Router, Supabase Auth (`@supabase/ssr`), existing shadcn `Button`/`Input`/`Label`/`Card` components, `lucide-react` icons.

---

### Task 1: `PasswordInput` component

**Files:**
- Create: `components/ui/password-input.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div className="relative">
      <Input
        type={mostrar ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={mostrar ? 'Ocultar senha' : 'Exibir senha'}
        tabIndex={-1}
      >
        {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
```

This mirrors the exact toggle pattern already in `app/(auth)/login/page.tsx` (`Eye`/`EyeOff`, `tabIndex={-1}`, absolutely positioned button). It spreads all `Input` props through (`id`, `name`, `value`, `onChange`, `disabled`, `required`, `placeholder`, `autoComplete`, etc.) so it works both as a controlled input (value/onChange) and as an uncontrolled form field read via `FormData` by `name` (needed for Task 4, `CriarUsuarioForm`, which uses `useActionState`).

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add components/ui/password-input.tsx
git commit -m "feat: adicionar componente PasswordInput reutilizavel"
```

---

### Task 2: Use `PasswordInput` in the login page

**Files:**
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Update imports**

Change:
```tsx
import { createClient } from '@/lib/supabase/client'
import { Logomark } from '@/components/Logomark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck, BarChart3, FileText, Eye, EyeOff } from 'lucide-react'
```
to:
```tsx
import { createClient } from '@/lib/supabase/client'
import { Logomark } from '@/components/Logomark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, ShieldCheck, BarChart3, FileText } from 'lucide-react'
```
(`Eye`/`EyeOff` are no longer used directly in this file — they now live inside `PasswordInput`.)

- [ ] **Step 2: Remove the `mostrarSenha` state**

Change:
```tsx
  const [loading, setLoading] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
```
to:
```tsx
  const [loading, setLoading] = useState(false)
```

- [ ] **Step 3: Replace the manual toggle markup with `PasswordInput`**

Change:
```tsx
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
```
to:
```tsx
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <PasswordInput
                id="senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11"
              />
              <div className="flex justify-end">
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>
```

`Input` stays imported/used for the email field earlier in the file — do not remove that import.

- [ ] **Step 2 (verify): typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login/page.tsx"
git commit -m "refactor: usar PasswordInput na tela de login"
```

---

### Task 3: Use `PasswordInput` in the redefinir-senha page

**Files:**
- Modify: `app/(auth)/redefinir-senha/page.tsx`

- [ ] **Step 1: Update imports**

Change:
```tsx
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'
```
to:
```tsx
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'
```
(`Input` was only used for the two password fields in this file — no longer needed.)

- [ ] **Step 2: Replace both password fields**

Change:
```tsx
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar senha</Label>
            <Input
              id="confirmarSenha"
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>
```
to:
```tsx
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <PasswordInput
              id="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmarSenha">Confirmar senha</Label>
            <PasswordInput
              id="confirmarSenha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-11"
            />
          </div>
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/redefinir-senha/page.tsx"
git commit -m "refactor: usar PasswordInput na tela de redefinir senha"
```

---

### Task 4: Use `PasswordInput` in `CriarUsuarioForm`

**Files:**
- Modify: `components/CriarUsuarioForm.tsx`

- [ ] **Step 1: Update imports**

Change:
```tsx
import { useActionState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
```
to:
```tsx
import { useActionState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
```

- [ ] **Step 2: Replace the "Senha" field**

Change:
```tsx
          <div className="space-y-2">
            <Label htmlFor="senha">Senha <span className="text-destructive">*</span></Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              required
              placeholder="mínimo 6 caracteres"
              disabled={pending}
              className="h-10"
            />
          </div>
```
to:
```tsx
          <div className="space-y-2">
            <Label htmlFor="senha">Senha <span className="text-destructive">*</span></Label>
            <PasswordInput
              id="senha"
              name="senha"
              required
              placeholder="mínimo 6 caracteres"
              disabled={pending}
              className="h-10"
            />
          </div>
```

`Input` stays imported/used for `email`, `nome`, `telefone`, `cargo`, `funcao` fields elsewhere in this file — do not remove that import.

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add components/CriarUsuarioForm.tsx
git commit -m "refactor: usar PasswordInput no formulario de criar usuario"
```

---

### Task 5: Perfil server actions

**Files:**
- Create: `app/(protected)/perfil/actions.ts`

- [ ] **Step 1: Write the file**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function atualizarPerfil(data: {
  nome: string
  telefone: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão inválida' }

  const { error } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, nome: data.nome, telefone: data.telefone },
  })

  if (error) return { error: 'Não foi possível atualizar os dados. Tente novamente.' }

  return {}
}

export async function alterarSenha(
  senhaAtual: string,
  novaSenha: string
): Promise<{ error?: string }> {
  if (novaSenha.length < 6) return { error: 'A nova senha deve ter pelo menos 6 caracteres' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: 'Sessão inválida' }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senhaAtual,
  })

  if (reauthError) return { error: 'Senha atual incorreta' }

  const { error } = await supabase.auth.updateUser({ password: novaSenha })

  if (error) return { error: 'Não foi possível atualizar a senha. Tente novamente.' }

  return {}
}
```

Both actions use `createClient()` (the normal cookie-based authenticated client from `lib/supabase/server.ts`) — never `createServiceClient()`. `atualizarPerfil` spreads the current `user.user_metadata` before overriding `nome`/`telefone`, so `cargo`/`funcao` (managed only by admins in `/configuracoes/usuarios`) are preserved regardless of whether Supabase's `updateUser({ data })` merges or replaces `user_metadata` server-side.

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/perfil/actions.ts"
git commit -m "feat: adicionar server actions de perfil (atualizar dados e alterar senha)"
```

---

### Task 6: `PerfilForm` component

**Files:**
- Create: `components/PerfilForm.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { atualizarPerfil } from '@/app/(protected)/perfil/actions'

export function PerfilForm({ nome: nomeInicial, telefone: telefoneInicial }: { nome: string; telefone: string }) {
  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    setLoading(true)

    const result = await atualizarPerfil({ nome, telefone })

    setLoading(false)

    if (result.error) {
      setErro(result.error)
      return
    }

    setSucesso(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João da Silva"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(81) 99999-9999"
            className="h-10"
          />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Dados atualizados com sucesso!
        </div>
      )}

      <Button type="submit" disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar dados'
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add components/PerfilForm.tsx
git commit -m "feat: adicionar PerfilForm (edicao de nome e telefone)"
```

---

### Task 7: `AlterarSenhaForm` component

**Files:**
- Create: `components/AlterarSenhaForm.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { alterarSenha } from '@/app/(protected)/perfil/actions'

export function AlterarSenhaForm() {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem')
      return
    }

    setLoading(true)
    const result = await alterarSenha(senhaAtual, novaSenha)
    setLoading(false)

    if (result.error) {
      setErro(result.error)
      return
    }

    setSenhaAtual('')
    setNovaSenha('')
    setConfirmarSenha('')
    setSucesso(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="senhaAtual">Senha atual</Label>
        <PasswordInput
          id="senhaAtual"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
          placeholder="••••••••"
          autoComplete="current-password"
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="novaSenha">Nova senha</Label>
          <PasswordInput
            id="novaSenha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            placeholder="mínimo 6 caracteres"
            autoComplete="new-password"
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
          <PasswordInput
            id="confirmarSenha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
            className="h-10"
          />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Senha alterada com sucesso!
        </div>
      )}

      <Button type="submit" disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Alterar senha'
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add components/AlterarSenhaForm.tsx
git commit -m "feat: adicionar AlterarSenhaForm (troca de senha com reautenticacao)"
```

---

### Task 8: `/perfil` page

**Files:**
- Create: `app/(protected)/perfil/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PerfilForm } from '@/components/PerfilForm'
import { AlterarSenhaForm } from '@/components/AlterarSenhaForm'
import { User } from 'lucide-react'

export default async function PerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const nome = (user.user_metadata?.nome as string | undefined) ?? ''
  const telefone = (user.user_metadata?.telefone as string | undefined) ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Minha conta</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie seus dados pessoais e sua senha
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>Nome e telefone exibidos no seu perfil.</CardDescription>
        </CardHeader>
        <CardContent>
          <PerfilForm nome={nome} telefone={telefone} />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
          <CardDescription>Informe sua senha atual para definir uma nova.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlterarSenhaForm />
        </CardContent>
      </Card>
    </div>
  )
}
```

This route lives under `app/(protected)/`, so `(protected)/layout.tsx` already enforces authentication (redirects to `/login` if no session) and `proxy.ts` already requires a session for any route not in its `PUBLIC_ROUTES`/`ADMIN_ROUTES` lists — `/perfil` is in neither list, so it's automatically "authenticated but not admin-gated," which is exactly what's needed. No `proxy.ts` change is required for this task.

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/perfil/page.tsx"
git commit -m "feat: adicionar pagina /perfil"
```

---

### Task 9: Link to `/perfil` from `UserMenu`

**Files:**
- Modify: `components/UserMenu.tsx`

- [ ] **Step 1: Add the `User` icon import**

Change:
```tsx
import { Moon, Sun, LogOut, ChevronDown, Settings } from 'lucide-react'
```
to:
```tsx
import { Moon, Sun, LogOut, ChevronDown, Settings, User } from 'lucide-react'
```

- [ ] **Step 2: Add the "Minha conta" menu item**

Change:
```tsx
          <DropdownMenuSeparator />

          {isAdmin && (
            <DropdownMenuItem
              render={<Link href="/configuracoes" />}
              className="gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Configurações
            </DropdownMenuItem>
          )}
```
to:
```tsx
          <DropdownMenuSeparator />

          <DropdownMenuItem
            render={<Link href="/perfil" />}
            className="gap-2 cursor-pointer"
          >
            <User className="w-4 h-4" />
            Minha conta
          </DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem
              render={<Link href="/configuracoes" />}
              className="gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Configurações
            </DropdownMenuItem>
          )}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add components/UserMenu.tsx
git commit -m "feat: adicionar link Minha conta no menu do usuario"
```

---

### Task 10: Full verification, push, PR

**Files:** none (verification and git operations only)

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build completes successfully; `/perfil` appears in the route list (dynamic, ƒ — reads the session server-side). No TypeScript errors.

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: existing Vitest suite (26 tests) passes unchanged — this feature adds no pure functions.

- [ ] **Step 3: Manual browser verification (report results, do not skip)**

With `npm run dev` running:
1. Confirm the eye icon shows/hides the password correctly in all 4 locations: `/login`, `/redefinir-senha` (both fields), criar usuário (`/configuracoes/usuarios`, admin only), and `/perfil` alterar senha (all 3 fields).
2. Log in as a non-admin user, open the user menu, confirm "Minha conta" is visible (and "Configurações" is not, since that item stays admin-only).
3. On `/perfil`, edit nome/telefone, save, reload the page — confirm the new values persisted.
4. Try "Alterar senha" with the wrong current password — expect "Senha atual incorreta" inline, nothing changes.
5. Try with the correct current password but a new password under 6 characters, or with mismatched confirmation — expect the respective inline validation error, no submission.
6. Change the password correctly, confirm the success message and that the fields clear. Log out and log back in with the new password to confirm it actually changed.
7. As an admin, confirm `/configuracoes/usuarios` → criar usuário still works end-to-end with the new `PasswordInput`.

- [ ] **Step 4: Push branch and open PR into develop**

```bash
git push -u origin feat/perfil-alterar-senha
```

```bash
gh pr create --base develop --title "feat: implementar alteração de senha e edição de perfil" --body "$(cat <<'EOF'
## Resumo
Implementa a issue #28: página `/perfil` onde qualquer usuário autenticado pode editar nome/telefone e trocar a própria senha (com reautenticação pela senha atual). Também extrai um componente `PasswordInput` reutilizável e aplica o ícone de mostrar/ocultar senha em todos os campos de senha do app (login, redefinir-senha, criar usuário, e os novos campos de troca de senha).

- Nova rota `/perfil`, acessível a qualquer usuário autenticado (não gated por admin).
- `PerfilForm`: edita nome/telefone via `atualizarPerfil` (client autenticado normal, nunca o service client).
- `AlterarSenhaForm`: exige senha atual (reautentica via `signInWithPassword` antes de trocar).
- `components/ui/password-input.tsx`: componente reutilizável, retrofitado em login, redefinir-senha e criar usuário.
- Link "Minha conta" no `UserMenu`.

Closes #28

## Test plan
- [x] npm run build
- [x] npm run test
- [ ] Verificação manual completa (ver checklist da Task 10 do plano) — pendente
EOF
)"
```

Expected: PR URL printed.

---

## Spec coverage check

- `/perfil` fora do gate de admin, duas seções independentes — Task 8 (página) + Task 6/7 (forms separados).
- Troca de senha exige senha atual — Task 5 (`alterarSenha` reautentica) + Task 7 (form pede o campo).
- Actions usam client autenticado normal, nunca o service client — Task 5.
- `PasswordInput` reutilizável aplicado em login, redefinir-senha, criar usuário e troca de senha — Tasks 1-4 e 7.
- Link no `UserMenu` — Task 9.
- Preservar `cargo`/`funcao` ao atualizar perfil — Task 5 (spread de `user.user_metadata`).
- Fora de escopo (edição de cargo/função, exigir troca no primeiro login, mudanças no fluxo de admin além do retrofit do `PasswordInput`) — intencionalmente sem tasks.
