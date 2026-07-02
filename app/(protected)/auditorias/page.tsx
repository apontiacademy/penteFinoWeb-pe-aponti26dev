import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AuditoriasList } from '@/components/AuditoriasList'
import { BarChart3 } from 'lucide-react'

export default async function AuditoriasPage() {
  const supabase = await createClient()
  const { data: auditorias } = await supabase
    .from('auditorias')
    .select('id, created_at, trigger_type, relatorios_incluidos')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Auditorias</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Histórico de todas as auditorias geradas
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Histórico
          </CardTitle>
          <CardDescription>
            {auditorias?.length ?? 0} auditoria(s) gerada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditoriasList auditorias={auditorias ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
