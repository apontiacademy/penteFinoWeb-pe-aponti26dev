export type PontoAuditoria = { createdAt: string; cumprimento: number }

const DIA_MS = 24 * 60 * 60 * 1000
const JANELA_DIAS = 15

// Aritmética de dias em ms só é segura pq América/São Paulo é UTC-3 fixo (sem horário de verão desde 2019)
function paraDiaISO(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)
}

export function inicioDaJanela(hoje: Date, dias: number): Date {
  return new Date(hoje.getTime() - (dias - 1) * DIA_MS)
}

export function montarEvolucao15Dias(
  auditorias: PontoAuditoria[],
  ultimaAnterior: PontoAuditoria | null,
  hoje: Date
): { diaISO: string; cumprimento: number }[] {
  const ultimaPorDia = new Map<string, PontoAuditoria>()
  for (const a of auditorias) {
    const dia = paraDiaISO(new Date(a.createdAt))
    const atual = ultimaPorDia.get(dia)
    if (!atual || new Date(a.createdAt).getTime() > new Date(atual.createdAt).getTime()) {
      ultimaPorDia.set(dia, a)
    }
  }

  const resultado: { diaISO: string; cumprimento: number }[] = []
  let valorAtual = ultimaAnterior?.cumprimento ?? null

  for (let i = JANELA_DIAS - 1; i >= 0; i--) {
    const dia = paraDiaISO(new Date(hoje.getTime() - i * DIA_MS))
    const auditoriaDoDia = ultimaPorDia.get(dia)
    if (auditoriaDoDia) {
      valorAtual = auditoriaDoDia.cumprimento
      resultado.push({ diaISO: dia, cumprimento: valorAtual })
    } else if (valorAtual !== null) {
      resultado.push({ diaISO: dia, cumprimento: valorAtual })
    }
  }

  return resultado
}
