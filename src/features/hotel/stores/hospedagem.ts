/**
 * Store da estadia: hóspedes na casa, prancheta do turno e o trabalho de um animal.
 *
 * Três telas bebem daqui e têm ritmos diferentes: a **lista de hóspedes**, que é panorama e pode
 * recarregar inteira; a **prancheta**, que é trabalho e não pode piscar a cada tarefa marcada; e a
 * **estadia**, que é leitura demorada. Por isso marcar uma tarefa atualiza a linha no lugar em vez
 * de recarregar a lista — uma tela que se remonta a cada clique faz quem está no canil perder o
 * dedo de onde estava.
 *
 * O relógio é observado, e não lido uma vez: "atrasada" muda sozinha com o tempo passando, e uma
 * prancheta que só descobre o atraso quando alguém recarrega a página não serve para nada num
 * turno de oito horas com a tela aberta na parede.
 */

import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import {
  BoletimRetidoError,
  hospedagemRepository,
  propostaRepository,
  PassagemTravadaError,
  SaidaBloqueadaError,
  situacaoDaTarefa,
  type EstadiaDetalhada,
  type HospedeNaCasa,
  type PassagemDeTurno,
  type TarefaNaPrancheta,
} from '../data/repositories'
import type {
  Adaptacao,
  Autorizacao,
  ClockTime,
  GravidadeDaOcorrencia,
  ISODate,
  ISODateTime,
  MedicacaoDaEstadia,
  OcorrenciaKind,
  PlanoAlimentar,
  RegistroKind,
  TarefaDaCasaKind,
  TarefaStatus,
  ViaDeMedicacao,
} from '../data/types'
import { agruparPorHorario } from '../domain/rotina'
import type { PropostaDeRotina } from '../domain/rotina-sugerida'

import { hotelClock, useHotelStore } from './hotel'

/**
 * De quanto em quanto tempo o "agora" da tela avança.
 *
 * Meio minuto: fino o bastante para uma refeição virar atraso na hora certa, grosso o bastante
 * para não repintar a prancheta a cada segundo por nada.
 */
const PULSO_MS = 30_000

export const useHospedagemStore = defineStore('hotel-hospedagem', () => {
  const hotelStore = useHotelStore()

  const hospedes = ref<HospedeNaCasa[]>([])
  const estadia = ref<EstadiaDetalhada | null>(null)
  const prancheta = ref<TarefaNaPrancheta[]>([])
  const passagem = ref<PassagemDeTurno | null>(null)
  const dia = ref<ISODate>(hotelClock.today())

  const carregando = ref(false)
  const salvando = ref(false)
  const erro = ref('')
  const erroDeAcao = ref('')

  const agora = ref<ISODateTime>(hotelClock.nowIso())

  const pulso = setInterval(() => {
    agora.value = hotelClock.nowIso()
  }, PULSO_MS)

  onScopeDispose(() => {
    clearInterval(pulso)
  })

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  async function carregarHospedes() {
    carregando.value = true
    erro.value = ''

    try {
      await hotelStore.carregar()
      hospedes.value = await hospedagemRepository.listar()
      agora.value = hotelClock.nowIso()
    } catch {
      erro.value = 'hotel.erros.hospedes'
    } finally {
      carregando.value = false
    }
  }

  async function carregarEstadia(hospedagemId: string) {
    carregando.value = true
    erro.value = ''

    try {
      await hotelStore.carregar()
      estadia.value = await hospedagemRepository.abrir(hospedagemId)
      agora.value = hotelClock.nowIso()
    } catch {
      erro.value = 'hotel.erros.estadia'
    } finally {
      carregando.value = false
    }
  }

  async function carregarPrancheta(alvo: ISODate = dia.value) {
    carregando.value = true
    erro.value = ''
    dia.value = alvo

    try {
      await hotelStore.carregar()
      prancheta.value = await hospedagemRepository.rotina(alvo)
      agora.value = hotelClock.nowIso()
    } catch {
      erro.value = 'hotel.erros.rotina'
    } finally {
      carregando.value = false
    }
  }

  async function carregarPassagem() {
    try {
      passagem.value = await hospedagemRepository.passagem()
    } catch {
      passagem.value = null
    }
  }

  // -------------------------------------------------------------------------
  // Leituras derivadas
  // -------------------------------------------------------------------------

  /**
   * A prancheta agrupada por horário, já classificada contra o relógio.
   *
   * Depende de `agora`, que avança sozinho — é o que faz a linha mudar de cor sem ninguém tocar na
   * tela.
   */
  const blocosDaPrancheta = computed(() =>
    agruparPorHorario(prancheta.value.map((linha) => linha.tarefa)).map((bloco) => ({
      ...bloco,
      linhas: bloco.tarefas.map((tarefa) => ({
        ...prancheta.value.find((linha) => linha.tarefa.id === tarefa.id)!,
        situacao: situacaoDaTarefa(tarefa, agora.value),
      })),
    })),
  )

  const pendentesNaPrancheta = computed(
    () =>
      blocosDaPrancheta.value
        .flatMap((bloco) => bloco.linhas)
        .filter((linha) => linha.situacao === 'na-janela' || linha.situacao === 'atrasada').length,
  )

  const atrasadasNaPrancheta = computed(
    () =>
      blocosDaPrancheta.value
        .flatMap((bloco) => bloco.linhas)
        .filter((linha) => linha.situacao === 'atrasada').length,
  )

  /** O checklist só do animal aberto, do dia corrente e já contra o relógio. */
  const checklistDaEstadia = computed(() =>
    (estadia.value?.tarefas ?? [])
      .filter((tarefa) => tarefa.previstaPara.slice(0, 10) === dia.value)
      .map((tarefa) => ({ tarefa, situacao: situacaoDaTarefa(tarefa, agora.value) })),
  )

  /** Ocorrências que ainda esperam uma ligação. É o que trava boletim, turno e saída. */
  const ocorrenciasTravadasDaEstadia = computed(() =>
    (estadia.value?.ocorrencias ?? []).filter((item) => item.exigeContato && !item.contatoEm),
  )

  // -------------------------------------------------------------------------
  // Escrita
  // -------------------------------------------------------------------------

  async function mutar<T>(acao: () => Promise<T>): Promise<T | null> {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      const resultado = await acao()

      hotelStore.invalidarTudo()

      return resultado
    } catch (falha) {
      erroDeAcao.value = traduzir(falha)

      return null
    } finally {
      salvando.value = false
    }
  }

  function traduzir(falha: unknown): string {
    if (falha instanceof SaidaBloqueadaError) {
      return `hotel.erros.saida.${falha.kinds[0]}`
    }

    if (falha instanceof BoletimRetidoError) {
      return 'hotel.erros.boletimRetido'
    }

    if (falha instanceof PassagemTravadaError) {
      return 'hotel.erros.passagemTravada'
    }

    return 'hotel.erros.acao'
  }

  async function checkIn(entrada: {
    reservaId: string
    pesoEntradaKg: number
    inspecaoDeEntrada: string
    pertences: { descricao: string; quantidade: number }[]
    planoAlimentar: PlanoAlimentar
    autorizacoes: Autorizacao[]
    contatoEmergencia: string
    veterinarioDeConfianca: string
    medicacoes?: Omit<MedicacaoDaEstadia, 'id' | 'hospedagemId'>[]
  }) {
    return mutar(() =>
      hospedagemRepository.checkIn({ ...entrada, recebidoPor: hotelStore.operadorAtual() }),
    )
  }

  /**
   * A proposta de rotina de um hóspede.
   *
   * Fica na store e não no componente porque **duas telas abrem o mesmo diálogo** — a prancheta do
   * turno e a ficha da estadia —, e duas cópias do mesmo estado é a forma de as duas discordarem
   * sobre o que está sendo proposto.
   */
  const proposta = ref<PropostaDeRotina | null>(null)
  const gerandoProposta = ref(false)

  async function proporRotina(hospedagemId: string) {
    gerandoProposta.value = true
    proposta.value = null
    erroDeAcao.value = ''

    try {
      proposta.value = await propostaRepository.propor(hospedagemId)
    } catch {
      erroDeAcao.value = 'hotel.erros.acao'
    } finally {
      gerandoProposta.value = false
    }

    return proposta.value
  }

  async function aprovarProposta(entrada: {
    hospedagemId: string
    sugestoes: { kind: TarefaDaCasaKind; horarios: ClockTime[]; motivo: string }[]
  }) {
    const gravados = await mutar(() =>
      propostaRepository.aprovar({ ...entrada, por: hotelStore.operadorAtual() }),
    )

    if (!gravados) return null

    /*
     * Aprovar grava `AjusteDeRotina`, nunca tarefa. As tarefas nascem depois, pela materialização,
     * e por isso a prancheta precisa ser relida — é ela que vai pedir o dia com a rotina nova.
     */
    proposta.value = null
    await carregarPrancheta()

    return gravados
  }

  async function registrarMedicacao(entrada: {
    hospedagemId: string
    descricao: string
    via: ViaDeMedicacao
    doseTexto: string
    horarios: string[]
    receita: string
    observacao: string
  }) {
    const registrada = await mutar(() => hospedagemRepository.registrarMedicacao(entrada))

    if (!registrada) return null

    await carregarPrancheta()

    if (estadia.value?.hospedagem.id === entrada.hospedagemId) {
      await carregarEstadia(entrada.hospedagemId)
    }

    return registrada
  }

  /**
   * Marca uma tarefa e **substitui a linha no lugar**.
   *
   * Sem isso, cada refeição servida recarregaria a prancheta inteira e a lista saltaria sob o dedo
   * de quem está marcando as dezoito da manhã.
   */
  /** Um cuidado recorrente que não é remédio: curativo, compressa, casaco. */
  async function registrarCuidado(entrada: {
    hospedagemId: string
    descricao: string
    horarios: string[]
    observacao: string
  }) {
    const registrado = await mutar(() => hospedagemRepository.registrarCuidado(entrada))

    if (!registrado) return null

    await carregarPrancheta()

    if (estadia.value?.hospedagem.id === entrada.hospedagemId) {
      await carregarEstadia(entrada.hospedagemId)
    }

    return registrado
  }

  /** Um serviço vendido no meio da estadia. Entra na conta — ver o repositório. */
  async function acrescentarServico(entrada: {
    hospedagemId: string
    servicoId: string
    dia: ISODate
    hora: string
    observacao: string
  }) {
    const feito = await mutar(() => hospedagemRepository.acrescentarServico(entrada))

    if (feito === null) return false

    await carregarPrancheta()

    return true
  }

  /** O ajuste escrito à mão, sem passar por proposta. */
  async function registrarAjuste(entrada: {
    hospedagemId: string
    kind: TarefaDaCasaKind
    horarios: ClockTime[]
    motivo: string
  }) {
    const gravado = await mutar(() =>
      propostaRepository.registrarAjuste({ ...entrada, por: hotelStore.operadorAtual() }),
    )

    if (!gravado) return null

    await carregarPrancheta()

    return gravado
  }

  async function marcarTarefa(tarefaId: string, status: TarefaStatus, observacao?: string) {
    const atualizada = await mutar(() =>
      hospedagemRepository.marcarTarefa({
        tarefaId,
        status,
        executadaPor: hotelStore.operadorAtual(),
        observacao,
      }),
    )

    if (!atualizada) {
      return null
    }

    prancheta.value = prancheta.value.map((linha) =>
      linha.tarefa.id === tarefaId ? { ...linha, tarefa: atualizada } : linha,
    )

    if (estadia.value) {
      estadia.value = {
        ...estadia.value,
        tarefas: estadia.value.tarefas.map((tarefa) =>
          tarefa.id === tarefaId ? atualizada : tarefa,
        ),
      }
    }

    return atualizada
  }

  async function registrarNoDiario(entrada: {
    hospedagemId: string
    kind: RegistroKind
    texto: string
    foto?: string | null
  }) {
    const registro = await mutar(() =>
      hospedagemRepository.registrarNoDiario({
        ...entrada,
        registradoPor: hotelStore.operadorAtual(),
      }),
    )

    if (registro && estadia.value) {
      estadia.value = { ...estadia.value, diario: [registro, ...estadia.value.diario] }
    }

    return registro
  }

  async function registrarOcorrencia(entrada: {
    hospedagemId: string
    kind: OcorrenciaKind
    gravidade: GravidadeDaOcorrencia
    descricao: string
    conduta: string
    encaminhadaAoVeterinario?: boolean
  }) {
    const ocorrencia = await mutar(() =>
      hospedagemRepository.registrarOcorrencia({
        ...entrada,
        registradaPor: hotelStore.operadorAtual(),
      }),
    )

    if (ocorrencia) {
      await carregarEstadia(entrada.hospedagemId)
    }

    return ocorrencia
  }

  async function registrarContato(ocorrenciaId: string, hospedagemId: string) {
    const ocorrencia = await mutar(() =>
      hospedagemRepository.registrarContato(ocorrenciaId, hotelStore.operadorAtual()),
    )

    if (ocorrencia) {
      await carregarEstadia(hospedagemId)
      await carregarPassagem()
    }

    return ocorrencia
  }

  async function gerarBoletim(hospedagemId: string) {
    const boletim = await mutar(() =>
      hospedagemRepository.gerarBoletim(hospedagemId, hotelStore.operadorAtual()),
    )

    if (boletim) {
      await carregarEstadia(hospedagemId)
    }

    return boletim
  }

  async function enviarBoletim(boletimId: string, hospedagemId: string) {
    const boletim = await mutar(() => hospedagemRepository.enviarBoletim(boletimId))

    if (boletim) {
      await carregarEstadia(hospedagemId)
    }

    return boletim
  }

  async function entregarTurno(nota: string, recebidoPor: string) {
    const turno = await mutar(() => hospedagemRepository.entregarTurno({ nota, recebidoPor }))

    if (turno) {
      await carregarPassagem()
    }

    return turno
  }

  async function conferirPertence(entrada: {
    hospedagemId: string
    pertenceId: string
    devolvido: boolean
    observacao?: string
  }) {
    const hospedagem = await mutar(() => hospedagemRepository.conferirPertence(entrada))

    if (hospedagem) {
      await carregarEstadia(entrada.hospedagemId)
    }

    return hospedagem
  }

  async function pesarNaSaida(hospedagemId: string, pesoKg: number) {
    const hospedagem = await mutar(() => hospedagemRepository.pesarNaSaida(hospedagemId, pesoKg))

    if (hospedagem) {
      await carregarEstadia(hospedagemId)
    }

    return hospedagem
  }

  /** Como o hóspede está se adaptando. O selo da tela de Hóspedes era imutável até aqui. */
  async function ajustarAdaptacao(hospedagemId: string, adaptacao: Adaptacao) {
    const hospedagem = await mutar(() =>
      hospedagemRepository.ajustarAdaptacao(hospedagemId, adaptacao),
    )

    if (hospedagem) {
      await carregarEstadia(hospedagemId)
      await carregarHospedes()
    }

    return hospedagem
  }

  async function checkOut(hospedagemId: string, retiradoPor: string) {
    const hospedagem = await mutar(() =>
      hospedagemRepository.checkOut({
        hospedagemId,
        entreguePor: hotelStore.operadorAtual(),
        /* Quem do hotel entregou, e a quem. As duas pontas do mesmo gesto. */
        retiradoPor,
      }),
    )

    if (hospedagem) {
      await carregarEstadia(hospedagemId)
    }

    return hospedagem
  }

  return {
    hospedes,
    estadia,
    prancheta,
    passagem,
    dia,
    agora,
    carregando,
    salvando,
    erro,
    erroDeAcao,
    blocosDaPrancheta,
    pendentesNaPrancheta,
    atrasadasNaPrancheta,
    checklistDaEstadia,
    ocorrenciasTravadasDaEstadia,
    carregarHospedes,
    carregarEstadia,
    carregarPrancheta,
    carregarPassagem,
    checkIn,
    marcarTarefa,
    proposta,
    gerandoProposta,
    proporRotina,
    aprovarProposta,
    registrarMedicacao,
    registrarCuidado,
    acrescentarServico,
    registrarAjuste,
    registrarNoDiario,
    registrarOcorrencia,
    registrarContato,
    gerarBoletim,
    enviarBoletim,
    entregarTurno,
    conferirPertence,
    pesarNaSaida,
    ajustarAdaptacao,
    checkOut,
  }
})
