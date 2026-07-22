# Design: senha aleatória + envio por email na criação de usuário

Issue: [#27](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/27)

## Contexto

Hoje, ao criar um usuário em `/configuracoes/usuarios`, o admin digita a senha manualmente em
texto plano (`components/CriarUsuarioForm.tsx:44-54`, mínimo 6 caracteres validado em
`app/(protected)/configuracoes/usuarios/actions.ts:32`, sem outra regra). A ação `criarUsuario`
chama `supabase.auth.admin.createUser({ email, password: senha, ..., email_confirm: true })` —
acesso imediato, sem confirmação por email. Não existe nenhuma infraestrutura de email no
projeto hoje (só os fluxos nativos do Supabase Auth, todos baseados em link — convite, reset de
senha — nenhum permite enviar um texto arbitrário como "sua senha é: X").

## Objetivo

Ao criar um usuário, gerar uma senha aleatória segura no lugar do campo digitado pelo admin, e
enviar essa senha por email para o novo usuário via AWS SES.

## Decisão: AWS SES em vez dos recursos nativos do Supabase Auth

Os fluxos de email do Supabase Auth (`inviteUserByEmail`, `resetPasswordForEmail`) são todos
baseados em **link** — o destinatário clica e define a própria senha. Não é possível usá-los
para enviar o texto de uma senha já gerada, que é exatamente o que a issue pede. Por isso, um
provedor de email de propósito geral é necessário.

**AWS SES** (Simple Email Service) foi escolhido — não confundir com **AWS WorkMail**, que é um
serviço de caixa de email hospedada (tipo Google Workspace), inadequado pra esse caso de uso de
envio automatizado disparado pelo sistema. SES é a contraparte direta do papel que o Resend
ocuparia: uma API de envio de email transacional.

Contas novas de SES começam em **sandbox mode** — só é possível enviar para endereços de email
individualmente verificados na conta AWS, até a Amazon aprovar um pedido de saída do sandbox
("production access"), que costuma levar até 24h. Isso é puramente uma questão de configuração
externa (painel da AWS), não exige mudança de código quando a conta sair do sandbox — equivalente
ao caveat de domínio não verificado que existiria com qualquer provedor de email novo.

## 1. Nova dependência e variáveis de ambiente

- `npm install @aws-sdk/client-sesv2`
- `AWS_REGION` — região AWS onde o SES está configurado (ex: `us-east-1`).
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — credenciais de uma IAM user/role com permissão
  `ses:SendEmail`. O AWS SDK v3 lê essas duas variáveis automaticamente (credential provider
  chain padrão) — não é necessário passá-las explicitamente no código.
- `SES_FROM_EMAIL` — endereço remetente verificado no SES (ex: `naoresponda@aponti.com.br`, ou
  um endereço individual verificado enquanto a conta estiver em sandbox mode).
- `NEXT_PUBLIC_SITE_URL` — URL de produção do sistema (ex: `https://pentefino.aponti.com.br`),
  usada para montar o link "Acessar o sistema" no corpo do email. Nova variável — o projeto hoje
  só usa `window.location.origin` no navegador (`components/EsqueciSenhaForm.tsx:24`), o que não
  funciona dentro de uma Server Action (sem acesso ao `window`).

Essas variáveis precisam ser configuradas pelo usuário em `.env.local` (e no ambiente de
produção) antes de testar o fluxo — não fazem parte desta spec definir os valores reais.

## 2. Gerador de senha — `lib/gerar-senha.ts` (novo)

Função pura, sem dependência de React/Next — testável isoladamente, mesmo padrão de
`lib/pagination.ts`. Usa `crypto.randomInt` (gerador criptograficamente seguro, módulo nativo do
Node, sem dependência nova). Exclui caracteres ambíguos (`I`, `O`, `l`, `0`, `1`) para facilitar
caso o admin precise repassar a senha manualmente por telefone/mensagem (cenário de falha de
envio, seção 4). Garante pelo menos 1 caractere de cada classe (maiúscula, minúscula, número,
símbolo) e embaralha o resultado para não ter uma ordem previsível.

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

Testado com Vitest (`lib/gerar-senha.test.ts`): comprimento sempre 12; só contém caracteres do
conjunto permitido (regex); contém pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo em
várias execuções; chamadas sucessivas não geram a mesma senha (checagem de variedade, não de
unicidade garantida).

## 3. Envio de email — `lib/ses.ts` + `lib/email/enviar-senha-usuario.ts` (novos)

`lib/ses.ts` — factory simples, mesmo padrão de nomenclatura de `createServiceClient()` em
`lib/supabase/server.ts`:

```ts
import { SESv2Client } from '@aws-sdk/client-sesv2'

export function createSesClient() {
  return new SESv2Client({ region: process.env.AWS_REGION })
}
```

`lib/email/enviar-senha-usuario.ts` — monta o HTML e envia. Diferença importante em relação a
provedores como Resend: o SDK da AWS **lança exceção** em caso de falha, em vez de retornar
`{ data, error }` — por isso o `try/catch`, mantendo a mesma interface de retorno
(`Promise<{ error?: string }>`) que o resto do app (`criarUsuario`, seção 4) já espera:

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

## 4. Integração em `criarUsuario` (`app/(protected)/configuracoes/usuarios/actions.ts`)

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

Decisões:
- A validação `senha.length < 6` some — não existe mais campo de senha para validar.
- `revalidatePath` roda antes da tentativa de envio de email — a lista de usuários atualiza
  independente do resultado do email (o usuário já foi criado nesse ponto).
- O log (`registrarLog`) registra a criação do usuário de qualquer forma — falha no envio de
  email não é tratada como um evento de log separado, é só um estado de retorno da action.
- Se `criarUsuario` falhar (erro do Supabase), nada muda em relação a hoje.
- Se a criação for bem-sucedida mas o email falhar, a action **não desfaz** a criação do
  usuário — retorna sucesso com a senha gerada, para o admin repassar manualmente.

## 5. UI — `CriarUsuarioForm.tsx` + `CriarUsuarioDialog.tsx`

**`CriarUsuarioForm.tsx`**: remove o campo "Senha" (e o import de `PasswordInput`, que não é
usado em mais nenhum lugar deste arquivo) da seção "Acesso", que passa a ter só o campo Email.
O tipo do estado do `useActionState` ganha `emailFalhou`/`senhaGerada`. O `useEffect` que hoje
reseta o formulário e fecha o dialog automaticamente após 1.5s só deve disparar quando
`state?.success && !state?.emailFalhou` — se o email falhou, o dialog fica aberto até o admin
fechar manualmente, dando tempo de copiar a senha exibida.

Novo bloco de aviso (substituindo/complementando o bloco `state?.success` existente):

```tsx
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
```

**`CriarUsuarioDialog.tsx`**: troca o texto de aviso atual —

```tsx
<p className="text-xs text-muted-foreground">
  O usuário receberá acesso imediato — não é necessário confirmar email.
</p>
```

por:

```tsx
<p className="text-xs text-muted-foreground">
  Uma senha será gerada automaticamente e enviada por email para o novo usuário.
</p>
```

## Fora de escopo

- **Saída do sandbox mode do SES e verificação do domínio/email remetente** — configuração
  externa, feita pelo usuário no painel da AWS fora desta implementação; o código funciona com
  qualquer `SES_FROM_EMAIL` válido, verificado ou não.
- **Forçar troca de senha no primeiro login** — já marcado na issue como nota não bloqueante,
  depende de uma issue futura de alteração de senha do usuário autenticado.
- **Botão de copiar a senha** (clipboard) no aviso de falha de envio — o texto já fica
  selecionável; um botão dedicado é um incremento de UX que pode ser adicionado depois, não é
  necessário para o objetivo da issue.
- **Reenvio manual do email** pelo admin (ex: botão "reenviar senha") — não pedido pela issue.
