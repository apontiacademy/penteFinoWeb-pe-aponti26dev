# Preview e reordenamento de relatórios antes da anexação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao selecionar 2+ arquivos em `AdicionarRelatorioForm`, abrir um modal mostrando a numeração ("Relatório N") que cada um vai receber, permitindo reordenar via drag-and-drop e remover arquivos individualmente antes de confirmar o upload.

**Architecture:** Nova função pura `proximoNumeroRelatorio` em `lib/relatorio-numero.ts` (extraída da lógica já existente em `actions.ts`, reaproveitada também no preview). Novo componente `RelatorioUploadPreviewModal.tsx` usando `Dialog` (já existente) + `@dnd-kit`. `AdicionarRelatorioForm.tsx` passa a guardar `File[]` reais, abre o modal com 2+ arquivos, e monta o `FormData` final na ordem confirmada antes de chamar a Server Action.

**Tech Stack:** Next.js 15 (App Router, Server Actions), TypeScript, React 19 (`useActionState`), `@dnd-kit`, Vitest.

---

### Task 1: Instalar dependências

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Confirmar instalação**

Run: `npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adicionar dependencias dnd-kit"
```

---

### Task 2: `lib/relatorio-numero.ts` — extrair cálculo do próximo número

**Files:**
- Create: `lib/relatorio-numero.ts`
- Create: `lib/relatorio-numero.test.ts`

Independente do Task 1 — pode ser feito em paralelo, mas segue a ordem do plano.

- [ ] **Step 1: Escrever o teste que falha**

Crie `lib/relatorio-numero.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { proximoNumeroRelatorio } from './relatorio-numero'

describe('proximoNumeroRelatorio', () => {
  it('retorna 1 quando não há relatórios existentes', () => {
    expect(proximoNumeroRelatorio([])).toBe(1)
  })

  it('retorna o maior número + 1', () => {
    expect(proximoNumeroRelatorio(['Relatório 1', 'Relatório 2', 'Relatório 3'])).toBe(4)
  })

  it('ignora nomes fora do padrão "Relatório N"', () => {
    expect(proximoNumeroRelatorio(['Relatório 1', 'Planilha extra', 'Relatório 2'])).toBe(3)
  })

  it('lida corretamente com gaps na numeração (relatório do meio deletado)', () => {
    // Relatório 2 foi deletado (soft delete) — não entra na lista de ativos,
    // mas o próximo número continua vindo do maior já usado (3), não do gap.
    expect(proximoNumeroRelatorio(['Relatório 1', 'Relatório 3'])).toBe(4)
  })

  it('não quebra com nomes em ordem não sequencial na lista de entrada', () => {
    expect(proximoNumeroRelatorio(['Relatório 3', 'Relatório 1', 'Relatório 2'])).toBe(4)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- lib/relatorio-numero.test.ts`
Expected: FAIL com "Failed to resolve import './relatorio-numero'".

- [ ] **Step 3: Implementar `lib/relatorio-numero.ts`**

```ts
export function proximoNumeroRelatorio(nomesExistentes: string[]): number {
  const maiorNumero = nomesExistentes.reduce((max, nome) => {
    const match = /^Relatório (\d+)$/.exec(nome)
    const numero = match ? parseInt(match[1], 10) : 0
    return Math.max(max, numero)
  }, 0)
  return maiorNumero + 1
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- lib/relatorio-numero.test.ts`
Expected: PASS, 5/5 testes.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add lib/relatorio-numero.ts lib/relatorio-numero.test.ts
git commit -m "feat: extrair calculo do proximo numero de relatorio para funcao pura"
```

---

### Task 3: Refatorar `actions.ts` pra usar a função extraída

**Files:**
- Modify: `app/(protected)/relatorios/actions.ts`

Depende do Task 2. Refatoração pura — sem mudar comportamento.

- [ ] **Step 1: Trocar o cálculo inline pela função extraída**

Localize, no topo do arquivo:

```ts
import { registrarLog } from '@/lib/system-log'
import { planilhaTemColuna } from '@/lib/pente-fino'
```

Adicione o import:

```ts
import { registrarLog } from '@/lib/system-log'
import { planilhaTemColuna } from '@/lib/pente-fino'
import { proximoNumeroRelatorio } from '@/lib/relatorio-numero'
```

Localize, dentro de `adicionarRelatorios`:

```ts
    const maiorNumero = (relatoriosAtivos ?? []).reduce((max, r) => {
      const match = /^Relatório (\d+)$/.exec(r.nome)
      const numero = match ? parseInt(match[1], 10) : 0
      return Math.max(max, numero)
    }, 0)

    let proximoNumero = maiorNumero + 1
```

Substitua por:

```ts
    let proximoNumero = proximoNumeroRelatorio((relatoriosAtivos ?? []).map((r) => r.nome))
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar os testes**

Run: `npm test`
Expected: todos passando.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/relatorios/actions.ts"
git commit -m "refactor: reaproveitar proximoNumeroRelatorio em actions.ts"
```

---

### Task 4: `page.tsx` — calcular e passar `numeroInicial`

**Files:**
- Modify: `app/(protected)/relatorios/page.tsx`

Depende do Task 2. Independente do Task 3.

- [ ] **Step 1: Adicionar o import e o cálculo**

Localize:

```ts
import { RelatoriosList } from '@/components/RelatoriosList'
import { AdicionarRelatorioForm } from '@/components/AdicionarRelatorioForm'
import { GerarAuditoriaButton } from '@/components/GerarAuditoriaButton'
import { FileText } from 'lucide-react'
```

Adicione o import:

```ts
import { RelatoriosList } from '@/components/RelatoriosList'
import { AdicionarRelatorioForm } from '@/components/AdicionarRelatorioForm'
import { GerarAuditoriaButton } from '@/components/GerarAuditoriaButton'
import { proximoNumeroRelatorio } from '@/lib/relatorio-numero'
import { FileText } from 'lucide-react'
```

Localize:

```ts
  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, semana, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
```

Adicione logo depois:

```ts
  const { data: relatorios } = await supabase
    .from('relatorios')
    .select('id, nome, semana, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const numeroInicial = proximoNumeroRelatorio((relatorios ?? []).map((r) => r.nome))
```

- [ ] **Step 2: Passar a prop pro form**

Localize:

```tsx
        <CardContent>
          <AdicionarRelatorioForm />
        </CardContent>
```

Substitua por:

```tsx
        <CardContent>
          <AdicionarRelatorioForm numeroInicial={numeroInicial} />
        </CardContent>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: erro esperado nesse ponto — `AdicionarRelatorioForm` ainda não aceita `numeroInicial` (isso é corrigido no Task 6). Confirme que o erro é exatamente sobre essa prop não existir, nada mais.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/relatorios/page.tsx"
git commit -m "feat: calcular e passar numeroInicial para AdicionarRelatorioForm"
```

---

### Task 5: `components/RelatorioUploadPreviewModal.tsx` — modal de preview/reorder

**Files:**
- Create: `components/RelatorioUploadPreviewModal.tsx`

Depende do Task 1 (`@dnd-kit`). Independente das Tasks 2-4.

- [ ] **Step 1: Criar o componente**

Crie `components/RelatorioUploadPreviewModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { GripVertical, X } from 'lucide-react'

type ArquivoStaged = { id: string; file: File }

type Props = {
  open: boolean
  arquivos: File[]
  numeroInicial: number
  onConfirm: (arquivosOrdenados: File[]) => void
  onCancel: () => void
}

export function RelatorioUploadPreviewModal({
  open,
  arquivos,
  numeroInicial,
  onConfirm,
  onCancel,
}: Props) {
  const [staged, setStaged] = useState<ArquivoStaged[]>([])

  useEffect(() => {
    if (open) {
      setStaged(arquivos.map((file) => ({ id: crypto.randomUUID(), file })))
    }
  }, [open, arquivos])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setStaged((atual) => {
      const oldIndex = atual.findIndex((a) => a.id === active.id)
      const newIndex = atual.findIndex((a) => a.id === over.id)
      return arrayMove(atual, oldIndex, newIndex)
    })
  }

  function removerItem(id: string) {
    setStaged((atual) => atual.filter((a) => a.id !== id))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar ordem dos relatórios</DialogTitle>
          <DialogDescription>
            Arraste pra reordenar. Essa vai ser a numeração final.
          </DialogDescription>
        </DialogHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={staged.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {staged.map((item, index) => (
                <ItemArrastavel
                  key={item.id}
                  id={item.id}
                  numero={numeroInicial + index}
                  nomeArquivo={item.file.name}
                  onRemover={() => removerItem(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(staged.map((a) => a.file))} disabled={staged.length === 0}>
            Confirmar e anexar ({staged.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemArrastavel({
  id,
  numero,
  nomeArquivo,
  onRemover,
}: {
  id: string
  numero: number
  nomeArquivo: string
  onRemover: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 bg-card ${
        isDragging ? 'border-primary shadow-lg z-10' : 'border-border/60'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-xs font-semibold text-primary bg-primary/10 rounded-md px-2 py-0.5 shrink-0">
        Relatório {numero}
      </span>
      <span className="text-sm truncate flex-1">{nomeArquivo}</span>
      <button
        type="button"
        onClick={onRemover}
        className="text-muted-foreground hover:text-destructive shrink-0"
        aria-label={`Remover ${nomeArquivo}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a este arquivo (o erro do Task 4 sobre `numeroInicial` em `AdicionarRelatorioForm` ainda deve aparecer até o Task 6 — não é deste arquivo).

- [ ] **Step 3: Commit**

```bash
git add components/RelatorioUploadPreviewModal.tsx
git commit -m "feat: modal de preview e reordenamento de relatorios antes do upload"
```

---

### Task 6: `AdicionarRelatorioForm.tsx` — integrar o modal

**Files:**
- Modify: `components/AdicionarRelatorioForm.tsx`

Depende dos Tasks 4 e 5.

- [ ] **Step 1: Substituir o arquivo inteiro**

Conteúdo atual de `components/AdicionarRelatorioForm.tsx`:

```tsx
'use client'

import { useActionState, useRef, useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { adicionarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

export function AdicionarRelatorioForm() {
  const [state, action, pending] = useActionState(adicionarRelatorios, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [fileNames, setFileNames] = useState<string[]>([])
  const [showGerarDialog, setShowGerarDialog] = useState(false)
  const [gerando, startGerarTransition] = useTransition()

  useEffect(() => {
    if (!state) return

    if (state.error) {
      toast.error(state.error)
      return
    }

    if (state.falhas && state.falhas.length > 0) {
      state.falhas.forEach((falha) => toast.error(`${falha.nome}: ${falha.erro}`))
    }

    if (state.sucesso && state.sucesso.length > 0) {
      formRef.current?.reset()
      setFileNames([])
      toast.success(
        state.sucesso.length === 1
          ? 'Relatório anexado com sucesso!'
          : `${state.sucesso.length} relatórios anexados com sucesso!`
      )
      setShowGerarDialog(true)
    }
  }, [state])

  function handleGerarAuditoria() {
    const sucesso = state?.sucesso
    if (!sucesso || sucesso.length === 0) return
    const triggerId = sucesso.length === 1 ? sucesso[0].id : null
    startGerarTransition(async () => {
      const res = await gerarAuditoriaManual('add', triggerId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setShowGerarDialog(false)
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (fileNames.length === 0) {
      e.preventDefault()
      toast.error('Selecione ao menos um arquivo CSV.')
    }
  }

  return (
    <>
      <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Arquivo(s) CSV (exportado do Moodle)</Label>
          <label
            htmlFor="arquivo-rel"
            className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-8 px-4 text-center
              ${pending ? 'opacity-50 cursor-not-allowed' : ''}
              ${fileNames.length > 0
                ? 'border-primary/50 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-primary/3'
              }`}
          >
            {fileNames.length > 0 ? (
              <>
                <FileCheck2 className="w-7 h-7 text-primary mb-2" />
                <span className="text-sm font-medium text-primary truncate max-w-full px-4">
                  {fileNames.length === 1
                    ? fileNames[0]
                    : `${fileNames.length} arquivos selecionados`}
                </span>
                <span className="text-xs text-muted-foreground mt-1 truncate max-w-full px-4">
                  {fileNames.length === 1 ? 'Clique para trocar o arquivo' : fileNames.join(', ')}
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">
                  Clique para selecionar um ou mais arquivos
                </span>
                <span className="text-xs text-muted-foreground mt-1">CSV exportado do Moodle</span>
              </>
            )}
          </label>
          <Input
            id="arquivo-rel"
            name="arquivos"
            type="file"
            accept=".csv"
            multiple
            disabled={pending}
            className="sr-only"
            onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
          />
        </div>

        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              Adicionar relatório(s)
            </>
          )}
        </Button>
      </form>

      <AlertDialog
        open={showGerarDialog}
        onOpenChange={(open) => {
          if (!open) setShowGerarDialog(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state?.sucesso && state.sucesso.length > 1
                ? 'Relatórios anexados'
                : 'Relatório anexado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state?.sucesso && state.sucesso.length > 1
                ? `${state.sucesso.length} relatórios foram anexados com sucesso. Deseja gerar a auditoria agora?`
                : 'O relatório foi anexado com sucesso. Deseja gerar a auditoria agora?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarAuditoria} disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

Substitua o arquivo inteiro por:

```tsx
'use client'

import { useActionState, useRef, useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'
import { adicionarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'
import { RelatorioUploadPreviewModal } from '@/components/RelatorioUploadPreviewModal'

type Props = {
  numeroInicial: number
}

export function AdicionarRelatorioForm({ numeroInicial }: Props) {
  const [state, action, pending] = useActionState(adicionarRelatorios, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([])
  const [previewAberto, setPreviewAberto] = useState(false)
  const [showGerarDialog, setShowGerarDialog] = useState(false)
  const [gerando, startGerarTransition] = useTransition()

  useEffect(() => {
    if (!state) return

    if (state.error) {
      toast.error(state.error)
      return
    }

    if (state.falhas && state.falhas.length > 0) {
      state.falhas.forEach((falha) => toast.error(`${falha.nome}: ${falha.erro}`))
    }

    if (state.sucesso && state.sucesso.length > 0) {
      formRef.current?.reset()
      setArquivosSelecionados([])
      toast.success(
        state.sucesso.length === 1
          ? 'Relatório anexado com sucesso!'
          : `${state.sucesso.length} relatórios anexados com sucesso!`
      )
      setShowGerarDialog(true)
    }
  }, [state])

  function handleGerarAuditoria() {
    const sucesso = state?.sucesso
    if (!sucesso || sucesso.length === 0) return
    const triggerId = sucesso.length === 1 ? sucesso[0].id : null
    startGerarTransition(async () => {
      const res = await gerarAuditoriaManual('add', triggerId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setShowGerarDialog(false)
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (arquivosSelecionados.length === 0) {
      e.preventDefault()
      toast.error('Selecione ao menos um arquivo CSV.')
      return
    }
    if (arquivosSelecionados.length >= 2) {
      e.preventDefault()
      setPreviewAberto(true)
    }
  }

  function handleConfirmarPreview(arquivosOrdenados: File[]) {
    setPreviewAberto(false)
    const formData = new FormData()
    for (const arquivo of arquivosOrdenados) {
      formData.append('arquivos', arquivo)
    }
    action(formData)
  }

  return (
    <>
      <form ref={formRef} action={action} onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Arquivo(s) CSV (exportado do Moodle)</Label>
          <label
            htmlFor="arquivo-rel"
            className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-all py-8 px-4 text-center
              ${pending ? 'opacity-50 cursor-not-allowed' : ''}
              ${arquivosSelecionados.length > 0
                ? 'border-primary/50 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-primary/3'
              }`}
          >
            {arquivosSelecionados.length > 0 ? (
              <>
                <FileCheck2 className="w-7 h-7 text-primary mb-2" />
                <span className="text-sm font-medium text-primary truncate max-w-full px-4">
                  {arquivosSelecionados.length === 1
                    ? arquivosSelecionados[0].name
                    : `${arquivosSelecionados.length} arquivos selecionados`}
                </span>
                <span className="text-xs text-muted-foreground mt-1 truncate max-w-full px-4">
                  {arquivosSelecionados.length === 1
                    ? 'Clique para trocar o arquivo'
                    : arquivosSelecionados.map((f) => f.name).join(', ')}
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">
                  Clique para selecionar um ou mais arquivos
                </span>
                <span className="text-xs text-muted-foreground mt-1">CSV exportado do Moodle</span>
              </>
            )}
          </label>
          <Input
            id="arquivo-rel"
            name="arquivos"
            type="file"
            accept=".csv"
            multiple
            disabled={pending}
            className="sr-only"
            onChange={(e) => setArquivosSelecionados(Array.from(e.target.files ?? []))}
          />
        </div>

        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              Adicionar relatório(s)
            </>
          )}
        </Button>
      </form>

      <RelatorioUploadPreviewModal
        open={previewAberto}
        arquivos={arquivosSelecionados}
        numeroInicial={numeroInicial}
        onConfirm={handleConfirmarPreview}
        onCancel={() => setPreviewAberto(false)}
      />

      <AlertDialog
        open={showGerarDialog}
        onOpenChange={(open) => {
          if (!open) setShowGerarDialog(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {state?.sucesso && state.sucesso.length > 1
                ? 'Relatórios anexados'
                : 'Relatório anexado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {state?.sucesso && state.sucesso.length > 1
                ? `${state.sucesso.length} relatórios foram anexados com sucesso. Deseja gerar a auditoria agora?`
                : 'O relatório foi anexado com sucesso. Deseja gerar a auditoria agora?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={gerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarAuditoria} disabled={gerando}>
              {gerando ? 'Gerando...' : 'Gerar auditoria'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (o erro pendente do Task 4 sobre `numeroInicial` deve desaparecer agora).

- [ ] **Step 3: Rodar os testes**

Run: `npm test`
Expected: todos passando.

- [ ] **Step 4: Commit**

```bash
git add components/AdicionarRelatorioForm.tsx
git commit -m "feat: integrar modal de preview e reordenamento no formulario de anexar relatorio"
```

---

### Task 7: Verificação manual

Sem código — checklist pro usuário validar na tela real (`/relatorios`, como admin):

- [ ] Selecionar 1 arquivo CSV só → confirmar que envia direto, sem abrir modal (comportamento igual ao atual).
- [ ] Selecionar 3+ arquivos CSV → confirmar que o modal abre mostrando "Relatório N" pra cada um, com N começando no número certo (conferir contra os relatórios já existentes na lista "Relatórios ativos" abaixo).
- [ ] Arrastar um item pro meio da lista (mouse) → confirmar que a numeração de todos os itens atualiza em tempo real.
- [ ] Testar reordenar via teclado (Tab até o ícone de arrastar, Space pra pegar, setas pra mover, Space pra soltar).
- [ ] Remover um arquivo da lista (botão X) → confirmar que a numeração dos itens restantes se ajusta.
- [ ] Remover todos os arquivos → confirmar que o botão "Confirmar" fica desabilitado.
- [ ] Clicar "Cancelar" → confirmar que o modal fecha e os arquivos continuam selecionados no formulário (reabrir clicando em "Adicionar" de novo deve mostrar os mesmos arquivos).
- [ ] Confirmar o upload após reordenar → verificar na lista "Relatórios ativos" que os nomes ("Relatório N") batem com a ordem final escolhida no modal, não com a ordem de seleção original.
- [ ] Gerar uma auditoria depois e conferir que a ordem de processamento em `gerarAuditoria` reflete a ordem confirmada (via `created_at` dos relatórios recém-criados).

---
