import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, FileText, Users, TrendingUp, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DashboardCharts } from '@/components/DashboardCharts'
import { montarEvolucao15Dias, inicioDaJanela, type PontoAuditoria } from '@/lib/evolucao-dashboard'

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

  const hoje = new Date()
  const inicioJanela = inicioDaJanela(hoje, 16) // 1 dia de margem de segurança pra query historico
  const inicioJanelaReal = inicioDaJanela(hoje, 15) // inicio real da janela de 15 dias, usado pro seed de auditoriaAnterior

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
      .select('id, created_at, resultado_json')
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
      .lt('created_at', inicioJanelaReal.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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
      pct: totalRelatorios ? Math.round((r.totalAusencias / totalRelatorios) * 100) : 0,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral do acompanhamento de relatórios
          </p>
        </div>
        {ultimaAuditoria && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/auditorias/${ultimaAuditoria.id}`} />}
          >
            Ver última auditoria
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
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
