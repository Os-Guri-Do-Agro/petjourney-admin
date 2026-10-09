/**
 * As costuras entre reserva, check-in e check-out.
 *
 * Reserva, entrada e saída são três momentos do **mesmo contrato**, e o que se pergunta num
 * precisa reaparecer no seguinte. Uma auditoria encontrou seis lugares onde isso não acontecia, e
 * o traço comum é que **nenhum deles quebrava nada**: o orçamento fechava, a tela abria, o teste
 * passava. O que faltava era a informação atravessar.
 *
 * Cada `describe` aqui guarda uma dessas costuras. São afirmações sobre o fluxo, não sobre uma
 * função — por isso vivem juntas, e não espalhadas pelos testes de domínio.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { hospedagemRepository, reservaRepository } from '../data/repositories'
import { getDataset, resetDataset } from '../data/store'
import { setMockConfig } from '@/features/clinico/data/mock-runtime'
import { planejarDia } from '../domain/rotina'
import { dataDe } from '../domain/hotel-time'
import type { Servico, ServicoContratado } from '../data/types'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('o serviço vendido vira trabalho na prancheta', () => {
  const CATALOGO: Servico[] = [
    { id: 'srv-banho', kind: 'banho', precoCentavos: 8_900, porDiaria: false, ativo: true },
    {
      id: 'srv-passeio',
      kind: 'passeio-extra',
      precoCentavos: 3_500,
      porDiaria: true,
      ativo: true,
    },
    {
      id: 'srv-transporte',
      kind: 'transporte',
      precoCentavos: 6_900,
      porDiaria: false,
      ativo: true,
    },
  ]

  function contratar(servicoId: string, quantidade = 1): ServicoContratado {
    return { servicoId, quantidade, precoUnitarioCentavos: 0, observacao: '' }
  }

  const base = {
    hospedagemId: 'hosp-1',
    utcOffset: '-03:00',
    planoAlimentar: {
      racaoPropria: true,
      marca: 'Premier',
      porcaoGramas: 120,
      horarios: ['08:00' as const],
      restricoes: '',
      petiscos: '',
    },
    medicacoes: [],
    passeioAutorizado: false,
    entradaEm: '2026-09-20T11:00:00-03:00',
    saidaPrevistaEm: '2026-09-25T12:00:00-03:00',
    servicos: [contratar('srv-banho'), contratar('srv-passeio')],
    catalogoDeServicos: CATALOGO,
  }

  it('o banho vendido aparece como tarefa — era cobrado e ninguém era avisado', () => {
    /* Primeiro dia inteiro: quem chega às 11h de segunda toma banho na terça, não naquele mesmo dia. */
    const planejadas = planejarDia({ ...base, dia: '2026-09-21' })

    expect(planejadas.filter((item) => item.kind === 'banho')).toHaveLength(1)
  })

  it('o que é cobrado uma vez acontece uma vez, e não todo dia', () => {
    const depois = planejarDia({ ...base, dia: '2026-09-23' })

    expect(depois.some((item) => item.kind === 'banho')).toBe(false)
  })

  it('o que é por diária acontece todo dia', () => {
    for (const dia of ['2026-09-21', '2026-09-22', '2026-09-23']) {
      const planejadas = planejarDia({ ...base, dia })

      expect(
        planejadas.filter((item) => item.kind === 'passeio'),
        dia,
      ).toHaveLength(1)
    }
  })

  it('transporte não vira tarefa de canil: acontece fora da casa', () => {
    const planejadas = planejarDia({
      ...base,
      dia: '2026-09-21',
      servicos: [contratar('srv-transporte')],
    })

    expect(planejadas.some((item) => item.origemId === 'srv-transporte')).toBe(false)
  })

  it('a tarefa aponta para o serviço que a originou', () => {
    const planejadas = planejarDia({ ...base, dia: '2026-09-21' })
    const banho = planejadas.find((item) => item.kind === 'banho')

    /* Sem a origem não há como dizer, no check-out, que o que foi cobrado foi feito. */
    expect(banho?.origemId).toBe('srv-banho')
  })
})

describe('o check-in registra a medicação que veio de casa', () => {
  it('a medicação informada vira tarefa no mesmo dia', async () => {
    const dataset = getDataset()

    /*
     * `res-zeus` fica de fora: é o caso plantado C3, que chega **sem a vacina da tosse dos canis**
     * e existe justamente para o check-in recusar. Usá-lo aqui faria este teste falhar por uma
     * regra que funciona.
     */
    const reserva = dataset.reservas.find(
      (item) =>
        item.id !== 'res-zeus' &&
        item.status === 'confirmada' &&
        dataDe(item.entradaPrevista) <= dataset.ancora,
    )

    expect(reserva, 'preciso de uma reserva pronta para entrar').toBeDefined()

    const hospedagem = await hospedagemRepository.checkIn({
      reservaId: reserva!.id,
      pesoEntradaKg: 12,
      inspecaoDeEntrada: '',
      pertences: [],
      planoAlimentar: {
        racaoPropria: true,
        marca: 'Premier',
        porcaoGramas: 120,
        horarios: ['08:00'],
        restricoes: '',
        petiscos: '',
      },
      autorizacoes: [],
      contatoEmergencia: '',
      veterinario: null,
      autorizadosARetirar: [],
      recebidoPor: 'eq-bruna',
      medicacoes: [
        {
          descricao: 'Benazepril 5 mg',
          via: 'oral',
          doseTexto: '1/2 comprimido',
          horarios: ['08:00', '20:00'],
          inicio: dataset.ancora,
          fim: null,
          receita: '',
          observacao: '',
          suspensaEm: null,
        },
      ],
    })

    const medicacoes = getDataset().medicacoes.filter((item) => item.hospedagemId === hospedagem.id)

    expect(medicacoes).toHaveLength(1)

    const tarefas = getDataset().tarefas.filter(
      (item) => item.hospedagemId === hospedagem.id && item.kind === 'medicacao',
    )

    /* Registrar o remédio e não gerar a tarefa seria o mesmo que não registrar. */
    expect(tarefas.length).toBeGreaterThan(0)
  })
})

describe('o check-out fecha o ciclo do dado', () => {
  async function encerrarUmaEstadia() {
    const dataset = getDataset()
    const hospedagem = dataset.hospedagens.find((item) => item.status === 'hospedado')!

    /* Resolve o que a regra R4 trava, para poder chegar ao fechamento. */
    for (const pertence of hospedagem.pertences) {
      await hospedagemRepository.conferirPertence({
        hospedagemId: hospedagem.id,
        pertenceId: pertence.id,
        devolvido: true,
      })
    }

    for (const ocorrencia of dataset.ocorrencias.filter(
      (item) => item.hospedagemId === hospedagem.id && item.exigeContato && !item.contatoEm,
    )) {
      await hospedagemRepository.registrarContato(ocorrencia.id, 'eq-bruna')
    }

    await hospedagemRepository.pesarNaSaida(hospedagem.id, 21.4)

    return hospedagemRepository.checkOut({
      hospedagemId: hospedagem.id,
      entreguePor: 'eq-bruna',
      retiradoPor: 'Clara Okamoto',
    })
  }

  it('o peso da balança volta para o cadastro do animal', async () => {
    const encerrada = await encerrarUmaEstadia()
    const pet = getDataset().pets.find((item) => item.id === encerrada.petId)

    /*
     * Ficava só na estadia, e o cadastro seguia com o peso de meses atrás — que é justamente o que
     * sugere o peso no próximo check-in e o que define o porte no preço.
     */
    expect(pet?.pesoKg).toBe(21.4)
  })

  it('fica registrado a quem o animal foi entregue, e não só quem entregou', async () => {
    const encerrada = await encerrarUmaEstadia()

    expect(encerrada.entreguePor).toBe('eq-bruna')
    expect(encerrada.retiradoPor).toBe('Clara Okamoto')
  })
})

describe('a adaptação pode mudar durante a estadia', () => {
  it('quem sossegou no segundo dia deixa de estar em adaptação', async () => {
    const hospedagem = getDataset().hospedagens.find((item) => item.status === 'hospedado')!

    await hospedagemRepository.ajustarAdaptacao(hospedagem.id, 'tranquilo')

    expect(getDataset().hospedagens.find((item) => item.id === hospedagem.id)?.adaptacao).toBe(
      'tranquilo',
    )
  })
})

describe('o detalhe da estadia carrega quem pode retirar', () => {
  it('a lista vem da reserva, sem uma segunda chamada', async () => {
    const dataset = getDataset()
    const hospedagem = dataset.hospedagens.find((item) => item.status === 'hospedado')!
    const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)!

    const sueli = {
      id: 'pessoa-teste',
      nome: 'Sueli Prado',
      telefone: '(11) 98760-3318',
      relacao: 'Mãe',
      documento: 'RG 9.884.120-3',
    }

    reserva.autorizadosARetirar = [sueli]

    const detalhe = await hospedagemRepository.abrir(hospedagem.id)

    /* Com telefone e documento: é o que o check-out mostra para a recepção conferir. */
    expect(detalhe?.autorizadosARetirar).toEqual([sueli])
  })
})

describe('a duração da estadia se escolhe na reserva', () => {
  it('a vaga responde para o período escolhido, sem gravar nada', () => {
    const dataset = getDataset()
    const ocupada = dataset.reservas.find(
      (item) => item.status === 'confirmada' || item.status === 'hospedado',
    )!

    /*
     * Esticar a estadia por cima de uma reserva existente precisa ser recusado **antes** do
     * clique de confirmar: o diálogo pergunta enquanto o número de noites muda.
     */
    const resposta = reservaRepository.vaga({
      acomodacaoId: ocupada.acomodacaoId,
      inicio: ocupada.entradaPrevista,
      fim: ocupada.saidaPrevista,
    })

    expect(resposta?.impedimentos).toContain('ocupada')
  })

  it('e libera o período que de fato está livre', () => {
    const dataset = getDataset()
    const livre = dataset.acomodacoes.find(
      (item) => item.ativa && !dataset.reservas.some((reserva) => reserva.acomodacaoId === item.id),
    )

    expect(livre, 'preciso de uma acomodação sem reserva').toBeDefined()

    const resposta = reservaRepository.vaga({
      acomodacaoId: livre!.id,
      inicio: `${dataset.ancora}T08:00:00-03:00`,
      fim: `${dataset.ancora}T12:00:00-03:00`,
    })

    expect(resposta?.impedimentos).toEqual([])
  })
})

describe('o passado do dataset não fica sem serviço', () => {
  it('há estadia com serviço vendido que virou tarefa', () => {
    const dataset = getDataset()

    const comServico = dataset.hospedagens.filter((hospedagem) => {
      const reserva = dataset.reservas.find((item) => item.id === hospedagem.reservaId)

      return (reserva?.servicos.length ?? 0) > 0
    })

    expect(comServico.length, 'preciso de alguma estadia com serviço').toBeGreaterThan(0)

    const tarefasDeServico = dataset.tarefas.filter(
      (tarefa) =>
        comServico.some((hospedagem) => hospedagem.id === tarefa.hospedagemId) &&
        ['banho', 'tosa', 'recreacao', 'adestramento'].includes(tarefa.kind),
    )

    expect(tarefasDeServico.length).toBeGreaterThan(0)
  })
})
