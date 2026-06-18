'use client'

import { useState } from 'react'
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
import { Download, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'

type NaoFeito = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosAusentes: string
  totalAusencias: number
}

type Feito = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosFeitos: string
  totalFeitos: number
}

type Props = {
  auditId: string
  naoFeitos: NaoFeito[]
  feitos: Feito[]
}

export function AuditResultTable({ auditId, naoFeitos, feitos }: Props) {
  const [modo, setModo] = useState<'nao_feitos' | 'feitos'>('nao_feitos')
  const isNF = modo === 'nao_feitos'

  const dados = isNF
    ? [...naoFeitos].sort((a, b) => b.totalAusencias - a.totalAusencias)
    : [...feitos].sort((a, b) => b.totalFeitos - a.totalFeitos)

  const total = naoFeitos.length
  const comAusencias = naoFeitos.filter((r) => r.totalAusencias > 0).length
  const semAusencias = total - comAusencias
  const taxa = total > 0 ? Math.round((semAusencias / total) * 100) : 0

  const comFeitos = feitos.filter((r) => r.totalFeitos > 0).length
  const taxaFeitos = total > 0 ? Math.round((comFeitos / total) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground mt-0.5">alunos</div>
        </div>

        {isNF ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs text-destructive">Pendências</span>
            </div>
            <div className="text-2xl font-bold text-destructive">{comAusencias}</div>
            <div className="text-xs text-muted-foreground mt-0.5">com ausências</div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-700">Participaram</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{comFeitos}</div>
            <div className="text-xs text-muted-foreground mt-0.5">com entregas</div>
          </div>
        )}

        <div
          className={`rounded-xl border p-4 text-center ${
            (isNF ? taxa : taxaFeitos) >= 80
              ? 'border-green-200 bg-green-50'
              : 'border-accent/30 bg-accent/10'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <CheckCircle2
              className={`w-3.5 h-3.5 ${
                (isNF ? taxa : taxaFeitos) >= 80
                  ? 'text-green-600'
                  : 'text-accent-foreground'
              }`}
            />
            <span
              className={`text-xs ${
                (isNF ? taxa : taxaFeitos) >= 80
                  ? 'text-green-700'
                  : 'text-accent-foreground'
              }`}
            >
              {isNF ? 'Cumprimento' : 'Engajamento'}
            </span>
          </div>
          <div
            className={`text-2xl font-bold ${
              (isNF ? taxa : taxaFeitos) >= 80
                ? 'text-green-700'
                : 'text-accent-foreground'
            }`}
          >
            {isNF ? taxa : taxaFeitos}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">dos alunos</div>
        </div>
      </div>

      {/* Tabs + download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
          <TabsList>
            <TabsTrigger value="nao_feitos" className="gap-2">
              Não feitos
              {comAusencias > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0 h-4">
                  {comAusencias}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feitos">Feitos</TabsTrigger>
          </TabsList>
        </Tabs>

        <a href={`/api/auditorias/${auditId}/download?modo=${modo}`} download>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Baixar CSV
          </Button>
        </a>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-medium">Nome</TableHead>
              <TableHead className="font-medium">UF</TableHead>
              <TableHead className="hidden sm:table-cell font-medium">Empresa</TableHead>
              <TableHead className="font-medium">
                {isNF ? 'Relatórios Ausentes' : 'Relatórios Feitos'}
              </TableHead>
              <TableHead className="text-right font-medium">
                {isNF ? 'Ausências' : 'Feitos'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((row, i) => {
              const total = isNF
                ? (row as NaoFeito).totalAusencias
                : (row as Feito).totalFeitos
              const lista = isNF
                ? (row as NaoFeito).relatoriosAusentes
                : (row as Feito).relatoriosFeitos
              const zerado = total === 0

              return (
                <TableRow
                  key={i}
                  className={`${zerado ? 'opacity-50' : ''} ${
                    !zerado && isNF && total >= 3 ? 'bg-destructive/3' : ''
                  }`}
                >
                  <TableCell className="font-medium text-sm">{row.nomeCompleto}</TableCell>
                  <TableCell className="text-sm">{row.estado || '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {row.empresa || '—'}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {zerado ? '—' : lista}
                  </TableCell>
                  <TableCell className="text-right">
                    {!zerado && (
                      <Badge
                        variant={isNF ? 'destructive' : 'default'}
                        className={
                          !isNF
                            ? 'bg-accent text-accent-foreground'
                            : ''
                        }
                      >
                        {total}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {isNF ? comAusencias : comFeitos} de {total} aluno(s) com{' '}
        {isNF ? 'ausências' : 'presenças registradas'}
      </p>
    </div>
  )
}
