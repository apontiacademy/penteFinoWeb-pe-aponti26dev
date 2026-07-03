# Staging + Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `staging` branch between `develop` and `main`, and a `CHANGELOG.md` (Keep a Changelog format, SemVer) tracking releases going forward.

**Architecture:** Two independent, additive changes: (1) documentation/version files (`CHANGELOG.md`, `package.json` version bump, `README.md` gitflow section) committed on the current feature branch and merged into `develop` via PR like any other change; (2) a new persistent `staging` branch cut directly from `develop`'s current tip and pushed to `origin`, which immediately gets an automatic Vercel preview deployment (existing Git integration, no dashboard config needed) — this can happen independently of the docs PR merging.

**Tech Stack:** Git, GitHub CLI (`gh`), Node/npm (for build verification), no new libraries.

---

### Task 1: Create CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Write the file**

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

- [ ] **Step 2: Verify the file was created correctly**

Run: `node -e "console.log(require('fs').readFileSync('CHANGELOG.md','utf8').split('\n').length + ' lines')"`
Expected: prints a line count (no errors reading the file)

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: adicionar CHANGELOG.md com baseline 1.0.0"
```

---

### Task 2: Bump package.json version to 1.0.0

**Files:**
- Modify: `package.json:3`

- [ ] **Step 1: Change the version field**

In `package.json`, change:
```json
  "version": "0.1.0",
```
to:
```json
  "version": "1.0.0",
```

- [ ] **Step 2: Verify package.json is still valid JSON and the version matches**

Run: `node -pe "require('./package.json').version"`
Expected: `1.0.0`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version para 1.0.0"
```

---

### Task 3: Update README's gitflow section

**Files:**
- Modify: `README.md` (section "Fluxo de trabalho (gitflow)" — if the section doesn't exist yet on this branch because PR #26 hasn't merged into `develop`, add it as a new section at the end of the file, in the same style as the rest of the file)

- [ ] **Step 1: Replace (or add) the gitflow section**

If the section `## Fluxo de trabalho (gitflow)` already exists in `README.md`, replace its content with:

```markdown
## Fluxo de trabalho (gitflow)

Este projeto segue gitflow com três camadas de branches:

```
feat/*, fix/*  --PR-->  develop  --PR-->  staging  --PR-->  main
```

- `feat/*`/`fix/*`: branches de trabalho, uma por funcionalidade/correção, sempre a partir de `develop`.
- `develop`: integração contínua do que já foi revisado e mesclado.
- `staging`: ambiente de homologação. Recebe promoções de `develop` sob demanda, via PR. Tem deploy de preview automático na Vercel (mesma branch, sem configuração extra).
- `main`: produção. Só recebe promoções de `staging` (nunca direto de `develop`), via PR, depois de validado em staging.

Cada mudança notável é registrada no [CHANGELOG.md](./CHANGELOG.md), na seção `[Unreleased]`. Ao promover `staging` para `main`, essa seção vira uma nova versão datada.
```

If the section doesn't exist yet (because the README-update PR hasn't landed in `develop`), append the same block as a new `##` section at the end of `README.md`.

- [ ] **Step 2: Verify the section renders correctly**

Run: `grep -c "Fluxo de trabalho" README.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: atualizar README com fluxo de staging e link do changelog"
```

---

### Task 4: Verify production build still passes

**Files:** none (verification only)

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build completes successfully, all routes compiled (same as before this change — these edits don't touch app code, this just confirms nothing broke)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean)

No commit for this task — it's verification only.

---

### Task 5: Push branch and open PR into develop

**Files:** none (git operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin docs/gitflow-staging-changelog
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base develop --title "docs: adicionar changelog e documentar fluxo de staging" --body "$(cat <<'EOF'
## Resumo
- Adiciona CHANGELOG.md (Keep a Changelog) com baseline retroativo 1.0.0.
- Bumpa package.json de 0.1.0 para 1.0.0 para casar com o changelog.
- Atualiza o README descrevendo o novo fluxo de 3 camadas (develop → staging → main).

## Test plan
- [x] npm run build
- [x] npx tsc --noEmit
EOF
)"
```

Expected: PR URL printed, e.g. `https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/pull/NN`

---

### Task 6: Create and push the staging branch

**Files:** none (git operations only — this is independent of Task 5's PR being merged; `staging` starts from `develop`'s current tip)

- [ ] **Step 1: Fetch latest develop**

```bash
git fetch origin develop
```

- [ ] **Step 2: Create the staging branch from develop's current tip**

```bash
git checkout -b staging origin/develop
```

- [ ] **Step 3: Push it to origin**

```bash
git push -u origin staging
```

Expected: `staging` now exists on the remote. Vercel's existing Git integration will pick it up automatically and produce a preview deployment on the next push to that branch (no dashboard action required).

- [ ] **Step 4: Switch back to the feature branch (in case more work follows)**

```bash
git checkout docs/gitflow-staging-changelog
```

---

## Spec coverage check

- Branch flow (`feat/fix → develop → staging → main`) — Task 6 (branch creation) + Task 3 (documented in README).
- No new Vercel infra, same Supabase DB — explicitly not configured anywhere in this plan (nothing to do — covered by Task 6's note).
- Changelog file, Keep a Changelog format, `[Unreleased]` + retroactive `[1.0.0]` — Task 1.
- SemVer synced with `package.json` — Task 2.
- README gitflow section updated — Task 3.
- Out of scope items (branch protection, custom domain, isolated staging DB, changelog automation) — intentionally have no task.
