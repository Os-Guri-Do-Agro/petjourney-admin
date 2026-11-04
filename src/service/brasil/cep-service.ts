/**
 * O endereço de um CEP, pelo ViaCEP: o mesmo serviço que o app usa no cadastro de endereço,
 * gratuito e sem chave. Só ajuda a preencher o formulário; quem grava é a rota do portal.
 */

const VIACEP = 'https://viacep.com.br/ws'

export type EnderecoDoCep = {
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

type RespostaDoViaCep = {
  erro?: boolean | string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export function digitosDoCep(valor: string) {
  return valor.replace(/\D/g, '')
}

/**
 * `null` quando o CEP não existe. Falha de rede ou do serviço lança, para a tela dizer "preencha à
 * mão" em vez de "não encontrado".
 *
 * CEP de cidade inteira (o único de uma cidade pequena) vem sem rua e sem bairro.
 */
export async function buscarCep(cep: string, signal?: AbortSignal): Promise<EnderecoDoCep | null> {
  const digitos = digitosDoCep(cep)

  if (digitos.length !== 8) return null

  const resposta = await fetch(`${VIACEP}/${digitos}/json/`, { signal })

  if (!resposta.ok) throw new Error(`ViaCEP respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as RespostaDoViaCep

  /* O ViaCEP responde 200 com `erro` (às vezes `true`, às vezes `"true"`) para CEP que não existe. */
  if (dados.erro) return null

  return {
    logradouro: dados.logradouro?.trim() ?? '',
    bairro: dados.bairro?.trim() ?? '',
    cidade: dados.localidade?.trim() ?? '',
    uf: dados.uf?.trim().toUpperCase() ?? '',
  }
}
