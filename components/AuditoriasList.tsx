import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { TRIGGER_INFO } from '@/lib/trigger-info'

type Auditoria = {
  id: string
  created_at: string
  trigger_type: 'add' | 'delete' | 'manual'
  relatorios_incluidos: string[]
}

export function AuditoriasList({ auditorias }: { auditorias: Auditoria[] }) {
  if (!auditorias.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <ClipboardList className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">Nenhuma auditoria ainda</p>
        <p className="text-muted-foreground text-xs mt-1">
          Adicione relatórios em{' '}
          <Link href="/relatorios" className="text-primary underline-offset-2 hover:underline">
            Relatórios
          </Link>{' '}
          para gerar a primeira auditoria.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {auditorias.map((a, idx) => {
        const info = TRIGGER_INFO[a.trigger_type]
        const Icon = info.icon
        return (
          <li key={a.id}>
            <Link
              href={`/auditorias/${a.id}`}
              className="group flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${info.iconClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div>
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">
                    Auditoria #{auditorias.length - idx}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(a.created_at).toLocaleString('pt-BR')} ·{' '}
                    {a.relatorios_incluidos.length} relatório(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs border ${info.badgeClass}`}>
                  {info.label}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
