/**
 * Store da internação.
 *
 * Duas telas bebem daqui e têm ritmos diferentes: o **mapa de leitos**, que é panorama e pode
 * recarregar inteiro, e o **paciente internado**, que é trabalho e não pode piscar a cada dose
 * marcada. Por isso o checklist atualiza a administração no lugar em vez de recarregar a lista —
 * uma tela que se remonta a cada clique faz a enfermagem perder o dedo de onde estava.
 *
 * O relógio é observado, e não lido uma vez: "atrasada" muda sozinha com o tempo passando, e um
 * checklist que só descobre o atraso quando alguém recarrega a página não serve para nada num
 * plantão de doze horas com a tela aberta na parede.
 */

import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import {
  BoletimBloqueadoError,
  internacaoRepository,
  LeitoRecusadoError,
  type MapaDeInternacao,
  type PacienteInternado,
  type PassagemDePlantao,
} from '../data/repositories'
import type {
  AdministracaoAgendada,
  AdministracaoStatus,
  BoletimAoTutor,
  GravidadeClinica,
  ISODateTime,
  Leito,
  LeitoInativoMotivo,
  LeitoKind,
  Measurement,
  PreferenciaDeBoletim,
  PrescricaoDeInternacao,
  VitalKey,
} from '../data/types'
import {
  atravessaAPassagem,
  pendentesAgora,
  situacaoDaAdministracao,
} from '../domain/internacao'

import { clinicClock, useClinicoStore } from './clinico'

/**
 * De quanto em quanto tempo o "agora" da tela avança.
 *
 * Meio minuto: fino o bastante para uma dose virar atraso na hora certa, grosso o bastante para
 * não repintar o checklist a cada segundo por nada.
 */
const PULSO_MS = 30_000

export const useInternacaoStore = defineStore('clinico-internacao', () => {
  const clinico = useClinicoStore()

  const mapa = ref<MapaDeInternacao | null>(null)
  const paciente = ref<PacienteInternado | null>(null)
  const passagem = ref<PassagemDePlantao | null>(null)

  const carregando = ref(false)
  const salvando = ref(false)
  const erro = ref('')
  /** Erro de uma ação pontual — não derruba a tela, aparece ao lado do que falhou. */
  const erroDeAcao = ref('')

  const agora = ref<ISODateTime>(clinicClock.nowIso())

  const pulso = setInterval(() => {
    agora.value = clinicClock.nowIso()
  }, PULSO_MS)

  onScopeDispose(() => {
    clearInterval(pulso)
  })

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  async function carregarMapa() {
    carregando.value = true
    erro.value = ''

    try {
      await clinico.carregar()
      mapa.value = await internacaoRepository.mapa()
      agora.value = clinicClock.nowIso()
    } catch {
      erro.value = 'clinico.erros.internacao'
    } finally {
      carregando.value = false
    }
  }

  async function carregarPaciente(internacaoId: string) {
    carregando.value = true
    erro.value = ''

    try {
      await clinico.carregar()
      paciente.value = await internacaoRepository.doPaciente(internacaoId)
      agora.value = clinicClock.nowIso()
    } catch {
      erro.value = 'clinico.erros.internacao'
    } finally {
      carregando.value = false
    }
  }

  async function carregarPassagem() {
    try {
      passagem.value = await internacaoRepository.passagem()
    } catch {
      passagem.value = null
    }
  }

  /**
   * O checklist do paciente aberto, em ordem de horário e já classificado contra o relógio.
   *
   * Depende de `agora`, que avança sozinho — é o que faz a linha mudar de cor sem ninguém tocar
   * na tela.
   */
  const checklist = computed(() => {
    const atual = paciente.value

    if (!atual) {
      return []
    }

    return atual.administracoes.map((administracao) => ({
      administracao,
      prescricao:
        atual.prescricoes.find((item) => item.id === administracao.prescricaoId) ?? null,
      situacao: situacaoDaAdministracao(administracao, agora.value),
    }))
  })

  const pendentesDoPaciente = computed(() =>
    paciente.value ? pendentesAgora(paciente.value.administracoes, agora.value) : [],
  )

  /** Boletins que não saíram e esperam alguém — a fila que a tela não pode deixar esconder. */
  const boletinsRetidos = computed(() =>
    (paciente.value?.boletins ?? []).filter((item) => item.status === 'retido'),
  )

  const proximoBoletimPendente = computed<BoletimAoTutor | null>(
    () =>
      (paciente.value?.boletins ?? []).find(
        (item) => item.status === 'retido' || item.status === 'liberado',
      ) ?? null,
  )

  /** As doses que encavalam a troca do plantão corrente, para o paciente aberto. */
  const naTrocaDePlantao = computed(() => {
    const fim = mapa.value?.plantaoAtual?.fim ?? passagem.value?.plantao.fim ?? null

    if (!fim || !paciente.value) {
      return []
    }

    return paciente.value.administracoes.filter((item) => atravessaAPassagem(item, fim))
  })

  // -------------------------------------------------------------------------
  // Escrita
  // -------------------------------------------------------------------------

  /**
   * Substitui uma administração no lugar, sem recarregar a lista.
   *
   * É a diferença entre marcar seis doses seguidas e marcar uma e procurar de novo onde estava.
   */
  function aplicarAdministracao(atualizada: AdministracaoAgendada) {
    if (!paciente.value) {
      return
    }

    paciente.value.administracoes = paciente.value.administracoes.map((item) =>
      item.id === atualizada.id ? atualizada : item,
    )
  }

  async function registrar(input: {
    administracaoId: string
    status: Exclude<AdministracaoStatus, 'pendente' | 'suspensa'>
    professionalId: string
    observacao?: string
  }) {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      aplicarAdministracao(await internacaoRepository.registrar(input))
      clinico.invalidarTudo()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  async function desfazer(administracaoId: string) {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      aplicarAdministracao(await internacaoRepository.desfazer(administracaoId))
      clinico.invalidarTudo()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  async function prescrever(input: {
    kind: PrescricaoDeInternacao['kind']
    medicamentoId: string | null
    descricao: string
    via: PrescricaoDeInternacao['via']
    doseTexto: string
    frequenciaHoras: number
    continuo: boolean
    primeiroHorario: ISODateTime
    prescritoPor: string
    observacao?: string
  }) {
    if (!paciente.value) {
      return
    }

    salvando.value = true
    erroDeAcao.value = ''

    const internacaoId = paciente.value.internacao.id

    try {
      await internacaoRepository.prescrever({ ...input, internacaoId })
      /* Prescrever cria horários novos: aqui a recarga é o certo, não um desperdício. */
      await carregarPaciente(internacaoId)
      clinico.invalidarTudo()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  async function suspender(prescricaoId: string, motivo: string) {
    if (!paciente.value) {
      return
    }

    salvando.value = true
    erroDeAcao.value = ''

    const internacaoId = paciente.value.internacao.id

    try {
      await internacaoRepository.suspender({ prescricaoId, motivo })
      await carregarPaciente(internacaoId)
      clinico.invalidarTudo()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  /**
   * Registra a evolução do turno.
   *
   * Devolve o boletim que a piora tenha gerado — a tela precisa dele **na hora**: a evolução que
   * marca piora e não abre imediatamente o boletim retido deixa o profissional achar que
   * terminou o trabalho quando falta a parte que importa.
   */
  async function evoluir(input: {
    professionalId: string
    vitais: Record<VitalKey, Measurement>
    observado: string
    avaliacao: string
    plano: string
    gravidade: GravidadeClinica
  }): Promise<BoletimAoTutor | null> {
    if (!paciente.value) {
      return null
    }

    salvando.value = true
    erroDeAcao.value = ''

    const internacaoId = paciente.value.internacao.id

    try {
      const { boletim } = await internacaoRepository.evoluir({ ...input, internacaoId })

      await carregarPaciente(internacaoId)
      clinico.invalidarTudo()

      return boletim
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'

      return null
    } finally {
      salvando.value = false
    }
  }

  async function gerarBoletim(input: {
    autorId: string
    observado: string
    temperatura?: number | null
    foto?: string | null
    fotoLegenda?: string
    texto?: string
  }) {
    if (!paciente.value) {
      return null
    }

    salvando.value = true
    erroDeAcao.value = ''

    const internacaoId = paciente.value.internacao.id

    try {
      const boletim = await internacaoRepository.gerarBoletim({ ...input, internacaoId })

      await carregarPaciente(internacaoId)

      return boletim
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'

      return null
    } finally {
      salvando.value = false
    }
  }

  async function registrarLigacao(boletimId: string, professionalId: string) {
    if (!paciente.value) {
      return
    }

    salvando.value = true
    erroDeAcao.value = ''

    const internacaoId = paciente.value.internacao.id

    try {
      await internacaoRepository.registrarLigacao({ boletimId, professionalId })
      await carregarPaciente(internacaoId)
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  /**
   * Envia o boletim.
   *
   * O bloqueio por ligação pendente ganha mensagem própria porque **não é um erro**: é a regra
   * funcionando. Tratá-lo como falha genérica ensinaria a tentar de novo em vez de pegar o
   * telefone.
   */
  async function enviarBoletim(boletimId: string) {
    if (!paciente.value) {
      return
    }

    salvando.value = true
    erroDeAcao.value = ''

    const internacaoId = paciente.value.internacao.id

    try {
      await internacaoRepository.enviarBoletim(boletimId)
      await carregarPaciente(internacaoId)
    } catch (falha) {
      erroDeAcao.value =
        falha instanceof BoletimBloqueadoError
          ? 'clinico.internacao.boletim.bloqueadoErro'
          : 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  async function atualizarPreferencia(preferencia: PreferenciaDeBoletim) {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      const atualizada = await internacaoRepository.atualizarPreferencia(preferencia)

      if (paciente.value) {
        paciente.value.preferencia = atualizada
      }
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  async function entregarPlantao(notaDePassagem: string, recebidoPor: string) {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      await internacaoRepository.entregarPlantao({ notaDePassagem, recebidoPor })
      await carregarPassagem()
      await carregarMapa()
      clinico.invalidarTudo()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  async function internar(input: {
    petId: string
    tutorId: string
    leitoId: string
    responsavelId: string
    motivo: string
    diagnostico: string
    gravidade: GravidadeClinica
    pesoEntradaKg: number
  }) {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      const internacao = await internacaoRepository.internar(input)

      await carregarMapa()
      clinico.invalidarTudo()

      return internacao
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoLeito'

      return null
    } finally {
      salvando.value = false
    }
  }

  async function darAlta(
    internacaoId: string,
    status: 'alta' | 'obito' | 'transferido',
    observacao: string,
  ) {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      await internacaoRepository.darAlta({ internacaoId, status, observacao })
      await carregarPaciente(internacaoId)
      clinico.invalidarTudo()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacaoAcao'
    } finally {
      salvando.value = false
    }
  }

  // -------------------------------------------------------------------------
  // Cadastro de leitos
  // -------------------------------------------------------------------------

  const leitos = ref<Leito[]>([])

  async function carregarLeitos() {
    try {
      leitos.value = await internacaoRepository.leitos()
    } catch {
      erroDeAcao.value = 'clinico.erros.internacao'
    }
  }

  /**
   * Envelope das mudanças de cadastro.
   *
   * A recusa por regra — leito ocupado, nome repetido — **não é falha**: é a regra funcionando, e
   * merece a frase que explica qual regra. Tratá-la como erro genérico ensinaria a tentar de novo
   * do mesmo jeito. Devolve `true` quando a mudança passou, para a tela saber se fecha o
   * formulário.
   */
  async function mudarCadastro(acao: () => Promise<unknown>): Promise<boolean> {
    salvando.value = true
    erroDeAcao.value = ''

    try {
      await acao()
      await carregarLeitos()
      await carregarMapa()
      clinico.invalidarTudo()

      return true
    } catch (falha) {
      erroDeAcao.value =
        falha instanceof LeitoRecusadoError
          ? `clinico.internacao.leitos.recusa.${falha.kind}`
          : 'clinico.erros.internacaoAcao'

      return false
    } finally {
      salvando.value = false
    }
  }

  function criarLeito(input: { nome: string; roomId: string; kind: LeitoKind }) {
    return mudarCadastro(() => internacaoRepository.criarLeito(input))
  }

  function editarLeito(input: { leitoId: string; nome: string; kind: LeitoKind }) {
    return mudarCadastro(() => internacaoRepository.editarLeito(input))
  }

  function desativarLeito(input: {
    leitoId: string
    motivo: LeitoInativoMotivo
    detalhe: string
  }) {
    return mudarCadastro(() => internacaoRepository.desativarLeito(input))
  }

  function reativarLeito(leitoId: string) {
    return mudarCadastro(() => internacaoRepository.reativarLeito(leitoId))
  }

  function removerLeito(leitoId: string) {
    return mudarCadastro(() => internacaoRepository.removerLeito(leitoId))
  }

  function $resetModulo() {
    mapa.value = null
    paciente.value = null
    passagem.value = null
    erro.value = ''
    erroDeAcao.value = ''
  }

  return {
    mapa,
    paciente,
    passagem,
    leitos,
    agora,
    carregando,
    salvando,
    erro,
    erroDeAcao,
    checklist,
    pendentesDoPaciente,
    boletinsRetidos,
    proximoBoletimPendente,
    naTrocaDePlantao,
    carregarMapa,
    carregarPaciente,
    carregarPassagem,
    registrar,
    desfazer,
    prescrever,
    suspender,
    evoluir,
    gerarBoletim,
    registrarLigacao,
    enviarBoletim,
    atualizarPreferencia,
    entregarPlantao,
    internar,
    darAlta,
    carregarLeitos,
    criarLeito,
    editarLeito,
    desativarLeito,
    reativarLeito,
    removerLeito,
    $resetModulo,
  }
})
