import { isValidCnpj, stripCnpj } from './cnpj'
import { isValidCpf } from './cpf'

/**
 * A chave PIX que a carteira aceita: CPF, CNPJ, e-mail, telefone ou a chave aleatória do banco.
 *
 * A API gravava qualquer texto (gravou "abc" na validação de 27/10/2026); desde o PJ-4BI7TE ela
 * recusa com 400 `CHAVE_PIX_INVALIDA`. Aqui a carteira recusa antes de salvar, com a mesma regra
 * de telefone da API: só com +55 e DDD, porque 11 dígitos sem o "+" são lidos como CPF.
 */
export type TipoDeChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALEATORIA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Só o que um número digitado costuma ter: dígitos, espaço, parênteses, hífen, ponto, barra, +. */
const NUMERICA = /^[\d\s().\-/+]+$/
/** +55, DDD de 11 a 99 e o número: celular com 9 dígitos começando por 9, fixo com 8 de 2 a 8. */
const TELEFONE = /^55[1-9][1-9](9\d{8}|[2-8]\d{7})$/

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
    return TELEFONE.test(digitos) ? 'telefone' : null
  }

  if (digitos.length === 14) {
    return isValidCnpj(digitos) ? 'cnpj' : null
  }

  if (digitos.length === 11 && isValidCpf(digitos)) {
    return 'cpf'
  }

  return null
}

export function isValidChavePix(valor: string) {
  return tipoDaChavePix(valor) !== null
}
