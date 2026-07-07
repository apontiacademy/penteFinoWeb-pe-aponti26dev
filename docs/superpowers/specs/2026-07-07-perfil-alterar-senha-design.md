# Perfil do usuário + alteração de senha

> Issue: https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/28

## Contexto

Não existe hoje nenhuma forma do próprio usuário autenticado trocar sua senha ou editar seus dados (nome/telefone) — essas ações só existem no fluxo de admin (`/configuracoes/usuarios`), que usa o service client e não deve ser reaproveitado aqui (afetaria/exigiria privilégio de admin para uma ação que qualquer usuário deve poder fazer sobre si mesmo).

Separadamente, apenas o campo de senha da tela de login (`app/(auth)/login/page.tsx`) tem um ícone de olho para mostrar/ocultar a senha digitada. Os campos de senha em `redefinir-senha/page.tsx` (2 campos) e `CriarUsuarioForm.tsx` (1 campo) não têm esse recurso, e essa mesma lógica seria duplicada de novo nos novos campos de troca de senha — bom momento para extrair um componente reutilizável.

## Objetivo

1. Permitir que o usuário autenticado edite nome/telefone e troque a própria senha, em uma página `/perfil`.
2. Padronizar o toggle de mostrar/ocultar senha em todos os campos de senha do app via um componente reutilizável.

## Decisões

- `/perfil` é uma **página nova**, fora do gate de admin, acessível a qualquer usuário autenticado.
- A página tem **duas seções independentes** (dados pessoais e alterar senha), cada uma com seu próprio formulário e server action — sucesso/erro de uma não afeta a outra.
- Troca de senha **exige a senha atual** (reautenticação via `signInWithPassword`) antes de aplicar a nova — proteção contra troca de senha em sessão aberta sem que a pessoa saiba a senha atual.
- Ambas as server actions usam o **client autenticado normal** (`lib/supabase/server.ts` `createClient()`), nunca o service client — o service client só existe para o admin agir sobre outros usuários; aqui a ação é sempre sobre o próprio usuário da sessão.
- Extrair um componente `PasswordInput` reutilizável para o toggle de mostrar/ocultar senha, e aplicá-lo em todos os campos de senha do app (login, redefinir-senha, criar usuário, e os novos campos de troca de senha).

## Componentes/arquivos

### Componente `PasswordInput`

- **Criar** `components/ui/password-input.tsx`: client component, encapsula um `Input` (`type` alternando entre `password`/`text`) com um botão de olho posicionado absolutamente (mesmo padrão visual já usado em `login/page.tsx`: `Eye`/`EyeOff` do lucide-react, `pr-10`, botão `tabIndex={-1}`). Aceita as mesmas props de `Input` (via spread), exceto `type`, que é controlado internamente.
- **Modificar** `app/(auth)/login/page.tsx`: substituir o `<div className="relative">...</div>` manual do campo de senha por `<PasswordInput />`, removendo o estado `mostrarSenha` local (passa a ser interno do componente). Comportamento visual idêntico.
- **Modificar** `app/(auth)/redefinir-senha/page.tsx`: trocar os dois `Input type="password"` (nova senha, confirmar senha) por `PasswordInput`.
- **Modificar** `components/CriarUsuarioForm.tsx`: trocar o `Input type="password"` do campo "Senha" por `PasswordInput`.

### Página `/perfil`

- **Criar** `app/(protected)/perfil/page.tsx`: server component, busca o usuário autenticado (`createClient()` + `getUser()`), renderiza duas `Card` (mesmo padrão visual de `configuracoes/page.tsx`): uma com `PerfilForm`, outra com `AlterarSenhaForm`.
- **Criar** `components/PerfilForm.tsx`: client component, campos "Nome" e "Telefone" (pré-preenchidos com `user_metadata.nome`/`user_metadata.telefone` atuais, passados via props), botão salvar, feedback de sucesso/erro inline (mesmo padrão dos outros forms do app).
- **Criar** `components/AlterarSenhaForm.tsx`: client component, campos "Senha atual", "Nova senha", "Confirmar nova senha" (todos `PasswordInput`), validação de nova senha ≥ 6 caracteres e nova senha === confirmação antes de submeter, botão salvar, feedback de sucesso/erro inline. Ao trocar com sucesso, limpa os três campos (não redireciona — usuário continua na página).
- **Criar** `app/(protected)/perfil/actions.ts`:
  - `atualizarPerfil(data: { nome: string; telefone: string })`: pega o usuário da sessão via `createClient()` + `getUser()`. Não é garantido que `updateUser({ data })` faça merge do `user_metadata` no servidor (comportamento não documentado no client — pode substituir o objeto inteiro), então a action busca o `user_metadata` atual do usuário retornado por `getUser()` e monta o payload explicitamente com spread: `{ ...user.user_metadata, nome: data.nome, telefone: data.telefone }`, preservando `cargo`/`funcao` de forma garantida independente do comportamento real da API.
  - `alterarSenha(senhaAtual: string, novaSenha: string)`: valida `novaSenha.length >= 6` (mesma regra de `criarUsuario`). Pega o email do usuário da sessão atual. Chama `supabase.auth.signInWithPassword({ email, password: senhaAtual })` — se falhar, retorna erro genérico "Senha atual incorreta". Se ok, chama `supabase.auth.updateUser({ password: novaSenha })`.
- **Modificar** `components/UserMenu.tsx`: adicionar item "Minha conta" (ícone `User` do lucide-react) no dropdown, acima do item "Configurações", visível para todos os usuários (não só admin) — link para `/perfil`.

## Tratamento de erros

- `atualizarPerfil`: erro de rede/Supabase mostra mensagem genérica inline no formulário de dados pessoais.
- `alterarSenha`:
  - Senha atual incorreta → "Senha atual incorreta" (não expõe detalhe técnico do erro do Supabase).
  - Nova senha < 6 caracteres → erro inline, sem submeter.
  - Nova senha ≠ confirmação → erro inline, sem submeter.
  - Erro de rede/Supabase no `updateUser` → mensagem genérica inline.

## Testes

Mesma situação das outras telas de auth já implementadas neste projeto (login, recuperação de senha): sem lógica pura nova para testar com Vitest — é integração direta com Supabase Auth. Verificação manual: editar nome/telefone e confirmar persistência (reload da página), trocar senha com senha atual errada (deve falhar), trocar senha com senha atual certa mas nova senha curta/sem confirmar (deve falhar com erro inline), trocar senha corretamente e confirmar login funciona com a senha nova. Verificar visualmente o ícone de olho nos 4 lugares (login, redefinir-senha ×2, criar usuário, alterar senha ×3).

## Fora de escopo

- Edição de `cargo`/`funcao` pelo próprio usuário (esses campos continuam só editáveis pelo admin em `/configuracoes/usuarios`).
- Exigir troca de senha no primeiro login (mencionado como nota não bloqueante na issue #27, não faz parte desta issue).
- Qualquer alteração no fluxo de admin (`criarUsuario`, `atualizarUsuario`, `deletarUsuario`) além da extração do `PasswordInput` no formulário de criação.
