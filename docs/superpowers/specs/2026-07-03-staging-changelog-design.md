# Ambiente de staging + Changelog

## Contexto

O projeto segue gitflow com duas branches persistentes (`develop`, `main`). Promoções `develop→main` são manuais, feitas sob demanda via PR. Não existe hoje nenhum passo intermediário de homologação entre "integrado em develop" e "em produção", nem um histórico legível do que foi entregue em cada versão.

O deploy é feito na Vercel, com Git integration já ativa: qualquer branch com push ganha automaticamente uma URL de preview (`<projeto>-git-<branch>-<time>.vercel.app`), usando as mesmas env vars/banco (Supabase) do restante do projeto.

## Objetivo

1. Introduzir uma camada de staging/homologação no fluxo de branches, antes de promover para `main`.
2. Manter um `CHANGELOG.md` legível do que foi entregue em cada versão.

## Decisões

- **Staging é uma branch dedicada** (`staging`), persistente, entre `develop` e `main`. Não é a própria `develop` reaproveitada.
- **Sem infraestrutura nova na Vercel.** A branch `staging` usa o deploy de preview automático que a Vercel já gera para qualquer branch. Mesmo banco Supabase de produção (decisão explícita do usuário — simplicidade sobre isolamento de dados).
- **Changelog manual**, formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Sem ferramentas de automação (sem Conventional Commits obrigatório, sem release-please).
- **Versionamento SemVer simples** (`MAJOR.MINOR.PATCH`), sincronizado com `version` em `package.json`.

## Fluxo de branches

```
feat/*, fix/*  --PR-->  develop  --PR-->  staging  --PR-->  main
```

- `feat/*`/`fix/*` → `develop`: como já acontece hoje, sem mudanças.
- `develop` → `staging`: promoção manual, sob demanda (ex: "vamos homologar o que já está em develop"). Cria-se um PR `develop→staging`, mesmo padrão dos PRs de promoção já usados para `develop→main`.
- `staging` → `main`: promoção manual, sob demanda, **depois de validado em staging**. É neste passo que a release acontece: a seção `[Unreleased]` do changelog vira uma versão datada, e `package.json` é bumpado.
- `staging` nunca recebe merge direto de `feat/*`/`fix/*` — só de `develop`.
- `main` nunca recebe merge direto de `develop` — só de `staging`.

Nenhuma configuração adicional é necessária na Vercel: assim que a branch `staging` existir no remoto e receber push, a URL de preview correspondente passa a existir automaticamente. Um domínio amigável (ex: `staging.pentefino...`) é opcional e fica a critério do usuário, fora do escopo desta mudança.

## Changelog

Arquivo `CHANGELOG.md` na raiz do projeto, seguindo Keep a Changelog:

```markdown
# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [1.0.0] - 2026-07-03
### Added
- Login com autenticação via Supabase e toggle de mostrar/ocultar senha.
- Upload de relatórios semanais (CSV do Moodle) com histórico e exclusão.
- Geração de auditoria sob demanda, comparando planilha geral com relatórios ativos.
- Dashboard com indicadores gerais, evolução do cumprimento e distribuição por UF.
- Extração de UF/empresa a partir da coluna "Grupos" dos relatórios, como fallback quando a planilha geral não tem essa informação.
- Gerenciamento de usuários (admin).
### Fixed
- Quebra de layout em colunas com listas longas (ausências, nome) no grid de auditoria.
- Fuso horário das datas exibidas (America/Sao_Paulo), antes exibindo com +3h em produção.
```

- `[1.0.0]` é o baseline retroativo: resume o que já está em produção hoje (não é uma entrega nova). `package.json` é bumpado de `0.1.0` para `1.0.0` no mesmo commit.
- A partir de agora, todo PR relevante mesclado em `develop` adiciona sua entrada em `[Unreleased]` (nas subseções `Added`/`Changed`/`Fixed`/`Removed`, conforme o caso).
- Quando `staging→main` é promovido, `[Unreleased]` é renomeado para a próxima versão (ex: `[1.1.0] - 2026-07-10`) e uma nova seção `[Unreleased]` vazia é criada no topo.

## Fora de escopo

- Configuração de branch protection no GitHub para `staging`/`main`.
- Domínio customizado para o preview de staging.
- Banco Supabase isolado para staging (decisão explícita: usar o mesmo de produção).
- Automação de changelog/versionamento (ex: Conventional Commits + release-please) — pode ser revisitado no futuro se o processo manual se mostrar trabalhoso.

## Arquivos afetados

- `CHANGELOG.md` (novo)
- `package.json` (bump de versão)
- `README.md` (atualizar seção "Fluxo de trabalho" para descrever as 3 camadas de branches)
- Branch `staging` criada a partir de `develop` e enviada ao remoto
