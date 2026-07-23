import { describe, it, expect } from 'vitest'
import {
  normalizarNome,
  normalizarUF,
  parsearGrupos,
  carregarAlunos,
  carregarRelatorio,
  extrairGruposRelatorio,
  aplicarFallbackGrupos,
  calcularAusencias,
  calcularPresencas,
  planilhaTemColuna,
  indexarRespostasPorAluno,
} from './pente-fino'

// Formato A: coluna "residente" (estado fica vazio, empresa da coluna "empresa") + coluna de ID
const CSV_ALUNOS_A = `ID,residente,empresa
A1,João  Silva,Empresa X
A2,maria souza,Empresa Y`

// Formato B: colunas "Nome", "Sobrenome", "Grupos" + coluna de ID
const CSV_ALUNOS_B = `ID,Nome,Sobrenome,Grupos
B1,João,Silva,PE:Empresa X - 12345678/0001-99
B2,Maria,Souza,CE:Empresa Y - 98765432/0001-11`

// Planilha com identificador vazio numa linha
const CSV_ALUNOS_ID_VAZIO = `ID,residente,empresa
,João Silva,Empresa X
A2,Maria Souza,Empresa Y`

// Planilha com identificador duplicado
const CSV_ALUNOS_ID_DUPLICADO = `ID,residente,empresa
A1,João Silva,Empresa X
A1,João Segundo,Empresa Z`

// Relatório com coluna de ID e "Nome completo"
const CSV_REL_COM_COLUNA = `ID,Nome completo,Email
A1,João Silva,joao@x.com
P1,Pedro Lima,pedro@y.com`

// Relatório sem a coluna de ID configurada
const CSV_REL_SEM_COLUNA = `Outro,Header
A,B`

// Relatório com coluna "Grupos" preenchida para um aluno, vazia para outro
const CSV_REL_COM_GRUPOS = `ID,Nome completo,Grupos,Email
A1,João Silva,Maranhão: Hermes - 42.441.933/0001-64,joao@x.com
P1,Pedro Lima,,pedro@x.com`

describe('normalizarNome', () => {
  it('coloca em minúsculo e colapsa espaços múltiplos', () => {
    expect(normalizarNome('  João  Silva  ')).toBe('joão silva')
  })

  it('mantém nome simples sem alteração além de minúsculo', () => {
    expect(normalizarNome('Maria Souza')).toBe('maria souza')
  })
})

describe('normalizarUF', () => {
  it('converte nome completo do estado (com acento) para sigla', () => {
    expect(normalizarUF('Maranhão')).toBe('MA')
  })

  it('mantém sigla já válida inalterada', () => {
    expect(normalizarUF('PE')).toBe('PE')
  })

  it('converte sigla em minúsculo para maiúsculo', () => {
    expect(normalizarUF('pe')).toBe('PE')
  })

  it('mantém valor desconhecido sem alteração', () => {
    expect(normalizarUF('Nao Existe')).toBe('Nao Existe')
  })

  it('retorna string vazia para entrada vazia', () => {
    expect(normalizarUF('')).toBe('')
  })

  it('normaliza nome completo do estado todo em maiúsculo', () => {
    expect(normalizarUF('MARANHÃO')).toBe('MA')
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

  it('normaliza nome completo do estado para sigla', () => {
    const [estado, empresa] = parsearGrupos('Maranhão: Hermes - 42.441.933/0001-64')
    expect(estado).toBe('MA')
    expect(empresa).toBe('Hermes')
  })
})

describe('carregarAlunos', () => {
  it('carrega formato A (coluna residente) — identificador e nome corretos', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    expect(alunos).toHaveLength(2)
    expect(alunos[0].identificador).toBe('A1')
    expect(alunos[0].nomeNormalizado).toBe('joão silva')
    expect(alunos[0].empresa).toBe('Empresa X')
  })

  it('carrega formato B (Nome + Sobrenome + Grupos) — estado e empresa extraídos', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B, 'ID')
    expect(alunos).toHaveLength(2)
    expect(alunos[0].identificador).toBe('B1')
    expect(alunos[0].estado).toBe('PE')
    expect(alunos[0].empresa).toBe('Empresa X')
  })

  it('descarta linha com identificador vazio', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_ID_VAZIO, 'ID')
    expect(alunos).toHaveLength(1)
    expect(alunos[0].identificador).toBe('A2')
  })

  it('mantém a primeira ocorrência quando o identificador está duplicado', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_ID_DUPLICADO, 'ID')
    expect(alunos).toHaveLength(1)
    expect(alunos[0].empresa).toBe('Empresa X')
  })
})

describe('planilhaTemColuna', () => {
  it('retorna true quando a coluna existe no cabeçalho', () => {
    expect(planilhaTemColuna(CSV_ALUNOS_A, 'ID')).toBe(true)
  })

  it('retorna false quando a coluna não existe no cabeçalho', () => {
    expect(planilhaTemColuna(CSV_ALUNOS_A, 'Outra')).toBe(false)
  })
})

describe('carregarRelatorio', () => {
  it('retorna Set de identificadores da coluna de ID configurada', () => {
    const ids = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')
    expect(ids).not.toBeNull()
    expect(ids!.has('A1')).toBe(true)
    expect(ids!.has('P1')).toBe(true)
    expect(ids!.size).toBe(2)
  })

  it('retorna null se a coluna de ID configurada estiver ausente', () => {
    expect(carregarRelatorio(CSV_REL_SEM_COLUNA, 'ID')).toBeNull()
  })
})

describe('extrairGruposRelatorio', () => {
  it('extrai estado (normalizado) e empresa por identificador', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS, 'ID')
    expect(grupos.get('A1')).toEqual(['MA', 'Hermes'])
  })

  it('ignora aluno com célula de Grupos vazia', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS, 'ID')
    expect(grupos.has('P1')).toBe(false)
  })

  it('retorna Map vazio se não houver coluna Grupos', () => {
    const grupos = extrairGruposRelatorio(CSV_REL_COM_COLUNA, 'ID')
    expect(grupos.size).toBe(0)
  })
})

describe('aplicarFallbackGrupos', () => {
  it('preenche estado vazio a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID') // Formato A: estado sempre vazio
    const grupos = new Map<string, [string, string]>([['A1', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.identificador === 'A1')!
    expect(joao.estado).toBe('MA')
  })

  it('não sobrescreve estado já preenchido pela planilha geral', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_B, 'ID') // já tem estado 'PE' para B1
    const grupos = new Map<string, [string, string]>([['B1', ['MA', 'Outra Empresa']]])
    const resultado = aplicarFallbackGrupos(alunos, grupos)

    const joao = resultado.find((a) => a.identificador === 'B1')!
    expect(joao.estado).toBe('PE')
  })

  it('ignora alunos sem correspondência no fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const resultado = aplicarFallbackGrupos(alunos, new Map())
    expect(resultado).toEqual(alunos)
  })

  it('preenche empresa vazia a partir do fallback', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const alunoSemEmpresa = alunos.map((a) => ({ ...a, empresa: '' }))
    const grupos = new Map<string, [string, string]>([['A1', ['MA', 'Hermes']]])
    const resultado = aplicarFallbackGrupos(alunoSemEmpresa, grupos)

    const joao = resultado.find((a) => a.identificador === 'A1')!
    expect(joao.empresa).toBe('Hermes')
  })
})

describe('calcularAusencias', () => {
  it('detecta quem NÃO fez o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')! // só A1 e P1 estão — A2 (Maria) ausente
    const resultado = calcularAusencias(alunos, { 'Relatório 1': rel })

    const maria = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('maria'))!
    expect(maria.totalAusencias).toBe(1)
    expect(maria.relatoriosAusentes).toContain('Relatório 1')

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.totalAusencias).toBe(0)
    expect(joao.relatoriosAusentes).toBe('')
  })
})

describe('calcularPresencas', () => {
  it('detecta quem FEZ o relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.totalFeitos).toBe(1)
    expect(joao.relatoriosFeitos).toContain('Relatório 1')

    const maria = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('maria'))!
    expect(maria.totalFeitos).toBe(0)
  })

  it('casa relatório e planilha pelo identificador mesmo quando o nome muda', () => {
    const planilhaComNomeNovo = `ID,residente,empresa
A1,João Santos,Empresa X` // nome mudou de "Silva" para "Santos", identificador continua A1
    const relatorio = `ID,Nome completo,Email
A1,Qualquer Nome no Relatório,x@x.com`

    const alunos = carregarAlunos(planilhaComNomeNovo, 'ID')
    const rel = carregarRelatorio(relatorio, 'ID')!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    expect(resultado[0].totalFeitos).toBe(1)
  })
})

describe('integração: fallback de UF do relatório semanal', () => {
  it('aluno sem UF na planilha geral (Formato A) recebe UF/empresa extraídas do relatório', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const grupos = extrairGruposRelatorio(CSV_REL_COM_GRUPOS, 'ID')
    const enriquecidos = aplicarFallbackGrupos(alunos, grupos)

    const joao = enriquecidos.find((a) => a.identificador === 'A1')!
    expect(joao.estado).toBe('MA')
    // empresa já vinha preenchida pela planilha geral (Empresa X) — não é sobrescrita
    expect(joao.empresa).toBe('Empresa X')

    const maria = enriquecidos.find((a) => a.identificador === 'A2')!
    // Maria não aparece em nenhum relatório com Grupos preenchido — segue vazia
    expect(maria.estado).toBe('')
  })
})

describe('calcularAusencias — identificador propagado', () => {
  it('inclui o identificador do aluno no resultado', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')!
    const resultado = calcularAusencias(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.identificador).toBe('A1')
  })
})

describe('calcularPresencas — identificador propagado', () => {
  it('inclui o identificador do aluno no resultado', () => {
    const alunos = carregarAlunos(CSV_ALUNOS_A, 'ID')
    const rel = carregarRelatorio(CSV_REL_COM_COLUNA, 'ID')!
    const resultado = calcularPresencas(alunos, { 'Relatório 1': rel })

    const joao = resultado.find((r) => r.nomeCompleto.toLowerCase().includes('joão'))!
    expect(joao.identificador).toBe('A1')
  })
})

const CSV_REL_COM_PERGUNTAS = `ID,Nome completo,1. Como foi a semana?,2. Teve alguma dificuldade?
A1,João Silva,Foi tranquila,Não
P1,Pedro Lima,Corrido mas produtivo,"Sim, prazo apertado"`

describe('indexarRespostasPorAluno', () => {
  it('indexa as respostas de cada aluno pelas colunas de pergunta numeradas', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_PERGUNTAS, 'ID')
    const respostasJoao = indice.get('A1')

    expect(respostasJoao).toEqual([
      { pergunta: 'Como foi a semana?', resposta: 'Foi tranquila' },
      { pergunta: 'Teve alguma dificuldade?', resposta: 'Não' },
    ])
  })

  it('indexa múltiplos alunos do mesmo CSV numa única chamada', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_PERGUNTAS, 'ID')
    expect(indice.size).toBe(2)
    expect(indice.get('P1')).toEqual([
      { pergunta: 'Como foi a semana?', resposta: 'Corrido mas produtivo' },
      { pergunta: 'Teve alguma dificuldade?', resposta: 'Sim, prazo apertado' },
    ])
  })

  it('aluno ausente do CSV não aparece no índice', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_PERGUNTAS, 'ID')
    expect(indice.has('NAO_EXISTE')).toBe(false)
  })

  it('retorna mapa vazio quando a coluna de identificador está ausente', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_SEM_COLUNA, 'ID')
    expect(indice.size).toBe(0)
  })

  it('cada aluno mapeia para lista vazia quando não há coluna de pergunta numerada', () => {
    const indice = indexarRespostasPorAluno(CSV_REL_COM_COLUNA, 'ID')
    expect(indice.get('A1')).toEqual([])
  })

  it('identificador duplicado no CSV: a última linha vence', () => {
    const csvDuplicado = `ID,Nome completo,1. Pergunta
A1,João Primeiro,Resposta 1
A1,João Segundo,Resposta 2`
    const indice = indexarRespostasPorAluno(csvDuplicado, 'ID')
    expect(indice.get('A1')).toEqual([{ pergunta: 'Pergunta', resposta: 'Resposta 2' }])
  })

  it('coluna de identificador que casa com o padrão de pergunta não vaza como resposta', () => {
    const csvIdColideComPergunta = `1. Matrícula,Nome completo,2. Como foi a semana?
A1,João Silva,Foi tranquila`
    const indice = indexarRespostasPorAluno(csvIdColideComPergunta, '1. Matrícula')
    expect(indice.get('A1')).toEqual([{ pergunta: 'Como foi a semana?', resposta: 'Foi tranquila' }])
  })
})
