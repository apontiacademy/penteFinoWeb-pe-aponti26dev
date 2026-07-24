# PDF consolidado por aluno

## Contexto

Issue [#74](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/74): portar/reaproveitar do Aponti ScriptHub um script (Python, `fpdf2`) que compila os relatórios de um aluno num único PDF, agrupado por mês → pergunta → semana → resposta.

Análise do script de referência (`apontiacademy/scriptHub-pe-aponti26dev`, `src/scripthub/scripts/compilacao_de_relatorios`) mostrou que:
- Ele baixa CSVs do Moodle (colunas `Nome completo`, `Grupos`, `Endereço de e-mail`, e colunas de pergunta numeradas `"1. Pergunta"`, `"2. Pergunta"`...) e gera um PDF por aluno com as respostas de cada semana.
- O CPF vem de um CSV externo separado (`residentes.csv`), que não existe no Pente Fino.
- O agrupamento por mês vem de uma config manual (`settings.json`) que mapeia nome-do-mês → lista de URLs semanais — conceito que o Pente Fino não tem (só relatórios sequenciais).

No Pente Fino, os relatórios são CSVs do Moodle enviados manualmente (`app/(protected)/relatorios`), armazenados **inteiros e sem alteração** no bucket `relatorios` do Storage — inclusive as colunas de pergunta que o app hoje ignora (`lib/pente-fino.ts` só lê a coluna de identificador pra calcular presença/ausência). Ou seja, os dados que o script original usa **já existem** no Storage do Pente Fino, só não são aproveitados ainda.

Decisões tomadas com o usuário (issue deixava em aberto "a critério de quem implementar"):
- **Conteúdo do PDF**: completo (perguntas/respostas por relatório), não só presença/ausência.
- **Agrupamento por mês**: replicar, mas sem o conceito de "mês" configurado manualmente do script original — o mês de cada relatório é **inferido do `created_at`** (fuso América/São Paulo), não de um campo novo.
- **CPF**: omitir do PDF (Pente Fino não tem essa informação em lugar nenhum).
- **Geração**: dois modos — sob demanda por aluno (botão por linha na tabela) **e** em lote pra todos os alunos da auditoria de uma vez (`.zip`, botão no topo da tela). A auditoria mais recente tem **508 alunos** — o lote baixa/parseia cada CSV de relatório **uma única vez** (não por aluno) pra não refazer 508× o mesmo parsing.

## Objetivo

Na tela de detalhe de uma auditoria (`/auditorias/[id]`): adicionar um botão "Gerar PDF" por aluno, que gera e baixa um PDF consolidado com os dados do aluno e suas respostas em cada relatório incluído naquela auditoria; e um botão "Baixar todos os PDFs" que gera um `.zip` com o PDF de cada aluno da auditoria de uma vez.

## Arquitetura

### Novas dependências

- `@react-pdf/renderer` (v4.5.1+, compatível com React 19) — gera PDF via componentes React (`Document`/`Page`/`View`/`Text`), roda em Node.js puro, sem binário nativo/Chromium. Preferido a `pdf-lib`/`pdfkit` (exigiriam recriar manualmente o posicionamento x/y que o script original faz via `fpdf2`) e a Puppeteer (pesado, exige configuração extra de runtime não trivial em Vercel).
- `jszip` (v3.10.1+) — monta o `.zip` da geração em lote. Pura JS, sem binário nativo, gera o buffer inteiro em memória (aceitável no volume atual de ~500 alunos × PDFs pequenos).

### `lib/pente-fino.ts`

`ResultadoAusencia` e `ResultadoPresenca` ganham um campo novo:

```ts
export type ResultadoAusencia = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador: string   // novo
  relatoriosAusentes: string
  totalAusencias: number
}

export type ResultadoPresenca = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador: string   // novo
  relatoriosFeitos: string
  totalFeitos: number
}
```

`calcularAusencias`/`calcularPresencas` passam a incluir `identificador: aluno.identificador` (o dado já está disponível em `Aluno`, só nunca foi propagado pra saída). **Auditorias geradas antes dessa mudança não terão esse campo** em `resultado_json` — tratamento disso na seção de UI abaixo.

Nova função — mesma extração do script original (`_extrair_colunas_perguntas` + lookup por linha), mas indexando **todas** as linhas do CSV de uma vez (não uma busca por aluno), pra poder ser reaproveitada tanto na geração individual quanto na em lote sem re-parsear o mesmo CSV centenas de vezes. O agrupamento por mês é feito depois, no nível da rota/PDF, a partir do `created_at` de cada relatório, não aqui:

```ts
export type RespostaPergunta = { pergunta: string; resposta: string }

// Chave: identificador do aluno. Ausente do mapa = aluno não enviou esse relatório.
export function indexarRespostasPorAluno(
  csvText: string,
  idColuna: string
): Map<string, RespostaPergunta[]> {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const mapa = new Map<string, RespostaPergunta[]>()
  const idKey = meta.fields?.find((f) => f === idColuna)
  if (!idKey) return mapa

  const colunasPergunta = (meta.fields ?? []).filter((f) => /^\d+\./.test(f.trim()))

  for (const row of data) {
    const identificador = (row[idKey] ?? '').trim()
    if (!identificador) continue
    mapa.set(
      identificador,
      colunasPergunta.map((col) => ({
        pergunta: col.replace(/^\d+\.\s*/, '').trim(),
        resposta: (row[col] ?? '').trim(),
      }))
    )
  }

  return mapa
}
```

Uso: `indexarRespostasPorAluno(csvText, idColuna).get(identificador) ?? null` — tanto a rota individual quanto a em lote chamam essa mesma função uma vez por relatório (não uma vez por aluno).

### Agrupamento por mês: `lib/relatorio-mes.ts` (novo)

Como o Pente Fino não grava "mês" em lugar nenhum, o mês de cada relatório é inferido do `created_at`, fuso América/São Paulo (mesma técnica de fuso fixo já usada em `lib/evolucao-dashboard.ts`):

```ts
export function formatarMesAno(date: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(date)
  const mes = partes.find((p) => p.type === 'month')?.value ?? ''
  const ano = partes.find((p) => p.type === 'year')?.value ?? ''
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ano}`
}

export function agruparRelatoriosPorMes<T extends { createdAt: string }>(
  relatorios: T[]
): { mes: string; relatorios: T[] }[] {
  const grupos = new Map<string, T[]>()
  for (const r of relatorios) {
    const mes = formatarMesAno(new Date(r.createdAt))
    if (!grupos.has(mes)) grupos.set(mes, [])
    grupos.get(mes)!.push(r)
  }
  return [...grupos.entries()].map(([mes, relatorios]) => ({ mes, relatorios }))
}
```

Pré-condição: `relatorios` precisa já vir ordenado ascendente por `created_at` (a query da rota já busca assim) — a ordem de inserção no `Map` é o que garante que os grupos saiam em ordem cronológica.

### Geração do PDF

Novo componente `lib/pdf/RelatorioAlunoPDF.tsx` (React, `@react-pdf/renderer`), com as seções:
- Título "Relatório de Residência" + nome do aluno
- "Dados do Aluno": Nome, Núcleo (estado), Empresa
- Um cabeçalho por mês (`agruparRelatoriosPorMes`), e dentro de cada mês, um bloco por relatório daquele mês (na ordem em que foram criados): nome do relatório como cabeçalho, lista de pergunta/resposta; se `.get(identificador)` não encontrar entrada no índice daquele relatório (aluno não enviou), mostra "Não enviado" em vez da lista
- Rodapé com número de página

### `app/api/auditorias/[id]/pdf-aluno/[identificador]/route.ts` (novo)

Mesmo padrão de `app/api/auditorias/[id]/download/route.ts` (auth de usuário logado via `createClient()`, operações via `createServiceClient()`):

1. Busca a auditoria (`relatorios_incluidos`, `resultado_json`) pelo `id` da URL.
2. Localiza o aluno pelo `identificador` da URL dentro de `resultado_json.nao_feitos`/`feitos` — nome/estado/empresa vêm daqui (autoritativo, não de query params). Se não encontrar, 404.
3. Busca a `id_coluna` atual na `planilha_geral` mais recente (mesma premissa de `gerar-auditoria.ts` — não fica gravada por auditoria; risco aceito de o admin ter trocado a coluna de ID entre a geração da auditoria e a geração do PDF, caso raro).
4. Busca `relatorios` (`nome`, `storage_path`, `created_at`) para os ids em `relatorios_incluidos`, ordenados ascendente por `created_at`.
5. Baixa cada CSV do Storage (bucket `relatorios`), roda `indexarRespostasPorAluno` e faz `.get(identificador)` pra cada relatório.
6. Agrupa os relatórios por mês com `agruparRelatoriosPorMes`.
7. Renderiza `RelatorioAlunoPDF` via `renderToBuffer` e devolve como `attachment` (`Content-Type: application/pdf`).

PDF gerado **na hora, não persistido** no Storage — cada request reprocessa os CSVs.

### `app/api/auditorias/[id]/pdf-todos/route.ts` (novo — geração em lote)

Mesmo padrão de auth. Diferença principal: baixa/indexa cada CSV de relatório **uma vez só**, não uma vez por aluno.

1. Busca a auditoria (`relatorios_incluidos`, `resultado_json`).
2. Lista de alunos = `resultado_json.nao_feitos` (tem todos os alunos da auditoria com `identificador`/`nomeCompleto`/`estado`/`empresa` — `feitos` cobre exatamente o mesmo conjunto de alunos, só com outros campos, então é indiferente qual dos dois usar como fonte da lista).
3. Busca a `id_coluna` atual (mesma premissa da rota individual).
4. Busca `relatorios` (`nome`, `storage_path`, `created_at`), ordenados ascendente.
5. Baixa **cada CSV uma vez** e roda `indexarRespostasPorAluno` uma vez por relatório, guardando o resultado (`{ nome, createdAt, respostas: Map<string, RespostaPergunta[]> }[]`).
6. Agrupa esses relatórios por mês com `agruparRelatoriosPorMes`.
7. Para cada aluno (`.get(aluno.identificador)` em cada relatório do agrupamento, sem reparsear nada): renderiza `RelatorioAlunoPDF` via `renderToBuffer` e adiciona ao zip em `<Estado>/<Empresa>/<Nome>.pdf` (mesma estrutura de pastas do script original), com o nome de cada pasta/arquivo passado por uma função local `sanitizarCaminho`.
8. Gera o buffer do zip (`jszip`'s `generateAsync({ type: 'nodebuffer' })`) e devolve como `attachment` (`Content-Type: application/zip`, filename `relatorios-auditoria-{id}.zip`).

`sanitizarCaminho`, equivalente ao `sanitizar_caminho` do script original, fica declarada dentro do próprio arquivo da rota (uso pontual, não precisa ser uma função de `lib/` reaproveitada em outro lugar):

```ts
function sanitizarCaminho(texto: string): string {
  return texto.replace(/[\\/*?:"<>|]/g, '').trim()
}
```

PDFs e zip gerados na hora, não persistidos no Storage.

### `components/AuditResultTable.tsx`

- Cada linha (tabelas "Não feitos" e "Feitos") ganha um botão "Gerar PDF" (ícone, ex. `FileDown` do lucide-react), visível só quando `row.identificador` existe (guarda contra auditorias antigas sem o campo). Link simples:

```tsx
<a href={`/api/auditorias/${auditId}/pdf-aluno/${row.identificador}`} download>
```

- O botão "Baixar CSV" do topo vira um `DropdownMenu` (componente já existente, `components/ui/dropdown-menu.tsx`, mesmo usado em `UserMenu.tsx`) com dois itens: "Baixar CSV" (link atual, inalterado) e "Baixar todos os PDFs (.zip)" (novo, link pra `/api/auditorias/${auditId}/pdf-todos`, não depende do `modo`/aba atual já que o conjunto de alunos é o mesmo nas duas abas).

Nenhum estado de loading client-side novo precisa ser gerenciado em nenhum dos dois casos — o navegador cuida do download.

`Props`/tipos locais (`NaoFeito`/`Feito` duplicados neste arquivo e em `app/(protected)/auditorias/[id]/page.tsx`) ganham `identificador: string` também, espelhando a mudança em `lib/pente-fino.ts`.

## Fluxo de dados (resumo)

```
admin clica "Gerar PDF" na linha de um aluno
        │
        ▼
GET /api/auditorias/{auditId}/pdf-aluno/{identificador}
        │
        ├─► busca auditoria → localiza aluno em resultado_json (nome/estado/empresa)
        ├─► busca id_coluna atual (planilha_geral mais recente)
        ├─► busca relatorios_incluidos (com created_at) → baixa cada CSV do Storage
        ├─► indexarRespostasPorAluno(csv, idColuna).get(identificador) por relatório
        ├─► agruparRelatoriosPorMes (a partir do created_at, fuso América/São Paulo)
        └─► renderiza RelatorioAlunoPDF → renderToBuffer
        │
        ▼
navegador baixa o PDF

────────────────────────────────────────────────────

admin clica "Baixar todos os PDFs (.zip)" no topo da tela
        │
        ▼
GET /api/auditorias/{auditId}/pdf-todos
        │
        ├─► busca auditoria → lista de alunos (resultado_json.nao_feitos)
        ├─► busca id_coluna atual + relatorios_incluidos (com created_at)
        ├─► baixa e indexa cada CSV UMA VEZ (indexarRespostasPorAluno por relatório)
        ├─► agruparRelatoriosPorMes (mesmo agrupamento, calculado uma vez)
        ├─► pra cada aluno: monta os dados via .get(identificador) nos índices já prontos,
        │   renderiza RelatorioAlunoPDF, adiciona ao zip em <Estado>/<Empresa>/<Nome>.pdf
        └─► gera o buffer do zip (jszip)
        │
        ▼
navegador baixa o .zip
```

## Tratamento de erros / casos de borda

- Auditoria sem `identificador` no `resultado_json` (gerada antes desta feature): botão "Gerar PDF" fica oculto na UI. Se a rota for chamada mesmo assim (URL direta), retorna 404 ("aluno não encontrado nessa auditoria").
- Aluno não encontrado na auditoria (`identificador` não bate com nenhuma linha de `resultado_json`): 404.
- Relatório com falha ao baixar do Storage: pula esse relatório (mesmo tratamento best-effort já usado em `gerar-auditoria.ts` pra relatórios que falham ao baixar), não aborta a geração inteira (nem a individual, nem a em lote).
- Aluno não enviou um relatório específico (`.get(identificador)` não encontra entrada no índice): bloco do relatório mostra "Não enviado".
- `planilha_geral` sem `id_coluna` configurada, ou ausente: erro 500 com mensagem clara (mesma situação já tratada em `gerar-auditoria.ts`).
- Nenhum relatório incluído na auditoria (`relatorios_incluidos` vazio): PDF(s) gerado(s) só com os dados do aluno, sem nenhum bloco de relatório.
- Geração em lote com `resultado_json.nao_feitos` vazio (auditoria sem alunos): zip vazio devolvido — sem tela de erro, já que tecnicamente não há nada de errado, só nada pra gerar.
- Falha ao renderizar o PDF de UM aluno específico durante o lote: não deveria acontecer em condições normais (mesmos dados/formato pra todos), mas se acontecer, a exceção propaga e aborta o lote inteiro (sem tratamento parcial/best-effort por aluno nesta primeira versão — tratamento granular fica de fora do escopo).

## Testes

`indexarRespostasPorAluno` é pura e testável com Vitest, mesmo estilo de `lib/pagination.test.ts`/`lib/scroll.test.ts`. Vale testar: CSV com múltiplos alunos indexados corretamente, aluno ausente do CSV (chave ausente do mapa, não `undefined` explícito vs `null`), coluna de identificador ausente no CSV (mapa vazio), CSV sem nenhuma coluna de pergunta (cada aluno mapeia pra `[]`), identificador duplicado no CSV (última linha vence — mesmo comportamento de `Map.set`).

`formatarMesAno`/`agruparRelatoriosPorMes` (`lib/relatorio-mes.ts`) também são puras e testáveis: formatação básica (data → "Julho 2026"), múltiplos relatórios no mesmo mês agrupados juntos, relatórios em meses diferentes gerando grupos separados em ordem cronológica, lista vazia retorna `[]`.

A rota (`route.ts`) e o componente de PDF (`RelatorioAlunoPDF.tsx`) não têm teste automatizado — mesma situação já aceita pras outras rotas/Server Components deste projeto que dependem de Storage/Supabase real. Verificação manual (abrir uma auditoria real, gerar PDF de um aluno, conferir conteúdo) fica no plano de implementação.

## Fora de escopo

- Job em background/assíncrono pra geração em lote — decidido explicitamente que não nesta primeira versão; é síncrono numa única requisição (otimizado pra reprocessar cada CSV uma vez só, não por aluno).
- Barra de progresso ou qualquer feedback incremental durante a geração em lote — o navegador só espera a resposta, sem indicação de "aluno X de 508" nesse meio tempo.
- Reprocessamento parcial/best-effort se a geração de UM aluno falhar durante o lote — uma falha aborta o lote inteiro.
- Campo "mês" configurável manualmente por relatório — o mês é sempre inferido do `created_at`, sem UI/schema novo pra isso.
- CPF no PDF — Pente Fino não tem essa informação; não é adicionado.
- Persistência do PDF/zip gerado no Storage — gerado sob demanda a cada request, não fica salvo.
- Qualquer mudança no fluxo de upload de relatórios ou no cálculo de ausências/presenças além de expor `identificador` na saída (que já existe internamente, só não era propagado).
- Restringir a geração de PDF a admins especificamente — segue o mesmo nível de permissão do endpoint de download de CSV já existente (qualquer usuário autenticado), não é uma decisão nova desta feature.
