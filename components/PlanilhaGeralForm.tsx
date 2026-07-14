'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { uploadPlanilhaGeral } from '@/app/(protected)/configuracoes/actions'

export function PlanilhaGeralForm() {
  const [state, action, pending] = useActionState(uploadPlanilhaGeral, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [colunas, setColunas] = useState<string[]>([])
  const [idColuna, setIdColuna] = useState<string | null>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      setFileName(null)
      setColunas([])
      setIdColuna(null)
      toast.success('Planilha atualizada com sucesso!')
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setIdColuna(null)

    if (!file) {
      setFileName(null)
      setColunas([])
      return
    }

    setFileName(file.name)

    const texto = await file.text()
    const { meta } = Papa.parse<Record<string, string>>(texto, {
      header: true,
      preview: 1,
    })

    if (!meta.fields || meta.fields.length === 0) {
      setColunas([])
      toast.error('Não foi possível ler as colunas desse arquivo CSV.')
      return
    }

    setColunas(meta.fields)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!fileName) {
      e.preventDefault()
      toast.error('Selecione um arquivo CSV.')
      return
    }
    if (!idColuna) {
      e.preventDefault()
      toast.error('Selecione a coluna de identificador.')
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Arquivo CSV</Label>
        <label
          htmlFor="arquivo-pg"
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
              <span className="text-xs text-muted-foreground mt-1">
                Formatos: <code className="text-xs bg-muted px-1 rounded">residente, empresa</code> ou{' '}
                <code className="text-xs bg-muted px-1 rounded">Nome, Sobrenome, Grupos</code>
              </span>
            </>
          )}
        </label>
        <Input
          id="arquivo-pg"
          name="arquivo"
          type="file"
          accept=".csv"
          disabled={pending}
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {colunas.length > 0 && (
        <div className="space-y-2">
          <Label>Coluna de identificador único</Label>
          <Select name="idColuna" value={idColuna} onValueChange={setIdColuna} disabled={pending}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a coluna de identificador" />
            </SelectTrigger>
            <SelectContent>
              {colunas.map((coluna) => (
                <SelectItem key={coluna} value={coluna}>
                  {coluna}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Essa coluna será usada para cruzar os alunos com os relatórios semanais, no lugar do nome.
          </p>
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
            Atualizar planilha geral
          </>
        )}
      </Button>
    </form>
  )
}
