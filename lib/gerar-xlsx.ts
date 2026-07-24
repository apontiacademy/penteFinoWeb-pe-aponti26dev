import ExcelJS from 'exceljs'
import type { ResultadoAusencia, ResultadoPresenca } from './pente-fino'

export async function gerarXlsxAuditoria(
  naoFeitos: ResultadoAusencia[],
  feitos: ResultadoPresenca[]
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()

  const abaNaoFeitos = workbook.addWorksheet('Não feitos')
  abaNaoFeitos.columns = [
    { header: 'Nome Completo', key: 'nomeCompleto', width: 30 },
    { header: 'Estado', key: 'estado', width: 10 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Relatórios Ausentes', key: 'relatoriosAusentes', width: 40 },
    { header: 'Total Ausências', key: 'totalAusencias', width: 15 },
  ]
  abaNaoFeitos.addRows(naoFeitos)
  abaNaoFeitos.getRow(1).font = { bold: true }

  const abaFeitos = workbook.addWorksheet('Feitos')
  abaFeitos.columns = [
    { header: 'Nome Completo', key: 'nomeCompleto', width: 30 },
    { header: 'Estado', key: 'estado', width: 10 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Relatórios Feitos', key: 'relatoriosFeitos', width: 40 },
    { header: 'Total Feitos', key: 'totalFeitos', width: 15 },
  ]
  abaFeitos.addRows(feitos)
  abaFeitos.getRow(1).font = { bold: true }

  return workbook.xlsx.writeBuffer()
}
