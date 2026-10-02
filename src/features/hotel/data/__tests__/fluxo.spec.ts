/**
 * O fluxo inteiro, de ponta a ponta: reserva → documentação → check-in → rotina → ocorrência →
 * boletim → check-out.
 *
 * Os testes de domínio provam cada regra isolada. Este prova que elas **se encaixam** — que a
 * reserva criada pelo mapa é a mesma que o check-in encontra, que a rotina nasce da ficha que o
 * balcão preencheu, e que a ocorrência registrada às três da manhã trava a saída do dia seguinte.
 *
 * É também a prova de que as quatro regras não se contradizem. Cada uma delas, sozinha, é uma
 * função de dez linhas; juntas, são a diferença entre um protótipo que navega e um que funciona.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { addDays } from '@/features/clinico/domain/clinic-time'
import { setMockConfig } from '@/features/clinico/data/mock-runtime'

import {
  AdmissaoBloqueadaError,
  acomodacaoRepository,
  BoletimRetidoError,
  CadastroRecusadoError,
  hospedagemRepository,
  rotinaPadraoRepository,
  amanhaNaCasa,
  PassagemTravadaError,
  reservaRepository,
  SaidaBloqueadaError,
  VagaIndisponivelError,
} from '../repositories'
import { getDataset, resetDataset } from '../store'
import { instante } from '../../domain/hotel-time'

const OFFSET = '-04:00'

function iso(data: string, hora: string) {
  return instante(data, hora, OFFSET)
}

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('venda: do mapa à reserva', () => {
  it('a vaga oferecida pelo mapa é a vaga que a reserva aceita', async () => {
    /*
     * A invariante que sustenta o telefone: as duas telas chamam a mesma função de domínio. Se
     * divergirem, a recepção oferece uma baia e o sistema recusa com o cliente na linha.
     */
    const ancora = getDataset().ancora
    const inicio = iso(addDays(ancora, 20), '08:00')
    const fim = iso(addDays(ancora, 23), '12:00')

    const mapa = await reservaRepository.mapa({ inicio, fim, porte: 'medio', especie: 'canina' })
    const livre = mapa.vagas.find((vaga) => vaga.impedimentos.length === 0)!

    const reserva = await reservaRepository.criar({
      petId: 'pet-luna',
      acomodacaoId: livre.acomodacao.id,
      inicio,
      fim,
      origem: 'telefone',
    })

    expect(reserva.acomodacaoId).toBe(livre.acomodacao.id)
    expect(reserva.diarias).toBe(3)
    /* Nasce pendente: reserva sem sinal é intenção, não venda. */
    expect(reserva.status).toBe('pendente')
    expect(reserva.orcamento.totalCentavos).toBeGreaterThan(0)

    /* E a vaga sai do mapa no mesmo período, imediatamente. */
    const depois = await reservaRepository.mapa({ inicio, fim })

    expect(depois.vagas.find((vaga) => vaga.acomodacao.id === livre.acomodacao.id)!.situacao).toBe(
      'reservada',
    )
  })

  it('a segunda reserva no mesmo período é recusada, com o motivo', async () => {
    const ancora = getDataset().ancora
    const inicio = iso(addDays(ancora, 25), '08:00')
    const fim = iso(addDays(ancora, 28), '12:00')

    const primeira = await reservaRepository.criar({
      petId: 'pet-luna',
      acomodacaoId: 'acom-a3',
      inicio,
      fim,
      origem: 'balcao',
    })

    expect(primeira.id).toBeTruthy()

    await expect(
      reservaRepository.criar({
        petId: 'pet-mel',
        acomodacaoId: 'acom-a3',
        inicio: iso(addDays(ancora, 26), '08:00'),
        fim: iso(addDays(ancora, 30), '12:00'),
        origem: 'balcao',
      }),
    ).rejects.toThrow(VagaIndisponivelError)
  })

  it('prorrogar não colide com a própria reserva, e recalcula a conta', async () => {
    /* A operação que mais acontece — o voo atrasou — e a que menos costuma estar prevista. */
    const ancora = getDataset().ancora
    const inicio = iso(addDays(ancora, 40), '08:00')

    const reserva = await reservaRepository.criar({
      petId: 'pet-luna',
      acomodacaoId: 'acom-b2',
      inicio,
      fim: iso(addDays(ancora, 43), '12:00'),
      origem: 'app',
    })

    const antes = reserva.orcamento.totalCentavos

    const esticada = await reservaRepository.editar({
      reservaId: reserva.id,
      fim: iso(addDays(ancora, 46), '12:00'),
    })

    expect(esticada.diarias).toBe(6)
    expect(esticada.orcamento.totalCentavos).toBeGreaterThan(antes)
  })
})

describe('admissão: o que entra e o que não', () => {
  it('o check-in é recusado enquanto falta documento bloqueante', async () => {
    /* Caso C3: o Zeus chega hoje sem tosse dos canis. */
    await expect(
      hospedagemRepository.checkIn({
        reservaId: 'res-zeus',
        pesoEntradaKg: 19.8,
        inspecaoDeEntrada: '',
        pertences: [],
        planoAlimentar: {
          racaoPropria: false,
          marca: '',
          porcaoGramas: 200,
          horarios: ['08:00'],
          restricoes: '',
          petiscos: '',
        },
        autorizacoes: [],
        contatoEmergencia: '',
        veterinarioDeConfianca: '',
        recebidoPor: 'eq-bruna',
      }),
    ).rejects.toThrow(AdmissaoBloqueadaError)
  })

  it('a dispensa nominal libera — e fica registrada com nome e motivo', async () => {
    await reservaRepository.dispensar({
      reservaId: 'res-zeus',
      kind: 'vacina-tosse-canis',
      motivo: 'Carteira em poder do veterinário; foto conferida por WhatsApp.',
      autorizadaPor: 'eq-helena',
    })

    const detalhe = (await reservaRepository.abrir('res-zeus'))!

    expect(detalhe.admissao.liberada).toBe(true)
    expect(detalhe.reserva.dispensas[0]?.autorizadaPor).toBe('eq-helena')
    /* A dispensa não apaga o fato de não haver papel. */
    expect(
      detalhe.admissao.itens.find((item) => item.kind === 'vacina-tosse-canis')?.comprovante,
    ).toBeNull()
  })

  it('registrar o comprovante também libera, e a validade é calculada', async () => {
    const hoje = getDataset().ancora

    await reservaRepository.registrarComprovante({
      petId: 'pet-zeus',
      kind: 'vacina-tosse-canis',
      apresentadoEm: hoje,
      documento: 'Lote 25A-0031',
    })

    const detalhe = (await reservaRepository.abrir('res-zeus'))!
    const item = detalhe.admissao.itens.find((linha) => linha.kind === 'vacina-tosse-canis')

    expect(detalhe.admissao.liberada).toBe(true)
    expect(item?.situacao).toBe('ok')
    /* Doze meses: o balcão digita a aplicação, o sistema faz a conta. */
    expect(item?.comprovante?.validoAte).toBe(addDays(hoje, 365))
  })
})

describe('a estadia, de ponta a ponta', () => {
  async function internarZeus() {
    await reservaRepository.dispensar({
      reservaId: 'res-zeus',
      kind: 'vacina-tosse-canis',
      motivo: 'Comprovante a caminho por e-mail.',
      autorizadaPor: 'eq-helena',
    })

    return hospedagemRepository.checkIn({
      reservaId: 'res-zeus',
      pesoEntradaKg: 19.8,
      inspecaoDeEntrada: 'Sem alterações.',
      pertences: [
        { descricao: 'Coleira e guia', quantidade: 1 },
        { descricao: 'Caminha', quantidade: 1 },
      ],
      planoAlimentar: {
        racaoPropria: true,
        marca: 'Premier',
        porcaoGramas: 320,
        horarios: ['08:00', '18:00'],
        restricoes: '',
        petiscos: '',
      },
      autorizacoes: [
        {
          kind: 'passeio-externo',
          concedida: true,
          limiteCentavos: null,
          registradaEm: iso(getDataset().ancora, '15:00'),
        },
      ],
      contatoEmergencia: '(11) 99999-0000',
      veterinarioDeConfianca: 'Clínica PetJourney',
      recebidoPor: 'eq-bruna',
    })
  }

  it('o check-in cria a estadia e a rotina nasce da ficha preenchida', async () => {
    const hospedagem = await internarZeus()
    const estadia = (await hospedagemRepository.abrir(hospedagem.id))!

    expect(hospedagem.status).toBe('hospedado')
    expect(estadia.hospedagem.pertences).toHaveLength(2)

    const kinds = new Set(estadia.tarefas.map((tarefa) => tarefa.kind))

    /* Refeição e passeio vêm da ficha; higiene e água são a rotina fixa da casa. */
    expect(kinds).toContain('refeicao')
    expect(kinds).toContain('passeio')
    expect(kinds).toContain('higiene')

    /* Nada antes da entrada: quem chega às 15h não tem a refeição das 8h nascendo atrasada. */
    expect(estadia.tarefas.every((tarefa) => tarefa.previstaPara >= hospedagem.entradaEm)).toBe(
      true,
    )

    /* E a reserva acompanha. */
    expect((await reservaRepository.abrir('res-zeus'))!.reserva.status).toBe('hospedado')
  })

  it('marcar uma tarefa muda só aquela tarefa', async () => {
    const hospedagem = await internarZeus()
    const estadia = (await hospedagemRepository.abrir(hospedagem.id))!
    const alvo = estadia.tarefas[0]!

    const marcada = await hospedagemRepository.marcarTarefa({
      tarefaId: alvo.id,
      status: 'feita',
      executadaPor: 'eq-rafael',
    })

    expect(marcada.status).toBe('feita')
    expect(marcada.executadaPor).toBe('eq-rafael')

    const depois = (await hospedagemRepository.abrir(hospedagem.id))!
    const outras = depois.tarefas.filter((tarefa) => tarefa.id !== alvo.id)

    expect(outras.every((tarefa) => tarefa.status === 'pendente')).toBe(true)
  })

  it('ocorrência grave trava boletim, turno e saída — e a ligação destrava os três', async () => {
    const hospedagem = await internarZeus()

    const ocorrencia = await hospedagemRepository.registrarOcorrencia({
      hospedagemId: hospedagem.id,
      kind: 'briga',
      gravidade: 'grave',
      descricao: 'Atrito na área de recreação, arranhão no focinho.',
      conduta: 'Separados e limpeza local.',
      registradaPor: 'eq-rafael',
    })

    /* A regra é derivada da gravidade no repositório, nunca recebida da tela. */
    expect(ocorrencia.exigeContato).toBe(true)

    const boletim = await hospedagemRepository.gerarBoletim(hospedagem.id, 'eq-helena')

    expect(boletim.status).toBe('retido')
    await expect(hospedagemRepository.enviarBoletim(boletim.id)).rejects.toThrow(BoletimRetidoError)

    await expect(
      hospedagemRepository.entregarTurno({ nota: '', recebidoPor: 'eq-tais' }),
    ).rejects.toThrow(PassagemTravadaError)

    /* Uma ligação, e os três destravam. Exigir três cliques deixaria o responsável sem notícia. */
    await hospedagemRepository.registrarContato(ocorrencia.id, 'eq-helena')

    const enviado = await hospedagemRepository.enviarBoletim(boletim.id)

    expect(enviado.status).toBe('enviado')
    expect(enviado.enviadoEm).toBeTruthy()
  })

  it('o check-out recusa enquanto falta conferência e pesagem, e aceita depois', async () => {
    const hospedagem = await internarZeus()

    await expect(
      hospedagemRepository.checkOut({
        hospedagemId: hospedagem.id,
        entreguePor: 'eq-bruna',
        retiradoPor: 'Responsável',
      }),
    ).rejects.toThrow(SaidaBloqueadaError)

    for (const pertence of hospedagem.pertences) {
      await hospedagemRepository.conferirPertence({
        hospedagemId: hospedagem.id,
        pertenceId: pertence.id,
        devolvido: true,
      })
    }

    /* Só os pertences não bastam: falta a balança, que é a prova que some quando o carro sai. */
    await expect(
      hospedagemRepository.checkOut({
        hospedagemId: hospedagem.id,
        entreguePor: 'eq-bruna',
        retiradoPor: 'Responsável',
      }),
    ).rejects.toThrow(SaidaBloqueadaError)

    await hospedagemRepository.pesarNaSaida(hospedagem.id, 19.2)

    const encerrada = await hospedagemRepository.checkOut({
      hospedagemId: hospedagem.id,
      entreguePor: 'eq-bruna',
      retiradoPor: 'Responsável',
    })

    expect(encerrada.status).toBe('encerrada')
    expect(encerrada.saidaEm).toBeTruthy()

    /* A conta é refeita contra a saída **real**, e a reserva fecha junto. */
    const reserva = (await reservaRepository.abrir('res-zeus'))!

    expect(reserva.reserva.status).toBe('encerrada')

    /* E a estadia encerrada some da prancheta: refeição pendente de quem foi embora é ruído. */
    const prancheta = await hospedagemRepository.rotina(getDataset().ancora)

    expect(prancheta.some((linha) => linha.hospedagemId === hospedagem.id)).toBe(false)
  })

  it('o pertence perdido **com** observação deixa a saída fechar', async () => {
    /*
     * "Resolvido" não é "devolvido": a coleira que se perdeu, e alguém escreveu que se perdeu,
     * é um check-out honesto. O que trava é o campo em branco.
     */
    const hospedagem = await internarZeus()

    await hospedagemRepository.conferirPertence({
      hospedagemId: hospedagem.id,
      pertenceId: hospedagem.pertences[0]!.id,
      devolvido: true,
    })
    await hospedagemRepository.conferirPertence({
      hospedagemId: hospedagem.id,
      pertenceId: hospedagem.pertences[1]!.id,
      devolvido: false,
      observacao: 'Caminha extraviada. Responsável avisado no balcão.',
    })
    await hospedagemRepository.pesarNaSaida(hospedagem.id, 19.5)

    await expect(
      hospedagemRepository.checkOut({
        hospedagemId: hospedagem.id,
        entreguePor: 'eq-bruna',
        retiradoPor: 'Responsável',
      }),
    ).resolves.toBeTruthy()
  })
})

describe('cadastro da casa', () => {
  it('cria, edita e tira de operação — e a vaga some do mapa', async () => {
    const ancora = getDataset().ancora
    const nova = await acomodacaoRepository.criar({
      nome: 'Baia A9',
      blocoId: 'bloco-canil-a',
      kind: 'baia',
      capacidade: 1,
      porteMaximo: 'grande',
      especiesAceitas: ['canina'],
      recursos: ['climatizacao'],
      higienizacaoMinutos: 60,
      tarifaId: 'tarifa-padrao',
    })

    expect(nova.ativa).toBe(true)

    await acomodacaoRepository.desativar({
      acomodacaoId: nova.id,
      motivo: 'manutencao',
      detalhe: 'Trocar o bebedouro',
    })

    const mapa = await reservaRepository.mapa({
      inicio: iso(addDays(ancora, 50), '08:00'),
      fim: iso(addDays(ancora, 52), '12:00'),
    })

    expect(mapa.vagas.find((vaga) => vaga.acomodacao.id === nova.id)!.situacao).toBe(
      'fora-de-operacao',
    )
  })

  it('recusa nome repetido, e recusa remover o que já hospedou', async () => {
    await expect(
      acomodacaoRepository.criar({
        nome: 'Baia A1',
        blocoId: 'bloco-canil-a',
        kind: 'baia',
        capacidade: 1,
        porteMaximo: 'grande',
        especiesAceitas: ['canina'],
        recursos: [],
        higienizacaoMinutos: 60,
        tarifaId: 'tarifa-padrao',
      }),
    ).rejects.toThrow(CadastroRecusadoError)

    /*
     * Apagar uma acomodação com história apagaria a história junto: a estadia de março passaria a
     * apontar para um lugar que não existe.
     */
    await expect(acomodacaoRepository.remover('acom-a1')).rejects.toThrow(CadastroRecusadoError)
  })

  it('recusa desativar acomodação com hóspede dentro', async () => {
    /* Desativar uma acomodação ocupada não é configuração, é despejo. */
    const ocupada = getDataset().hospedagens.find((item) => item.status === 'hospedado')!

    await expect(
      acomodacaoRepository.desativar({
        acomodacaoId: ocupada.acomodacaoId,
        motivo: 'manutencao',
        detalhe: '',
      }),
    ).rejects.toThrow(CadastroRecusadoError)
  })
})

describe('a rotina existe em todo dia da estadia, não só nos dois que alguém gerou', () => {
  it('o terceiro dia de uma estadia longa tem tarefas', async () => {
    /*
     * As tarefas nasciam em dois momentos e só neles: a semente gera ontem e hoje, o check-in gera
     * hoje e amanhã. Ninguém gerava o resto, e numa estadia de sete noites o terceiro dia chegava
     * com a prancheta **vazia** — a casa passava o dia sem lista. O defeito nunca aparecia na
     * demonstração porque a demonstração sempre olha hoje.
     */
    const dataset = getDataset()
    const hospedado = dataset.hospedagens.find((item) => item.status === 'hospedado')!

    const daquiATresDias = addDays(dataset.ancora, 3)

    /* A estadia precisa de fato alcançar esse dia, senão o teste não prova nada. */
    expect(hospedado.saidaPrevistaEm.slice(0, 10) >= daquiATresDias).toBe(true)

    const tarefas = await hospedagemRepository.rotina(daquiATresDias)

    expect(tarefas.length).toBeGreaterThan(0)
    expect(tarefas.some((item) => item.tarefa.hospedagemId === hospedado.id)).toBe(true)
  })

  it('reler o mesmo dia não duplica nada', async () => {
    /* A leitura materializa. Sem a chave idempotente, abrir a prancheta duas vezes dobraria o dia. */
    const daquiADoisDias = addDays(getDataset().ancora, 2)

    const primeira = await hospedagemRepository.rotina(daquiADoisDias)
    const segunda = await hospedagemRepository.rotina(daquiADoisDias)

    expect(segunda).toHaveLength(primeira.length)

    const ids = segunda.map((item) => item.tarefa.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('não materializa dia nenhum para quem já foi embora', async () => {
    const dataset = getDataset()
    const encerrada = dataset.hospedagens.find((item) => item.status !== 'hospedado')

    if (!encerrada) return

    const tarefas = await hospedagemRepository.rotina(addDays(dataset.ancora, 3))

    expect(tarefas.some((item) => item.tarefa.hospedagemId === encerrada.id)).toBe(false)
  })
})

describe('a casa cadastra a própria rotina', () => {
  it('publicar um plano novo não apaga o trabalho já feito', async () => {
    /*
     * A prova de que o cadastro não destrói histórico. Marca-se metade do dia, troca-se o plano
     * inteiro por outro sem um horário em comum, e o que foi executado tem de sair do outro lado
     * com o mesmo id, o mesmo executor e a mesma hora.
     */
    const dataset = getDataset()
    const hoje = dataset.ancora

    const antes = await hospedagemRepository.rotina(hoje)
    const daCasa = antes.filter((item) => item.tarefa.kind === 'agua')

    expect(daCasa.length).toBeGreaterThan(0)

    const marcadas = daCasa.slice(0, Math.max(1, Math.floor(daCasa.length / 2)))

    for (const item of marcadas) {
      await hospedagemRepository.marcarTarefa({
        tarefaId: item.tarefa.id,
        status: 'feita',
        executadaPor: 'cuidador-teste',
      })
    }

    const atual = await rotinaPadraoRepository.atual()

    /* Um plano de água sem nenhum horário em comum com o anterior. */
    const novos = atual.itens.map((item) =>
      item.kind === 'agua' ? { ...item, horarios: ['05:30', '23:30'] } : item,
    )

    await rotinaPadraoRepository.publicar({
      itens: novos,
      vigenteDesde: `${hoje}T00:00:00-04:00`,
      por: 'cuidador-teste',
    })

    const depois = getDataset().tarefas

    for (const item of marcadas) {
      const sobrevivente = depois.find((tarefa) => tarefa.id === item.tarefa.id)

      expect(sobrevivente, `a tarefa ${item.tarefa.id} sumiu ao publicar`).toBeDefined()
      expect(sobrevivente!.status).toBe('feita')
      expect(sobrevivente!.executadaPor).toBe('cuidador-teste')
    }
  })

  it('a previsão diz a verdade: os números batem com o que a publicação faz', async () => {
    const dataset = getDataset()
    const atual = await rotinaPadraoRepository.atual()
    const vigenteDesde = `${dataset.ancora}T00:00:00-04:00`

    const novos = atual.itens.map((item) =>
      item.kind === 'higiene' ? { ...item, horarios: ['23:10', '23:20', '23:30'] } : item,
    )

    const previsao = await rotinaPadraoRepository.previsao({ itens: novos, vigenteDesde })

    const antes = getDataset().tarefas.length

    await rotinaPadraoRepository.publicar({ itens: novos, vigenteDesde, por: 'cuidador-teste' })

    const depois = getDataset().tarefas.length

    expect(depois - antes).toBe(previsao.criadas - previsao.retiradas)
  })

  it('o cadastro vale para quem entrar depois', async () => {
    const dataset = getDataset()
    const atual = await rotinaPadraoRepository.atual()

    /* A casa liga a pesagem, que sempre existiu como tipo e nunca teve gerador. */
    const comPesagem = atual.itens.map((item) =>
      item.kind === 'pesagem' ? { ...item, ativo: true, horarios: ['07:30'] } : item,
    )

    await rotinaPadraoRepository.publicar({
      itens: comPesagem,
      vigenteDesde: `${dataset.ancora}T00:00:00-04:00`,
      por: 'cuidador-teste',
    })

    /* Um dia adiante, ainda não materializado: nasce já com a pesagem. */
    const adiante = await hospedagemRepository.rotina(addDays(dataset.ancora, 2))

    expect(adiante.some((item) => item.tarefa.kind === 'pesagem')).toBe(true)
  })

  it('desfazer volta o cadastro e tira as tarefas que ninguém tocou', async () => {
    const dataset = getDataset()
    const atual = await rotinaPadraoRepository.atual()

    const novos = atual.itens.map((item) =>
      item.kind === 'agua' ? { ...item, horarios: [...item.horarios, '23:45'] } : item,
    )

    /*
     * Amanhã é materializado antes de publicar, e não por capricho: `reconciliarDia` só cria o que
     * ainda está à frente do relógio (`previstaPara > agora`), então o horário das 23:45 **de hoje**
     * deixa de nascer a partir das 23:45 de hoje. Este teste reprovava todo dia entre 23:45 e a
     * meia-noite, e reprovava dizendo "expected 0 to be greater than 0" — que não aponta para o
     * relógio nem de longe. Com o dia seguinte no jogo, o horário está sempre no futuro.
     */
    await hospedagemRepository.rotina(addDays(dataset.ancora, 1))

    await rotinaPadraoRepository.publicar({
      itens: novos,
      vigenteDesde: `${dataset.ancora}T00:00:00-04:00`,
      por: 'cuidador-teste',
    })

    const comExtra = getDataset().tarefas.filter((item) =>
      item.previstaPara.includes('23:45'),
    ).length

    expect(comExtra).toBeGreaterThan(0)

    const revertido = await rotinaPadraoRepository.desfazer()

    expect(revertido.itens.find((item) => item.kind === 'agua')!.horarios).toEqual(
      atual.itens.find((item) => item.kind === 'agua')!.horarios,
    )

    expect(
      getDataset().tarefas.filter((item) => item.previstaPara.includes('23:45')),
    ).toHaveLength(0)
  })
})
