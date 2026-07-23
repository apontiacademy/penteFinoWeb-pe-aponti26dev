import { describe, it, expect } from 'vitest'
import { montarEvolucao15Dias, inicioDaJanela, type PontoAuditoria } from './evolucao-dashboard'

const HOJE = new Date('2026-07-23T15:00:00-03:00')

function dia(offsetDias: number, hora = '10:00:00'): string {
  const d = new Date(HOJE.getTime() - offsetDias * 24 * 60 * 60 * 1000)
  const iso = d.toISOString().slice(0, 10)
  return `${iso}T${hora}-03:00`
}

describe('montarEvolucao15Dias', () => {
  it('retorna array vazio quando não há nenhuma auditoria', () => {
    expect(montarEvolucao15Dias([], null, HOJE)).toEqual([])
  })

  it('usa a auditoria de maior created_at quando há mais de uma no mesmo dia', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(0, '08:00:00'), cumprimento: 50 },
      { createdAt: dia(0, '18:00:00'), cumprimento: 90 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].cumprimento).toBe(90)
  })

  it('herda o valor do dia anterior quando um dia não tem auditoria', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(2), cumprimento: 70 },
      // dia(1) sem auditoria
      { createdAt: dia(0), cumprimento: 85 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(3)
    expect(resultado.map((p) => p.cumprimento)).toEqual([70, 70, 85])
  })

  it('herda em cadeia por vários dias seguidos sem auditoria', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(4), cumprimento: 60 },
      { createdAt: dia(0), cumprimento: 95 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(5)
    expect(resultado.map((p) => p.cumprimento)).toEqual([60, 60, 60, 60, 95])
  })

  it('usa ultimaAnterior para herdar no primeiro dia da janela se ele não tiver auditoria própria', () => {
    const ultimaAnterior: PontoAuditoria = { createdAt: dia(20), cumprimento: 40 }
    const auditorias: PontoAuditoria[] = [{ createdAt: dia(0), cumprimento: 100 }]
    const resultado = montarEvolucao15Dias(auditorias, ultimaAnterior, HOJE)
    expect(resultado).toHaveLength(15)
    expect(resultado[0].cumprimento).toBe(40)
    expect(resultado[resultado.length - 1].cumprimento).toBe(100)
  })

  it('omite os dias iniciais sem nenhum histórico pra herdar (sem ultimaAnterior)', () => {
    const auditorias: PontoAuditoria[] = [{ createdAt: dia(2), cumprimento: 77 }]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    // só a partir do dia(2): dia(2), dia(1), dia(0) = 3 pontos
    expect(resultado).toHaveLength(3)
    expect(resultado.every((p) => p.cumprimento === 77)).toBe(true)
  })

  it('ignora itens fora da janela de 15 dias', () => {
    const auditorias: PontoAuditoria[] = [
      { createdAt: dia(30), cumprimento: 10 }, // fora da janela, deve ser ignorado
      { createdAt: dia(0), cumprimento: 88 },
    ]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado).toHaveLength(1)
    expect(resultado[0].cumprimento).toBe(88)
  })

  it('inclui uma auditoria criada hoje no último dia da janela', () => {
    const auditorias: PontoAuditoria[] = [{ createdAt: dia(0), cumprimento: 33 }]
    const resultado = montarEvolucao15Dias(auditorias, null, HOJE)
    expect(resultado[resultado.length - 1].cumprimento).toBe(33)
  })
})

describe('inicioDaJanela', () => {
  it('volta 14 dias quando dias=15', () => {
    const resultado = inicioDaJanela(HOJE, 15)
    expect(resultado.getTime()).toBe(HOJE.getTime() - 14 * 24 * 60 * 60 * 1000)
  })

  it('retorna a própria data quando dias=1', () => {
    const resultado = inicioDaJanela(HOJE, 1)
    expect(resultado.getTime()).toBe(HOJE.getTime())
  })
})
