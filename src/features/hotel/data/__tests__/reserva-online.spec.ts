/**
 * O servidor da reserva online do hotel, dos dois lados.
 *
 * O percurso da demonstração — pedir pelo app, o balcão reservar, a reserva aparecer `pendente`
 * com a origem do pedido e o aviso chegar — e os casos difíceis de hotel: dois cães da mesma casa
 * na mesma acomodação, o tipo que esgota enquanto a pessoa pede, a primeira estadia de um pet que o
 * hotel não conhece, e a urgência que não vira pedido.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setMockConfig } from '@/features/clinico/data/mock-runtime'
import { RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO } from '@/features/clinico/data/seed-pedidos'
import { addDays, setClockSkew } from '@/features/clinico/domain/clinic-time'

import {
  disputarProximoEnvio,
  ErroDaReservaOnline,
  pedidoDeReservaRepository,
  reservaOnlineDoResponsavel as app,
} from '../reserva-online'
import { getDataset, hojeIso, resetDataset } from '../store'
import { instante } from '../../domain/hotel-time'

const OFFSET = '-04:00'

function periodo(diasAteEntrada: number, noites: number) {
  const entrada = addDays(hojeIso(), diasAteEntrada)

  return {
    entrada: instante(entrada, '10:00', OFFSET),
    saida: instante(addDays(entrada, noites), '12:00', OFFSET),
  }
}

async function codigoDe(promessa: Promise<unknown>) {
  try {
    await promessa

    return null
  } catch (causa) {
    return causa instanceof ErroDaReservaOnline ? causa.codigo : 'outro'
  }
}

beforeEach(() => {
  setClockSkew(0)
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  disputarProximoEnvio(false)
})

afterEach(() => {
  setClockSkew(0)
})

describe('a caixa semeada', () => {
  it('a Luna pediu suíte depois de Thor e Cacau: não sobra suíte, e a linha sugere outra', async () => {
    const caixa = await pedidoDeReservaRepository.listar()
    const thor = caixa.find((linha) => linha.pedido.id === 'pedido-res-thor')
    const luna = caixa.find((linha) => linha.pedido.id === 'pedido-res-luna')

    expect(thor?.tipoTemVaga).toBe(true)
    expect(luna?.tipoTemVaga).toBe(false)
    expect(luna?.sugestao?.tipo.id).not.toBe('tipo-suite')
  })

  it('Bento e Açaí vão para uma acomodação que comporta os dois', async () => {
    const caixa = await pedidoDeReservaRepository.listar()
    const joao = caixa.find((linha) => linha.pedido.id === 'pedido-res-joao')

    expect(joao?.sugestao?.acomodacao.capacidade).toBeGreaterThanOrEqual(2)
  })
})

describe('o pedido do app', () => {
  it('dois cães da mesma casa: um pedido, a mesma acomodação, e o aceite reserva os dois juntos', async () => {
    const { entrada, saida } = periodo(20, 3)
    const pedido = await app.pedir('tutor-luciana', {
      modo: 'ACOMODACAO_ESCOLHIDA',
      petIds: ['pet-mel', 'pet-amora'],
      entrada,
      saida,
      tipoId: 'tipo-baia',
      servicos: ['BANHO'],
    })

    expect(pedido.status).toBe('AGUARDANDO_HOTEL')
    expect(pedido.pets.map((pet) => pet.id)).toEqual(['pet-mel', 'pet-amora'])

    const reserva = await pedidoDeReservaRepository.aceitar(pedido.id)

    expect(reserva.acompanhantePetId).toBe('pet-amora')
    expect(reserva.origem).toBe('app')
    expect(reserva.status).toBe('pendente')
    expect(reserva.servicos).toHaveLength(1)
    expect(app.avisos('tutor-luciana')[0]?.tipo).toBe('aceito')
  })

  it('o tipo que esgota enquanto a pessoa pede: o envio é recusado e o tipo some da lista', async () => {
    const { entrada, saida } = periodo(25, 2)

    disputarProximoEnvio()

    const codigo = await codigoDe(
      app.pedir('tutor-luciana', {
        modo: 'ACOMODACAO_ESCOLHIDA',
        petIds: ['pet-amora'],
        entrada,
        saida,
        tipoId: 'tipo-suite',
      }),
    )
    const depois = await app.disponibilidade('tutor-luciana', ['pet-amora'], entrada, saida)

    expect(codigo).toBe('SEM_VAGA_NO_TIPO')
    expect(depois.tipos.find((tipo) => tipo.tipoId === 'tipo-suite')?.livres).toBe(0)
  })

  it('cão e gato não dividem acomodação', async () => {
    const { entrada, saida } = periodo(20, 2)
    const codigo = await codigoDe(
      app.pedir('tutor-camila', {
        modo: 'HOTEL_ESCOLHE',
        petIds: ['pet-nina', 'pet-oliver'],
        entrada,
        saida,
      }),
    )

    expect(codigo).toBe('NAO_DIVIDEM_ACOMODACAO')
  })

  it('entrada em cima da hora não vira pedido', async () => {
    const amanha = addDays(hojeIso(), 0)
    const codigo = await codigoDe(
      app.pedir('tutor-luciana', {
        modo: 'HOTEL_ESCOLHE',
        petIds: ['pet-amora'],
        entrada: instante(amanha, '23:00', OFFSET),
        saida: instante(addDays(amanha, 2), '12:00', OFFSET),
      }),
    )

    expect(codigo).toBe('FORA_DA_ANTECEDENCIA')
  })

  it('cão sem porte não pede até completar; completado, o aceite cria o cadastro no hotel', async () => {
    const { entrada, saida } = periodo(30, 2)

    expect(
      app.petsDaConta(RESPONSAVEL_SEM_VINCULO).find((pet) => pet.id === PET_SEM_VINCULO)
        ?.faltaPorte,
    ).toBe(true)
    expect(
      await codigoDe(
        app.pedir(RESPONSAVEL_SEM_VINCULO, {
          modo: 'HOTEL_ESCOLHE',
          petIds: [PET_SEM_VINCULO],
          entrada,
          saida,
        }),
      ),
    ).toBe('CADASTRO_INCOMPLETO')

    await app.completarPorte(RESPONSAVEL_SEM_VINCULO, PET_SEM_VINCULO, 'pequeno')

    const pedido = await app.pedir(RESPONSAVEL_SEM_VINCULO, {
      modo: 'HOTEL_ESCOLHE',
      petIds: [PET_SEM_VINCULO],
      entrada,
      saida,
    })

    expect(getDataset().pets.some((pet) => pet.id === PET_SEM_VINCULO)).toBe(false)

    await pedidoDeReservaRepository.aceitar(pedido.id)

    expect(getDataset().pets.some((pet) => pet.id === PET_SEM_VINCULO)).toBe(true)
    expect(app.avisos(RESPONSAVEL_SEM_VINCULO)[0]?.tipo).toBe('alocado')
  })
})

describe('o link público e a recusa', () => {
  it('pelo link: cadastro mínimo, código para acompanhar, e o aceite com a origem do link', async () => {
    const { entrada, saida } = periodo(20, 3)
    const pedido = await app.pedirPeloLink({
      modo: 'ACOMODACAO_ESCOLHIDA',
      tipoId: 'tipo-baia',
      entrada,
      saida,
      visitante: {
        nome: 'Paula Reis',
        telefone: '(11) 97000-1234',
        petNome: 'Pingo',
        especie: 'CANINA',
        porte: 'PEQUENO',
      },
    })

    expect((await app.pedidoPorToken(pedido.token))?.status).toBe('AGUARDANDO_HOTEL')

    const reserva = await pedidoDeReservaRepository.aceitar(pedido.id)

    expect(reserva.origem).toBe('link')
    expect(getDataset().avisosDoPedido[getDataset().avisosDoPedido.length - 1]?.corpo).toContain(
      '/reservar/',
    )
  })

  it('cão pelo link precisa do porte', async () => {
    const { entrada, saida } = periodo(20, 3)
    const codigo = await codigoDe(
      app.pedirPeloLink({
        modo: 'HOTEL_ESCOLHE',
        entrada,
        saida,
        visitante: {
          nome: 'Paula Reis',
          telefone: '(11) 97000-1234',
          petNome: 'Pingo',
          especie: 'CANINA',
        },
      }),
    )

    expect(codigo).toBe('CADASTRO_INCOMPLETO')
  })

  it('recusar guarda o motivo e avisa; responder de novo não vale', async () => {
    await pedidoDeReservaRepository.recusar('pedido-res-thor', 'sem-vaga', 'Lotado.')

    expect(
      getDataset().pedidosDeReserva.find((item) => item.id === 'pedido-res-thor')?.recusa?.motivo,
    ).toBe('sem-vaga')
    expect(app.avisos('tutor-eduardo')[0]?.tipo).toBe('recusado')
    expect(await codigoDe(pedidoDeReservaRepository.aceitar('pedido-res-thor'))).toBe(
      'PEDIDO_JA_RESPONDIDO',
    )
  })

  it('pausado, o hotel não oferece vaga', async () => {
    await pedidoDeReservaRepository.salvarConfiguracao({
      ...pedidoDeReservaRepository.configuracao(),
      ativo: false,
    })

    const { entrada, saida } = periodo(20, 2)

    expect(
      await codigoDe(app.disponibilidade('tutor-luciana', ['pet-amora'], entrada, saida)),
    ).toBe('HOTEL_NAO_RECEBE_PEDIDOS')
  })
})
