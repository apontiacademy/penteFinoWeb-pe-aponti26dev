import Papa from 'papaparse'

export type Aluno = {
  nomeCompleto: string
  nomeNormalizado: string
  estado: string
  empresa: string
}

export type ResultadoAusencia = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosAusentes: string
  totalAusencias: number
}

export type ResultadoPresenca = {
  nomeCompleto: string
  estado: string
  empresa: string
  relatoriosFeitos: string
  totalFeitos: number
}

export function normalizarNome(nome: string): string {
  if (typeof nome !== 'string') return ''
  return nome.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Analisa "UF:Empresa - CNPJ" ou "UF | Empresa" → [estado, empresa]
export function parsearGrupos(valor: string): [string, string] {
  const colonIdx = valor.indexOf(':')
  if (colonIdx !== -1) {
    const estado = valor.slice(0, colonIdx).trim()
    const resto = valor.slice(colonIdx + 1)
    const dashIdx = resto.indexOf(' - ')
    const empresa = dashIdx !== -1 ? resto.slice(0, dashIdx).trim() : resto.trim()
    return [estado, empresa]
  }
  const pipeIdx = valor.indexOf('|')
  if (pipeIdx !== -1) {
    const estado = valor.slice(0, pipeIdx).trim()
    const empresa = valor.slice(pipeIdx + 1).trim()
    return [estado, empresa]
  }
  return ['', valor.trim()]
}

export function carregarAlunos(csvText: string): Aluno[] {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = (meta.fields ?? []).map((h) => h.toLowerCase())
  const isFormatoA = headers.includes('residente')

  const vistos = new Set<string>()
  const alunos: Aluno[] = []

  for (const row of data) {
    let nomeCompleto: string
    let estado = ''
    let empresa = ''

    if (isFormatoA) {
      const nomeKey = Object.keys(row).find((k) => k.toLowerCase() === 'residente') ?? ''
      const empresaKey = Object.keys(row).find((k) => k.toLowerCase() === 'empresa') ?? ''
      nomeCompleto = (row[nomeKey] ?? '').trim()
      empresa = (row[empresaKey] ?? '').trim()
    } else {
      const nomeKey = Object.keys(row).find((k) => k === 'Nome') ?? 'Nome'
      const sobrenomeKey = Object.keys(row).find((k) => k === 'Sobrenome') ?? 'Sobrenome'
      const gruposKey = Object.keys(row).find((k) => k === 'Grupos') ?? 'Grupos'
      nomeCompleto = `${row[nomeKey] ?? ''} ${row[sobrenomeKey] ?? ''}`.trim()
      if (row[gruposKey]) {
        ;[estado, empresa] = parsearGrupos(row[gruposKey])
      }
    }

    const nomeNormalizado = normalizarNome(nomeCompleto)
    if (!nomeNormalizado || vistos.has(nomeNormalizado)) continue
    vistos.add(nomeNormalizado)
    alunos.push({ nomeCompleto, nomeNormalizado, estado, empresa })
  }

  return alunos
}

// Retorna null se coluna "Nome completo" ausente (arquivo inválido)
export function carregarRelatorio(csvText: string): Set<string> | null {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const col = meta.fields?.find((f) => f === 'Nome completo')
  if (!col) return null

  return new Set(
    data
      .map((row) => normalizarNome(row[col] ?? ''))
      .filter(Boolean)
  )
}

export function calcularAusencias(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoAusencia[] {
  return alunos.map((aluno) => {
    const ausentes = Object.entries(relatorios)
      .filter(([, nomes]) => !nomes.has(aluno.nomeNormalizado))
      .map(([nome]) => nome)

    return {
      nomeCompleto: aluno.nomeCompleto,
      estado: aluno.estado,
      empresa: aluno.empresa,
      relatoriosAusentes: ausentes.join(', '),
      totalAusencias: ausentes.length,
    }
  })
}

export function calcularPresencas(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoPresenca[] {
  return alunos.map((aluno) => {
    const feitos = Object.entries(relatorios)
      .filter(([, nomes]) => nomes.has(aluno.nomeNormalizado))
      .map(([nome]) => nome)

    return {
      nomeCompleto: aluno.nomeCompleto,
      estado: aluno.estado,
      empresa: aluno.empresa,
      relatoriosFeitos: feitos.join(', '),
      totalFeitos: feitos.length,
    }
  })
}
