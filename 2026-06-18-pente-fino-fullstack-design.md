# Plano: Pente Fino — Full Stack (Next.js + Supabase)

## Contexto

O módulo `auditoria_de_relatorios` é um script CLI Python que cruza a lista de alunos com os relatórios respondidos no Moodle para identificar quem fez ou não fez cada relatório. É um dos cinco módulos do hub `menu.py`. O objetivo é transformar **apenas esse módulo** em uma aplicação web onde:

- **Admin** gerencia a planilha geral, adiciona/deleta relatórios e acompanha auditorias
- **Usuários finais** (equipe Aponti, lista fechada) consultam e baixam os resultados

A lógica de processamento é portada para TypeScript e executada em Server Actions do Next.js. O Supabase cuida de auth, storage e banco de dados.

---

## Estado atual do projeto

| Aspecto | Estado |
|---|---|
| Projeto web (Next.js) | **Não existe** — a criar do zero em `web/` |
| Configuração Supabase | **Não existe** — a criar |
| Módulo Python fonte | `auditoria_de_relatorios/executar.py` (348 linhas) |
| Script legado | `pente_fino.py` na raiz (versão anterior, sem modo duplo) |
| CSVs de amostra | `alunos.csv`, `residentes.csv`, `relatorio1.csv`–`relatorio6.csv`, `resultado_auditoria.csv` |

---

## Descobertas do módulo fonte

O arquivo canônico é **`auditoria_de_relatorios/executar.py`**, não o `pente_fino.py`. Ele tem funcionalidades adicionais não previstas no design inicial:

### Modo duplo
```python
def calcular_ausencias(df_alunos, relatorios) -> pd.DataFrame   # quem NÃO fez
def calcular_presencas(df_alunos, relatorios) -> pd.DataFrame   # quem FEZ
```
- `nao_feitos`: colunas `relatorios_ausentes`, `total_ausencias`
- `feitos`: colunas `relatorios_feitos`, `total_feitos`

**Decisão de design:** gerar ambos os modos a cada auditoria e oferecer toggle na UI — evita forçar escolha no upload.

### Funções a portar para TypeScript
```ts
// lib/pente-fino.ts
export function normalizarNome(nome: string): string
export function parsearGrupos(valor: string): [string, string]
export function carregarAlunos(csv: string): Aluno[]
export function carregarRelatorio(csv: string): Set<string>
export function calcularAusencias(alunos: Aluno[], relatorios: Record<string, Set<string>>): ResultadoAusencia[]
export function calcularPresencas(alunos: Aluno[], relatorios: Record<string, Set<string>>): ResultadoPresenca[]
```

Lógica a replicar fielmente:
- Normalização: `trim + lowercase + colapso de espaços`
- Dois formatos de planilha geral:
  - Colunas `residente`, `empresa`, `cnpj`
  - Colunas `Nome`, `Sobrenome`, `Grupos` (com parsing `"Estado: Empresa - CNPJ"`)
- Relatório: busca coluna `"Nome completo"`; arquivo sem essa coluna é ignorado (aviso)

---

## Arquitetura

### Stack
- **Next.js 15** (App Router, TypeScript, Tailwind CSS)
- **Supabase Auth** — email/senha, usuários criados manualmente pelo admin
- **Supabase Storage** — armazena CSVs de entrada e CSVs de resultado
- **Supabase PostgreSQL** — metadados de relatórios, auditorias e perfis
- **Next.js Server Actions** — processamento (sem edge function)

### Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | público | Formulário de login |
| `/relatorios` | admin | Lista + adiciona + deleta relatórios |
| `/auditorias` | todos | Lista todas as auditorias |
| `/auditorias/[id]` | todos | Tabela de resultado + toggle modo + download CSV |
| `/configuracoes` | admin | Atualizar planilha geral + gerenciar usuários |

### Estrutura do projeto
```
web/
  app/
    (auth)/
      login/page.tsx
    (protected)/
      layout.tsx                    ← auth guard
      relatorios/
        page.tsx
        actions.ts                  ← adicionarRelatorio, deletarRelatorio
      auditorias/
        page.tsx
        [id]/page.tsx
      configuracoes/
        page.tsx
        actions.ts                  ← uploadPlanilhaGeral
  lib/
    supabase/
      client.ts                     ← browser client
      server.ts                     ← server client (cookies)
    pente-fino.ts                   ← porta TypeScript de executar.py
    gerar-auditoria.ts              ← orquestra processamento + salva no banco
  middleware.ts                     ← auth + role check (admin routes)
  components/
    AuditResultTable.tsx            ← tabela com toggle nao_feitos / feitos
    RelatoriosList.tsx
    AuditoriasList.tsx
```

---

## Banco de Dados

```sql
-- Perfis e papéis
create table profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  role       text not null check (role in ('admin', 'user'))
);

-- Planilha geral (arquivo fixo, substituído quando admin faz novo upload)
create table planilha_geral (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  uploaded_at  timestamptz default now(),
  user_id      uuid references auth.users
);

-- Relatórios semanais (com soft delete)
create table relatorios (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  semana       text not null,
  storage_path text not null,
  created_at   timestamptz default now(),
  user_id      uuid references auth.users,
  deleted_at   timestamptz default null        -- null = ativo
);

-- Auditorias (geradas automaticamente em dois modos)
create table auditorias (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz default now(),
  trigger_type            text not null check (trigger_type in ('add', 'delete')),
  relatorio_trigger_id    uuid references relatorios,
  relatorios_incluidos    uuid[] not null,     -- IDs dos relatórios usados
  resultado_json          jsonb,               -- { nao_feitos: [...], feitos: [...] }
  resultado_nao_feitos_path  text,             -- Storage path CSV ausências
  resultado_feitos_path      text              -- Storage path CSV presenças
);
```

### Estrutura do `resultado_json`
```json
{
  "nao_feitos": [
    { "nome_completo": "...", "estado": "...", "empresa": "...",
      "relatorios_ausentes": "rel1, rel2", "total_ausencias": 2 }
  ],
  "feitos": [
    { "nome_completo": "...", "estado": "...", "empresa": "...",
      "relatorios_feitos": "rel3", "total_feitos": 1 }
  ]
}
```

### RLS
- Todos os usuários autenticados podem **ler** todas as tabelas
- Apenas admin pode **inserir/atualizar/deletar** (verificação de role nas Server Actions; service role key no servidor)

### Storage Buckets
```
relatorios/{relatorio_id}/arquivo.csv
planilha-geral/{id}/arquivo.csv
auditorias/{auditoria_id}/resultado-nao-feitos.csv
auditorias/{auditoria_id}/resultado-feitos.csv
```

---

## Lógica de Negócio

### Gatilhos de auditoria
`gerarAuditoria()` em `lib/gerar-auditoria.ts` é chamada em dois eventos:
1. **Admin adiciona um relatório** — inclui o novo
2. **Admin deleta um relatório** (soft delete) — recalcula sem ele

Passos internos:
```
1. Buscar planilha_geral mais recente do banco → ler CSV do Storage
2. Buscar todos os relatorios onde deleted_at IS NULL → ler cada CSV do Storage
3. calcularAusencias() + calcularPresencas()
4. Serializar ambos os resultados em CSV → upload para Storage
5. INSERT em auditorias com resultado_json e paths dos dois CSVs
```

### Server Action — adicionar relatório
```
1. Verificar role admin
2. Upload CSV → Storage (relatorios/{id}/arquivo.csv)
3. INSERT em relatorios
4. Chamar gerarAuditoria(trigger_type='add', relatorio_trigger_id=id)
```

### Server Action — deletar relatório
```
1. Verificar role admin
2. UPDATE relatorios SET deleted_at = now() WHERE id = ?
3. Chamar gerarAuditoria(trigger_type='delete', relatorio_trigger_id=id)
```

---

## Componentes principais

### `AuditResultTable`
- Props: `resultado: { nao_feitos: ResultadoAusencia[], feitos: ResultadoPresenca[] }`
- Toggle "Não feitos / Feitos" no topo da tabela
- Sorting por `total_ausencias` / `total_feitos`
- Linhas com total zero marcadas com "—"

### `/auditorias/[id]`
- Metadados: data/hora, relatórios incluídos (nomes), total de alunos
- `AuditResultTable` com toggle de modo
- Dois botões de download: "Baixar Não Feitos (CSV)" e "Baixar Feitos (CSV)"

### `/relatorios`
- Lista relatórios ativos (sem `deleted_at`)
- Formulário de upload: nome, semana, arquivo CSV
- Botão de delete com confirmação ("Isso irá gerar uma nova auditoria")

---

## Passos de Implementação

1. **Inicializar projeto Next.js**
   ```
   npx create-next-app@latest web --typescript --tailwind --app
   cd web && npm install @supabase/supabase-js @supabase/ssr papaparse @types/papaparse
   ```

2. **Configurar Supabase**
   - Criar projeto no Supabase dashboard
   - Executar SQL do schema acima (tabelas + RLS)
   - Criar buckets: `relatorios`, `planilha-geral`, `auditorias`
   - Políticas de storage: leitura autenticada; escrita via service role key no servidor

3. **Configurar auth Next.js + Supabase**
   - `lib/supabase/client.ts` e `lib/supabase/server.ts` com `@supabase/ssr`
   - `middleware.ts`: redireciona `/login` se não autenticado; bloqueia `/relatorios` e `/configuracoes` para não-admin

4. **Portar `auditoria_de_relatorios/executar.py` → `lib/pente-fino.ts`**
   - Parser CSV: `papaparse`
   - Funções: `normalizarNome`, `parsearGrupos`, `carregarAlunos`, `carregarRelatorio`, `calcularAusencias`, `calcularPresencas`
   - Testes unitários com os CSVs de amostra: `alunos.csv`, `residentes.csv`, `relatorio1.csv`–`relatorio6.csv`
   - Validar output contra `resultado_auditoria.csv` existente

5. **Construir `lib/gerar-auditoria.ts`**
   - Orquestra leitura do Storage + processamento + escrita no banco
   - Usada tanto no fluxo de add quanto no de delete

6. **Construir Server Actions**
   - `relatorios/actions.ts`: `adicionarRelatorio`, `deletarRelatorio`
   - `configuracoes/actions.ts`: `uploadPlanilhaGeral`

7. **Construir páginas**
   - `/login` — formulário Supabase Auth
   - `/relatorios` — lista + upload + delete (admin only)
   - `/auditorias` — lista com data, nº de relatórios incluídos
   - `/auditorias/[id]` — tabela com toggle + dois botões de download
   - `/configuracoes` — upload planilha geral + gerenciar usuários

8. **Download CSV**
   - Rota API `/api/auditorias/[id]/download?modo=nao_feitos|feitos`
   - Busca `resultado_nao_feitos_path` ou `resultado_feitos_path` no banco
   - Serve o CSV do Storage com `Content-Disposition: attachment`

---

## Verificação

1. **Testes unitários** (`lib/pente-fino.ts`)
   - Entrada: `alunos.csv` + `relatorio1.csv`–`relatorio6.csv`
   - Output esperado modo `nao_feitos`: comparar com `resultado_auditoria.csv`
   - Output modo `feitos`: inverso lógico do `nao_feitos`

2. **Fluxo admin**
   - Login como admin → `/configuracoes` → upload `alunos.csv`
   - `/relatorios` → upload `relatorio1.csv`, `relatorio2.csv`, `relatorio3.csv`
   - Verificar que 3 auditorias foram geradas automaticamente
   - Deletar `relatorio2.csv` → verificar 4ª auditoria gerada sem ele

3. **Fluxo usuário**
   - Login como usuário → `/relatorios` deve redirecionar (403/redirect)
   - `/auditorias` lista todas → `/auditorias/[id]` exibe tabela
   - Toggle entre "Não feitos" e "Feitos" funciona sem reload
   - Download dos dois CSVs funciona

4. **Consistência da lógica**
   - Resultado da aplicação web deve ser idêntico ao do script Python para os mesmos arquivos de entrada
