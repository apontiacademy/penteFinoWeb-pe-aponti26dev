import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { RespostaPergunta } from '@/lib/pente-fino'

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf',
      fontWeight: 'bold',
    },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Roboto' },
  title: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: '#3c3c3c', marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  field: { flexDirection: 'row', marginBottom: 2 },
  fieldLabel: { width: 90, fontWeight: 'bold', color: '#505050' },
  fieldValue: { flex: 1 },
  relatorioHeader: {
    backgroundColor: '#464646',
    color: '#ffffff',
    padding: 6,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  question: { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  answer: { fontSize: 9, marginBottom: 6, marginLeft: 8, color: '#3c3c3c' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#969696',
  },
})

export type RelatorioAlunoPDFProps = {
  nome: string
  estado: string
  empresa: string
  meses: {
    mes: string
    relatorios: { nome: string; respostas: RespostaPergunta[] | null }[]
  }[]
}

export function RelatorioAlunoPDF({ nome, estado, empresa, meses }: RelatorioAlunoPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório de Residência</Text>
        <Text style={styles.subtitle}>{nome}</Text>
        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Dados do Aluno</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nome:</Text>
          <Text style={styles.fieldValue}>{nome}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Núcleo:</Text>
          <Text style={styles.fieldValue}>{estado || '-'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Empresa:</Text>
          <Text style={styles.fieldValue}>{empresa || '-'}</Text>
        </View>

        {meses.map((grupo) => (
          <View key={grupo.mes}>
            {grupo.relatorios.map((rel) => (
              <View key={rel.nome} wrap={false}>
                <Text style={styles.relatorioHeader}>{rel.nome.toUpperCase()}</Text>
                {rel.respostas === null ? (
                  <Text style={styles.answer}>Não enviado</Text>
                ) : rel.respostas.length === 0 ? (
                  <Text style={styles.answer}>Sem perguntas registradas neste relatório</Text>
                ) : (
                  rel.respostas.map((r, i) => (
                    <View key={i}>
                      <Text style={styles.question}>
                        {i + 1}. {r.pergunta}
                      </Text>
                      <Text style={styles.answer}>{r.resposta || '-'}</Text>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber }) => `Página ${pageNumber}`}
          fixed
        />
      </Page>
    </Document>
  )
}
