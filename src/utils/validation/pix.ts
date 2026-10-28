import { isValidCnpj, stripCnpj } from './cnpj'
import { isValidCpf } from './cpf'

/**
 * A chave PIX que a carteira aceita: CPF, CNPJ, e-mail, telefone ou a chave aleatória do banco.
 *
 * A API grava qualquer texto (gravou "abc" na validação de 27/10/2026), e o erro só apareceria no
 * dia do saque, quando o pagamento não encontrasse a chave. Aqui a carteira recusa antes de salvar
 * e diz quais formatos servem.
 */
export type TipoDeChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALEATORIA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Só o que um número digitado costuma ter: dígitos, espaço, parênteses, hífen, ponto, barra, +. */
const NUMERICA = /^[\d\s().\-/+]+$/

export function tipoDaChavePix(valor: string): TipoDeChavePix | null {
  const chave = valor.trim()

  if (!chave) {
    return null
  }

  if (EMAIL.test(chave)) {
    return 'email'
  }

  if (ALEATORIA.test(chave)) {
    return 'aleatoria'
  }

  if (!NUMERICA.test(chave)) {
    return null
  }

  const digitos = stripCnpj(chave)

  if (chave.startsWith('+')) {
    return digitos.length >= 12 && digitos.length <= 13 ? 'telefone' : null
  }

  if (digitos.length === 14) {
    return isValidCnpj(digitos) ? 'cnpj' : null
  }

  if (digitos.length === 11 && isValidCpf(digitos)) {
    return 'cpf'
  }

  /* Celular ou fixo com DDD, com ou sem o 55 na frente. */
  if (digitos.length === 10 || digitos.length === 11) {
    return 'telefone'
  }

  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    return 'telefone'
  }

  return null
}

export function isValidChavePix(valor: string) {
  return tipoDaChavePix(valor) !== null
}
