'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type Props = {
  evolucao: { data: string; cumprimento: number }[]
  rankingAusencias: { nome: string; ausencias: number }[]
  distribuicaoPorUF: { uf: string; pct: number; total: number }[]
}

const evolucaoConfig = {
  cumprimento: { label: 'Cumprimento', color: 'oklch(0.452 0.286 294)' },
} satisfies ChartConfig

const ausenciasConfig = {
  ausencias: { label: 'Ausências', color: 'oklch(0.577 0.245 27.325)' },
} satisfies ChartConfig

const ufConfig = {
  pct: { label: 'Cumprimento', color: 'oklch(0.452 0.286 294)' },
} satisfies ChartConfig

function ufColor(pct: number) {
  if (pct >= 80) return 'oklch(0.6 0.18 150)'
  if (pct >= 60) return 'oklch(0.75 0.16 80)'
  return 'oklch(0.577 0.245 27.325)'
}

export function DashboardCharts({ evolucao, rankingAusencias, distribuicaoPorUF }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {evolucao.length > 1 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução do cumprimento</CardTitle>
            <CardDescription>% de alunos em dia nas últimas auditorias</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={evolucaoConfig} className="h-[220px] w-full">
              <AreaChart data={evolucao} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCumprimento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cumprimento)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-cumprimento)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <XAxis
                  dataKey="data"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ReferenceLine
                  y={80}
                  stroke="var(--color-cumprimento)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value}%`, 'Cumprimento']}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="cumprimento"
                  stroke="var(--color-cumprimento)"
                  strokeWidth={2}
                  fill="url(#gradCumprimento)"
                  dot={{ r: 3.5, fill: 'var(--color-cumprimento)', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {rankingAusencias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top ausências</CardTitle>
            <CardDescription>Alunos com mais relatórios pendentes</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ausenciasConfig} className="h-[280px] w-full">
              <BarChart
                data={rankingAusencias}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={96}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value} ausência(s)`, '']}
                      hideLabel
                    />
                  }
                />
                <Bar dataKey="ausencias" radius={[0, 4, 4, 0]} fill="var(--color-ausencias)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {distribuicaoPorUF.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cumprimento por estado</CardTitle>
            <CardDescription>% de alunos em dia por UF (linha = 80%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ufConfig} className="h-[280px] w-full">
              <BarChart
                data={distribuicaoPorUF}
                margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <XAxis
                  dataKey="uf"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ReferenceLine
                  y={80}
                  stroke="var(--color-pct)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => [
                        `${value}% · ${(item.payload as { total: number }).total} alunos`,
                        'Cumprimento',
                      ]}
                    />
                  }
                />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {distribuicaoPorUF.map((entry, i) => (
                    <Cell key={i} fill={ufColor(entry.pct)} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
