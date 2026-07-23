# Evolução do dashboard: últimos 15 dias com forward-fill

## Contexto

Issue [#77](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/77) já foi corrigida na branch `fix/dashboard-grafico-evolucao-limit` (PR #90): a query buscava as 10 auditorias mais antigas em vez das mais recentes (`ascending: true` + `.limit(10)`), travando o gráfico. O fix mínimo trocou pra `ascending: false` + `.reverse()`.

Esse documento substitui aquela lógica por uma mais correta: em vez de "últimas 10 auditorias" (que mistura datas de forma imprevisível quando há mais de uma auditoria por dia), o gráfico passa a mostrar **os últimos 15 dias corridos a partir de hoje**, um ponto por dia. Continua na mesma branch/PR, já que substitui por completo a lógica que acabou de ser corrigida ali.

## Objetivo

- Mostrar exatamente 15 pontos (um por dia calendário, América/São Paulo), dos últimos 15 dias corridos até hoje.
- Se houver mais de uma auditoria no mesmo dia, usar a **última** (por `created_at`).
- Se um dia não teve nenhuma auditoria, herdar o valor do dia anterior que teve (forward-fill).
- Se não há nenhuma auditoria anterior pra herdar (início do histórico do sistema), omitir esses dias do início da série em vez de mostrar 0%.

## Arquitetura

### `lib/evolucao-dashboard.ts` (novo)

Isola toda a lógica de bucketing por dia e forward-fill numa função pura e testável, seguindo a mesma convenção de `lib/scroll.ts`/`lib/pagination.ts`.

```ts
export type PontoAuditoria = { createdAt: string; cumprimento: number }

const DIA_MS = 24 * 60 * 60 * 1000

function paraDiaISO(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)
}

export function inicioDaJanela(hoje: Date, dias: number): Date {
  return new Date(hoje.getTime() - (dias - 1) * DIA_MS)
}

export function montarEvolucao15Dias(
  auditorias: PontoAuditoria[],
  ultimaAnterior: PontoAuditoria | null,
  hoje: Date
): { diaISO: string; cumprimento: number }[] {
  const JANELA_DIAS = 15

  const ultimaPorDia = new Map<string, PontoAuditoria>()
  for (const a of auditorias) {
    const dia = paraDiaISO(new Date(a.createdAt))
    const atual = ultimaPorDia.get(dia)
    if (!atual || new Date(a.createdAt).getTime() > new Date(atual.createdAt).getTime()) {
      ultimaPorDia.set(dia, a)
    }
  }

  const resultado: { diaISO: string; cumprimento: number }[] = []
  let valorAtual = ultimaAnterior?.cumprimento ?? null

  for (let i = JANELA_DIAS - 1; i >= 0; i--) {
    const dia = paraDiaISO(new Date(hoje.getTime() - i * DIA_MS))
    const auditoriaDoDia = ultimaPorDia.get(dia)
    if (auditoriaDoDia) {
      valorAtual = auditoriaDoDia.cumprimento
      resultado.push({ diaISO: dia, cumprimento: valorAtual })
    } else if (valorAtual !== null) {
      resultado.push({ diaISO: dia, cumprimento: valorAtual })
    }
  }

  return resultado
}
```

Notas de design:
- `paraDiaISO` usa `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`, que formata como `YYYY-MM-DD` — a mesma técnica (locale `en-CA`) dá uma chave de dia calendário ordenável, sem precisar de lib de datas.
- Aritmética de dias em milissegundos (`DIA_MS`) é segura aqui porque o Brasil não tem mais horário de verão desde 2019 — América/São Paulo é UTC-3 fixo o ano todo, então "subtrair N dias" em milissegundos sempre cai no dia calendário certo. Isso não seria seguro em fusos com DST.
- `auditorias` pode conter itens fora da janela de 15 dias (a query real traz uma margem de segurança) — a função ignora com segurança qualquer dia que não caia nos 15 dias enumerados a partir de `hoje`, já que só itera sobre esses 15 dias e consulta o map por chave.
- Se houver múltiplas auditorias no mesmo dia, o `Map` guarda apenas a de maior `createdAt` (comparação por timestamp, não por ordem de chegada no array).

### `app/(protected)/dashboard/page.tsx`

A 4ª query do `Promise.all` (a que tinha o bug) é substituída por duas:

```ts
const hoje = new Date()
const inicioJanela = inicioDaJanela(hoje, 16) // 1 dia de margem de segurança pra query

const [
  { count: totalAuditorias },
  { count: totalRelatorios },
  { data: ultimaAuditoria },
  { data: historico },
  { data: auditoriaAnterior },
] = await Promise.all([
  supabase.from('auditorias').select('*', { count: 'exact', head: true }),
  supabase.from('relatorios').select('*', { count: 'exact', head: true }).is('deleted_at', null),
  supabase
    .from('auditorias')
    .select('created_at, resultado_json')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
  supabase
    .from('auditorias')
    .select('created_at, resultado_json')
    .gte('created_at', inicioJanela.toISOString()),
  supabase
    .from('auditorias')
    .select('created_at, resultado_json')
    .lt('created_at', inicioJanela.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(),
])
```

`inicioDaJanela(hoje, 16)` (16, não 15) dá 1 dia de margem na query — o corte exato dos 15 dias fica por conta de `montarEvolucao15Dias`, que já lida com itens fora da janela real. Isso evita depender de acertar o boundary exato na query SQL.

Um helper local (não exportado, só em `page.tsx`) calcula `cumprimento` a partir de `resultado_json`, reaproveitando a mesma fórmula que já existe:

```ts
function calcularCumprimento(resultadoJson: unknown): number {
  const nf = (resultadoJson as Resultado | null)?.nao_feitos ?? []
  const total = nf.length
  const emDia = nf.filter((r) => r.totalAusencias === 0).length
  return total > 0 ? Math.round((emDia / total) * 100) : 0
}
```

E a montagem de `evolucao` passa a ser:

```ts
const pontosHistorico: PontoAuditoria[] = (historico ?? []).map((a) => ({
  createdAt: a.created_at,
  cumprimento: calcularCumprimento(a.resultado_json),
}))
const pontoAnterior: PontoAuditoria | null = auditoriaAnterior
  ? { createdAt: auditoriaAnterior.created_at, cumprimento: calcularCumprimento(auditoriaAnterior.resultado_json) }
  : null

const evolucao = montarEvolucao15Dias(pontosHistorico, pontoAnterior, hoje).map((p) => {
  const [, mes, dia] = p.diaISO.split('-')
  return { data: `${dia}/${mes}`, cumprimento: p.cumprimento }
})
```

A conversão de `diaISO` (`YYYY-MM-DD`) pra `"dd/mm"` é feita por **manipulação de string**, não recriando um `Date` e reformatando com `toLocaleDateString`. Recriar um `Date` a partir de `diaISO` reintroduziria risco de fuso horário (`new Date('2026-07-07')` é meia-noite UTC; formatar de volta em América/São Paulo pode cair no dia anterior) — já que `diaISO` já é o dia calendário certo, a forma mais segura de exibi-lo é sem passar por `Date` de novo.

`components/DashboardCharts.tsx` **não muda** — continua recebendo `{ data: string; cumprimento: number }[]`, mesmo formato de antes.

## Fluxo de dados (resumo)

```
Promise.all busca:
  - historico: auditorias com created_at >= (hoje - 16 dias)
  - auditoriaAnterior: última auditoria antes da janela (pra seed do 1º dia, se preciso)
        │
        ▼
calcula cumprimento de cada uma (mesma fórmula de sempre)
        │
        ▼
montarEvolucao15Dias(pontosHistorico, pontoAnterior, hoje)
  para cada um dos 15 dias (mais antigo → mais recente):
    - teve auditoria no dia? usa a última do dia, atualiza "valor atual"
    - não teve? usa "valor atual" (forward-fill), se existir
    - "valor atual" ainda não existe (sem histórico algum)? omite o dia
        │
        ▼
mapeia diaISO → "dd/mm" (string, sem recriar Date) → evolucao
        │
        ▼
DashboardCharts recebe evolucao (mesmo formato de antes)
```

## Tratamento de erros / casos de borda

- Nenhuma auditoria em lugar nenhum (`historico=[]`, `auditoriaAnterior=null`): `montarEvolucao15Dias` retorna `[]`; `DashboardCharts` já trata isso (`evolucao.length > 1` esconde o card do gráfico).
- Sistema muito novo, com auditorias só nos últimos 3 dias: os 12 dias anteriores são omitidos (sem `ultimaAnterior` pra herdar); a série começa no primeiro dia real.
- Múltiplas auditorias no mesmo dia: usa a última por `created_at`, não a última por ordem de chegada no array (a query não impõe ordenação específica).
- Auditoria criada exatamente hoje: cai corretamente no último dia da janela (`i = 0`).
- Nenhuma mudança em `lib/gerar-auditoria.ts` ou nas outras queries do dashboard (KPIs, ranking de ausências, distribuição por UF) — escopo é só a série de evolução.

## Testes

`montarEvolucao15Dias` e `inicioDaJanela` são puras — testadas com Vitest, com `hoje` sempre injetado explicitamente (nunca `new Date()` dentro do teste, pra não depender do relógio real):

- Um dia com múltiplas auditorias → usa a de maior `createdAt`.
- Dia sem auditoria no meio da janela → herda o valor do dia anterior.
- Vários dias seguidos sem auditoria → herda em cadeia (mesmo valor repetido).
- Primeiro dia da janela sem auditoria própria, mas com `ultimaAnterior` → usa o valor de `ultimaAnterior`.
- Primeiro(s) dia(s) sem auditoria própria e sem `ultimaAnterior` (`null`) → omitidos do resultado.
- Nenhuma auditoria em lugar nenhum → array vazio.
- Item em `auditorias` fora da janela de 15 dias (simulando a margem de segurança da query real) → ignorado.
- `inicioDaJanela`: `dias=15` volta 14 dias; `dias=1` retorna a própria data de `hoje`.

`app/(protected)/dashboard/page.tsx` continua sem teste automatizado (Server Component com chamadas reais ao Supabase, mesma situação já aceita pras outras páginas do projeto). Verificação manual fica no plano de implementação, incluindo checagem visual com dados reais do Supabase.

## Fora de escopo

- Não altera as outras queries/gráficos do dashboard (KPIs, ranking de ausências, distribuição por UF).
- Não adiciona seletor de período (7/15/30 dias) — fixo em 15 dias, conforme pedido.
- Não persiste nem cacheia a série calculada — recalculada a cada request, como o resto da página.
- Não trata o caso de o relógio do servidor estar com fuso errado — assume `new Date()` do runtime como fonte de verdade pra "agora", igual ao resto do código já assume hoje.
