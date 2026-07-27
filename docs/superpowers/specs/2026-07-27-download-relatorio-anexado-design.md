# Download do relatório anexado

## Contexto

Issue [#109](https://github.com/apontiacademy/penteFinoWeb-pe-aponti26dev/issues/109): relatórios (CSVs exportados do Moodle) podem ser anexados à aplicação (`/relatorios`, upload via `AdicionarRelatorioForm`) e ficam armazenados no bucket Supabase Storage `relatorios`, mas hoje não há nenhuma forma de baixá-los de volta — `components/RelatoriosList.tsx` só oferece a ação de excluir por linha. A issue pede uma ação de download visível, com feedback de sucesso/erro e nomeação clara do arquivo.

O checklist original da issue menciona testar "diferentes formatos (PDF, Excel, etc.)", mas o fluxo real de upload de relatório sempre grava um único CSV por registro (`storage_path` fixo em `"{id}/arquivo.csv"`, sem coluna de mime type ou nome original no banco) — não existe hoje suporte a outros formatos nesse fluxo. Confirmado com o usuário: escopo é baixar esse CSV único por relatório.

## Objetivo

Adicionar um botão de download por relatório em `/relatorios`, que baixa o CSV correspondente do Storage com feedback visual durante o download e tratamento de erro (arquivo não encontrado, falha de rede).

## Arquitetura

### `app/api/relatorios/[id]/download/route.ts` (nova rota)

Segue o mesmo formato das rotas de download já existentes (`app/api/auditorias/[id]/download/route.ts`, `pdf-aluno`, `pdf-todos`):

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

Decisões:

- **Permissão:** qualquer usuário autenticado (`auth.getUser()` sem checar `role`), igual às rotas de download de auditoria já existentes — decisão do usuário, mesmo a página `/relatorios` sendo hoje admin-only.
- **`deleted_at`:** a query verifica que o relatório não foi soft-deletado. Sem isso, um link de download (guardado/cacheado no navegador) continuaria funcionando depois do relatório ser excluído.
- **`sanitizarCaminho`:** duplicada localmente na rota em vez de extraída para `lib/`, seguindo o mesmo padrão já usado nas rotas de PDF (função pequena, uso pontual, não há necessidade de compartilhar).
- **Nome do arquivo:** como não existe coluna de nome original no banco (só `nome`, ex. `"Relatório 3"`), o arquivo baixado se chama `"Relatório 3.csv"`.

### `components/RelatoriosList.tsx` (modificado)

Novo estado local:

```ts
const [baixandoId, setBaixandoId] = useState<string | null>(null)
```

Nova função:

```ts
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
```

Hoje cada `<li>` tem exatamente dois filhos flex diretos (`justify-between`): a `<div className="flex items-center gap-3 min-w-0">` com checkbox/ícone/texto, e o `<AlertDialog>` de excluir. Para caber um segundo botão de ação sem depender de mais um `ml-2` avulso, os dois botões (download + excluir) passam a ficar dentro de um wrapper comum:

```tsx
<div className="flex items-center gap-1 shrink-0">
  <Button
    variant="ghost"
    size="sm"
    className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
    disabled={baixandoId === r.id}
    onClick={() => baixar(r.id, r.nome)}
  >
    {baixandoId === r.id ? <Spinner className="size-3.5" /> : <Download className="w-3.5 h-3.5" />}
  </Button>

  <AlertDialog open={openRowId === r.id} onOpenChange={(open) => setOpenRowId(open ? r.id : null)}>
    <AlertDialogTrigger render={
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
      />
    }>
      <Trash2 className="w-3.5 h-3.5" />
    </AlertDialogTrigger>
    {/* ...AlertDialogContent existente, sem alteração... */}
  </AlertDialog>
</div>
```

O `ml-2` que hoje está no botão de excluir (`shrink-0 ml-2`) sai dele — o `gap-1` do novo wrapper cuida do espaçamento entre os dois botões, e o `shrink-0` do wrapper substitui o do botão individual, mantendo os dois do encolher quando a linha aperta.

## Fluxo de dados (resumo)

```
usuário clica no botão de download da linha
        │
        ▼
baixar(id, nome) → setBaixandoId(id) → ícone vira Spinner
        │
        ▼
fetch GET /api/relatorios/[id]/download
        │
        ├─► não ok → toast.error(mensagem) → setBaixandoId(null)
        │
        └─► ok → blob() → link temporário com download="<nome>.csv" → click() → revoke
                        → setBaixandoId(null)
```

## Tratamento de erros / casos de borda

- **Relatório não encontrado ou já excluído:** rota retorna 404 com `{ error: 'Relatório não encontrado' }`; UI mostra esse texto via toast.
- **Falha ao baixar do Storage** (arquivo ausente por algum motivo): rota retorna 500 com mensagem genérica; UI mostra toast.
- **Usuário não autenticado:** 401 — cenário improvável na prática (rota só é acionada a partir de `/relatorios`, já protegida pelo layout), mas tratado igual às demais rotas de download do projeto.
- **Falha de rede** (`fetch` rejeita): capturada no `catch`, mesmo toast genérico.
- **Cliques repetidos no mesmo botão:** `disabled={baixandoId === r.id}` impede novo fetch enquanto o download em andamento não terminar.
- **Clicar em baixar durante uma exclusão (ou vice-versa) na mesma linha:** os dois estados (`excluindo`, `baixandoId`) são independentes; não há trava cruzada entre eles, mas como cada botão só desabilita a si mesmo, o pior caso é baixar um relatório que está sendo excluído no mesmo instante — aceitável, o soft-delete e o download são operações independentes no banco/storage.

## Testes

Sem teste automatizado para a rota (mesmo padrão já aceito para `app/api/auditorias/[id]/download` e as rotas de PDF — dependem de `Request`/Storage do Next e não são testadas no projeto). Verificação manual:
1. Baixar um relatório existente e confirmar que o CSV abre corretamente e o nome do arquivo é `"<nome do relatório>.csv"`.
2. Tentar baixar um relatório inexistente (id inválido) — confirmar 404 e toast de erro.
3. Excluir um relatório e tentar baixar pelo mesmo botão/URL antiga — confirmar 404.
4. Conferir que o spinner aparece durante o download e some ao concluir (sucesso ou erro).

## Fora de escopo

- Download em massa de múltiplos relatórios selecionados.
- Botão de download em `components/RelatoriosIncluidosCard.tsx` (card resumo read-only usado em outras páginas, ex. detalhe de auditoria).
- Suporte a formatos de arquivo além de CSV (não existe hoje no fluxo de upload de relatório).
- Preservar o nome original do arquivo enviado pelo usuário (não é persistido no banco hoje; fora de escopo alterar o schema/fluxo de upload para isso).
