import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AuditResultTable } from '@/components/AuditResultTable'
import { ArrowLeft, Calendar, FileText } from 'lucide-react'
import { TRIGGER_INFO } from '@/lib/trigger-info'

type Resultado = {
  nao_feitos: {
    nomeCompleto: string
    estado: string
    empresa: string
    relatoriosAusentes: string
    totalAusencias: number
  }[]
  feitos: {
    nomeCompleto: string
    estado: string
    empresa: string
    relatoriosFeitos: string
    totalFeitos: number
  }[]
}

export default async function AuditoriaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auditoria } = await supabase
    .from('auditorias')
    .select('*')
    .eq('id', id)
    .single()

  if (!auditoria) notFound()

  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, semana')
    .in('id', auditoria.relatorios_incluidos ?? [])

  const resultado = auditoria.resultado_json as Resultado | null
  const info = TRIGGER_INFO[auditoria.trigger_type as keyof typeof TRIGGER_INFO]
  const Icon = info.icon

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href="/auditorias">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2 h-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          Auditorias
        </Button>
      </Link>

      {/* Hero */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${info.iconClass}`}
          >
            <Icon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">Auditoria</h1>
              <Badge variant="outline" className={`text-xs ${info.badgeClass}`}>
                {info.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(auditoria.created_at).toLocaleString('pt-BR')}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {auditoria.relatorios_incluidos?.length ?? 0} relatório(s) incluído(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Relatórios incluídos */}
      {relatorios && relatorios.length > 0 && (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
              Relatórios incluídos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {relatorios.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">{r.nome}</span>
                <span className="w-px h-3 bg-border" />
                <span className="text-xs text-muted-foreground">{r.semana}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {resultado ? (
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditResultTable
              auditId={id}
              naoFeitos={resultado.nao_feitos}
              feitos={resultado.feitos}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-border/60">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Resultado não disponível. Nenhum relatório ativo ou planilha geral ausente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
