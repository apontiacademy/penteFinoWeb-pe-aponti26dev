# Download do relatório anexado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão de download por relatório em `/relatorios`, que baixa o CSV correspondente do Supabase Storage com feedback visual (spinner) durante o download e toast de erro em caso de falha.

**Architecture:** Uma nova rota `GET /api/relatorios/[id]/download` segue o mesmo formato das rotas de download de auditoria já existentes (auth check + service client + `storage.download()` + `Content-Disposition`). `components/RelatoriosList.tsx` ganha um botão de ícone por linha que faz `fetch` nessa rota, converte a resposta em blob e dispara o download via link temporário, com um estado local controlando o spinner.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Supabase Storage, Tailwind, `lucide-react`, `sonner` (toast).

Spec de referência: `docs/superpowers/specs/2026-07-27-download-relatorio-anexado-design.md`

---

### Task 1: `app/api/relatorios/[id]/download/route.ts` — rota de download

**Files:**
- Create: `app/api/relatorios/[id]/download/route.ts`

Sem teste automatizado (mesmo padrão já aceito para `app/api/auditorias/[id]/download/route.ts` e as rotas de PDF — dependem de `Request`/Supabase Storage reais e não são testadas neste projeto).

- [ ] **Step 1: Criar a rota**

Crie `app/api/relatorios/[id]/download/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function sanitizarCaminho(texto: string): string {
  const limpo = texto.replace(/[\\/*?:"<>|\r\n]/g, '').trim()
  return limpo === '' || /^\.+$/.test(limpo) ? '_' : limpo
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: relatorio } = await service
    .from('relatorios')
    .select('nome, storage_path, deleted_at')
    .eq('id', id)
    .single()

  if (!relatorio || relatorio.deleted_at) {
    return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
  }

  const { data: file, error: storageError } = await service.storage
    .from('relatorios')
    .download(relatorio.storage_path)

  if (!file || storageError) {
    return NextResponse.json({ error: 'Erro ao baixar arquivo do Storage' }, { status: 500 })
  }

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sanitizarCaminho(relatorio.nome)}.csv"`,
    },
  })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `app/api/relatorios/[id]/download/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/relatorios/[id]/download/route.ts"
git commit -m "feat: rota de download do relatorio anexado"
```

---

### Task 2: Botão de download em `components/RelatoriosList.tsx`

**Files:**
- Modify: `components/RelatoriosList.tsx`

Depende do Task 1 (a rota precisa existir para o botão funcionar de fato, embora a edição de UI em si não dependa tecnicamente do arquivo da rota para compilar).

Estado atual do arquivo (para referência exata de onde editar — arquivo completo tem 266 linhas):

```tsx
'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileText, Trash2, InboxIcon } from 'lucide-react'
import { deletarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'

type Relatorio = {
  id: string
  nome: string
  created_at: string
}

export function RelatoriosList({ relatorios }: { relatorios: Relatorio[] }) {
  const [selecionadosBruto, setSelecionados] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState(false)
  const [idsExcluidos, setIdsExcluidos] = useState<string[] | null>(null)
  const [gerando, setGerando] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  // ...
```

- [ ] **Step 1: Adicionar os imports**

Troque:
```tsx
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileText, Trash2, InboxIcon } from 'lucide-react'
import { deletarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'
```
por:
```tsx
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { FileText, Trash2, InboxIcon, Download } from 'lucide-react'
import { deletarRelatorios, gerarAuditoriaManual } from '@/app/(protected)/relatorios/actions'
```

- [ ] **Step 2: Adicionar o estado `baixandoId`**

Troque:
```tsx
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
```
por:
```tsx
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
```

- [ ] **Step 3: Adicionar a função `baixar`**

Troque (o fim da função `excluir`, logo antes de `handleGerarAuditoria`):
```tsx
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir relatório(s)')
    } finally {
      setExcluindo(false)
      setBulkDialogOpen(false)
      setOpenRowId(null)
    }
  }

  async function handleGerarAuditoria() {
```
por:
```tsx
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir relatório(s)')
    } finally {
      setExcluindo(false)
      setBulkDialogOpen(false)
      setOpenRowId(null)
    }
  }

  async function baixar(id: string, nome: string) {
    setBaixandoId(id)
    try {
      const res = await fetch(`/api/relatorios/${id}/download`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? 'Não foi possível baixar o relatório.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nome}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível baixar o relatório.')
    } finally {
      setBaixandoId(null)
    }
  }

  async function handleGerarAuditoria() {
```

- [ ] **Step 4: Reestruturar as ações da linha (download + excluir)**

Troque:
```tsx
            <AlertDialog
              open={openRowId === r.id}
              onOpenChange={(open) => setOpenRowId(open ? r.id : null)}
            >
              <AlertDialogTrigger render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0 ml-2"
                />
              }>
                <Trash2 className="w-3.5 h-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai remover <strong>{r.nome}</strong>. Esta ação não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => excluir([r.id])}
                    disabled={excluindo}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
```
por:
```tsx
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
                disabled={baixandoId === r.id}
                onClick={() => baixar(r.id, r.nome)}
              >
                {baixandoId === r.id ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </Button>

              <AlertDialog
                open={openRowId === r.id}
                onOpenChange={(open) => setOpenRowId(open ? r.id : null)}
              >
                <AlertDialogTrigger render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  />
                }>
                  <Trash2 className="w-3.5 h-3.5" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso vai remover <strong>{r.nome}</strong>. Esta ação não pode ser
                      desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => excluir([r.id])}
                      disabled={excluindo}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
```

Note: isso muda o `<li>` de "dois filhos flex diretos" (`div` de info + `AlertDialog`) para "dois filhos flex diretos" (`div` de info + novo `div` wrapper com os dois botões) — o `justify-between` do `<li>` continua funcionando igual. O `ml-2` que existia isoladamente no botão de excluir foi removido (o `gap-1` do novo wrapper cuida do espaçamento entre os dois botões).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add components/RelatoriosList.tsx
git commit -m "feat: botao de download por relatorio em RelatoriosList"
```

---

### Task 3: Build completo e verificação manual

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build passa sem erros novos, incluindo a nova rota `/api/relatorios/[id]/download` listada no output.

- [ ] **Step 2: Rodar os testes automatizados existentes**

Run: `npm test`
Expected: mesma suíte de antes passando (nenhum teste novo foi adicionado nesta feature, ver seção "Testes" da spec).

- [ ] **Step 3: Rodar o dev server**

Run: `npm run dev`

- [ ] **Step 4: Roteiro de verificação manual**

Documentar no PR:
1. Logado como admin, ir em `/relatorios` (precisa ter ao menos um relatório ativo — se a lista estiver vazia, fazer upload de um CSV primeiro).
2. Clicar no novo botão de download (ícone) de uma linha — confirmar que o ícone vira um spinner durante o download e volta ao ícone normal ao concluir.
3. Confirmar que o arquivo baixado pelo navegador se chama `"<nome do relatório>.csv"` (ex. `"Relatório 3.csv"`) e abre como CSV válido com o conteúdo esperado.
4. Testar erro: acessar diretamente `/api/relatorios/00000000-0000-0000-0000-000000000000/download` (id inexistente) pela URL — confirmar resposta 404 com `{ "error": "Relatório não encontrado" }`.
5. Excluir um relatório existente e, em seguida, tentar acessar a URL de download desse mesmo id diretamente — confirmar 404 (soft-delete respeitado).
6. Confirmar visualmente que os botões de download e excluir ficam lado a lado, com espaçamento consistente com o resto da linha (sem gap duplicado nem colado).
7. Testar em viewport mobile (DevTools responsivo) — mesmo comportamento, sem quebra de layout na linha.

- [ ] **Step 5: Registrar resultado**

Nenhum commit de código neste task — é só validação. Se algo falhar, abrir um fix conforme o problema encontrado antes de seguir para a finalização da branch.
