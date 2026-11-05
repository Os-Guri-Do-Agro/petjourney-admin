/**
 * Os campos do cadastro (E2-01): o que falta para salvar e o que vai para a API. Texto vazio
 * vira `null` (limpa o campo); o CPF e o CEP vão só com os dígitos; o telefone que veio da API
 * volta formatado para a tela.
 */
import { describe, expect, it } from 'vitest'

import {
  camposDoCliente,
  camposVazios,
  clienteParaApi,
  clienteVazio,
  validarCliente,
  validarPaciente,
} from '../campos'

const t = (chave: string) => chave

describe('validarPaciente', () => {
  it('pede nome e espécie, e qual espécie quando é "outra"', () => {
    expect(validarPaciente(camposVazios(), t)).toEqual({
      nome: 'cadastro.erros.nomeDoPaciente',
      especie: 'cadastro.erros.especie',
    })
    expect(validarPaciente({ ...camposVazios(), nome: 'Trovão', especie: 'OUTRO' }, t)).toEqual({
      especieOutra: 'cadastro.erros.especieOutra',
    })
    expect(validarPaciente({ ...camposVazios(), nome: 'Tofu', especie: 'GATO' }, t)).toEqual({})
  })
})

describe('cliente', () => {
  it('pede o nome e confere o e-mail só quando há um', () => {
    expect(validarCliente(clienteVazio(), t)).toEqual({ nome: 'cadastro.erros.nomeDoResponsavel' })
    expect(validarCliente({ ...clienteVazio(), nome: 'Ana', email: 'ana@' }, t)).toEqual({
      email: 'cadastro.erros.email',
    })
  })

  it('vai para a API com nulos no lugar do vazio e só os dígitos de CPF e CEP', () => {
    const corpo = clienteParaApi({
      ...clienteVazio(),
      nome: '  Ana Lima ',
      cpf: '103.371.700-29',
      telefone: '(65) 99988-7766',
      cep: '78005-000',
    })

    expect(corpo).toMatchObject({
      nome: 'Ana Lima',
      cpf: '10337170029',
      telefone: '(65) 99988-7766',
      cep: '78005000',
      email: null,
      logradouro: null,
      emergenciaTelefone: null,
    })
  })

  it('o cliente da API volta para a tela com o telefone formatado', () => {
    const campos = camposDoCliente({
      id: 'c1',
      nome: 'Marina Prado',
      cpf: null,
      telefone: '5565999887766',
      telefoneSecundario: null,
      email: null,
      contatoPreferido: 'WHATSAPP',
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      observacao: null,
      emergenciaNome: null,
      emergenciaTelefone: null,
      codigoNaOrigem: null,
      ativo: true,
      inativoMotivo: null,
      mescladoEmId: null,
      anonimizadoEm: null,
      bloqueadoAte: null,
      autorizados: [],
    })

    expect(campos.telefone).toBe('(65) 99988-7766')
    expect(campos.email).toBe('')
  })
})
