export type PaginaItem = number | 'ellipsis'

export function paginasVisiveis(paginaAtual: number, totalPaginas: number): PaginaItem[] {
  const delta = 1
  const paginas = new Set<number>([1, totalPaginas])
  for (let p = paginaAtual - delta; p <= paginaAtual + delta; p++) {
    if (p >= 1 && p <= totalPaginas) paginas.add(p)
  }
  const ordenadas = [...paginas].sort((a, b) => a - b)

  const resultado: PaginaItem[] = []
  let anterior: number | null = null
  for (const p of ordenadas) {
    if (anterior !== null && p - anterior > 1) resultado.push('ellipsis')
    resultado.push(p)
    anterior = p
  }
  return resultado
}
