/**
 * Quem pode buscar e o veterinário do animal, atravessando reserva → check-in → próxima estadia.
 *
 * O que estes testes guardam é a **memória da família**: quem foi cadastrado num balcão precisa
 * reaparecer no próximo, e a lista de uma estadia não pode vazar para a seguinte. As duas coisas
 * falham em silêncio — a tela abre, a reserva grava, e a vizinha some ou fica autorizada para
 * sempre.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { addDays } from '@/features/clinico/domain/clinic-time'
import { setMockConfig } from '@/features/clinico/data/mock-runtime'

import { hospedagemRepository, reservaRepository, VagaIndisponivelError } from '../repositories'
import { getDataset, resetDataset } from '../store'
import { instante } from '../../domain/hotel-time'
import type { PessoaAutorizada, VeterinarioDoPet } from '../types'

const OFFSET = '-04:00'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

/** O check-in mínimo do Sushi — chega hoje, com a irmã do responsável autorizada na reserva. */
function checkInDoSushi(entrada: {
  autorizadosARetirar: PessoaAutorizada[]
  veterinario: VeterinarioDoPet | null
}) {
  return hospedagemRepository.checkIn({
    reservaId: 'res-sushi',
    pesoEntradaKg: 4.2,
    inspecaoDeEntrada: '',
    pertences: [],
    planoAlimentar: {
      racaoPropria: true,
      marca: '',
      porcaoGramas: 40,
      horarios: ['08:00'],
      restricoes: '',
      petiscos: '',
    },
    autorizacoes: [],
    contatoEmergencia: '',
    recebidoPor: 'eq-bruna',
    ...entrada,
  })
}

function pessoaDoCadastro(id: string): PessoaAutorizada {
  const pessoa = reservaRepository.contatosDaFamilia('tutor-daniel').find((item) => item.id === id)

  /* O cadastro plantado precisa ter a pessoa: sem ela, o teste mediria a semente, não a regra. */
  expect(pessoa).toBeDefined()

  return pessoa!
}

describe('quem pode buscar, do check-in para o cadastro da família', () => {
  it('a demonstração tem o que mostrar: um autorizado e um cadastrado de fora', () => {
    const reserva = getDataset().reservas.find((item) => item.id === 'res-sushi')!
    const cadastro = reservaRepository.contatosDaFamilia(reserva.tutorId)

    /* Sem os dois, o check-in do Sushi nunca mostraria uma caixa marcada e outra vazia. */
    expect(reserva.autorizadosARetirar.map((item) => item.id)).toEqual(['pessoa-daniel-1'])
    expect(cadastro.length).toBeGreaterThanOrEqual(2)
  })

  it('a pessoa nova ganha id e entra no cadastro, para a próxima estadia já oferecê-la', async () => {
    await checkInDoSushi({
      veterinario: null,
      autorizadosARetirar: [
        pessoaDoCadastro('pessoa-daniel-1'),
        /* O vazio e o provisório do formulário caem no mesmo caminho: gente nova. */
        {
          id: '',
          nome: ' Neide Okamoto ',
          telefone: '(11) 97777-1234',
          relacao: 'Tia',
          documento: '',
        },
        {
          id: 'nova-1',
          nome: 'Jorge Motta',
          telefone: '(11) 96666-5678',
          relacao: '',
          documento: '',
        },
      ],
    })

    const reserva = getDataset().reservas.find((item) => item.id === 'res-sushi')!
    const [, neide, jorge] = reserva.autorizadosARetirar

    expect(reserva.autorizadosARetirar).toHaveLength(3)
    expect(neide?.id).toMatch(/^pessoa-/)
    expect(jorge?.id).toMatch(/^pessoa-/)
    expect(neide?.id).not.toBe(jorge?.id)
    /* E o espaço que o balcão deixou escapar não vai para a ficha. */
    expect(neide?.nome).toBe('Neide Okamoto')

    const cadastro = reservaRepository.contatosDaFamilia('tutor-daniel')

    expect(cadastro.map((item) => item.id)).toEqual(
      expect.arrayContaining([neide!.id, jorge!.id, 'pessoa-daniel-1', 'pessoa-daniel-2']),
    )
    /* O cadastro é desta família, e de nenhuma outra. */
    expect(
      reservaRepository.contatosDaFamilia('tutor-marina').map((item) => item.id),
    ).not.toContain(neide!.id)
  })

  it('a lista confirmada no balcão substitui a da reserva, e o check-out lê a nova', async () => {
    const rogerio = pessoaDoCadastro('pessoa-daniel-2')
    const hospedagem = await checkInDoSushi({ veterinario: null, autorizadosARetirar: [rogerio] })

    const reserva = getDataset().reservas.find((item) => item.id === 'res-sushi')!
    const estadia = await hospedagemRepository.abrir(hospedagem.id)

    expect(reserva.autorizadosARetirar).toEqual([rogerio])
    expect(estadia?.autorizadosARetirar).toEqual([rogerio])
    /* Desautorizar não é apagar: a Clara continua no cadastro para a próxima vez. */
    expect(reservaRepository.contatosDaFamilia('tutor-daniel').map((item) => item.id)).toContain(
      'pessoa-daniel-1',
    )
  })

  it('o mesmo telefone é a mesma pessoa, mesmo escrito de outro jeito', async () => {
    const dataset = getDataset()
    const jack = dataset.pets.find((item) => item.id === 'pet-jack')!
    const inicio = instante(addDays(dataset.ancora, 30), '08:00', OFFSET)
    const fim = instante(addDays(dataset.ancora, 33), '12:00', OFFSET)
    const mapa = await reservaRepository.mapa({
      inicio,
      fim,
      porte: jack.porte,
      especie: jack.especie,
    })
    const livre = mapa.vagas.find((vaga) => vaga.impedimentos.length === 0)!
    const antes = reservaRepository.contatosDaFamilia('tutor-daniel').length

    const reserva = await reservaRepository.criar({
      petId: jack.id,
      acomodacaoId: livre.acomodacao.id,
      inicio,
      fim,
      origem: 'telefone',
      autorizadosARetirar: [
        /* A Clara de novo, ditada sem máscara e sem relação: não pode nascer uma segunda Clara. */
        { id: '', nome: 'Clara O.', telefone: '11996712284', relacao: '', documento: '' },
      ],
    })

    const cadastro = reservaRepository.contatosDaFamilia('tutor-daniel')
    const clara = cadastro.find((item) => item.id === 'pessoa-daniel-1')

    expect(reserva.autorizadosARetirar.map((item) => item.id)).toEqual(['pessoa-daniel-1'])
    expect(cadastro).toHaveLength(antes)
    /* O mais recente vale quando preenchido; o vazio não apaga o que já estava lá. */
    expect(clara?.nome).toBe('Clara O.')
    expect(clara?.telefone).toBe('(11) 99671-2284')
    expect(clara?.relacao).toBe('Irmã')
    expect(clara?.documento).toBe('RG 23.456.789-0')
  })

  it('a reserva recusada não deixa ninguém para trás no cadastro', async () => {
    const dataset = getDataset()
    const antes = reservaRepository.contatosDaFamilia('tutor-daniel').length
    const sushi = dataset.reservas.find((item) => item.id === 'res-sushi')!

    /* A mesma baia, no mesmo período do Sushi: a vaga é recusada antes de qualquer gravação. */
    await expect(
      reservaRepository.criar({
        petId: 'pet-jack',
        acomodacaoId: sushi.acomodacaoId,
        inicio: sushi.entradaPrevista,
        fim: sushi.saidaPrevista,
        origem: 'telefone',
        autorizadosARetirar: [
          {
            id: '',
            nome: 'Neide Okamoto',
            telefone: '(11) 97777-1234',
            relacao: '',
            documento: '',
          },
        ],
      }),
    ).rejects.toThrow(VagaIndisponivelError)

    expect(reservaRepository.contatosDaFamilia('tutor-daniel')).toHaveLength(antes)
  })
})

describe('o veterinário do animal', () => {
  it('o informado no check-in fica guardado e volta preenchido na próxima reserva', async () => {
    const hospedagem = await checkInDoSushi({
      autorizadosARetirar: [],
      veterinario: {
        nome: ' Dra. Ana Lima ',
        clinica: 'Clínica Bem-Estar',
        telefone: '(11) 3333-4444',
      },
    })

    const esperado = {
      nome: 'Dra. Ana Lima',
      clinica: 'Clínica Bem-Estar',
      telefone: '(11) 3333-4444',
    }

    expect(hospedagem.veterinario).toEqual(esperado)
    expect(reservaRepository.veterinarioDoPet('pet-sushi')).toEqual(esperado)
    expect((await reservaRepository.abrir('res-sushi'))?.veterinarioDoPet).toEqual(esperado)
  })

  it('não informar agora não apaga o que se sabia', async () => {
    const antes = reservaRepository.veterinarioDoPet('pet-sushi')

    /* O Sushi chega com veterinário conhecido — é o check-in que a demonstração abre. */
    expect(antes).not.toBeNull()

    const hospedagem = await checkInDoSushi({
      autorizadosARetirar: [],
      veterinario: { nome: '', clinica: '', telefone: '' },
    })

    expect(hospedagem.veterinario).toBeNull()
    expect(reservaRepository.veterinarioDoPet('pet-sushi')).toEqual(antes)
  })

  it('quem já esteve na casa tem veterinário conhecido, e a estadia em curso também', () => {
    const dataset = getDataset()

    for (const hospedagem of dataset.hospedagens) {
      expect(hospedagem.veterinario?.telefone).toMatch(/\d{4}-\d{4}$/)
      expect(reservaRepository.veterinarioDoPet(hospedagem.petId)).toEqual(hospedagem.veterinario)
    }
  })
})
