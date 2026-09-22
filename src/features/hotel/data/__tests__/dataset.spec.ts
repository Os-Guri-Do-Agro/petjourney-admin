/**
 * O dataset de demonstração.
 *
 * Um protótipo em que o caso difícil só aparece se o apresentador souber montá-lo é um protótipo
 * que nunca mostra o caso difícil. Estes testes afirmam que os cinco casos plantados **existem**,
 * todo dia, em qualquer semente — e que o resto do dataset é coerente o bastante para que as telas
 * não abram mostrando contradições.
 */

import { describe, expect, it } from 'vitest'

import { avaliarAdmissao, piorSituacao } from '../../domain/admissao'
import { avaliarVaga, reservaSegura } from '../../domain/disponibilidade'
import { impedimentosDeSaida } from '../../domain/estadia'
import { contarDiarias, dataDe } from '../../domain/hotel-time'
import { cobrancaDaSaida } from '../../domain/tarifas'
import { gerarDataset, materializarTemporadas, SEMENTE_PADRAO } from '../seed'
import type { SeedResult } from '../seed'

const dataset = gerarDataset()

function reservaDe(id: string) {
  const reserva = dataset.reservas.find((item) => item.id === id)

  expect(reserva, id).toBeDefined()

  return reserva!
}

function admissaoDe(reservaId: string) {
  const reserva = reservaDe(reservaId)
  const pet = dataset.pets.find((item) => item.id === reserva.petId)!

  return avaliarAdmissao({
    exigencias: dataset.exigencias,
    comprovantes: dataset.comprovantes,
    petId: pet.id,
    especie: pet.especie,
    saidaPrevista: dataDe(reserva.saidaPrevista),
    hoje: dataset.ancora,
    dispensas: reserva.dispensas,
  })
}

describe('determinismo', () => {
  it('a mesma semente produz a mesma casa', () => {
    const outro = gerarDataset(SEMENTE_PADRAO)
    const assinatura = (item: SeedResult) =>
      JSON.stringify({
        reservas: item.reservas.map((reserva) => [reserva.id, reserva.orcamento.totalCentavos]),
        acomodacoes: item.acomodacoes.map((acomodacao) => acomodacao.id),
        comprovantes: item.comprovantes.length,
      })

    expect(assinatura(outro)).toBe(assinatura(dataset))
  })

  it('o dia âncora é hoje, inclusive no fim de semana', () => {
    /* Hotel não fecha no domingo. Pular o fim de semana mostraria a casa vazia no dia mais cheio. */
    const hoje = new Date()
    const local = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    /* Um dia de folga: o offset da casa pode cair na véspera em relação ao fuso de quem roda. */
    expect(Math.abs(Date.parse(dataset.ancora) - Date.parse(local))).toBeLessThanOrEqual(86_400_000)
  })
})

describe('C1 · a saída de hoje que custa mais e não fecha', () => {
  const reserva = reservaDe('res-bento')

  it('sai hoje, depois do horário de saída', () => {
    expect(dataDe(reserva.saidaPrevista)).toBe(dataset.ancora)
    expect(cobrancaDaSaida(reserva.saidaPrevista, dataset.hotel.politica)).toBe(50)
  })

  it('o orçamento já traz a meia diária — não é surpresa de balcão', () => {
    expect(reserva.orcamento.linhas.some((linha) => linha.kind === 'meia-diaria')).toBe(true)
  })

  it('o check-out está travado por pertence e por pesagem', () => {
    const hospedagem = dataset.hospedagens.find((item) => item.reservaId === reserva.id)!

    expect(
      impedimentosDeSaida({
        pertences: hospedagem.pertences,
        ocorrencias: dataset.ocorrencias.filter((item) => item.hospedagemId === hospedagem.id),
        pesoSaidaKg: hospedagem.pesoSaidaKg,
      }),
    ).toEqual(expect.arrayContaining(['pertences', 'peso-de-saida']))
  })
})

describe('C2 · ocorrência grave sem contato', () => {
  it('existe, e é do hóspede que parou de comer', () => {
    const travada = dataset.ocorrencias.find((item) => item.exigeContato && !item.contatoEm)

    expect(travada).toBeDefined()
    expect(travada?.kind).toBe('recusa-alimentar')
    expect(travada?.gravidade).toBe('grave')
  })

  it('as refeições recusadas que a originam estão registradas', () => {
    const recusadas = dataset.tarefas.filter(
      (item) => item.hospedagemId === 'hosp-tofu' && item.status === 'recusada',
    )

    expect(recusadas.length).toBeGreaterThan(0)
    expect(recusadas.every((item) => item.kind === 'refeicao')).toBe(true)
  })

  it('o boletim dessa estadia nasceu retido', () => {
    const boletim = dataset.boletins.find((item) => item.hospedagemId === 'hosp-tofu')

    expect(boletim?.status).toBe('retido')
    expect(boletim?.enviadoEm).toBeNull()
  })

  it('e há uma grave **já comunicada**, para o estado resolvido também existir na tela', () => {
    expect(dataset.ocorrencias.some((item) => item.exigeContato && Boolean(item.contatoEm))).toBe(
      true,
    )
  })
})

describe('C3 · chega hoje sem comprovante bloqueante', () => {
  it('a reserva entra hoje', () => {
    expect(dataDe(reservaDe('res-zeus').entradaPrevista)).toBe(dataset.ancora)
  })

  it('a admissão recusa, e diz qual documento falta', () => {
    const admissao = admissaoDe('res-zeus')

    expect(admissao.liberada).toBe(false)
    expect(admissao.impedimentos.map((item) => item.kind)).toEqual(['vacina-tosse-canis'])
    expect(piorSituacao(admissao.itens)).toBe('ausente')
  })
})

describe('C4 · carteira que vence durante a estadia', () => {
  it('está válida hoje e não alcança a saída', () => {
    const admissao = admissaoDe('res-bidu')
    const antirrabica = admissao.itens.find((item) => item.kind === 'vacina-antirrabica')

    expect(antirrabica?.situacao).toBe('vence-durante')
    expect(antirrabica?.diasDeFolga).toBeLessThan(0)
  })

  it('avisa sem bloquear — o reforço ainda cabe antes da entrada', () => {
    const admissao = admissaoDe('res-bidu')

    expect(admissao.liberada).toBe(true)
    expect(admissao.avisos.map((item) => item.kind)).toContain('vacina-antirrabica')
  })
})

describe('C5 · acomodação parada há semanas', () => {
  it('existe uma fora de operação, com motivo e com data', () => {
    const parada = dataset.acomodacoes.find((item) => !item.ativa)

    expect(parada?.motivoInativa).toBe('reforma')
    expect(parada?.detalheInativa).not.toBe('')
    /* A data é a informação: parada há duas horas é manutenção; há três semanas, vaga esquecida. */
    expect(parada?.inativaDesde).toBeTruthy()
    expect(Date.parse(parada!.inativaDesde!)).toBeLessThan(Date.now() - 14 * 86_400_000)
  })
})

describe('coerência da casa', () => {
  it('nenhuma reserva viva se sobrepõe a outra na mesma acomodação', () => {
    /*
     * A invariante que o módulo inteiro protege. Um dataset que já nascesse com sobreposição faria
     * a primeira tela abrir contradizendo a regra que ela existe para mostrar.
     */
    const vivas = dataset.reservas.filter(reservaSegura)

    const conflitantes = vivas.filter((reserva) => {
      const acomodacao = dataset.acomodacoes.find((item) => item.id === reserva.acomodacaoId)!

      return (
        avaliarVaga({
          acomodacao,
          reservas: vivas,
          inicio: reserva.entradaPrevista,
          fim: reserva.saidaPrevista,
          ignorarReservaId: reserva.id,
        }).conflitos.length > 0
      )
    })

    expect(conflitantes.map((item) => item.id)).toEqual([])
  })

  it('toda reserva hospedada tem estadia, e toda estadia tem reserva', () => {
    const hospedadas = dataset.reservas.filter((item) => item.status === 'hospedado')

    expect(dataset.hospedagens).toHaveLength(hospedadas.length)
    expect(
      dataset.hospedagens.every((hospedagem) =>
        dataset.reservas.some((reserva) => reserva.id === hospedagem.reservaId),
      ),
    ).toBe(true)
  })

  it('o total de cada orçamento é a soma das linhas', () => {
    const divergentes = dataset.reservas.filter((reserva) => {
      const soma = reserva.orcamento.linhas.reduce((total, linha) => total + linha.totalCentavos, 0)

      return soma !== reserva.orcamento.totalCentavos
    })

    expect(divergentes.map((item) => item.id)).toEqual([])
  })

  it('o saldo desconta o que já foi pago', () => {
    const divergentes = dataset.reservas.filter(
      (reserva) =>
        reserva.orcamento.saldoCentavos !== reserva.orcamento.totalCentavos - reserva.pagoCentavos,
    )

    expect(divergentes.map((item) => item.id)).toEqual([])
  })

  it('as diárias gravadas batem com a regra de contagem', () => {
    const divergentes = dataset.reservas.filter(
      (reserva) =>
        reserva.diarias !== contarDiarias(reserva.entradaPrevista, reserva.saidaPrevista),
    )

    expect(divergentes.map((item) => item.id)).toEqual([])
  })

  it('nenhuma tarefa cai fora da janela da estadia a que pertence', () => {
    const forasDeLugar = dataset.tarefas.filter((tarefa) => {
      const hospedagem = dataset.hospedagens.find((item) => item.id === tarefa.hospedagemId)

      if (!hospedagem) {
        return true
      }

      return (
        tarefa.previstaPara < hospedagem.entradaEm ||
        tarefa.previstaPara > hospedagem.saidaPrevistaEm
      )
    })

    expect(forasDeLugar.map((item) => item.id)).toEqual([])
  })

  it('a casa abre com trabalho na prancheta, e não vazia', () => {
    /* Um protótipo que abre sem nada a fazer não demonstra a tela que existe para demonstrar. */
    expect(dataset.hospedagens.length).toBeGreaterThanOrEqual(4)
    expect(dataset.tarefas.length).toBeGreaterThan(20)
    expect(dataset.diario.length).toBeGreaterThan(0)
  })

  it('há vaga livre para o telefone, e não só casa cheia', () => {
    const ocupadas = new Set(
      dataset.reservas.filter(reservaSegura).map((item) => item.acomodacaoId),
    )

    expect(
      dataset.acomodacoes.filter((item) => item.ativa && !ocupadas.has(item.id)).length,
    ).toBeGreaterThan(0)
  })
})

describe('temporadas materializadas', () => {
  it('a faixa que atravessa o ano vira duas pontas comparáveis', () => {
    const materializadas = materializarTemporadas(
      [
        {
          id: 'fim-de-ano',
          nome: 'Fim de ano',
          inicioMesDia: '12-20',
          fimMesDia: '01-05',
          acrescimoPercentual: 35,
        },
      ],
      '2026-06-10',
    )

    /* Sem a quebra, `inicio > fim` faria a contagem devolver zero no período mais caro do ano. */
    expect(materializadas.every((item) => item.inicio <= item.fim)).toBe(true)
    expect(materializadas.map((item) => item.id)).toEqual([
      'fim-de-ano-fim',
      'fim-de-ano-inicio',
      'fim-de-ano-anterior',
    ])
  })

  it('a faixa que cabe no ano continua sendo uma só', () => {
    const materializadas = materializarTemporadas(
      [
        {
          id: 'julho',
          nome: 'Férias',
          inicioMesDia: '07-01',
          fimMesDia: '07-31',
          acrescimoPercentual: 20,
        },
      ],
      '2026-06-10',
    )

    expect(materializadas).toEqual([
      {
        id: 'julho',
        nome: 'Férias',
        inicio: '2026-07-01',
        fim: '2026-07-31',
        acrescimoPercentual: 20,
      },
    ])
  })
})

describe('a casa tem passado', () => {
  /**
   * O resumo é a única tela que olha para trás, e foi a captura de apresentação que mostrou o
   * problema: **ocupação média de 5%**, gráfico chapado e "retorno 0%". Os números estavam certos;
   * o mês é que não existia, porque toda reserva do roteiro começa a menos de duas semanas de hoje.
   */
  const encerradas = dataset.reservas.filter(
    (item) => dataDe(item.saidaPrevista) < dataset.ancora && item.status !== 'cancelada',
  )

  it('há estadias concluídas cobrindo as semanas anteriores', () => {
    expect(encerradas.length).toBeGreaterThan(30)

    const maisAntiga = encerradas.map((item) => dataDe(item.entradaPrevista)).sort()[0]!

    expect(contarDiarias(maisAntiga, dataset.ancora)).toBeGreaterThanOrEqual(30)
  })

  it('o passado não encosta no presente, onde moram os casos plantados', () => {
    /* Uma reserva de fundo que terminasse hoje disputaria a acomodação com o roteiro escrito à mão. */
    const fundo = dataset.reservas.filter((item) => item.id.startsWith('res-fundo-'))

    expect(fundo.length).toBeGreaterThan(0)
    expect(fundo.every((item) => dataDe(item.saidaPrevista) < dataset.ancora)).toBe(true)
  })

  it('nenhum animal está em dois lugares ao mesmo tempo', () => {
    /*
     * A invariante de sobreposição do módulo é por acomodação, porque é a venda que ela protege.
     * Ela não vê o mesmo cachorro em quatro baias no mesmo dia — e foi assim que a primeira versão
     * do recheio saiu, visível na lista de reservas: "Jack" quatro vezes na mesma manhã.
     */
    const porPet = new Map<string, { de: string; ate: string; id: string }[]>()

    for (const reserva of dataset.reservas.filter(reservaSegura)) {
      const faixas = porPet.get(reserva.petId) ?? []

      faixas.push({
        de: dataDe(reserva.entradaPrevista),
        ate: dataDe(reserva.saidaPrevista),
        id: reserva.id,
      })
      porPet.set(reserva.petId, faixas)
    }

    const sobrepostas: string[] = []

    for (const [petId, faixas] of porPet) {
      const ordenadas = [...faixas].sort((um, outro) => um.de.localeCompare(outro.de))

      for (let i = 1; i < ordenadas.length; i += 1) {
        if (ordenadas[i]!.de < ordenadas[i - 1]!.ate) {
          sobrepostas.push(`${petId}: ${ordenadas[i - 1]!.id} × ${ordenadas[i]!.id}`)
        }
      }
    }

    expect(sobrepostas).toEqual([])
  })

  it('nem todo mundo apareceu — a perda por não comparecimento tem lastro', () => {
    expect(dataset.reservas.some((item) => item.status === 'nao-compareceu')).toBe(true)
  })

  it('há responsáveis com mais de uma estadia, que é o que o retorno mede', () => {
    const porTutor = new Map<string, number>()

    for (const reserva of dataset.reservas) {
      porTutor.set(reserva.tutorId, (porTutor.get(reserva.tutorId) ?? 0) + 1)
    }

    expect([...porTutor.values()].filter((total) => total > 1).length).toBeGreaterThan(0)
  })
})

describe('a tela de configuração vê a temporada como ela foi cadastrada', () => {
  /**
   * O dataset carrega as duas listas, e elas não são intercambiáveis.
   *
   * O preço precisa das faixas materializadas, porque a virada do ano só é comparável quebrada em
   * pontas. A tela de configuração precisa do que a operação digitou. Listar as materializadas ali
   * mostrava "Fim de ano" três vezes, com intervalos que pareciam se contradizer — e a tela de
   * configuração é justamente onde alguém vai conferir se o cadastro está certo.
   */
  it('há uma entrada por temporada cadastrada, e mais materializadas que isso', () => {
    expect(dataset.temporadasSazonais).toHaveLength(3)
    expect(new Set(dataset.temporadasSazonais.map((item) => item.nome)).size).toBe(3)
    expect(dataset.temporadas.length).toBeGreaterThan(dataset.temporadasSazonais.length)
  })

  it('a faixa cadastrada guarda o mês e dia, sem ano', () => {
    const fimDeAno = dataset.temporadasSazonais.find((item) => item.fimMesDia < item.inicioMesDia)

    expect(fimDeAno).toBeDefined()
    expect(fimDeAno?.inicioMesDia).toMatch(/^\d{2}-\d{2}$/)
    expect(fimDeAno?.fimMesDia).toMatch(/^\d{2}-\d{2}$/)
  })
})

describe('os casos aparecem no painel', () => {
  it('cada caso tem título, descrição e rota', () => {
    /* Um caso que o apresentador não acha é um caso que não existe. */
    expect(dataset.casos).toHaveLength(5)
    expect(
      dataset.casos.every(
        (caso) => caso.titulo && caso.descricao && caso.rota.startsWith('/hotel/'),
      ),
    ).toBe(true)
  })
})
