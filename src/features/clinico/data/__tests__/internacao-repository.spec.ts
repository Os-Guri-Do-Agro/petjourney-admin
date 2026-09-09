/**
 * Contrato do `internacaoRepository`.
 *
 * A regra que estes testes existem para segurar é uma só, e é a razão de o requisito existir:
 * **notícia grave não sai por aplicativo antes de alguém falar com o responsável**. Ela vive no
 * repositório, e não na tela, justamente para que nenhuma tela nova consiga contorná-la — o que
 * só vale enquanto houver teste provando que o repositório recusa.
 *
 * O resto cobre o que se perde em silêncio: dose executada sem nome de quem executou, prescrição
 * suspensa apagando o passado, e passagem de plantão que recalcula pendência em vez de congelar.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { situacaoDaAdministracao } from '../../domain/internacao'
import { MockError, setMockConfig, resetMockConfig } from '../mock-runtime'
import {
  AltaSemAvisoError,
  BoletimBloqueadoError,
  internacaoRepository,
  LeitoOcupadoError,
  LeitoRecusadoError,
} from '../repositories'
import { agoraIso, getDataset, resetDataset } from '../store'

beforeEach(() => {
  resetDataset()
  /* Sem latência: são dezenas de chamadas, e o que se testa aqui não é o envelope. */
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('mapa de leitos', () => {
  it('resolve paciente, responsável e pendências de cada leito ocupado', async () => {
    const mapa = await internacaoRepository.mapa()

    expect(mapa.leitos.length).toBeGreaterThan(mapa.ocupados)
    expect(mapa.ocupados).toBe(5)
    expect(mapa.criticos).toBe(1)
    expect(mapa.boletinsRetidos).toBe(1)

    const ocupados = mapa.leitos.filter((item) => item.internacao)

    expect(ocupados.every((item) => item.petNome.length > 0)).toBe(true)
    expect(ocupados.every((item) => item.tutorNome.length > 0)).toBe(true)
  })

  it('o leito fora de operação aparece no mapa e fora da conta de ocupação', async () => {
    const mapa = await internacaoRepository.mapa()
    const inativo = mapa.leitos.find((item) => !item.leito.ativo)

    expect(inativo).toBeDefined()
    expect(mapa.ativos).toBe(mapa.leitos.length - 1)
  })
})

describe('registro de administração', () => {
  it('grava quem executou, quando, e em que plantão a execução caiu', async () => {
    const pendente = getDataset().internacao.administracoes.find(
      (item) => item.status === 'pendente',
    )!

    const registrada = await internacaoRepository.registrar({
      administracaoId: pendente.id,
      status: 'feita',
      professionalId: 'prof-helena',
      observacao: 'Sem intercorrência.',
    })

    expect(registrada.status).toBe('feita')
    expect(registrada.executadaPor).toBe('prof-helena')
    expect(registrada.executadaEm).not.toBeNull()
    expect(registrada.plantaoId).toBeTruthy()
  })

  it('desfazer devolve a linha ao estado pendente, sem deixar rastro pela metade', async () => {
    const alvo = getDataset().internacao.administracoes.find(
      (item) => item.status === 'pendente',
    )!

    await internacaoRepository.registrar({
      administracaoId: alvo.id,
      status: 'feita',
      professionalId: 'prof-ana',
    })

    const desfeita = await internacaoRepository.desfazer(alvo.id)

    expect(desfeita.status).toBe('pendente')
    expect(desfeita.executadaPor).toBeNull()
    expect(desfeita.executadaEm).toBeNull()
    expect(desfeita.plantaoId).toBeNull()
  })
})

describe('prescrição', () => {
  it('nasce já aprazada — item sem horário não existe em internação', async () => {
    const prescricao = await internacaoRepository.prescrever({
      internacaoId: 'int-bento',
      kind: 'medicamento',
      medicamentoId: 'med-omeprazol',
      descricao: 'Omeprazol',
      via: 'oral',
      doseTexto: '1 mg/kg',
      frequenciaHoras: 12,
      continuo: false,
      primeiroHorario: agoraIso(),
      prescritoPor: 'prof-ana',
    })

    const horarios = getDataset().internacao.administracoes.filter(
      (item) => item.prescricaoId === prescricao.id,
    )

    expect(horarios.length).toBeGreaterThan(2)
    expect(horarios.every((item) => item.status === 'pendente')).toBe(true)
  })

  /**
   * Suspender não é apagar. O que se procura no registro de um paciente que piorou é exatamente
   * o que ele recebeu **antes** de piorar.
   */
  it('suspender preserva o passado e cancela só o que ainda não aconteceu', async () => {
    const dataset = getDataset().internacao
    const prescricaoId = 'presc-int-bento-cefalexina'
    const feitasAntes = dataset.administracoes.filter(
      (item) => item.prescricaoId === prescricaoId && item.status === 'feita',
    ).length

    expect(feitasAntes).toBeGreaterThan(0)

    await internacaoRepository.suspender({
      prescricaoId,
      motivo: 'Troca para via intravenosa.',
    })

    const depois = dataset.administracoes.filter((item) => item.prescricaoId === prescricaoId)

    expect(depois.filter((item) => item.status === 'feita')).toHaveLength(feitasAntes)
    expect(depois.some((item) => item.status === 'suspensa')).toBe(true)
    expect(depois.some((item) => item.status === 'pendente' && item.previstaPara > agoraIso())).toBe(
      false,
    )
  })
})

/**
 * A regra central do requisito, exercida de ponta a ponta.
 */
describe('boletim ao responsável', () => {
  it('o boletim da piora vem retido do dataset e recusa envio', async () => {
    const paciente = await internacaoRepository.doPaciente('int-tofu')
    const retido = paciente!.boletins.find((item) => item.status === 'retido')!

    expect(retido.exigeLigacao).toBe(true)

    await expect(internacaoRepository.enviarBoletim(retido.id)).rejects.toBeInstanceOf(
      BoletimBloqueadoError,
    )

    expect(retido.enviadoEm).toBeNull()
  })

  it('registrar a ligação libera o envio, e guarda quem ligou', async () => {
    const paciente = await internacaoRepository.doPaciente('int-tofu')
    const retido = paciente!.boletins.find((item) => item.status === 'retido')!

    const comLigacao = await internacaoRepository.registrarLigacao({
      boletimId: retido.id,
      professionalId: 'prof-helena',
    })

    expect(comLigacao.status).toBe('liberado')
    expect(comLigacao.ligacaoPor).toBe('prof-helena')

    const enviado = await internacaoRepository.enviarBoletim(retido.id)

    expect(enviado.status).toBe('enviado')
    expect(enviado.enviadoEm).not.toBeNull()
  })

  /**
   * O caminho completo do caso difícil: um paciente estável piora numa evolução, e o boletim que
   * nasce dessa evolução já vem travado.
   */
  it('evoluir com piora gera um boletim retido, sem ninguém pedir', async () => {
    const antes = await internacaoRepository.doPaciente('int-bento')

    expect(antes!.internacao.gravidade).toBe('estavel')

    const { boletim } = await internacaoRepository.evoluir({
      internacaoId: 'int-bento',
      professionalId: 'prof-ana',
      vitais: antes!.evolucoes[0]!.vitais,
      observado: 'Parou de apoiar o membro e recusou alimento.',
      avaliacao: 'Suspeita de deiscência.',
      plano: 'Radiografia agora.',
      gravidade: 'critico',
    })

    expect(boletim).not.toBeNull()
    expect(boletim!.status).toBe('retido')
    expect(boletim!.exigeLigacao).toBe(true)
    expect(boletim!.texto.length).toBeGreaterThan(0)

    const depois = await internacaoRepository.doPaciente('int-bento')

    expect(depois!.internacao.gravidade).toBe('critico')
  })

  it('evoluir sem piora não incomoda o responsável com boletim que ele não pediu', async () => {
    const antes = await internacaoRepository.doPaciente('int-bento')

    const { boletim } = await internacaoRepository.evoluir({
      internacaoId: 'int-bento',
      professionalId: 'prof-ana',
      vitais: antes!.evolucoes[0]!.vitais,
      observado: 'Comeu tudo e apoiou o membro.',
      avaliacao: 'Segue bem.',
      plano: 'Manter.',
      gravidade: 'estavel',
    })

    expect(boletim).toBeNull()
  })

  it('boletim manual de paciente estável já nasce liberado', async () => {
    const boletim = await internacaoRepository.gerarBoletim({
      internacaoId: 'int-bento',
      autorId: 'prof-ana',
      observado: 'Dormiu a tarde inteira.',
    })

    expect(boletim.status).toBe('liberado')
    expect(boletim.exigeLigacao).toBe(false)
    expect(boletim.origem).toBe('manual')

    const enviado = await internacaoRepository.enviarBoletim(boletim.id)

    expect(enviado.status).toBe('enviado')
  })

  it('a preferência de frequência é gravada como o responsável pediu', async () => {
    const salva = await internacaoRepository.atualizarPreferencia({
      internacaoId: 'int-bento',
      frequenciaHoras: 1,
      fotoSempre: true,
      silencioNoturno: false,
    })

    expect(salva.frequenciaHoras).toBe(1)
    expect(salva.silencioNoturno).toBe(false)
  })
})

describe('passagem de plantão', () => {
  it('lista o que está em cima da troca e o que ficou sem evolução', async () => {
    const passagem = await internacaoRepository.passagem()

    expect(passagem).not.toBeNull()
    expect(passagem!.pendencias.emCimaDaTroca.length).toBeGreaterThan(0)
    expect(passagem!.seguinte.responsavelId.length).toBeGreaterThan(0)
  })

  /**
   * Quem recebe o plantão não pode ser quem está saindo.
   *
   * O turno seguinte ainda não existe como registro, e a primeira versão caía no responsável
   * atual: o seletor abria com o nome de quem estava indo embora — a única escolha que a
   * passagem não pode sugerir.
   */
  it('sugere quem cobre o turno seguinte, nunca quem está saindo', async () => {
    const passagem = await internacaoRepository.passagem()

    expect(passagem!.seguinte.responsavelId).not.toBe(passagem!.plantao.responsavelId)
  })

  /** A pendência precisa dizer **qual** dose é: sem isso a lista repetia o paciente duas vezes. */
  it('cada pendência traz a dose, o paciente e o leito', async () => {
    const passagem = await internacaoRepository.passagem()
    const linhas = [
      ...passagem!.pendencias.emCimaDaTroca,
      ...passagem!.pendencias.atrasadas,
    ]

    expect(linhas.length).toBeGreaterThan(0)

    for (const linha of linhas) {
      expect(linha.descricao.length).toBeGreaterThan(0)
      expect(linha.petNome.length).toBeGreaterThan(0)
      expect(linha.leitoNome.length).toBeGreaterThan(0)
      expect(linha.descricao).not.toContain(linha.petNome)
    }
  })

  it('entregar congela as pendências e abre o turno seguinte', async () => {
    const antes = await internacaoRepository.passagem()
    const esperadas =
      antes!.pendencias.atrasadas.length + antes!.pendencias.emCimaDaTroca.length

    const entregue = await internacaoRepository.entregarPlantao({
      notaDePassagem: 'Tofu instável, cobrar o potássio.',
      recebidoPor: 'prof-caio',
    })

    expect(entregue!.entregueEm).not.toBeNull()
    expect(entregue!.recebidoPor).toBe('prof-caio')
    expect(entregue!.pendenciasEntregues).toHaveLength(esperadas)

    const dataset = getDataset().internacao

    expect(dataset.plantaoAtualId).not.toBe(entregue!.id)

    const novo = dataset.plantoes.find((item) => item.id === dataset.plantaoAtualId)

    expect(novo?.entregueEm).toBeNull()
    expect(novo?.responsavelId).toBe('prof-caio')
  })
})

/**
 * Cadastro de leitos.
 *
 * O sistema não adivinha quantos leitos a clínica tem, então este cadastro é dela — e as três
 * travas existem para que editá-lo não apague o que já aconteceu. É o tipo de regra que uma tela
 * nova contornaria sem querer se ela morasse na tela.
 */
describe('cadastro de leitos', () => {
  it('cadastra um leito novo e ele entra no mapa como vaga', async () => {
    const antes = await internacaoRepository.mapa()

    const leito = await internacaoRepository.criarLeito({
      nome: 'R9',
      roomId: 'sala-recuperacao',
      kind: 'geral',
    })

    expect(leito.ativo).toBe(true)
    expect(leito.motivoInativo).toBeNull()

    const depois = await internacaoRepository.mapa()

    expect(depois.leitos).toHaveLength(antes.leitos.length + 1)
    expect(depois.ativos).toBe(antes.ativos + 1)
    expect(depois.leitos.find((item) => item.leito.id === leito.id)?.internacao).toBeNull()
  })

  it('recusa dois leitos com o mesmo nome, ignorando caixa e espaços', async () => {
    await expect(
      internacaoRepository.criarLeito({ nome: ' r1 ', roomId: 'sala-recuperacao', kind: 'geral' }),
    ).rejects.toBeInstanceOf(LeitoRecusadoError)
  })

  it('recusa leito sem nome — nome de leito é endereço', async () => {
    await expect(
      internacaoRepository.criarLeito({ nome: '   ', roomId: 'sala-recuperacao', kind: 'geral' }),
    ).rejects.toBeInstanceOf(LeitoRecusadoError)
  })

  it('renomeia e reclassifica sem tocar na identidade do leito', async () => {
    const editado = await internacaoRepository.editarLeito({
      leitoId: 'leito-r3',
      nome: 'R3 — pós-operatório',
      kind: 'uti',
    })

    expect(editado.id).toBe('leito-r3')
    expect(editado.nome).toBe('R3 — pós-operatório')
    expect(editado.kind).toBe('uti')
  })

  /**
   * A trava que importa: tirar de operação um leito ocupado é dizer que o animal que está nele
   * não está — e o mapa passaria a mostrar vaga onde há paciente.
   */
  it('não tira de operação um leito ocupado', async () => {
    await expect(
      internacaoRepository.desativarLeito({
        leitoId: 'leito-uti',
        motivo: 'manutencao',
        detalhe: '',
      }),
    ).rejects.toBeInstanceOf(LeitoRecusadoError)
  })

  it('tira de operação um leito livre, com motivo e data', async () => {
    const leito = await internacaoRepository.desativarLeito({
      leitoId: 'leito-r3',
      motivo: 'desinfeccao',
      detalhe: 'Após paciente com parvovirose.',
    })

    expect(leito.ativo).toBe(false)
    expect(leito.motivoInativo).toBe('desinfeccao')
    expect(leito.inativoDesde).not.toBeNull()

    const mapa = await internacaoRepository.mapa()

    /* Sai da conta de vagas sem sair do mapa. */
    expect(mapa.leitos.some((item) => item.leito.id === 'leito-r3')).toBe(true)
    expect(mapa.ativos).toBe(mapa.leitos.filter((item) => item.leito.ativo).length)
  })

  it('devolver à operação limpa o motivo e a data', async () => {
    const leito = await internacaoRepository.reativarLeito('leito-i2')

    expect(leito.ativo).toBe(true)
    expect(leito.motivoInativo).toBeNull()
    expect(leito.detalheInativo).toBe('')
    expect(leito.inativoDesde).toBeNull()
  })

  /**
   * Leito com história não se apaga: a internação guarda onde o animal ficou, e é essa a resposta
   * que a clínica procura seis meses depois.
   */
  it('recusa apagar leito que já recebeu paciente', async () => {
    await expect(internacaoRepository.removerLeito('leito-uti')).rejects.toBeInstanceOf(
      LeitoRecusadoError,
    )
  })

  it('apaga o leito criado por engano, que nunca recebeu ninguém', async () => {
    const leito = await internacaoRepository.criarLeito({
      nome: 'R8',
      roomId: 'sala-recuperacao',
      kind: 'geral',
    })

    await internacaoRepository.removerLeito(leito.id)

    const mapa = await internacaoRepository.mapa()

    expect(mapa.leitos.some((item) => item.leito.id === leito.id)).toBe(false)
  })

  it('o motivo da recusa viaja como kind, para a tela poder traduzir', async () => {
    const falha = await internacaoRepository
      .desativarLeito({ leitoId: 'leito-uti', motivo: 'manutencao', detalhe: '' })
      .catch((erro: unknown) => erro)

    expect(falha).toBeInstanceOf(LeitoRecusadoError)
    expect((falha as LeitoRecusadoError).kind).toBe('ocupado')
  })
})

describe('entrada e alta', () => {
  it('interna num leito livre e o leito some das vagas', async () => {
    const mapa = await internacaoRepository.mapa()
    const livre = mapa.leitos.find((item) => item.leito.ativo && !item.internacao)!

    const criada = await internacaoRepository.internar({
      petId: 'pet-mel',
      tutorId: 'tutor-luciana',
      leitoId: livre.leito.id,
      responsavelId: 'prof-ana',
      motivo: 'Observação pós-crise convulsiva',
      diagnostico: 'Epilepsia em investigação',
      gravidade: 'atencao',
      pesoEntradaKg: 29.3,
    })

    expect(criada.status).toBe('internado')

    const depois = await internacaoRepository.mapa()

    expect(depois.ocupados).toBe(mapa.ocupados + 1)
  })

  it('recusa internar em leito ocupado ou fora de operação', async () => {
    const mapa = await internacaoRepository.mapa()
    const ocupado = mapa.leitos.find((item) => item.internacao)!
    const inativo = mapa.leitos.find((item) => !item.leito.ativo)!

    const entrada = {
      petId: 'pet-mel',
      tutorId: 'tutor-luciana',
      responsavelId: 'prof-ana',
      motivo: 'Teste',
      diagnostico: '',
      gravidade: 'estavel' as const,
      pesoEntradaKg: 29.3,
    }

    await expect(
      internacaoRepository.internar({ ...entrada, leitoId: ocupado.leito.id }),
    ).rejects.toBeInstanceOf(LeitoOcupadoError)
    await expect(
      internacaoRepository.internar({ ...entrada, leitoId: inativo.leito.id }),
    ).rejects.toBeInstanceOf(LeitoOcupadoError)
  })

  it('a alta devolve o leito e encerra o que ainda estava previsto', async () => {
    const antes = await internacaoRepository.mapa()

    await internacaoRepository.darAlta({
      internacaoId: 'int-pipoca',
      status: 'alta',
      observacao: 'Fezes normais por 24 h.',
      professionalId: 'prof-ana',
    })

    const depois = await internacaoRepository.mapa()

    expect(depois.ocupados).toBe(antes.ocupados - 1)

    const agora = agoraIso()
    const orfas = getDataset().internacao.administracoes.filter(
      (item) =>
        item.internacaoId === 'int-pipoca' &&
        item.previstaPara > agora &&
        situacaoDaAdministracao(item, agora) !== 'suspensa',
    )

    expect(orfas).toHaveLength(0)
  })

  /*
   * A outra metade da regra que dá nome ao requisito. A piora não sai por aplicativo, e o fim
   * também não: óbito e transferência exigem que alguém tenha falado com o responsável antes.
   */
  it('recusa óbito e transferência sem ligação registrada', async () => {
    await expect(
      internacaoRepository.darAlta({
        internacaoId: 'int-pipoca',
        status: 'obito',
        observacao: 'Parada às 3h40.',
        professionalId: 'prof-ana',
      }),
    ).rejects.toBeInstanceOf(AltaSemAvisoError)

    await expect(
      internacaoRepository.darAlta({
        internacaoId: 'int-pipoca',
        status: 'transferido',
        observacao: 'Encaminhado para hemodiálise.',
        professionalId: 'prof-ana',
      }),
    ).rejects.toBeInstanceOf(AltaSemAvisoError)

    /* A internação continua aberta: recusar não pode ter encerrado nada pela metade. */
    const paciente = await internacaoRepository.doPaciente('int-pipoca')

    expect(paciente?.internacao.status).toBe('internado')
  })

  it('aceita o desfecho grave com a ligação registrada, e não manda mensagem nenhuma', async () => {
    const antes = (await internacaoRepository.doPaciente('int-pipoca'))!.boletins.length

    const resultado = await internacaoRepository.darAlta({
      internacaoId: 'int-pipoca',
      status: 'obito',
      observacao: 'Comunicado à responsável por telefone às 3h50.',
      professionalId: 'prof-ana',
      avisadoPorTelefone: true,
    })

    expect(resultado?.internacao.status).toBe('obito')
    expect(resultado?.boletim).toBeNull()

    const depois = await internacaoRepository.doPaciente('int-pipoca')

    expect(depois?.boletins).toHaveLength(antes)
  })

  /*
   * O boletim de alta nasce **liberado**, e não retido — mesmo num paciente que passou a
   * internação inteira crítico. Compô-lo pela gravidade faria "o Bento foi para casa" chegar
   * como notícia grave e ficar preso esperando uma ligação que ninguém precisa dar.
   */
  it('a alta escreve a última mensagem ao responsável, pronta para sair', async () => {
    const resultado = await internacaoRepository.darAlta({
      internacaoId: 'int-bento',
      status: 'alta',
      observacao: 'Repouso por 3 dias.',
      professionalId: 'prof-ana',
    })

    expect(resultado?.boletim?.status).toBe('liberado')
    expect(resultado?.boletim?.exigeLigacao).toBe(false)
    expect(resultado?.boletim?.texto).toContain('alta')
    expect(resultado?.boletim?.texto).toContain('Repouso por 3 dias.')

    await expect(
      internacaoRepository.enviarBoletim(resultado!.boletim!.id),
    ).resolves.toMatchObject({ status: 'enviado' })
  })
})

describe('envelope da camada mocada', () => {
  it('a falha de uma operação não derruba as outras', async () => {
    resetMockConfig()
    setMockConfig({
      latenciaMs: 0,
      jitterMs: 0,
      erroPorOperacao: { 'internacao.administrar': 1 },
    })

    const pendente = getDataset().internacao.administracoes.find(
      (item) => item.status === 'pendente',
    )!

    await expect(
      internacaoRepository.registrar({
        administracaoId: pendente.id,
        status: 'feita',
        professionalId: 'prof-ana',
      }),
    ).rejects.toBeInstanceOf(MockError)

    /* O mapa continua respondendo — é a granularidade que justifica operações separadas. */
    await expect(internacaoRepository.mapa()).resolves.toBeTruthy()

    resetMockConfig()
  })
})
