'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UploadCloud, FileCheck2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { adicionarRelatorio } from '@/app/(protected)/relatorios/actions'

export function AdicionarRelatorioForm() {
  const [state, action, pending] = useActionState(adicionarRelatorio, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setFileName(null)
    }
  }, [state?.success])

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do relatório</Label>
          <Input
            id="nome"
            name="nome"
            required
            placeholder="ex: Relatório 1"
            disabled={pending}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="semana">Semana</Label>
          <Input
            id="semana"
            name="semana"
            required
            placeholder="ex: Semana 1"
            disabled={pending}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Arquivo CSV (exportado do Moodle)</Label>
        <label
          htmlFor="arquivo-rel"
          className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-8 px-4 text-center
            ${pending ? 'opacity-50 cursor-not-allowed' : ''}
            ${fileName
              ? 'border-primary/50 bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-primary/3'
            }`}
        >
          {fileName ? (
            <>
              <FileCheck2 className="w-7 h-7 text-primary mb-2" />
              <span className="text-sm font-medium text-primary truncate max-w-full px-4">
                {fileName}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Clique para trocar o arquivo
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
              <span className="text-sm font-medium text-foreground">
                Clique para selecionar um arquivo
              </span>
              <span className="text-xs text-muted-foreground mt-1">CSV exportado do Moodle</span>
            </>
          )}
        </label>
        <Input
          id="arquivo-rel"
          name="arquivo"
          type="file"
          accept=".csv"
          required
          disabled={pending}
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 px-3 py-2.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Relatório adicionado! Auditoria gerada automaticamente.
        </div>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            Adicionar e gerar auditoria
          </>
        )}
      </Button>
    </form>
  )
}
