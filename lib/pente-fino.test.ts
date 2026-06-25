import { describe, it, expect } from 'vitest'
import {
  normalizarNome,
  parsearGrupos,
  carregarAlunos,
  carregarRelatorio,
  calcularAusencias,
  calcularPresencas,
} from './pente-fino'

// Formato A: coluna "residente" (estado fica vazio, empresa da coluna "empresa")
const CSV_ALUNOS_A = `residente,empresa
João  Silva,Empresa X
maria souza,Empresa Y`

// Formato B: colunas "Nome", "Sobrenome", "Grupos" — parsear_grupos extrai estado:empresa
const CSV_ALUNOS_B = `Nome,Sobrenome,Grupos
João,Silva,PE:Empresa X - 12345678/0001-99
Maria,Souza,CE:Empresa Y - 98765432/0001-11`

// Relatório com coluna "Nome completo" (exato)
const CSV_REL_COM_COLUNA = `Nome completo,Email
João Silva,joao@x.com
Pedro Lima,pedro@y.com`

// Relatório sem a coluna obrigatória
const CSV_REL_SEM_COLUNA = `Outro,Header
A,B`

describe('normalizarNome', () => {
  it('coloca em minúsculo e colapsa espaços múltiplos', () => {
    expect(normalizarNome('  João  Silva  ')).toBe('joão silva')
  })

  it('mantém nome simples sem alteração além de minúsculo', () => {
    expect(normalizarNome('Maria Souza')).toBe('maria souza')
  })
})

describe('parsearGrupos', () => {
  it('extrai estado e empresa do formato "UF:Empresa - CNPJ"', () => {
    const [estado, empresa] = parsearGrupos('PE:Empresa X - 12345678/0001-99')
    expect(estado).toBe('PE')
    expect(empresa).toBe('Empresa X')
  })

  it('funciona com espaço após os dois-pontos', () => {
    const [estado, empresa] = parsearGrupos('CE: Empresa Y - 98765432/0001-11')
    expect(estado).toBe('CE')
    expect(empresa).toBe('Empresa Y')
  })

  it('retorna strings vazias para entrada inválida', () => {
    const [estado, empresa] = parsearGrupos('semformato')
    expect(estado).toBe('')
  })
})

describe('carregarAlunos', () => {
  it('carrega formato A (coluna residente) — nome normalizado correto', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    expect(alunos).toHaveLength(2)
    expect(alunos[0].nomeNormalizado).toBe('joão silva')
    expect(alunos[0].empresa).toBe('Empresa X')
  })

  it('carrega formato B (Nome + Sobrenome + Grupos) — estado e empresa extraídos', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B)
    expect(alunos).toHaveLength(2)
    expect(alunos[0].nomeNormalizado).toBe('joão silva')
    expect(alunos[0].estado).toBe('PE')
    expect(alunos[0].empresa).toBe('Empresa X')
  })
})

describe('carregarRelatorio', () => {
  it('retorna Set de nomes normalizados da coluna "Nome completo"', () => {
    const nomes = carregarRelatorio(CSV_REL_COM_COLUNA)
    expect(nomes).not.toBeNull()
    expect(nomes!.has('joão silva')).toBe(true)
    expect(nomes!.has('pedro lima')).toBe(true)
    expect(nomes!.size).toBe(2)
  })

  it('retorna null se coluna "Nome completo" ausente', () => {
    expect(carregarRelatorio(CSV_REL_SEM_COLUNA)).toBeNull()
  })
})

describe('calcularAusencias', () => {
  it('detecta quem NÃO fez o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA)! // só João e Pedro estão — Maria ausente
    const resultado = calcularAusencias(alunos, { 'Relatório 1': rel })

    const maria = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('maria')
    )!
    expect(maria.totalAusencias).toBe(1)
    expect(maria.relatoriosAusentes).toContain('Relatório 1')

    const joao = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('joão')
    )!
    expect(joao.totalAusencias).toBe(0)
    expect(joao.relatoriosAusentes).toBe('')
  })
})

describe('calcularPresencas', () => {
  it('detecta quem FEZ o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A)
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA)!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('joão')
    )!
    expect(joao.totalFeitos).toBe(1)
    expect(joao.relatoriosFeitos).toContain('Relatório 1')

    const maria = resultado.find((r) =>
      r.nomeCompleto.toLowerCase().includes('maria')
    )!
    expect(maria.totalFeitos).toBe(0)
  })
})
