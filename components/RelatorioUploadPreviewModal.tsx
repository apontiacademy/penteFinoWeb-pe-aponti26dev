'use client'

import { useState } from 'react'
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
  const [openAnterior, setOpenAnterior] = useState(open)

  if (open !== openAnterior) {
    setOpenAnterior(open)
    if (open) {
      setStaged(arquivos.map((file) => ({ id: crypto.randomUUID(), file })))
    }
  }

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
            Arraste para reordenar. Essa vai ser a numeração final.
          </DialogDescription>
        </DialogHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={staged.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {staged.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum arquivo selecionado.
                </p>
              )}
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
