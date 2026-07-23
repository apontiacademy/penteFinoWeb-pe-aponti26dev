import { describe, it, expect } from 'vitest'
import { deveExibirBotaoTopo } from './scroll'

describe('deveExibirBotaoTopo', () => {
  it('não exibe quando o scroll está abaixo do limiar', () => {
    expect(deveExibirBotaoTopo(100, 500)).toBe(false)
  })

  it('não exibe quando o scroll está exatamente no limiar', () => {
    expect(deveExibirBotaoTopo(500, 500)).toBe(false)
  })

  it('exibe quando o scroll ultrapassa o limiar', () => {
    expect(deveExibirBotaoTopo(600, 500)).toBe(true)
  })

  it('não exibe no topo da página (scroll zero)', () => {
    expect(deveExibirBotaoTopo(0, 500)).toBe(false)
  })
})
