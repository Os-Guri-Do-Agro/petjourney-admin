/**
 * O documento de quem pede a cópia do prontuário ou aceita um termo no balcão (E4-06). A API aceita
 * de 4 caracteres em diante, só letras sem acento, números, ponto, hífen, barra e espaço
 * (`copia.dto.ts` e `termos.dto.ts`): com outro caractere, como um parêntese, ela devolve 400 e a
 * tela só podia dizer que o servidor não aceitou os dados. A regra é conferida no campo, antes.
 */
const CARACTERES_ACEITOS = /^[0-9A-Za-z.\-/ ]+$/

export function documentoDaPessoaValido(texto: string): boolean {
  const limpo = texto.trim()
  return limpo.length >= 4 && CARACTERES_ACEITOS.test(limpo)
}
