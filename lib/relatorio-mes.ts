export function formatarMesAno(date: Date): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(date)
  const mes = partes.find((p) => p.type === 'month')?.value ?? ''
  const ano = partes.find((p) => p.type === 'year')?.value ?? ''
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ano}`
}

export function agruparRelatoriosPorMes<T extends { createdAt: string }>(
  relatorios: T[]
): { mes: string; relatorios: T[] }[] {
  const grupos = new Map<string, T[]>()
  for (const r of relatorios) {
    const mes = formatarMesAno(new Date(r.createdAt))
    if (!grupos.has(mes)) grupos.set(mes, [])
    grupos.get(mes)!.push(r)
  }
  return [...grupos.entries()].map(([mes, relatorios]) => ({ mes, relatorios }))
}
