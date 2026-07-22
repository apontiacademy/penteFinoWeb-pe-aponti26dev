import { randomInt } from 'crypto'

const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz'
const NUMEROS = '23456789'
const SIMBOLOS = '!@#$%&*'
const TODOS = MAIUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS
const TAMANHO = 12

export function gerarSenhaAleatoria(): string {
  const grupos = [MAIUSCULAS, MINUSCULAS, NUMEROS, SIMBOLOS]
  const senha: string[] = grupos.map((grupo) => grupo[randomInt(grupo.length)])

  for (let i = senha.length; i < TAMANHO; i++) {
    senha.push(TODOS[randomInt(TODOS.length)])
  }

  for (let i = senha.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[senha[i], senha[j]] = [senha[j], senha[i]]
  }

  return senha.join('')
}
