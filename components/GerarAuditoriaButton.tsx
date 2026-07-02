'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipboardList, Loader2 } from 'lucide-react'
import { gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function GerarAuditoriaButton() {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await gerarAuditoriaManual('manual', null)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Auditoria gerada com sucesso.')
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending} className="gap-1.5">
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ClipboardList className="w-3.5 h-3.5" />
      )}
      Gerar auditoria
    </Button>
  )
}
