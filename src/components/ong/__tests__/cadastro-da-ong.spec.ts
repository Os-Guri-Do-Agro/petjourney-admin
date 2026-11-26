/**
 * O cadastro do parceiro com a ONG (PJ-TJ07TW): os dois 409 da regra de 26/11 vão para o campo
 * certo, com a frase da API (decidido pelo `codigo`, nunca pela mensagem).
 */
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import { resolveCadastroErrorView } from '@/utils/parceiro/modo-participacao'

const erro = (codigo: string, mensagem: string) =>
  new ApiError(mensagem, 409, undefined, undefined, { codigo })

describe('resolveCadastroErrorView com a ONG', () => {
  it('trocar o CNPJ da ONG aprovada aponta o campo do CNPJ', () => {
    expect(
      resolveCadastroErrorView(erro('ONG_CNPJ_TROCA_PELO_SUPORTE', 'Fale com o suporte.')),
    ).toEqual({ message: 'Fale com o suporte.', field: 'cnpj' })
  })

  it('pôr a categoria ONG num cadastro aprovado aponta as categorias', () => {
    expect(
      resolveCadastroErrorView(erro('ONG_CATEGORIA_PELO_SUPORTE', 'O admin acrescenta.')),
    ).toEqual({ message: 'O admin acrescenta.', field: 'categorias' })
  })
})
