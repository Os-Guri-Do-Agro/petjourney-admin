/**
 * As regras do módulo ONG que a tela decide (PJ-TJ07TW): o erro pelo `codigo` (nunca pela
 * mensagem), o selo e o cancelar do convite pelo status, o toque dos avisos novos e quando o CNPJ da
 * ONG só muda pelo suporte.
 */
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'

import {
  cnpjDaOngSoPeloSuporte,
  diaNoFormatoDaApi,
  diaParaData,
  lerErroDaOng,
  podeCancelarConvite,
  rotaDoAvisoDaOng,
  seloDoConvite,
  temConviteValendo,
} from '../regras-da-ong'

const t = (chave: string) => chave

function erro(
  codigo: string,
  mensagem = 'frase da API',
  extra: { reason?: string; detalhes?: Record<string, unknown>; status?: number } = {},
) {
  return new ApiError(mensagem, extra.status ?? 409, undefined, extra.reason, {
    codigo,
    detalhes: extra.detalhes ?? {},
  })
}

describe('lerErroDaOng', () => {
  it('mostra a frase da API e decide pelo código, não pela mensagem', () => {
    expect(lerErroDaOng(erro('ONG_LIMITE_DE_ANIMAIS', 'Fale com o suporte'), t, 'g')).toEqual({
      codigo: 'ONG_LIMITE_DE_ANIMAIS',
      mensagem: 'Fale com o suporte',
      campo: undefined,
      recarregar: false,
    })
    /* A mesma mensagem com outro código não muda o que a tela faz. */
    expect(lerErroDaOng(erro('ANIMAL_JA_ENTREGUE', 'Fale com o suporte'), t, 'g').recarregar).toBe(
      true,
    )
  })

  it('o teto de escrita vira a frase da casa, com qualquer janela', () => {
    for (const janela of ['CADASTRO', 'FOTO', 'MICROCHIP']) {
      const lido = lerErroDaOng(
        erro('ONG_TAXA_EXCEDIDA', 'Muitas tentativas', { status: 429, detalhes: { janela } }),
        t,
        'g',
      )
      expect(lido.mensagem).toBe('ong.erros.taxa')
    }
  })

  it('microchip em uso aponta o campo e diz o que fazer, sem dizer de quem', () => {
    const lido = lerErroDaOng(erro('MICROCHIP_JA_CADASTRADO', 'Já está em outro animal.'), t, 'g')
    expect(lido.campo).toBe('microchip')
    expect(lido.mensagem).toBe('Já está em outro animal. ong.erros.microchipDica')
  })

  it('CNPJ encerrado é a frase do encerrado; outro motivo de consulta fica com a da API', () => {
    expect(
      lerErroDaOng(
        erro('MODULO_SOMENTE_LEITURA', 'x', { status: 403, reason: 'CNPJ_ENCERRADO' }),
        t,
        'g',
      ).mensagem,
    ).toBe('ong.cnpj.encerrado')
    expect(
      lerErroDaOng(
        erro('MODULO_SOMENTE_LEITURA', 'suspenso', { reason: 'MODULO_SUSPENSO' }),
        t,
        'g',
      ).mensagem,
    ).toBe('suspenso')
  })

  it('outra ONG e id que não existe: o mesmo "não encontramos"', () => {
    expect(lerErroDaOng(erro('OWNERSHIP_FORBIDDEN', 'Forbidden', { status: 403 }), t, 'g')).toEqual(
      {
        codigo: 'OWNERSHIP_FORBIDDEN',
        mensagem: 'ong.erros.naoEncontrado',
        campo: undefined,
        recarregar: false,
      },
    )
  })

  it('o campo do corpo leva o erro ao campo; o do código vence', () => {
    expect(
      lerErroDaOng(erro('ONG_DATA_INVALIDA', 'data', { detalhes: { campo: 'aplicadaEm' } }), t, 'g')
        .campo,
    ).toBe('aplicadaEm')
    expect(lerErroDaOng(erro('ENTREGA_TELEFONE_INVALIDO'), t, 'g').campo).toBe('adotanteTelefone')
    expect(lerErroDaOng(erro('ONG_ESPECIE_OUTRA_SO_COM_OUTRO'), t, 'g').campo).toBe('especieOutra')
  })

  it('a ficha que mudou (entregue, fora de cuidado) pede para ler de novo', () => {
    expect(lerErroDaOng(erro('ANIMAL_FORA_DE_CUIDADO'), t, 'g').recarregar).toBe(true)
    expect(lerErroDaOng(erro('REGISTRO_DA_ONG_TETO'), t, 'g').recarregar).toBe(false)
  })

  it('erro que não é da API cai na frase genérica', () => {
    expect(lerErroDaOng('quebrou', t, 'genérico')).toEqual({
      codigo: '',
      mensagem: 'genérico',
      recarregar: false,
    })
  })
})

describe('o convite', () => {
  it('cada status tem o seu selo, e o desconhecido cai no neutro', () => {
    expect(seloDoConvite('PENDENTE').chave).toBe('ong.convites.status.PENDENTE')
    expect(seloDoConvite('ACEITA').classe).toBe('ui-selo--ok')
    expect(seloDoConvite('EXPIRADA').chave).toBe('ong.convites.status.EXPIRADA')
    expect(seloDoConvite('CANCELADA').chave).toBe('ong.convites.status.CANCELADA')
    expect(seloDoConvite('RECUSADA').chave).toBe('ong.convites.status.RECUSADA')
    expect(seloDoConvite('NOVO_DA_API').chave).toBe('ong.convites.status.OUTRO')
  })

  it('cancelar só o que está aguardando', () => {
    expect(podeCancelarConvite('PENDENTE')).toBe(true)
    for (const status of ['ACEITA', 'RECUSADA', 'EXPIRADA', 'CANCELADA']) {
      expect(podeCancelarConvite(status)).toBe(false)
    }
  })

  it('avisa que o anterior deixa de valer só com um aguardando (vencido não conta)', () => {
    expect(temConviteValendo([{ status: 'EXPIRADA' }, { status: 'CANCELADA' }])).toBe(false)
    expect(temConviteValendo([{ status: 'ACEITA' }, { status: 'PENDENTE' }])).toBe(true)
    expect(temConviteValendo([])).toBe(false)
  })
})

describe('os avisos do sino', () => {
  it('aceite e recusa abrem a ficha do animal; sem o id, a lista', () => {
    const dados = { parceiroId: 'p1', animalId: 'a 1', entregaId: 'e1' }
    expect(rotaDoAvisoDaOng({ tipo: 'ENTREGA_DE_PET_ACEITA', dados })).toBe('/ong/animal/a%201')
    expect(rotaDoAvisoDaOng({ tipo: 'ENTREGA_DE_PET_RECUSADA', dados })).toBe('/ong/animal/a%201')
    expect(rotaDoAvisoDaOng({ tipo: 'ENTREGA_DE_PET_ACEITA', dados: {} })).toBe('/ong/animais')
  })

  it('o CNPJ irregular abre o perfil; aviso que não é da ONG fica com o sino', () => {
    expect(rotaDoAvisoDaOng({ tipo: 'ONG_CNPJ_IRREGULAR', dados: { situacao: 'INAPTA' } })).toBe(
      '/ong/perfil',
    )
    expect(rotaDoAvisoDaOng({ tipo: 'VINCULO_RESPONDIDO', dados: {} })).toBeNull()
  })
})

describe('o CNPJ da ONG', () => {
  it('aprovado com o módulo ONG: só pelo suporte; antes da aprovação, a ONG corrige', () => {
    expect(cnpjDaOngSoPeloSuporte('APROVADO', { status: 'ATIVO' })).toBe(true)
    expect(cnpjDaOngSoPeloSuporte('APROVADO', { status: 'SUSPENSO' })).toBe(true)
    expect(cnpjDaOngSoPeloSuporte('APROVADO', { status: 'DESLIGADO' })).toBe(true)
    expect(cnpjDaOngSoPeloSuporte('PENDENTE', { status: 'ATIVO' })).toBe(false)
    expect(cnpjDaOngSoPeloSuporte('REJEITADO', { status: 'ATIVO' })).toBe(false)
  })

  it('sem o módulo ONG, ou com ele recusado, o CNPJ muda pelo portal', () => {
    expect(cnpjDaOngSoPeloSuporte('APROVADO', { status: null })).toBe(false)
    expect(cnpjDaOngSoPeloSuporte('APROVADO', { status: 'REJEITADO' })).toBe(false)
    expect(cnpjDaOngSoPeloSuporte('APROVADO', null)).toBe(false)
  })
})

describe('datas de dia', () => {
  it('ida e volta pelo dia local, sem passar pelo fuso', () => {
    expect(diaNoFormatoDaApi(new Date(2026, 10, 3, 23, 50))).toBe('2026-11-03')
    expect(diaParaData('2026-11-03')?.getDate()).toBe(3)
    expect(diaParaData('')).toBeNull()
  })
})
