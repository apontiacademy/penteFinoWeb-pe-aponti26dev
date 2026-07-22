# Senha aleatória + envio por email (AWS SES) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao criar um usuário em `/configuracoes/usuarios`, gerar uma senha aleatória segura no lugar do campo digitado pelo admin, e enviar essa senha por email via AWS SES — com fallback visual (mostrar a senha na tela) se o envio falhar.

**Architecture:** Dois novos módulos isolados em `lib/` (gerador de senha puro/testável, cliente SES + função de envio), integrados em `criarUsuario` (`actions.ts`), com ajustes de UI em `CriarUsuarioForm.tsx`/`CriarUsuarioDialog.tsx` para remover o campo de senha manual e exibir o resultado do envio.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19, TypeScript, `@aws-sdk/client-sesv2`, Supabase Auth Admin API, Vitest.

Spec de referência: `docs/superpowers/specs/2026-07-09-senha-aleatoria-email-design.md`

URL de produção (para `NEXT_PUBLIC_SITE_URL`): `https://pentefino-aponti-academy.vercel.app`

---

## File Structure

- **Create** `lib/ses.ts` — factory `createSesClient()`, mesmo padrão de `createServiceClient()`.
- **Create** `lib/gerar-senha.ts` + `lib/gerar-senha.test.ts` — gerador de senha puro e testado.
- **Create** `lib/email/enviar-senha-usuario.ts` — monta o HTML e envia via SES.
- **Modify** `app/(protected)/configuracoes/usuarios/actions.ts` — `criarUsuario` gera a senha,
  cria o usuário, tenta enviar o email, retorna o resultado.
- **Modify** `components/CriarUsuarioForm.tsx` — remove campo "Senha", trata os novos estados de
  retorno da action.
- **Modify** `components/CriarUsuarioDialog.tsx` — atualiza o texto de aviso.

---

### Task 1: Cliente AWS SES — `lib/ses.ts`

**Files:**
- Create: `lib/ses.ts`

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @aws-sdk/client-sesv2`

- [ ] **Step 2: Criar o factory**

```ts
import { SESv2Client } from '@aws-sdk/client-sesv2'

export function createSesClient() {
  return new SESv2Client({ region: process.env.AWS_REGION })
}
```

O SDK v3 da AWS lê `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` automaticamente do ambiente
(credential provider chain padrão) — não é necessário passá-las explicitamente aqui.

- [ ] **Step 3: Rodar lint e build**

Run: `npx eslint lib/ses.ts`
Expected: sem erros.

Run: `npm run build`
Expected: build passa (a chamada real ao SES só acontece em runtime, não durante o build — não
precisa de credenciais configuradas para o build passar).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/ses.ts
git commit -m "feat: adicionar cliente AWS SES"
```

---

### Task 2: Gerador de senha — `lib/gerar-senha.ts` (TDD)

**Files:**
- Create: `lib/gerar-senha.ts`
- Test: `lib/gerar-senha.test.ts`

- [ ] **Step 1: Escrever os testes (arquivo novo)**

```ts
import { describe, it, expect } from 'vitest'
import { gerarSenhaAleatoria } from './gerar-senha'

describe('gerarSenhaAleatoria', () => {
  it('gera uma senha com 12 caracteres', () => {
    expect(gerarSenhaAleatoria()).toHaveLength(12)
  })

  it('só usa caracteres do conjunto permitido (sem I, O, l, 0, 1)', () => {
    const permitido = /^[A-HJ-NP-Za-km-np-z2-9!@#$%&*]+$/
    for (let i = 0; i < 50; i++) {
      expect(gerarSenhaAleatoria()).toMatch(permitido)
    }
  })

  it('contém pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo', () => {
    for (let i = 0; i < 50; i++) {
      const senha = gerarSenhaAleatoria()
      expect(senha).toMatch(/[A-HJ-NP-Z]/)
      expect(senha).toMatch(/[a-km-np-z]/)
      expect(senha).toMatch(/[2-9]/)
      expect(senha).toMatch(/[!@#$%&*]/)
    }
  })

  it('gera senhas diferentes em chamadas sucessivas', () => {
    const senhas = new Set(Array.from({ length: 20 }, () => gerarSenhaAleatoria()))
    expect(senhas.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run lib/gerar-senha.test.ts`
Expected: FAIL — `Cannot find module './gerar-senha'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar o gerador**

```ts
import { randomInt } from 'crypto'

const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz'
const NUMEROS = '23456789'
const SIMBOLOS = '!@#$%&*'
const TODOS = MAIUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS
const TAMANHO = 12

export function gerarSenhaAleatoria(): string {
  const grupos = [MAIUSCULAS, MINUSCULAS, NUMEROS, SIMBOLOS]
  const senha: string[] = grupos.map((grupo) => grupo[randomInt(grupo.length)])

  for (let i = senha.length; i < TAMANHO; i++) {
    senha.push(TODOS[randomInt(TODOS.length)])
  }

  for (let i = senha.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[senha[i], senha[j]] = [senha[j], senha[i]]
  }

  return senha.join('')
}
```

Nota: `MINUSCULAS` é `'abcdefghijkmnpqrstuvwxyz'` — repare que tem `i` e `j` e `k`, mas **não**
tem `l` (pula direto de `k` pra `m`) nem `o` (pula de `n` pra `p`). É fácil digitar esse literal
errado — copie exatamente como está acima, ou os testes do Step 2/4 vão falhar de forma confusa
(parecerá que só alguns caracteres aleatórios "por azar" não bateram com o regex).

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run lib/gerar-senha.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/gerar-senha.ts lib/gerar-senha.test.ts
git commit -m "feat: adicionar gerador de senha aleatoria"
```

---

### Task 3: Envio de email — `lib/email/enviar-senha-usuario.ts`

**Files:**
- Create: `lib/email/enviar-senha-usuario.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createSesClient } from '@/lib/ses'

export async function enviarSenhaPorEmail(params: {
  email: string
  nome: string
  senha: string
}): Promise<{ error?: string }> {
  const ses = createSesClient()
  const loginUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/login`

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Bem-vindo(a) ao Pente Fino</h2>
      <p>Olá${params.nome ? `, ${params.nome}` : ''}! Uma conta foi criada para você no
      sistema de auditoria de relatórios da Aponti Academy.</p>
      <p>
        <strong>Email:</strong> ${params.email}<br />
        <strong>Senha temporária:</strong>
        <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;">${params.senha}</code>
      </p>
      <p>
        <a href="${loginUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          Acessar o sistema
        </a>
      </p>
      <p style="color:#71717a;font-size:12px;">
        Não compartilhe esta senha com ninguém. Se você não esperava este email, ignore-o.
      </p>
    </div>
  `

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [params.email] },
        Content: {
          Simple: {
            Subject: { Data: 'Seu acesso ao Pente Fino', Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' } },
          },
        },
      })
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao enviar email' }
  }
}
```

Nota: diferente de provedores como Resend (que retornam `{ data, error }`), o SDK da AWS **lança
exceção** quando o envio falha — por isso o `try/catch` em vez de checar um campo `error` no
retorno. A interface pública de `enviarSenhaPorEmail` (`Promise<{ error?: string }>`) é a mesma
independente disso, então quem chama essa função (Task 4) não precisa saber desse detalhe.

- [ ] **Step 2: Rodar lint e build**

Run: `npx eslint lib/email/enviar-senha-usuario.ts`
Expected: sem erros.

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add lib/email/enviar-senha-usuario.ts
git commit -m "feat: adicionar envio de senha por email via SES"
```

---

### Task 4: Integração em `criarUsuario`

**Files:**
- Modify: `app/(protected)/configuracoes/usuarios/actions.ts:1-57`

- [ ] **Step 1: Atualizar os imports**

Localize o topo do arquivo (linhas 1-5 atuais):

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { registrarLog } from '@/lib/system-log'
```

Adicione, logo depois do import de `registrarLog`:

```ts
import { gerarSenhaAleatoria } from '@/lib/gerar-senha'
import { enviarSenhaPorEmail } from '@/lib/email/enviar-senha-usuario'
```

- [ ] **Step 2: Substituir a função `criarUsuario`**

Localize a função inteira (linhas 16-57 atuais):

```ts
export async function criarUsuario(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  try {
    const admin = await verificarAdmin()

    const email = formData.get('email') as string
    const senha = formData.get('senha') as string
    const role = formData.get('role') as string
    const nome = (formData.get('nome') as string) ?? ''
    const telefone = (formData.get('telefone') as string) ?? ''
    const cargo = (formData.get('cargo') as string) ?? ''
    const funcao = (formData.get('funcao') as string) ?? ''

    if (!email || !senha || !role) return { error: 'Email, senha e perfil são obrigatórios' }
    if (senha.length < 6) return { error: 'Senha deve ter pelo menos 6 caracteres' }

    const supabase = createServiceClient()
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      app_metadata: { role },
      user_metadata: { nome, telefone, cargo, funcao },
      email_confirm: true,
    })

    if (error) return { error: error.message }

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'usuario.criar',
      target: email,
    })

    revalidatePath('/configuracoes/usuarios')
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

Substitua por:

```ts
export async function criarUsuario(
  prevState: {
    error?: string
    success?: boolean
    emailFalhou?: boolean
    senhaGerada?: string
  } | null,
  formData: FormData
) {
  try {
    const admin = await verificarAdmin()

    const email = formData.get('email') as string
    const role = formData.get('role') as string
    const nome = (formData.get('nome') as string) ?? ''
    const telefone = (formData.get('telefone') as string) ?? ''
    const cargo = (formData.get('cargo') as string) ?? ''
    const funcao = (formData.get('funcao') as string) ?? ''

    if (!email || !role) return { error: 'Email e perfil são obrigatórios' }

    const senha = gerarSenhaAleatoria()

    const supabase = createServiceClient()
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      app_metadata: { role },
      user_metadata: { nome, telefone, cargo, funcao },
      email_confirm: true,
    })

    if (error) return { error: error.message }

    await registrarLog({
      userId: admin.id,
      userEmail: admin.email!,
      action: 'usuario.criar',
      target: email,
    })

    revalidatePath('/configuracoes/usuarios')

    const { error: emailError } = await enviarSenhaPorEmail({ email, nome, senha })
    if (emailError) {
      return { success: true, emailFalhou: true, senhaGerada: senha }
    }

    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}
```

Não toque em `verificarAdmin`, `atualizarUsuario` nem `deletarUsuario` — ficam exatamente como
estão.

- [ ] **Step 3: Rodar lint e build**

Run: `npx eslint "app/(protected)/configuracoes/usuarios/actions.ts"`
Expected: sem erros.

Run: `npm run build`
Expected: build passa. Nesse ponto, `components/CriarUsuarioForm.tsx` ainda envia um campo
`senha` que não é mais lido — isso não quebra o build (formulário HTML simplesmente manda um
campo a mais que a action ignora), mas a Task 5 vai limpar isso.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/configuracoes/usuarios/actions.ts"
git commit -m "feat: gerar senha automaticamente e enviar por email em criarUsuario"
```

---

### Task 5: `CriarUsuarioForm.tsx` — remover campo de senha, tratar novos estados

**Files:**
- Modify: `components/CriarUsuarioForm.tsx` (arquivo inteiro, 153 linhas hoje)

- [ ] **Step 1: Reescrever o arquivo**

Conteúdo completo do arquivo (substitui o atual por inteiro):

```tsx
'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { criarUsuario } from '@/app/(protected)/configuracoes/usuarios/actions'

export function CriarUsuarioForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState(criarUsuario, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success && !state?.emailFalhou) {
      formRef.current?.reset()
      const timer = setTimeout(() => onSuccess?.(), 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success, state?.emailFalhou])

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {/* Acesso */}
      <div>
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
          Acesso
        </p>
        <div className="space-y-2">
          <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="usuario@email.com"
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="role">Perfil de acesso <span className="text-destructive">*</span></Label>
          <select
            id="role"
            name="role"
            required
            disabled={pending}
            defaultValue="user"
            className="flex h-10 w-full sm:w-[200px] items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="user">Usuário</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Perfil */}
      <div>
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
          Perfil
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              placeholder="João da Silva"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              name="telefone"
              type="tel"
              placeholder="(81) 99999-9999"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              name="cargo"
              type="text"
              placeholder="ex: Coordenador"
              disabled={pending}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="funcao">Função</Label>
            <Input
              id="funcao"
              name="funcao"
              type="text"
              placeholder="ex: Operações"
              disabled={pending}
              className="h-10"
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && state?.emailFalhou && (
        <div className="flex flex-col gap-1.5 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Usuário criado, mas o envio do email falhou.
          </div>
          <p className="text-xs">
            Repasse esta senha manualmente ao usuário:{' '}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded">{state.senhaGerada}</code>
          </p>
        </div>
      )}
      {state?.success && !state?.emailFalhou && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Usuário criado com sucesso! A senha foi enviada por email.
        </div>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Criando...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Criar usuário
          </>
        )}
      </Button>
    </form>
  )
}
```

Mudanças em relação ao arquivo atual: import de `PasswordInput` removido (não usado mais); a
seção "Acesso" perde o grid de 2 colunas (agora só tem o campo Email, não faz mais sentido
dividir em colunas com um campo só) e o campo "Senha" inteiro; o `useEffect` só reseta/fecha
automaticamente quando `state?.success && !state?.emailFalhou`; dois blocos novos tratam os
casos de sucesso com e sem falha de email.

- [ ] **Step 2: Rodar lint e build**

Run: `npx eslint components/CriarUsuarioForm.tsx`
Expected: sem erros (confirma que `PasswordInput` não ficou como import não usado).

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add components/CriarUsuarioForm.tsx
git commit -m "feat: remover campo de senha manual do formulario de criar usuario"
```

---

### Task 6: `CriarUsuarioDialog.tsx` — atualizar texto de aviso

**Files:**
- Modify: `components/CriarUsuarioDialog.tsx:28-30`

- [ ] **Step 1: Trocar o texto**

Localize:

```tsx
            <p className="text-xs text-muted-foreground">
              O usuário receberá acesso imediato — não é necessário confirmar email.
            </p>
```

Substitua por:

```tsx
            <p className="text-xs text-muted-foreground">
              Uma senha será gerada automaticamente e enviada por email para o novo usuário.
            </p>
```

Nada mais neste arquivo muda.

- [ ] **Step 2: Rodar lint e build**

Run: `npx eslint components/CriarUsuarioDialog.tsx`
Expected: sem erros.

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add components/CriarUsuarioDialog.tsx
git commit -m "feat: atualizar aviso do dialog de criar usuario"
```

---

### Task 7: Verificação manual e fechamento

**Files:** nenhum (só verificação; sem alterações de código esperadas nesta task)

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm run test`
Expected: todos os testes passam, incluindo os 4 novos de `lib/gerar-senha.test.ts`.

- [ ] **Step 2: Rodar lint e build do projeto inteiro**

Run: `npm run lint`
Expected: sem erros novos (podem existir avisos/erros pré-existentes em arquivos não tocados por
esta branch).

Run: `npm run build`
Expected: build passa.

- [ ] **Step 3: Configurar as variáveis de ambiente necessárias**

Antes de testar manualmente, confirme que `.env.local` tem:

```
AWS_REGION=<região onde o SES está configurado, ex: us-east-1>
AWS_ACCESS_KEY_ID=<access key de uma IAM user/role com permissão ses:SendEmail>
AWS_SECRET_ACCESS_KEY=<secret key correspondente>
SES_FROM_EMAIL=<endereço remetente verificado no SES>
NEXT_PUBLIC_SITE_URL=https://pentefino-aponti-academy.vercel.app
```

Enquanto a conta SES estiver em sandbox mode, o email de destino do teste (o email do usuário
que você for criar) também precisa estar verificado individualmente no painel do SES — senão o
envio falha (o que também é uma boa forma de testar o cenário de falha do Step 5 abaixo).

- [ ] **Step 4: Testar o caminho de sucesso**

Run: `npm run dev`, logar como admin, abrir `/configuracoes/usuarios`, clicar em "Novo usuário".

Checklist:
- O formulário não mostra mais campo de senha — só Email, Perfil de acesso, e os campos de
  Perfil (Nome, Telefone, Cargo, Função).
- O aviso no topo do dialog diz que uma senha será gerada e enviada por email.
- Ao submeter com um email verificado no SES (ou o próprio domínio verificado, se já tiver
  saído do sandbox): usuário é criado, aparece a mensagem verde "Usuário criado com sucesso! A
  senha foi enviada por email.", o dialog fecha sozinho depois de ~1.5s.
- O email chega na caixa de entrada do endereço usado, com a senha gerada, e o link "Acessar o
  sistema" aponta pra `https://pentefino-aponti-academy.vercel.app/login`.
- A senha do email funciona para logar como o novo usuário.

- [ ] **Step 5: Testar o caminho de falha de envio**

Crie um usuário com um email que **não** esteja verificado no SES (enquanto a conta estiver em
sandbox mode) — ou, se já estiver em produção, teste temporariamente com uma credencial AWS
inválida em `.env.local` pra forçar a falha, revertendo depois.

Checklist:
- O usuário é criado normalmente no Supabase (confirme em `/configuracoes/usuarios` que ele
  aparece na lista).
- Aparece a caixa âmbar "Usuário criado, mas o envio do email falhou." com a senha gerada
  visível e selecionável.
- O dialog **não** fecha sozinho — fica aberto até ser fechado manualmente.

- [ ] **Step 6: Se tudo passou, seguir para push + PR**

Use a skill `finishing-a-development-branch` (branch base: `develop`) para dar push e abrir o
PR. Nenhum commit é esperado nesta task a menos que a verificação manual encontre um
problema — nesse caso, corrija, repita os passos 1-2, e só então prossiga.

---

## Fora de escopo (herdado da spec)

- Saída do sandbox mode do SES e verificação do domínio/email remetente — configuração externa
  no painel da AWS.
- Forçar troca de senha no primeiro login.
- Botão de copiar a senha (clipboard) no aviso de falha de envio.
- Reenvio manual do email pelo admin.
