import { describe, it, expect } from 'vitest'
import { paginasVisiveis } from './pagination'

describe('paginasVisiveis', () => {
  it('retorna só a página 1 quando há apenas 1 página', () => {
    expect(paginasVisiveis(1, 1)).toEqual([1])
  })

  it('sem reticências quando há poucas páginas', () => {
    expect(paginasVisiveis(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('reticências dos dois lados quando a página atual está no meio', () => {
    expect(paginasVisiveis(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20])
  })

  it('reticências só à direita quando a página atual está no início', () => {
    expect(paginasVisiveis(1, 20)).toEqual([1, 2, 'ellipsis', 20])
  })

  it('reticências só à esquerda quando a página atual está no fim', () => {
    expect(paginasVisiveis(20, 20)).toEqual([1, 'ellipsis', 19, 20])
  })
})
