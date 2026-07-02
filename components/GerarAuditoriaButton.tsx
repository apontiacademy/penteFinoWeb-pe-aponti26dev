'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react'
import { gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function GerarAuditoriaButton() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await gerarAuditoriaManual('manual', null)
      setResult(res)
    })
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={pending} className="gap-1.5">
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ClipboardList className="w-3.5 h-3.5" />
        )}
        Gerar auditoria
      </Button>
      {result?.error && (
        <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/8 border border-destructive/20 px-2.5 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {result.error}
        </div>
      )}
      {result?.success && (
        <div className="flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 px-2.5 py-2 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Auditoria gerada com sucesso.
        </div>
      )}
    </div>
  )
}
