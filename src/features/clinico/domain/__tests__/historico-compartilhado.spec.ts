/**
 * Regras do histórico que viaja com o pet: o estado do acesso, o que a clínica vê em cada estado,
 * o código que a recepção digita e os dois degraus da ficha de emergência.
 */

import { describe, expect, it } from 'vitest'

import type { ISODateTime } from '../../data/types'
import {
  agruparPorCategoria,
  ALFABETO_DO_CODIGO,
  CODIGO_TAMANHO,
  conselhoValidoParaEmergencia,
  estadoDoAcesso,
  gerarCodigo,
  itensVisiveis,
  montarFichaDeEmergencia,
  montarFichaPublica,
  motivoDoCodigoRecusado,
  normalizarCodigo,
  terminouEm,
  type AcessoAoHistorico,
  type ItemDoHistorico,
} from '../historico-compartilhado'

const AGORA: ISODateTime = '2026-10-22T10:00:00-03:00'

function acesso(parcial: Partial<AcessoAoHistorico> = {}): AcessoAoHistorico {
  return {
    id: 'a1',
    codigo: 'ABC234',
    petId: 'pet-1',
    tutorId: 'tutor-1',
    parceiroId: 'clinica',
    parceiroNome: 'Clínica',
    categorias: ['ALERGIAS', 'VACINAS'],
    liberadoEm: '2026-10-01T09:00:00-03:00',
    expiraEm: '2026-11-01T09:00:00-03:00',
    vinculadoEm: '2026-10-01T09:10:00-03:00',
    encerradoEm: null,
    ...parcial,
  }
}

function item(parcial: Partial<ItemDoHistorico>): ItemDoHistorico {
  return {
    id: parcial.titulo ?? 'i',
    categoria: 'VACINAS',
    titulo: 'V10',
    detalhe: '',
    em: '2026-01-10',
    origem: { tipo: 'CLINICA', local: 'Clínica de antes', profissional: null },
    marcador: null,
    ...parcial,
  }
}

describe('estado do acesso', () => {
  it('código sem clínica espera; com clínica vale', () => {
    expect(estadoDoAcesso(acesso({ vinculadoEm: null }), AGORA)).toBe('aguardando')
    expect(estadoDoAcesso(acesso(), AGORA)).toBe('ativo')
  })

  it('vence sozinho no prazo, mesmo sem ninguém ter usado o código', () => {
    const vencido = '2026-10-21T09:00:00-03:00'

    expect(estadoDoAcesso(acesso({ expiraEm: vencido }), AGORA)).toBe('expirado')
    expect(estadoDoAcesso(acesso({ expiraEm: vencido, vinculadoEm: null }), AGORA)).toBe('expirado')
  })

  it('encerrado pelo responsável vence o prazo, e termina na data em que ele encerrou', () => {
    const encerrado = acesso({
      encerradoEm: '2026-10-20T18:00:00-03:00',
      expiraEm: '2026-10-21T09:00:00-03:00',
    })

    expect(estadoDoAcesso(encerrado, AGORA)).toBe('encerrado')
    expect(terminouEm(encerrado)).toBe('2026-10-20T18:00:00-03:00')
  })
})

describe('o que a clínica vê', () => {
  const itens = [
    item({ titulo: 'V10', categoria: 'VACINAS', em: '2026-01-10' }),
    item({ titulo: 'Antirrábica', categoria: 'VACINAS', em: '2026-03-10' }),
    item({ titulo: 'Dipirona', categoria: 'ALERGIAS', em: null, marcador: 'grave' }),
    item({ titulo: 'Linfoma', categoria: 'DIAGNOSTICOS', marcador: 'ativo' }),
  ]

  it('só as categorias liberadas, a mais recente primeiro', () => {
    const visiveis = itensVisiveis(acesso(), itens, AGORA)

    expect(visiveis?.map((visivel) => visivel.titulo)).toEqual(['Antirrábica', 'V10', 'Dipirona'])
  })

  it('terminado, não volta nada, como o snapshot nulo da API', () => {
    expect(itensVisiveis(acesso({ encerradoEm: AGORA }), itens, AGORA)).toBeNull()
    expect(itensVisiveis(acesso({ expiraEm: AGORA }), itens, AGORA)).toBeNull()
    expect(itensVisiveis(acesso({ vinculadoEm: null }), itens, AGORA)).toBeNull()
  })

  it('agrupa na ordem da tela e sem grupo vazio', () => {
    expect(agruparPorCategoria(itens).map((grupo) => grupo.categoria)).toEqual([
      'ALERGIAS',
      'DIAGNOSTICOS',
      'VACINAS',
    ])
  })
})

describe('código', () => {
  it('aceita o que a recepção digita com espaço e traço', () => {
    expect(normalizarCodigo(' 729-154 ')).toBe('729154')
  })

  it('gera 6 dígitos, como o acesso temporário da API, sem repetir um que existe', () => {
    let chamada = 0
    const sempreIgual = () => 0
    const existentes = new Set(['000000'])
    const depois = () => (chamada++ < CODIGO_TAMANHO ? 0 : 0.5)

    const codigo = gerarCodigo(depois, existentes)

    expect(codigo).toHaveLength(CODIGO_TAMANHO)
    expect([...codigo].every((digito) => ALFABETO_DO_CODIGO.includes(digito))).toBe(true)
    expect(codigo).toMatch(/^\d{6}$/)
    expect(codigo).not.toBe('000000')
    expect(() => gerarCodigo(sempreIgual, existentes)).toThrow(
      'não foi possível gerar um código livre',
    )
  })

  it('usado por outra clínica e encerrado dizem o mesmo: não vale mais', () => {
    expect(motivoDoCodigoRecusado(null, AGORA)).toBe('CODIGO_NAO_ENCONTRADO')
    expect(motivoDoCodigoRecusado(acesso({ vinculadoEm: null }), AGORA)).toBeNull()
    expect(motivoDoCodigoRecusado(acesso(), AGORA)).toBe('CODIGO_JA_USADO')
    expect(motivoDoCodigoRecusado(acesso({ vinculadoEm: null, encerradoEm: AGORA }), AGORA)).toBe(
      'CODIGO_JA_USADO',
    )
    expect(motivoDoCodigoRecusado(acesso({ vinculadoEm: null, expiraEm: AGORA }), AGORA)).toBe(
      'CODIGO_EXPIRADO',
    )
  })
})

describe('ficha de emergência em dois degraus', () => {
  const pet = {
    petId: 'pet-1',
    nome: 'Fubá',
    especie: 'canina',
    raca: 'SRD',
    iniciais: 'FU',
    fotoUrl: '',
    microchip: '',
  }
  const itens = [
    item({ titulo: 'Pólen', categoria: 'ALERGIAS', marcador: null }),
    item({ titulo: 'Amoxicilina', categoria: 'ALERGIAS', marcador: 'grave' }),
    item({ titulo: 'Fenobarbital', categoria: 'MEDICAMENTOS', marcador: 'continuo' }),
    item({ titulo: 'Carprofeno', categoria: 'MEDICAMENTOS', marcador: null }),
    item({ titulo: 'Epilepsia', categoria: 'DIAGNOSTICOS', marcador: 'ativo' }),
    item({ titulo: 'Giardíase', categoria: 'DIAGNOSTICOS', marcador: null }),
    item({ titulo: '12,6 kg', categoria: 'PESO', em: '2026-10-10' }),
    item({ titulo: '12,1 kg', categoria: 'PESO', em: '2026-04-10' }),
  ]

  it('o primeiro degrau só tem o gatilho da alergia grave', () => {
    const publica = montarFichaPublica(pet, 'Renata Lima', itens)

    expect(publica.alertasCriticos).toEqual(['Amoxicilina'])
    expect(publica).not.toHaveProperty('medicacaoContinua')
    expect(publica).not.toHaveProperty('responsavelTelefone')
  })

  it('o segundo traz o uso contínuo, as alergias com a grave em cima, o que está ativo e o último peso', () => {
    const ficha = montarFichaDeEmergencia(
      pet,
      { nome: 'Renata Lima', telefone: '(11) 98120-4471' },
      itens,
    )

    expect(ficha.medicacaoContinua.map((itemDaFicha) => itemDaFicha.titulo)).toEqual([
      'Fenobarbital',
    ])
    expect(ficha.alergias.map((itemDaFicha) => itemDaFicha.titulo)).toEqual([
      'Amoxicilina',
      'Pólen',
    ])
    expect(ficha.diagnosticosAtivos.map((itemDaFicha) => itemDaFicha.titulo)).toEqual(['Epilepsia'])
    expect(ficha.ultimoPeso?.titulo).toBe('12,6 kg')
    expect(ficha.responsavelTelefone).toBe('(11) 98120-4471')
  })

  it('só abre com CRMV', () => {
    expect(conselhoValidoParaEmergencia('CRMV-SP 41208')).toBe(true)
    expect(conselhoValidoParaEmergencia('')).toBe(false)
    expect(conselhoValidoParaEmergencia(null)).toBe(false)
    expect(conselhoValidoParaEmergencia('Recepção')).toBe(false)
  })
})
