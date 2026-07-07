# Recuperação de senha ("Esqueci minha senha")

> Issue: https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/29

## Contexto

A tela de login (`app/(auth)/login/page.tsx`) só tem `signInWithPassword`. Não existe nenhum fluxo de recuperação de senha, nem rota de callback para lidar com links de email do Supabase Auth. O middleware (`proxy.ts`) hoje redireciona qualquer usuário não autenticado para `/login`, exceto a própria `/login`.

Issue relacionada (#27, fora de escopo aqui): geração de senha aleatória + envio de email na criação de usuário pelo admin. Aquela issue tem uma decisão em aberto sobre mecanismo de envio de email (Supabase nativo vs. provedor dedicado) porque precisa montar um email customizado com a senha gerada. **Essa decisão não se aplica aqui**: `resetPasswordForEmail` usa o e-mail de recuperação nativo do Supabase Auth (template configurado no painel do projeto), sem precisar de infraestrutura de email nova.

## Objetivo

Permitir que um usuário que esqueceu a senha solicite um link de recuperação por email e defina uma nova senha, sem intervenção do admin.

## Decisões

- Tela de "esqueci minha senha" é uma **rota separada** (`/esqueci-senha`), não um toggle dentro da página de login.
- Depois de definir a nova senha, o usuário **cai logado direto no dashboard** (a sessão de recuperação já é uma sessão válida) — não precisa logar de novo manualmente.
- Sem infraestrutura de email nova: usa o envio nativo do Supabase Auth via `resetPasswordForEmail`.

## Fluxo

```
[/login] --"Esqueci minha senha?"--> [/esqueci-senha]
   usuário digita email
   → supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/redefinir-senha` })
   → mensagem genérica de sucesso (sempre, exista ou não o email)

[email do Supabase] --link--> [/auth/callback?code=...&next=/redefinir-senha]
   → supabase.auth.exchangeCodeForSession(code)
   → sucesso: redirect para /redefinir-senha
   → falha (link inválido/expirado): redirect para /esqueci-senha?erro=link-invalido

[/redefinir-senha] (exige sessão de recuperação ativa)
   usuário digita nova senha + confirmação
   → supabase.auth.updateUser({ password })
   → sucesso: redirect para /dashboard (já autenticado)
   → sem sessão ativa ao acessar a rota diretamente: redirect para /esqueci-senha
```

## Componentes/arquivos

- **Modificar** `app/(auth)/login/page.tsx`: adicionar link "Esqueci minha senha?" abaixo do campo de senha, apontando para `/esqueci-senha`.
- **Criar** `app/(auth)/esqueci-senha/page.tsx`: formulário client-side com campo de email, chama `resetPasswordForEmail`, mostra mensagem de sucesso genérica ou erro genérico de rede/rate-limit. Se vier `?erro=link-invalido` na URL (redirecionado pelo callback), mostra aviso "Link inválido ou expirado, solicite novamente" acima do formulário.
- **Criar** `app/auth/callback/route.ts`: route handler (`GET`) que lê `code` e `next` da query string, chama `supabase.auth.exchangeCodeForSession(code)` usando um client server-side (`lib/supabase/server.ts`), e redireciona para `next` em caso de sucesso ou para `/esqueci-senha?erro=link-invalido` em caso de falha.
- **Criar** `app/(auth)/redefinir-senha/page.tsx`: formulário client-side com "nova senha" + "confirmar senha" (mínimo 6 caracteres, mesma regra de `CriarUsuarioForm.tsx`; validação de que os dois campos batem). Ao montar, verifica se há sessão ativa (`supabase.auth.getUser()`); se não houver, redireciona para `/esqueci-senha`. Em submit bem-sucedido, chama `updateUser({ password })` e redireciona para `/dashboard`.
- **Modificar** `proxy.ts`: adicionar `/esqueci-senha`, `/auth/callback` e `/redefinir-senha` à lista de rotas acessíveis sem autenticação (hoje só `/login` está isenta do redirect).

## Tratamento de erros

- `resetPasswordForEmail`: nunca expõe se o email existe ou não — sempre mostra a mesma mensagem de sucesso. Erros de rede/rate-limit mostram uma mensagem genérica de erro (sem detalhes técnicos).
- Link de callback inválido/expirado (`exchangeCodeForSession` falha): redireciona para `/esqueci-senha` com aviso para solicitar um novo link.
- Acesso direto a `/redefinir-senha` sem sessão de recuperação ativa: redireciona para `/esqueci-senha`.
- Senhas não coincidem ou menor que 6 caracteres em `/redefinir-senha`: erro inline no formulário, sem submeter.

## Testes

Não há lógica pura nova para testar com Vitest — é integração direta com Supabase Auth (mesmo padrão do login e da criação de usuário existentes, que também não têm testes automatizados). Verificação será manual no navegador: solicitar recuperação, seguir o link recebido por email, trocar a senha, confirmar que cai autenticado no dashboard; também testar o caminho de link inválido/expirado e o de acesso direto a `/redefinir-senha` sem sessão.

## Fora de escopo

- Geração de senha aleatória / envio de email na criação de usuário pelo admin (issue #27).
- Alteração de senha por um usuário já autenticado, fora do fluxo de recuperação (issue #28).
- Customização do template de email do Supabase (usa o template padrão configurado no painel).
