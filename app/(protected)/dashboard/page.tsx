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
      .order('created_at', { ascending: true })
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

  const evolucao = (historico ?? []).map((a) => {
    const res = a.resultado_json as Resultado | null
    const nf = res?.nao_feitos ?? []
    const total = nf.length
    const emDia = nf.filter((r) => r.totalAusencias === 0).length
    return {
      data: new Date(a.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      cumprimento: total > 0 ? Math.round((emDia / total) * 100) : 0,
    }
  })

  const highlightClass = (pct: number) =>
    pct >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

  const kpis = [
    {
      title: 'Auditorias geradas',
      value: String(totalAuditorias ?? 0),
      icon: BarChart3,
      sub: 'total histórico',
      valueClass: '',
    },
    {
      title: 'Relatórios ativos',
      value: String(totalRelatorios ?? 0),
      icon: FileText,
      sub: 'na última auditoria',
      valueClass: '',
    },
    {
      title: 'Alunos monitorados',
      value: String(totalAlunos),
      icon: Users,
      sub: 'na última auditoria',
      valueClass: '',
    },
    {
      title: 'Cumprimento atual',
      value: `${taxaCumprimento}%`,
      icon: TrendingUp,
      sub: `${alunosEmDia} de ${totalAlunos} alunos em dia`,
      valueClass: totalAlunos > 0 ? highlightClass(taxaCumprimento) : '',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral do acompanhamento de relatórios
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ title, value, icon: Icon, sub, valueClass }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
              <Icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalAlunos > 0 ? (
        <DashboardCharts
          evolucao={evolucao}
          rankingAusencias={rankingAusencias}
          distribuicaoPorUF={distribuicaoPorUF}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Nenhuma auditoria encontrada. Adicione relatórios para ver os gráficos.
          </p>
        </div>
      )}
    </div>
  )
}
