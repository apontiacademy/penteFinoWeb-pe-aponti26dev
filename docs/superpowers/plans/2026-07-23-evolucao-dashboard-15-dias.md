# Evolução do dashboard: últimos 15 dias com forward-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a lógica de "últimas 10 auditorias" do gráfico de evolução do dashboard por "últimos 15 dias corridos", com forward-fill nos dias sem auditoria.

**Architecture:** Uma função pura (`montarEvolucao15Dias`) faz o bucketing por dia calendário (América/São Paulo) e o forward-fill; `app/(protected)/dashboard/page.tsx` busca os dados (janela de 15 dias + 1 auditoria anterior pra seed) e chama essa função.

**Tech Stack:** Next.js 16 (App Router, Server Component), TypeScript, Supabase, Vitest.

Spec de referência: `docs/superpowers/specs/2026-07-23-evolucao-dashboard-15-dias-design.md`

Branch atual: `fix/dashboard-grafico-evolucao-limit` (já existe, já tem o fix mínimo da issue #77 commitado — este plano continua na mesma branch/PR #90, substituindo aquela lógica pela versão final).

---

### Task 1: `lib/evolucao-dashboard.ts` — bucketing por dia + forward-fill

**Files:**
- Create: `lib/evolucao-dashboard.ts`
- Test: `lib/evolucao-dashboard.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `lib/evolucao-dashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarEvolucao15Dias, inicioDaJanela, type PontoAuditoria } from './evolucao-dashboard'

const HOJE = new Date('2026-07-23T15:00:00-03:00')

function dia(offsetDias: number, hora = '10:00:00'): string {
  const d = new Date(HOJE.getTime() - offsetDias * 24 * 60 * 60 * 1000)
  const iso = d.toISOString().slice(0, 10)
  return `${iso}T${hora}-03:00`
}

describe('montarEvolucao15Dias', () => {
  it('retorna array vazio quando não há nenhuma auditoria', () => {
    expect(montarEvolucao15Dias([], null, HOJE)).toEqual([])
  })

  it('usa a auditoria de maior created_at quando há mais de uma no mesmo dia', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(0, '08:00:00'), cumprimento: 50 },
      { createdAt: dia(0, '18:00:00'), cumprimento: 90 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].cumprimento).toBe(90)
  })

  it('herda o valor do dia anterior quando um dia não tem auditoria', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(2), cumprimento: 70 },
      // dia(1) sem auditoria
      { createdAt: dia(0), cumprimento: 85 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(3)
    expect(resultado.map((p) => p.cumprimento)).toEqual([70, 70, 85])
  })

  it('herda em cadeia por vários dias seguidos sem auditoria', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(4), cumprimento: 60 },
      { createdAt: dia(0), cumprimento: 95 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(5)
    expect(resultado.map((p) => p.cumprimento)).toEqual([60, 60, 60, 60, 95])
  })

  it('usa ultimaAnterior para herdar no primeiro dia da janela se ele não tiver auditoria própria', () => {
    const ultimaAnterior: PontoAuditoria = { createdAt: dia(20), cumprimento: 40 }
    const auditorias: PontoAuditoria[] = [{ createdAt: dia(0), cumprimento: 100 }]
    const resultado = montarEvolucao15Dias(auditorias, ultimaAnterior, HOJE)
    expect(resultado).toHaveLength(15)
    expect(resultado[0].cumprimento).toBe(40)
    expect(resultado[resultado.length - 1].cumprimento).toBe(100)
  })

  it('omite os dias iniciais sem nenhum histórico pra herdar (sem ultimaAnterior)', () => {
    const auditorias: PontoAuditoria[] = [{ createdAt: dia(2), cumprimento: 77 }]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    // só a partir do dia(2): dia(2), dia(1), dia(0) = 3 pontos
    expect(resultado).toHaveLength(3)
    expect(resultado.every((p) => p.cumprimento === 77)).toBe(true)
  })

  it('ignora itens fora da janela de 15 dias', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(30), cumprimento: 10 }, // fora da janela, deve ser ignorado
      { createdAt: dia(0), cumprimento: 88 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].cumprimento).toBe(88)
  })

  it('inclui uma auditoria criada hoje no último dia da janela', () => {
    const auditorias: PontoAuditoria[] = [{ createdAt: dia(0), cumprimento: 33 }]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado[resultado.length - 1].cumprimento).toBe(33)
  })
})

describe('inicioDaJanela', () => {
  it('volta 14 dias quando dias=15', () => {
    const resultado = inicioDaJanela(HOJE, 15)
    expect(resultado.getTime()).toBe(HOJE.getTime() - 14 * 24 * 60 * 60 * 1000)
  })

  it('retorna a própria data quando dias=1', () => {
    const resultado = inicioDaJanela(HOJE, 1)
    expect(resultado.getTime()).toBe(HOJE.getTime())
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- lib/evolucao-dashboard.test.ts`
Expected: FAIL com "Failed to resolve import './evolucao-dashboard'" (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `lib/evolucao-dashboard.ts`**

```ts
export type PontoAuditoria = { createdAt: string; cumprimento: number }

const DIA_MS = 24 * 60 * 60 * 1000
const JANELA_DIAS = 15

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

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- lib/evolucao-dashboard.test.ts`
Expected: PASS, 11/11 testes (9 de `montarEvolucao15Dias` + 2 de `inicioDaJanela`).

- [ ] **Step 5: Commit**

```bash
git add lib/evolucao-dashboard.ts lib/evolucao-dashboard.test.ts
git commit -m "feat: bucketing por dia e forward-fill pra evolucao do dashboard"
```

---

### Task 2: Atualizar `app/(protected)/dashboard/page.tsx`

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx`

Depende do Task 1 (`lib/evolucao-dashboard.ts`) já existir.

Estado atual do arquivo (pra referência exata de onde editar — já reflete o fix mínimo da issue #77, commit anterior nesta mesma branch):

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart3, FileText, Users, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardCharts } from '@/components/DashboardCharts'

type NaoFeito = {
  nomeCompleto: string
  estado: string
  empresa: string
  totalAusencias: number
}

type Resultado = { nao_feitos: NaoFeito[] }

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: totalAuditorias },
    { count: totalRelatorios },
    { data: ultimaAuditoria },
    { data: historico },
  ] = await Promise.all([
    supabase.from('auditorias').select('*', { count: 'exact', head: true }),
    supabase
      .from('relatorios')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('auditorias')
      .select('created_at, resultado_json')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('auditorias')
      .select('created_at, resultado_json')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const resultado = ultimaAuditoria?.resultado_json as Resultado | null
  const naoFeitos: NaoFeito[] = resultado?.nao_feitos ?? []
  const totalAlunos = naoFeitos.length
  const alunosEmDia = naoFeitos.filter((r) => r.totalAusencias === 0).length
  const taxaCumprimento = totalAlunos > 0 ? Math.round((alunosEmDia / totalAlunos) * 100) : 0

  const rankingAusencias = [...naoFeitos]
    .filter((r) => r.totalAusencias > 0)
    .sort((a, b) => b.totalAusencias - a.totalAusencias)
    .slice(0, 10)
    .map((r) => ({
      nome: r.nomeCompleto.split(' ').slice(0, 2).join(' '),
      ausencias: r.totalAusencias,
    }))

  const ufMap: Record<string, { total: number; emDia: number }> = {}
  for (const r of naoFeitos) {
    const uf = r.estado || 'N/D'
    if (!ufMap[uf]) ufMap[uf] = { total: 0, emDia: 0 }
    ufMap[uf].total++
    if (r.totalAusencias === 0) ufMap[uf].emDia++
  }
  const distribuicaoPorUF = Object.entries(ufMap)
    .map(([uf, { total, emDia }]) => ({
      uf,
      pct: Math.round((emDia / total) * 100),
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  const evolucao = [...(historico ?? [])].reverse().map((a) => {
    const res = a.resultado_json as Resultado | null
    const nf = res?.nao_feitos ?? []
    const total = nf.length
    const emDia = nf.filter((r) => r.totalAusencias === 0).length
    return {
      data: new Date(a.created_at).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
      }),
      cumprimento: total > 0 ? Math.round((emDia / total) * 100) : 0,
    }
  })

  const highlightClass = (pct: number) =>
  // ... resto do arquivo sem mudança (kpis, JSX)
```

- [ ] **Step 1: Adicionar o import**

Adicione junto aos outros imports no topo do arquivo:

```tsx
import { montarEvolucao15Dias, inicioDaJanela, type PontoAuditoria } from '@/lib/evolucao-dashboard'
```

- [ ] **Step 2: Trocar a 4ª query por duas (janela + auditoria anterior)**

Substitua o bloco `const [...] = await Promise.all([...])` inteiro por:

```tsx
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
    supabase
      .from('relatorios')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),
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

- [ ] **Step 3: Substituir o bloco de `evolucao`**

Substitua todo o bloco atual:

```tsx
  const evolucao = [...(historico ?? [])].reverse().map((a) => {
    const res = a.resultado_json as Resultado | null
    const nf = res?.nao_feitos ?? []
    const total = nf.length
    const emDia = nf.filter((r) => r.totalAusencias === 0).length
    return {
      data: new Date(a.created_at).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
      }),
      cumprimento: total > 0 ? Math.round((emDia / total) * 100) : 0,
    }
  })
```

por:

```tsx
  function calcularCumprimento(resultadoJson: unknown): number {
    const nf = (resultadoJson as Resultado | null)?.nao_feitos ?? []
    const total = nf.length
    const emDia = nf.filter((r) => r.totalAusencias === 0).length
    return total > 0 ? Math.round((emDia / total) * 100) : 0
  }

  const pontosHistorico: PontoAuditoria[] = (historico ?? []).map((a) => ({
    createdAt: a.created_at,
    cumprimento: calcularCumprimento(a.resultado_json),
  }))
  const pontoAnterior: PontoAuditoria | null = auditoriaAnterior
    ? {
        createdAt: auditoriaAnterior.created_at,
        cumprimento: calcularCumprimento(auditoriaAnterior.resultado_json),
      }
    : null

  const evolucao = montarEvolucao15Dias(pontosHistorico, pontoAnterior, hoje).map((p) => {
    const [, mes, dia] = p.diaISO.split('-')
    return { data: `${dia}/${mes}`, cumprimento: p.cumprimento }
  })
```

Note que `function calcularCumprimento` fica declarada dentro do componente, antes de ser usada — igual ao padrão de `highlightClass` mais abaixo no mesmo arquivo (função local declarada com `const`/`function` dentro do component body).

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: todos os testes passando (nenhum teste existente cobre `page.tsx` diretamente, então isso só confirma que nada mais quebrou).

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/dashboard/page.tsx"
git commit -m "feat: grafico de evolucao do dashboard passa a mostrar os ultimos 15 dias com forward-fill"
```

---

### Task 3: Verificação manual

**Files:** nenhum (só verificação)

Não há automação de browser disponível neste ambiente — verificação manual, feita pelo usuário:

- [ ] **Step 1: Rodar o dev server**

Run: `npm run dev`

- [ ] **Step 2: Roteiro de verificação manual**

1. Abrir `/dashboard` logado como admin.
2. Confirmar que o gráfico de evolução mostra até 15 pontos, com datas dos últimos 15 dias corridos (não mais preso em 07/07).
3. Conferir visualmente contra os dados reais do Supabase (projeto `chuppzvaanyasljuknen`, tabela `auditorias`) que os valores fazem sentido — em particular, dias com mais de uma auditoria devem refletir a última do dia, e dias sem auditoria devem repetir o valor do dia anterior (forward-fill visível como um platô na linha do gráfico).
4. Confirmar que o restante do dashboard (KPIs, ranking de ausências, distribuição por UF) continua funcionando normalmente — nada nessas seções foi alterado, mas vale conferir que a página renderiza sem erros.

- [ ] **Step 3: Registrar resultado**

Nenhum commit de código neste task — é só validação. Se algo falhar, abrir um fix conforme o problema encontrado antes de finalizar a branch.
