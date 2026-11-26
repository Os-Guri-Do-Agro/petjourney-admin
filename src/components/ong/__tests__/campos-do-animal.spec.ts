/**
 * Os campos do animal da ONG (guia 2.2): o obrigatório de cada passo, o corpo do cadastro (sem
 * nada do adotante) e o do PATCH (só o que mudou, sem a espécie).
 */
import { describe, expect, it } from 'vitest'

import type { AnimalDaOng } from '@/service/parceiro/ong-service'

import {
  campoDaTela,
  camposDoAnimal,
  camposVazios,
  paraCadastrar,
  paraEditar,
  parteDoCampo,
  validarAnimal,
} from '../campos-do-animal'

const t = (chave: string) => chave

describe('validarAnimal', () => {
  it('pede nome e espécie no passo do animal, e qual espécie quando é "outra"', () => {
    expect(validarAnimal(camposVazios('2026-11-26'), t, 'animal')).toEqual({
      nome: 'ong.campos.nomeObrigatorio',
      especie: 'ong.campos.especieObrigatoria',
    })
    expect(
      validarAnimal({ ...camposVazios('2026-11-26'), nome: 'Rex', especie: 'OUTRO' }, t, 'animal'),
    ).toEqual({ especieOutra: 'ong.campos.especieOutraObrigatoria' })
  })

  it('pede o dia e a origem da chegada no passo da chegada', () => {
    expect(validarAnimal({ ...camposVazios(''), nome: 'Rex' }, t, 'chegada')).toEqual({
      entradaEm: 'ong.campos.entradaObrigatoria',
      origemDaEntrada: 'ong.campos.origemObrigatoria',
    })
    expect(validarAnimal(camposVazios('2026-11-26'), t, 'observacoes')).toEqual({})
  })
})

describe('paraCadastrar', () => {
  it('leva só o preenchido, com a data de nascimento no campo da API', () => {
    const corpo = paraCadastrar({
      ...camposVazios('2026-11-26'),
      nome: '  Rex ',
      especie: 'CACHORRO',
      origemDaEntrada: 'RESGATE',
      castrado: false,
      nascimento: '2024-01-10',
      observacaoInterna: 'Mordeu na chegada',
      observacaoParaAdotante: 'Gosta de bolinha',
    })

    expect(corpo).toEqual({
      nome: 'Rex',
      especiePet: 'CACHORRO',
      entradaEm: '2026-11-26',
      origemDaEntrada: 'RESGATE',
      castrado: false,
      dataNascimento: '2024-01-10',
      observacaoInterna: 'Mordeu na chegada',
      observacaoParaAdotante: 'Gosta de bolinha',
    })
    /* Nada de quem vai adotar nem do parceiro: a API recusa com 400. */
    for (const proibido of ['tutorId', 'responsavelCpf', 'responsavelNome', 'parceiroId']) {
      expect(corpo).not.toHaveProperty(proibido)
    }
  })

  it('o tipo do animal só vai com a espécie "outra"', () => {
    const base = {
      ...camposVazios('2026-11-26'),
      nome: 'Ouri',
      origemDaEntrada: 'RESGATE' as const,
    }
    expect(paraCadastrar({ ...base, especie: 'GATO', especieOutra: 'Ouriço' })).not.toHaveProperty(
      'especieOutra',
    )
    expect(paraCadastrar({ ...base, especie: 'OUTRO', especieOutra: 'Ouriço' }).especieOutra).toBe(
      'Ouriço',
    )
  })
})

const ficha = {
  id: 'a1',
  status: 'EM_CUIDADO',
  nome: 'Rex',
  especie: 'CACHORRO',
  especieOutra: null,
  sexo: 'MACHO',
  nascimento: null,
  entradaEm: '2026-11-10',
  origemDaEntrada: 'RESGATE',
  entregueEm: null,
  fotoUrl: null,
  criadoEm: '2026-11-10T12:00:00.000Z',
  observacaoInterna: 'Mordeu na chegada',
  observacaoParaAdotante: null,
  encerradoMotivo: null,
  encerradoEm: null,
  retornoDeId: null,
  identidade: {
    raca: 'SRD',
    cor: null,
    castrado: true,
    porte: 'MEDIO',
    microchip: null,
    avisosDeManejo: ['MORDE'],
    fotoUrl: null,
  },
  saude: { vacinas: [], vermifugos: [], pesos: [] },
  entregue: null,
  adotantePrimeiroNome: null,
} satisfies AnimalDaOng

describe('paraEditar', () => {
  it('sem mudança, nada vai', () => {
    expect(paraEditar(camposDoAnimal(ficha), camposDoAnimal(ficha))).toEqual({})
  })

  it('manda só o que mudou, e o opcional apagado vai nulo', () => {
    const depois = {
      ...camposDoAnimal(ficha),
      raca: '',
      cor: 'Caramelo',
      observacaoInterna: '',
      avisosDeManejo: ['MORDE', 'MEDROSO'] as typeof ficha.identidade.avisosDeManejo,
    }

    expect(paraEditar(camposDoAnimal(ficha), depois)).toEqual({
      raca: null,
      cor: 'Caramelo',
      observacaoInterna: null,
      avisosDeManejo: ['MORDE', 'MEDROSO'],
    })
  })

  it('a espécie não vai no PATCH, mesmo trocada na tela', () => {
    const depois = { ...camposDoAnimal(ficha), especie: 'GATO' as const }
    expect(paraEditar(camposDoAnimal(ficha), depois)).toEqual({})
  })
})

describe('o erro da API volta ao campo e ao passo', () => {
  it('traduz o nome do campo da API e acha o passo', () => {
    expect(campoDaTela('dataNascimento')).toBe('nascimento')
    expect(campoDaTela('microchip')).toBe('microchip')
    expect(campoDaTela('adotanteTelefone')).toBeUndefined()
    expect(parteDoCampo('microchip')).toBe('chegada')
    expect(parteDoCampo('observacaoParaAdotante')).toBe('observacoes')
    expect(parteDoCampo('nome')).toBe('animal')
  })
})
