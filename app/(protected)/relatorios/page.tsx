import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { RelatoriosList } from '@/components/RelatoriosList'
import { AdicionarRelatorioForm } from '@/components/AdicionarRelatorioForm'
import { GerarAuditoriaButton } from '@/components/GerarAuditoriaButton'
import { FileText } from 'lucide-react'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.role !== 'admin') redirect('/auditorias')

  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, semana, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie os relatórios Moodle usados nas auditorias
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>Adicionar relatório</CardTitle>
          <CardDescription>
            Faça upload do CSV exportado do Moodle. Depois de anexado, você poderá optar
            por gerar uma nova auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdicionarRelatorioForm />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Relatórios ativos</CardTitle>
            <CardDescription>
              {relatorios?.length ?? 0} relatório(s) incluídos na próxima auditoria
            </CardDescription>
          </div>
          <GerarAuditoriaButton />
        </CardHeader>
        <CardContent>
          <RelatoriosList relatorios={relatorios ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
