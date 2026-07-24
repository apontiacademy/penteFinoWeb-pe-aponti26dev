# Preview e reordenamento (drag-n-drop) da numeração dos relatórios antes da anexação

## Contexto

Issue [#78](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/78): a ordem em que os relatórios são anexados define a numeração (`Relatório N`) e a ordem usada por `gerarAuditoria` (`lib/gerar-auditoria.ts`), mas hoje isso é implícito — sem visualização prévia nem forma de reorganizar antes da anexação efetiva.

**Descoberta durante a investigação**: a issue foi escrita presumindo upload de um arquivo por vez, mas o código atual (`components/AdicionarRelatorioForm.tsx`, `app/(protected)/relatorios/actions.ts`) **já suporta seleção múltipla de arquivos** (`<input type="file" multiple>`, Server Action `adicionarRelatorios` no plural, processando um array). A numeração é atribuída sequencialmente conforme a ordem que o navegador retorna os arquivos selecionados (`FormData.getAll('arquivos')`), sem qualquer controle do usuário sobre essa ordem antes de confirmar. Isso muda o escopo real do trabalho: falta só a etapa de prévia + reordenação, não o suporte a múltiplos arquivos em si.

## Objetivo

Ao selecionar 2 ou mais arquivos, abrir um modal de confirmação mostrando a numeração que cada um vai receber, permitindo reordenar via drag-and-drop e remover arquivos individualmente antes de confirmar o upload.

## Decisões

- **Escopo do reorder**: só os arquivos sendo anexados na leva atual. Não mexe em relatórios já anexados anteriormente — não precisa de coluna nova no banco (`ordem`/`posicao`), a ordem final vira a ordem de inserção (`created_at`) na hora do upload, exatamente como já funciona hoje.
- **Quando abre o modal**: só com 2+ arquivos selecionados. Com 1 arquivo, envia direto (comportamento atual inalterado, sem clique extra pro caso mais comum).
- **Cancelar o modal**: só fecha, mantém os arquivos selecionados no formulário (não limpa a seleção).
- **Dentro do modal**: além de arrastar pra reordenar, cada linha tem um botão de remover — tira aquele arquivo da leva sem precisar cancelar tudo e selecionar de novo.
- **Layout**: modal (`Dialog`, já existente no projeto), não expansão inline no formulário.
- **Biblioteca de drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`. Compatível com React 19 (`peerDependencies: react >=16.8.0`), sem vulnerabilidades conhecidas (verificado via GitHub Advisories). Suporte a teclado (`KeyboardSensor`) incluído por padrão do próprio dnd-kit, não é escopo extra.
- **Numeração no preview é uma estimativa, não uma reserva**: calculada no carregamento da página (Server Component). Se outro admin anexar um relatório entre o carregamento e a confirmação deste usuário, o número final atribuído pelo servidor (recalculado no submit, como já acontece hoje) pode diferir do que foi mostrado no preview. Ferramenta interna de baixa concorrência — não resolvido com lock/transação, aceito como está.

## Arquitetura

### `lib/relatorio-numero.ts` (novo)

Extrai a lógica de "próximo número" que hoje está inline em `actions.ts`, pra reaproveitar tanto no preview (client, via prop calculada no Server Component) quanto na atribuição real (server, no submit):

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

### `app/(protected)/relatorios/actions.ts` (modificar)

Substitui o bloco inline de cálculo do `maiorNumero`/`proximoNumero` (linhas 74-80 atuais) por uma chamada à função extraída — sem mudar nenhum comportamento:

```ts
import { proximoNumeroRelatorio } from '@/lib/relatorio-numero'
// ...
let proximoNumero = proximoNumeroRelatorio((relatoriosAtivos ?? []).map((r) => r.nome))
```

### `app/(protected)/relatorios/page.tsx` (modificar)

Calcula `numeroInicial` reaproveitando os nomes que já busca pra `RelatoriosList`, passa como prop:

```ts
import { proximoNumeroRelatorio } from '@/lib/relatorio-numero'
// ...
const numeroInicial = proximoNumeroRelatorio((relatorios ?? []).map((r) => r.nome))
// ...
<AdicionarRelatorioForm numeroInicial={numeroInicial} />
```

### `components/RelatorioUploadPreviewModal.tsx` (novo)

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

### `components/AdicionarRelatorioForm.tsx` (modificar)

Passa a guardar os `File[]` reais (não só os nomes) em estado. No submit: 1 arquivo envia direto (comportamento atual); 2+ abre o modal em vez de submeter. Ao confirmar no modal, monta um `FormData` novo com os arquivos na ordem escolhida e chama a `action` do `useActionState` diretamente — a função retornada pelo hook pode ser invocada programaticamente com qualquer payload, não só via envio nativo de `<form>`, e o estado `pending` reflete corretamente esse caminho também.

```tsx
type Props = {
  numeroInicial: number
}

export function AdicionarRelatorioForm({ numeroInicial }: Props) {
  const [state, action, pending] = useActionState(adicionarRelatorios, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([])
  const [previewAberto, setPreviewAberto] = useState(false)
  // ...showGerarDialog, gerando: inalterados

  // useEffect(state): inalterado, exceto trocar setFileNames([]) por setArquivosSelecionados([])

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
    // 1 arquivo: deixa o form submeter normalmente, sem preventDefault
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
        {/* dropzone igual; onChange do input troca fileNames por: */}
        {/* onChange={(e) => setArquivosSelecionados(Array.from(e.target.files ?? []))} */}
        {/* label exibida usa arquivosSelecionados.length / .map(f => f.name) no lugar de fileNames */}
      </form>

      <RelatorioUploadPreviewModal
        open={previewAberto}
        arquivos={arquivosSelecionados}
        numeroInicial={numeroInicial}
        onConfirm={handleConfirmarPreview}
        onCancel={() => setPreviewAberto(false)}
      />

      {/* AlertDialog de "gerar auditoria": inalterado */}
    </>
  )
}
```

## Fluxo de dados (resumo)

```
Usuário seleciona arquivos no input nativo
        │
        ▼
onChange guarda File[] em estado (arquivosSelecionados)
        │
        ▼
Clica "Adicionar relatório(s)"
        │
   ┌────┴────┐
  1 arquivo   2+ arquivos
   │              │
   ▼              ▼
submit normal   abre RelatorioUploadPreviewModal
(form action)     │
   │              ▼
   │         usuário arrasta/remove (estado local do modal)
   │              │
   │         confirma → monta FormData na ordem final → action(formData)
   │              │
   └──────┬───────┘
          ▼
adicionarRelatorios (server action, inalterado):
  processa arquivos na ordem de FormData.getAll('arquivos'),
  atribui "Relatório N" sequencialmente, insere no banco
```

## Tratamento de erros / casos de borda

- Remover todos os arquivos dentro do modal (lista fica vazia): botão "Confirmar" desabilitado — usuário precisa cancelar ou deixar ao menos 1 arquivo.
- Cancelar o modal: mantém a seleção original no formulário (estado `arquivosSelecionados` não é limpo), permitindo reabrir o modal clicando em "Adicionar" de novo ou trocar a seleção no input.
- Numeração do preview divergindo da numeração final (concorrência entre admins): aceito, documentado acima — não é um bug a corrigir nesta versão.
- Falhas de upload/validação por arquivo (coluna de identificador ausente, arquivo vazio, erro de Storage): comportamento do `adicionarRelatorios` já existente, inalterado — cada falha aparece como toast individual, como hoje.
- Arrastar com teclado: suportado nativamente pelo `KeyboardSensor` do dnd-kit (Tab até o item, Space pra pegar, setas pra mover, Space pra soltar) — sem código extra além da configuração padrão do sensor.

## Testes

`lib/relatorio-numero.ts` é pura e testável com Vitest: array vazio retorna 1, nomes com padrão "Relatório N" retornam max+1, nomes fora do padrão são ignorados, gaps na numeração (ex.: 1 e 3 ativos, 2 deletado) não afetam o cálculo — mesmo comportamento já existente em `actions.ts`, só extraído.

`RelatorioUploadPreviewModal` e as mudanças em `AdicionarRelatorioForm` não ganham teste automatizado — mesma situação já aceita para os outros componentes client interativos deste projeto (`AuditResultTable.tsx`, `RelatoriosList.tsx` também não têm teste). Verificação manual (selecionar múltiplos arquivos, reordenar, remover, confirmar, conferir numeração final no banco) fica no plano de implementação.

## Fora de escopo

- Reordenar relatórios já anexados anteriormente — precisaria de uma coluna explícita de ordem/posição no banco (`relatorios.ordem`), decidido explicitamente que não faz parte desta versão.
- Otimização específica para touch/mobile no drag-and-drop — dnd-kit tem suporte básico a touch, mas não é o foco de testes/ajustes aqui; ferramenta de uso administrativo interno, majoritariamente desktop.
- Undo/histórico de reordenação dentro do modal além de arrastar de novo.
- Validação de conteúdo dos CSVs dentro do preview — já acontece no servidor durante a submissão, como hoje; o preview só lida com nome/ordem dos arquivos, não abre/valida o conteúdo.
