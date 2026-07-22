import { describe, it, expect } from 'vitest'
import { gerarSenhaAleatoria } from './gerar-senha'

describe('gerarSenhaAleatoria', () => {
  it('gera uma senha com 12 caracteres', () => {
    expect(gerarSenhaAleatoria()).toHaveLength(12)
  })

  it('só usa caracteres do conjunto permitido (sem I, O, l, 0, 1)', () => {
    const permitido = /^[A-HJ-NP-Za-km-np-z2-9!@#$%&*]+$/
    for (let i = 0; i < 50; i++) {
      expect(gerarSenhaAleatoria()).toMatch(permitido)
    }
  })

  it('contém pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 símbolo', () => {
    for (let i = 0; i < 50; i++) {
      const senha = gerarSenhaAleatoria()
      expect(senha).toMatch(/[A-HJ-NP-Z]/)
      expect(senha).toMatch(/[a-km-np-z]/)
      expect(senha).toMatch(/[2-9]/)
      expect(senha).toMatch(/[!@#$%&*]/)
    }
  })

  it('gera senhas diferentes em chamadas sucessivas', () => {
    const senhas = new Set(Array.from({ length: 20 }, () => gerarSenhaAleatoria()))
    expect(senhas.size).toBeGreaterThan(1)
  })
})
