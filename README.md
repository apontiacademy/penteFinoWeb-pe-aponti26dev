# Pente Fino

Ferramenta interna da Aponti para auditoria de relatórios semanais de estágio (Moodle). Compara a planilha geral de alunos com os relatórios recebidos e gera automaticamente uma auditoria mostrando quem entregou e quem está com pendências, por semana, estado (UF) e empresa.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [Supabase](https://supabase.com) — Postgres (dados), Storage (CSVs) e Auth (login)
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI)
- [Vitest](https://vitest.dev) para testes unitários
- [PapaParse](https://www.papaparse.com) para leitura dos CSVs exportados do Moodle

## Funcionalidades

- **Login** com autenticação via Supabase.
- **Relatórios**: upload dos CSVs semanais exportados do Moodle, com histórico e exclusão.
- **Auditorias**: geração sob demanda (comparando a planilha geral com os relatórios ativos), com detalhamento de presenças/ausências por aluno.
- **Dashboard**: indicadores gerais, evolução do cumprimento e distribuição por UF.
- **Configurações**: upload da planilha geral de alunos e gerenciamento de usuários (admin).

## Pré-requisitos

- Node.js 20+
- Um projeto no [Supabase](https://supabase.com) já configurado com as tabelas usadas pelo app (`auditorias`, `relatorios`, `planilha_geral`, etc.) e um bucket de Storage para os CSVs.

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env.local` na raiz do projeto com as credenciais do seu projeto Supabase:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```

   > A `SUPABASE_SERVICE_ROLE_KEY` é usada apenas em código server-side (ex.: gerenciamento de usuários) e nunca deve ser exposta no client.

3. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

| Comando               | Descrição                                  |
| --------------------- | ------------------------------------------- |
| `npm run dev`          | Sobe o servidor de desenvolvimento (Turbopack) |
| `npm run build`        | Build de produção                           |
| `npm run start`        | Sobe o servidor de produção (após o build)  |
| `npm run lint`         | Roda o ESLint                               |
| `npm run test`         | Roda os testes unitários (Vitest)           |
| `npm run test:watch`   | Roda os testes em modo watch                |

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

## Deploy

O deploy é feito na [Vercel](https://vercel.com). Configure as mesmas variáveis de ambiente do `.env.local` no painel do projeto na Vercel.
