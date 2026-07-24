export function proximoNumeroRelatorio(nomesExistentes: string[]): number {
  const maiorNumero = nomesExistentes.reduce((max, nome) => {
    const match = /^Relatório (\d+)$/.exec(nome)
    const numero = match ? parseInt(match[1], 10) : 0
    return Math.max(max, numero)
  }, 0)
  return maiorNumero + 1
}
