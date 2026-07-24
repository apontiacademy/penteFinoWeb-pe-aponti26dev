import { describe, it, expect } from 'vitest'
import { proximoNumeroRelatorio } from './relatorio-numero'

describe('proximoNumeroRelatorio', () => {
  it('retorna 1 quando não há relatórios existentes', () => {
    expect(proximoNumeroRelatorio([])).toBe(1)
  })

  it('retorna o maior número + 1', () => {
    expect(proximoNumeroRelatorio(['Relatório 1', 'Relatório 2', 'Relatório 3'])).toBe(4)
  })

  it('ignora nomes fora do padrão "Relatório N"', () => {
    expect(proximoNumeroRelatorio(['Relatório 1', 'Planilha extra', 'Relatório 2'])).toBe(3)
  })

  it('lida corretamente com gaps na numeração (relatório do meio deletado)', () => {
    // Relatório 2 foi deletado (soft delete) — não entra na lista de ativos,
    // mas o próximo número continua vindo do maior já usado (3), não do gap.
    expect(proximoNumeroRelatorio(['Relatório 1', 'Relatório 3'])).toBe(4)
  })

  it('não quebra com nomes em ordem não sequencial na lista de entrada', () => {
    expect(proximoNumeroRelatorio(['Relatório 3', 'Relatório 1', 'Relatório 2'])).toBe(4)
  })
})
