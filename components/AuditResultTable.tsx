'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { paginasVisiveis } from '@/lib/pagination'
import { derivarUfsDisponiveis } from './audit-result-table-utils'
import {
  Download,
  Users,
  Clock,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileDown,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NaoFeito = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador?: string
  relatoriosAusentes: string
  totalAusencias: number
}

type Feito = {
  nomeCompleto: string
  estado: string
  empresa: string
  identificador?: string
  relatoriosFeitos: string
  totalFeitos: number
}

type Props = {
  auditId: string
  naoFeitos: NaoFeito[]
  feitos: Feito[]
}

type SortCol = 'nome' | 'uf' | 'empresa' | 'lista' | 'total'
type SortDir = 'asc' | 'desc'

const PER_PAGE = 20

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-foreground/30 shrink-0" />
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-primary shrink-0" />
    : <ArrowDown className="w-3 h-3 text-primary shrink-0" />
}

export function AuditResultTable({ auditId, naoFeitos, feitos }: Props) {
  const [modo, setModo] = useState<'nao_feitos' | 'feitos'>('nao_feitos')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<SortCol>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filters, setFilters] = useState({ nome: '', ufs: [] as string[], empresa: '' })
  const ufsDisponiveis = useMemo(
    () => derivarUfsDisponiveis(naoFeitos, feitos),
    [naoFeitos, feitos]
  )
  const ufsAnchor = useComboboxAnchor()
  const isNF = modo === 'nao_feitos'

  function handleModo(v: typeof modo) {
    setModo(v)
    setPage(1)
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'total' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function handleFilter(key: 'nome' | 'empresa', value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  function handleUfsChange(ufs: string[]) {
    setFilters((prev) => ({ ...prev, ufs }))
    setPage(1)
  }

  function clearFilters() {
    setFilters({ nome: '', ufs: [], empresa: '' })
    setPage(1)
  }

  const hasFilters = filters.nome || filters.ufs.length > 0 || filters.empresa
  const base = isNF ? naoFeitos : feitos
  const feitosPorNome = new Map(feitos.map((f) => [f.nomeCompleto, f.totalFeitos]))

  // 1. Filter
  const filtered = base.filter((row) => {
    const n = filters.nome.toLowerCase()
    const e = filters.empresa.toLowerCase()
    return (
      (!n || row.nomeCompleto.toLowerCase().includes(n)) &&
      (filters.ufs.length === 0 || filters.ufs.includes(row.estado)) &&
      (!e || row.empresa.toLowerCase().includes(e))
    )
  })

  // 2. Sort
  const sorted = [...filtered].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''

    if (sortCol === 'nome') {
      va = a.nomeCompleto; vb = b.nomeCompleto
    } else if (sortCol === 'uf') {
      va = a.estado; vb = b.estado
    } else if (sortCol === 'empresa') {
      va = a.empresa; vb = b.empresa
    } else if (sortCol === 'lista') {
      va = isNF ? (a as NaoFeito).relatoriosAusentes : (a as Feito).relatoriosFeitos
      vb = isNF ? (b as NaoFeito).relatoriosAusentes : (b as Feito).relatoriosFeitos
    } else {
      va = isNF ? (a as NaoFeito).totalAusencias : (a as Feito).totalFeitos
      vb = isNF ? (b as NaoFeito).totalAusencias : (b as Feito).totalFeitos
    }

    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va
    }
    const cmp = String(va).localeCompare(String(vb), 'pt-BR')
    return sortDir === 'asc' ? cmp : -cmp
  })

  // 3. Paginate
  const totalRows = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const dados = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  // Stats always from full unfiltered data
  const total = naoFeitos.length
  const comAusencias = naoFeitos.filter((r) => r.totalAusencias > 0).length
  const semAusencias = total - comAusencias
  const taxaCompleto = total > 0 ? Math.round((semAusencias / total) * 100) : 0

  const parcial = naoFeitos.filter(
    (r) => r.totalAusencias > 0 && (feitosPorNome.get(r.nomeCompleto) ?? 0) > 0
  ).length
  const taxaParcial = total > 0 ? Math.round((parcial / total) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">alunos</div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:border-amber-500/40 dark:bg-amber-500/15 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Parcialmente feitos</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{parcial}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{taxaParcial}% dos alunos</div>
        </div>

        <div className="rounded-xl border border-green-500/30 bg-green-500/10 dark:border-green-500/40 dark:bg-green-500/15 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Completamente feitos</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">{semAusencias}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{taxaCompleto}% dos alunos</div>
        </div>
      </div>

      {/* Tabs + download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={modo} onValueChange={(v) => handleModo(v as typeof modo)}>
          <TabsList>
            <TabsTrigger value="nao_feitos" className="gap-2">
              Não feitos
              {comAusencias > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0 h-4 min-w-[1.25rem]">
                  {comAusencias}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feitos">Feitos</TabsTrigger>
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="gap-1.5" />}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download />}
              className="cursor-pointer"
            >
              Baixar CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={`/api/auditorias/${auditId}/pdf-todos`} download />}
              className="cursor-pointer"
            >
              Baixar todos os PDFs (.zip)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Combobox multiple items={ufsDisponiveis} value={filters.ufs} onValueChange={handleUfsChange}>
          <ComboboxChips ref={ufsAnchor} className="w-48 text-sm">
            <ComboboxValue>
              {(values: string[]) => (
                <>
                  {values.map((uf) => (
                    <ComboboxChip key={uf}>{uf}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput placeholder={values.length === 0 ? 'UF...' : undefined} />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={ufsAnchor}>
            <ComboboxEmpty>Nenhuma UF encontrada.</ComboboxEmpty>
            <ComboboxList>
              {(uf: string) => (
                <ComboboxItem key={uf} value={uf}>
                  {uf}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Input
          placeholder="Filtrar por nome..."
          value={filters.nome}
          onChange={(e) => handleFilter('nome', e.target.value)}
          className="h-8 w-52 text-sm"
        />
        <Input
          placeholder="Empresa..."
          value={filters.empresa}
          onChange={(e) => handleFilter('empresa', e.target.value)}
          className="h-8 w-48 text-sm"
        />
        {hasFilters && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </Button>
            {totalRows !== base.length && (
              <span className="text-xs text-muted-foreground">
                {totalRows} de {base.length} alunos
              </span>
            )}
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/60">
              <TableHead className="py-3 w-[30%]">
                <button
                  onClick={() => handleSort('nome')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Nome
                  <SortIcon col="nome" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3 w-16">
                <button
                  onClick={() => handleSort('uf')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  UF
                  <SortIcon col="uf" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="hidden sm:table-cell py-3">
                <button
                  onClick={() => handleSort('empresa')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Empresa
                  <SortIcon col="empresa" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3">
                <button
                  onClick={() => handleSort('lista')}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  {isNF ? 'Ausências em' : 'Presenças em'}
                  <SortIcon col="lista" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3 w-20">
                <button
                  onClick={() => handleSort('total')}
                  className="flex items-center gap-1 ml-auto text-xs font-semibold text-foreground/60 uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Total
                  <SortIcon col="total" sortCol={sortCol} sortDir={sortDir} />
                </button>
              </TableHead>
              <TableHead className="py-3 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum resultado para os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              dados.map((row, i) => {
                const count = isNF
                  ? (row as NaoFeito).totalAusencias
                  : (row as Feito).totalFeitos
                const lista = isNF
                  ? (row as NaoFeito).relatoriosAusentes
                  : (row as Feito).relatoriosFeitos
                const zerado = count === 0
                const altaSeveridade = !zerado && isNF && count >= 3
                const semEnvio = (feitosPorNome.get(row.nomeCompleto) ?? 0) === 0

                return (
                  <TableRow
                    key={i}
                    className={`border-b border-border/40 last:border-0 transition-colors ${
                      zerado
                        ? 'bg-transparent text-muted-foreground/60'
                        : altaSeveridade
                        ? 'bg-destructive/[0.03] hover:bg-destructive/[0.06]'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    <TableCell className="py-3 whitespace-normal break-words">
                      <span
                        className={`text-sm font-medium ${
                          zerado ? 'text-muted-foreground/60' : 'text-foreground'
                        }`}
                      >
                        {row.nomeCompleto}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm font-mono text-muted-foreground">
                        {row.estado || (semEnvio ? 'sem envio' : '—')}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-3">
                      <span className="text-sm text-muted-foreground">
                        {row.empresa || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 max-w-xs whitespace-normal break-words">
                      <span className="text-sm text-muted-foreground leading-snug">
                        {zerado ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          lista
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      {!zerado && (
                        <Badge
                          className={
                            isNF
                              ? altaSeveridade
                                ? 'bg-destructive text-destructive-foreground font-semibold'
                                : 'bg-destructive/80 text-destructive-foreground'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }
                          variant={isNF ? 'destructive' : 'outline'}
                        >
                          {count}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      {row.identificador && (
                        <a href={`/api/auditorias/${auditId}/pdf-aluno/${row.identificador}`} download>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Gerar PDF de ${row.nomeCompleto}`}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {totalRows === 0 ? (
            'Nenhum resultado'
          ) : (
            <>
              Mostrando{' '}
              <span className="font-medium text-foreground">
                {(safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, totalRows)}
              </span>{' '}
              de{' '}
              <span className="font-medium text-foreground">{totalRows}</span> alunos
            </>
          )}
        </p>

        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="Anterior"
                  aria-disabled={safePage === 1}
                  tabIndex={safePage === 1 ? -1 : undefined}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault()
                    setPage((p) => Math.max(1, p - 1))
                  }}
                  className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {paginasVisiveis(safePage, totalPages).map((item, i) =>
                item === 'ellipsis' ? (
                  <PaginationItem key={`e${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      isActive={item === safePage}
                      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.preventDefault()
                        setPage(item)
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text="Próxima"
                  aria-disabled={safePage === totalPages}
                  tabIndex={safePage === totalPages ? -1 : undefined}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault()
                    setPage((p) => Math.min(totalPages, p + 1))
                  }}
                  className={safePage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}
