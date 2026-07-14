import Papa from 'papaparse'

export type Aluno = {
  nomeCompleto: string
  nomeNormalizado: string
  identificador: string
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

const UF_POR_NOME_ESTADO: Record<string, string> = {
  'acre': 'AC',
  'alagoas': 'AL',
  'amapa': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceara': 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'goias': 'GO',
  'maranhao': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'para': 'PA',
  'paraiba': 'PB',
  'parana': 'PR',
  'pernambuco': 'PE',
  'piaui': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondonia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO',
}

const UFS_VALIDAS = new Set(Object.values(UF_POR_NOME_ESTADO))

const MAPA_ACENTOS: Record<string, string> = {
  'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
  'é': 'e', 'ê': 'e',
  'í': 'i',
  'ó': 'o', 'õ': 'o', 'ô': 'o',
  'ú': 'u',
  'ç': 'c',
}

function removerAcentos(valor: string): string {
  return valor
    .split('')
    .map((c) => MAPA_ACENTOS[c] ?? c)
    .join('')
}

export function normalizarUF(valor: string): string {
  const limpo = valor.trim()
  if (!limpo) return ''
  const maiusculo = limpo.toUpperCase()
  if (maiusculo.length === 2 && UFS_VALIDAS.has(maiusculo)) return maiusculo
  const chave = removerAcentos(limpo.toLowerCase())
  return UF_POR_NOME_ESTADO[chave] ?? limpo
}

// Analisa "UF:Empresa - CNPJ" ou "UF | Empresa" → [estado, empresa]
export function parsearGrupos(valor: string): [string, string] {
  const colonIdx = valor.indexOf(':')
  if (colonIdx !== -1) {
    const estado = valor.slice(0, colonIdx).trim()
    const resto = valor.slice(colonIdx + 1)
    const dashIdx = resto.indexOf(' - ')
    const empresa = dashIdx !== -1 ? resto.slice(0, dashIdx).trim() : resto.trim()
    return [normalizarUF(estado), empresa]
  }
  const pipeIdx = valor.indexOf('|')
  if (pipeIdx !== -1) {
    const estado = valor.slice(0, pipeIdx).trim()
    const empresa = valor.slice(pipeIdx + 1).trim()
    return [normalizarUF(estado), empresa]
  }
  return ['', valor.trim()]
}

export function carregarAlunos(csvText: string, idColuna: string): Aluno[] {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const headers = (meta.fields ?? []).map((h) => h.toLowerCase())
  const isFormatoA = headers.includes('residente')
  const idKey = meta.fields?.find((f) => f === idColuna) ?? idColuna

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
    const identificador = (row[idKey] ?? '').trim()
    if (!identificador || vistos.has(identificador)) continue
    vistos.add(identificador)
    alunos.push({ nomeCompleto, nomeNormalizado, identificador, estado, empresa })
  }

  return alunos
}

export function planilhaTemColuna(csvText: string, idColuna: string): boolean {
  const { meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    preview: 1,
  })
  return meta.fields?.includes(idColuna) ?? false
}

// Retorna null se a coluna de identificador configurada estiver ausente (arquivo inválido)
export function carregarRelatorio(csvText: string, idColuna: string): Set<string> | null {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const col = meta.fields?.find((f) => f === idColuna)
  if (!col) return null

  return new Set(
    data
      .map((row) => (row[col] ?? '').trim())
      .filter(Boolean)
  )
}

export function extrairGruposRelatorio(
  csvText: string,
  idColuna: string
): Map<string, [string, string]> {
  const { data, meta } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const idKey = meta.fields?.find((f) => f === idColuna)
  const gruposKey = meta.fields?.find((f) => f === 'Grupos')
  const grupos = new Map<string, [string, string]>()

  if (!idKey || !gruposKey) return grupos

  for (const row of data) {
    const identificador = (row[idKey] ?? '').trim()
    const valorGrupos = row[gruposKey]
    if (!identificador || !valorGrupos) continue
    grupos.set(identificador, parsearGrupos(valorGrupos))
  }

  return grupos
}

export function aplicarFallbackGrupos(
  alunos: Aluno[],
  grupos: Map<string, [string, string]>
): Aluno[] {
  return alunos.map((aluno) => {
    const fallback = grupos.get(aluno.identificador)
    if (!fallback) return aluno
    const [estadoFallback, empresaFallback] = fallback
    return {
      ...aluno,
      estado: aluno.estado || estadoFallback,
      empresa: aluno.empresa || empresaFallback,
    }
  })
}

export function calcularAusencias(
  alunos: Aluno[],
  relatorios: Record<string, Set<string>>
): ResultadoAusencia[] {
  return alunos.map((aluno) => {
    const ausentes = Object.entries(relatorios)
      .filter(([, ids]) => !ids.has(aluno.identificador))
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
      .filter(([, ids]) => ids.has(aluno.identificador))
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
