import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { gerarXlsxAuditoria } from './gerar-xlsx'
import type { ResultadoAusencia, ResultadoPresenca } from './pente-fino'

const naoFeitosExemplo: ResultadoAusencia[] = [
  {
    nomeCompleto: 'João Silva',
    estado: 'RJ',
    empresa: 'Empresa X',
    identificador: 'A1',
    relatoriosAusentes: 'Relatório 1, Relatório 2',
    totalAusencias: 2,
  },
]

const feitosExemplo: ResultadoPresenca[] = [
  {
    nomeCompleto: 'Maria Souza',
    estado: 'SP',
    empresa: 'Empresa Y',
    identificador: 'A2',
    relatoriosFeitos: 'Relatório 1',
    totalFeitos: 1,
  },
]

async function lerWorkbook(buffer: ExcelJS.Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

describe('gerarXlsxAuditoria', () => {
  it('gera duas abas: Não feitos e Feitos', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    expect(workbook.worksheets.map((w) => w.name)).toEqual(['Não feitos', 'Feitos'])
  })

  it('aba Não feitos tem cabeçalho correto e dados mapeados', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Não feitos')!

    expect(aba.getRow(1).values).toEqual([
      undefined,
      'Nome Completo',
      'Estado',
      'Empresa',
      'Relatórios Ausentes',
      'Total Ausências',
    ])
    expect(aba.getRow(2).values).toEqual([
      undefined,
      'João Silva',
      'RJ',
      'Empresa X',
      'Relatório 1, Relatório 2',
      2,
    ])
  })

  it('aba Feitos tem cabeçalho correto e dados mapeados', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Feitos')!

    expect(aba.getRow(1).values).toEqual([
      undefined,
      'Nome Completo',
      'Estado',
      'Empresa',
      'Relatórios Feitos',
      'Total Feitos',
    ])
    expect(aba.getRow(2).values).toEqual([
      undefined,
      'Maria Souza',
      'SP',
      'Empresa Y',
      'Relatório 1',
      1,
    ])
  })

  it('cabeçalho vem em negrito', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Não feitos')!
    expect(aba.getRow(1).font?.bold).toBe(true)
  })

  it('campo extra sem coluna correspondente (identificador) não aparece no XLSX', async () => {
    const buffer = await gerarXlsxAuditoria(naoFeitosExemplo, feitosExemplo)
    const workbook = await lerWorkbook(buffer)
    const aba = workbook.getWorksheet('Não feitos')!
    // índice 0 é sempre undefined (ExcelJS é 1-based); 5 colunas definidas = 6 posições
    expect(aba.getRow(1).values).toHaveLength(6)
  })

  it('gera abas válidas (só cabeçalho) quando os arrays estão vazios', async () => {
    const buffer = await gerarXlsxAuditoria([], [])
    const workbook = await lerWorkbook(buffer)
    const abaNF = workbook.getWorksheet('Não feitos')!
    const abaF = workbook.getWorksheet('Feitos')!
    expect(abaNF.rowCount).toBe(1)
    expect(abaF.rowCount).toBe(1)
  })
})
