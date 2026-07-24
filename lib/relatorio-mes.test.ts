import { describe, it, expect } from 'vitest'
import { formatarMesAno, agruparRelatoriosPorMes } from './relatorio-mes'

describe('formatarMesAno', () => {
  it('formata mês e ano por extenso, capitalizado, fuso América/São Paulo', () => {
    // 2026-07-15T12:00:00Z = 2026-07-15 09:00 em São Paulo (UTC-3) — mesmo dia, mesmo mês
    expect(formatarMesAno(new Date('2026-07-15T12:00:00Z'))).toBe('Julho 2026')
  })

  it('data perto da virada do mês respeita o fuso de São Paulo', () => {
    // 2026-08-01T02:00:00Z = 2026-07-31 23:00 em São Paulo (UTC-3) — ainda julho
    expect(formatarMesAno(new Date('2026-08-01T02:00:00Z'))).toBe('Julho 2026')
  })
})

describe('agruparRelatoriosPorMes', () => {
  it('agrupa relatórios do mesmo mês juntos', () => {
    const relatorios = [
      { nome: 'Relatório 1', createdAt: '2026-07-01T12:00:00Z' },
      { nome: 'Relatório 2', createdAt: '2026-07-15T12:00:00Z' },
    ]
    const grupos = agruparRelatoriosPorMes(relatorios)

    expect(grupos).toHaveLength(1)
    expect(grupos[0].mes).toBe('Julho 2026')
    expect(grupos[0].relatorios).toHaveLength(2)
  })

  it('gera grupos separados em ordem cronológica pra meses diferentes', () => {
    const relatorios = [
      { nome: 'Relatório 1', createdAt: '2026-07-01T12:00:00Z' },
      { nome: 'Relatório 2', createdAt: '2026-08-01T12:00:00Z' },
    ]
    const grupos = agruparRelatoriosPorMes(relatorios)

    expect(grupos.map((g) => g.mes)).toEqual(['Julho 2026', 'Agosto 2026'])
  })

  it('retorna lista vazia para entrada vazia', () => {
    expect(agruparRelatoriosPorMes([])).toEqual([])
  })
})
