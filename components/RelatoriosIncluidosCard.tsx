'use client'

import { ChevronDown, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type Relatorio = {
  id: string
  nome: string
  semana: string
}

type Props = {
  relatorios: Relatorio[]
}

export function RelatoriosIncluidosCard({ relatorios }: Props) {
  if (relatorios.length === 0) return null

  return (
    <Card className="shadow-sm border-border/60">
      <Collapsible>
        <CardHeader className="pb-3">
          <CollapsibleTrigger
            render={<Button variant="ghost" className="w-full justify-between px-2" />}
          >
            <CardTitle className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">
              Relatórios incluídos ({relatorios.length})
            </CardTitle>
            <ChevronDown className="w-4 h-4 text-foreground/50 transition-transform duration-300 group-data-panel-open/button:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-300 ease-in-out data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0">
          <CardContent className="flex flex-wrap gap-2 pt-0">
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
