/**
 * Store do prontuário.
 *
 * Três coisas moram aqui e em nenhum outro lugar:
 *
 * 1. **Autosave.** Grava direto no registro em edição e **não invalida nada** — esta é a única
 *    exceção à regra do módulo. Invalidar a cada pausa de digitação faria a tela piscar
 *    enquanto o profissional escreve.
 * 2. **Rascunho local.** Espelho em `localStorage` sob `clinic.draft.<encounterId>`, para que
 *    fechar o navegador no meio da consulta não custe a anamnese inteira.
 * 3. **Um dispositivo edita por vez.** O segundo entra em leitura e só assume por
 *    transferência explícita, com comparação campo a campo.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import i18n from '@/i18n'

import {
  agendaRepository,
  EncounterLockedError,
  encounterRepository,
} from '../data/repositories'
import type {
  Encounter,
  EncounterDraft,
  EncounterLock,
  EncounterPatch,
  SlotSugestao,
  TimelineEvent,
} from '../data/types'

import { clinicClock, useClinicoStore } from './clinico'

const PREFIXO_RASCUNHO = 'clinic.draft.'
const CHAVE_DISPOSITIVO = 'clinic.deviceId'
/** Tempo de pausa na digitação que dispara a gravação. */
const ATRASO_AUTOSAVE_MS = 800

function identificarDispositivo(): EncounterLock {
  let id = ''

  if (typeof window !== 'undefined') {
    id = window.sessionStorage.getItem(CHAVE_DISPOSITIVO) ?? ''

    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 8)}`
      window.sessionStorage.setItem(CHAVE_DISPOSITIVO, id)
    }
  }

  /*
   * O rótulo é o que o outro dispositivo lê na tarja de somente leitura ("em edição por …"),
   * então precisa falar a língua de quem lê. Fora de componente, o `t` vem da instância global
   * — mesmo caminho já usado pelas stores e serviços da casa.
   *
   * A tradução acontece uma vez, na abertura da sessão: `navigator.platform` devolve algo como
   * "Win32" e só o texto de reserva é traduzível. Trocar de idioma no meio não reescreve o
   * rótulo, e não deveria — a essa altura ele já viajou dentro do lock para o outro
   * dispositivo, que é quem vai exibi-lo.
   */
  const { t } = i18n.global

  return {
    deviceId: id || 'dev-servidor',
    deviceLabel:
      typeof navigator === 'undefined'
        ? String(t('clinico.prontuario.dispositivo.servidor'))
        : navigator.platform || String(t('clinico.prontuario.dispositivo.navegador')),
    desde: clinicClock.nowIso(),
  }
}

export const useProntuarioStore = defineStore('clinico-prontuario', () => {
  const clinico = useClinicoStore()

  const encounter = ref<Encounter | null>(null)
  const consultaAnterior = ref<Encounter | null>(null)
  const timeline = ref<TimelineEvent[]>([])
  const carregando = ref(false)
  const salvando = ref(false)
  const salvoEm = ref<string | null>(null)
  const erro = ref('')
  const rascunhoPendente = ref<EncounterDraft | null>(null)
  const simulandoSegundoDispositivo = ref(false)

  const dispositivo = identificarDispositivo()

  let temporizador: ReturnType<typeof setTimeout> | null = null
  let patchAcumulado: EncounterPatch = {}

  /**
   * O quarto estado, que é do prontuário e não da página: leitura. Acontece quando outro
   * dispositivo detém a edição ou quando o atendimento já foi finalizado.
   */
  const somenteLeitura = computed(() => {
    if (!encounter.value) {
      return false
    }

    if (encounter.value.status === 'finalizado') {
      return true
    }

    const lock = encounter.value.lock

    return Boolean(lock && lock.deviceId !== dispositivo.deviceId)
  })

  const donoDaEdicao = computed(() => encounter.value?.lock ?? null)

  const pet = computed(() => (encounter.value ? clinico.pet(encounter.value.petId) : null))
  const tutor = computed(() => (encounter.value ? clinico.tutor(encounter.value.tutorId) : null))

  // ------------------------------------------------------------------ rascunho local

  function chaveDoRascunho(encounterId: string) {
    return `${PREFIXO_RASCUNHO}${encounterId}`
  }

  function lerRascunho(encounterId: string): EncounterDraft | null {
    if (typeof window === 'undefined') {
      return null
    }

    const bruto = window.localStorage.getItem(chaveDoRascunho(encounterId))

    if (!bruto) {
      return null
    }

    try {
      return JSON.parse(bruto) as EncounterDraft
    } catch {
      window.localStorage.removeItem(chaveDoRascunho(encounterId))

      return null
    }
  }

  function gravarRascunho(atual: Encounter) {
    if (typeof window === 'undefined') {
      return
    }

    const rascunho: EncounterDraft = {
      encounterId: atual.id,
      salvoEm: clinicClock.nowIso(),
      versaoBase: atual.versao,
      patch: {
        anamnese: atual.anamnese,
        exameFisico: atual.exameFisico,
        diagnosticos: atual.diagnosticos,
        conduta: atual.conduta,
      },
    }

    window.localStorage.setItem(chaveDoRascunho(atual.id), JSON.stringify(rascunho))
  }

  function descartarRascunho() {
    if (typeof window !== 'undefined' && encounter.value) {
      window.localStorage.removeItem(chaveDoRascunho(encounter.value.id))
    }

    rascunhoPendente.value = null
  }

  function restaurarRascunho() {
    const rascunho = rascunhoPendente.value

    if (!rascunho || !encounter.value) {
      return
    }

    encounter.value = { ...encounter.value, ...rascunho.patch }
    rascunhoPendente.value = null
    agendarGravacao(rascunho.patch)
  }

  // ------------------------------------------------------------------ carregamento

  async function abrirPorAppointment(appointmentId: string) {
    carregando.value = true
    erro.value = ''

    try {
      const aberto = await encounterRepository.abrir(appointmentId, {
        ...dispositivo,
        desde: clinicClock.nowIso(),
      })

      await aplicarCarregado(aberto)
    } catch {
      erro.value = 'clinico.erros.prontuario'
    } finally {
      carregando.value = false
    }
  }

  /**
   * Abre o atendimento e já grava na anamnese o que veio de fora — o resumo do paciente.
   *
   * `preencher` recebe a anamnese como está e devolve só o que acrescentar: quem chama decide
   * não sobrescrever o que alguém já digitou. A gravação é **imediata**, não pelo autosave:
   * quem chama navega em seguida, e a página do prontuário relê o registro do repositório — um
   * patch ainda esperando o temporizador chegaria depois da leitura e sumiria da tela.
   *
   * Devolve o id do prontuário, ou `null` quando não abriu. Prontuário em leitura (finalizado,
   * ou com outro dispositivo) abre sem preenchimento: o resumo não fura o bloqueio de edição.
   */
  async function abrirComAnamnese(
    appointmentId: string,
    preencher: (atual: Encounter['anamnese']) => Partial<Encounter['anamnese']>,
  ): Promise<string | null> {
    await abrirPorAppointment(appointmentId)

    const aberto = encounter.value

    if (!aberto || erro.value) {
      return null
    }

    const acrescimo = preencher(aberto.anamnese)

    if (!somenteLeitura.value && Object.keys(acrescimo).length > 0) {
      atualizar({ anamnese: { ...aberto.anamnese, ...acrescimo } })

      if (temporizador) {
        clearTimeout(temporizador)
        temporizador = null
      }

      await gravar()
    }

    return aberto.id
  }

  async function abrirPorId(encounterId: string) {
    carregando.value = true
    erro.value = ''

    try {
      await aplicarCarregado(await encounterRepository.obter(encounterId))
    } catch {
      erro.value = 'clinico.erros.prontuario'
    } finally {
      carregando.value = false
    }
  }

  async function aplicarCarregado(carregado: Encounter) {
    encounter.value = carregado
    salvoEm.value = null

    const rascunho = lerRascunho(carregado.id)

    /**
     * Rascunho mais novo que o servidor vira oferta, não sobrescrita: quem estava digitando
     * decide se quer o texto de volta.
     */
    rascunhoPendente.value = rascunho && rascunho.versaoBase <= carregado.versao ? rascunho : null

    const [anterior, historico] = await Promise.all([
      encounterRepository.consultaAnterior(carregado.petId, carregado.abertoEm),
      encounterRepository.historico(carregado.petId),
    ])

    consultaAnterior.value = anterior
    timeline.value = historico
  }

  // ------------------------------------------------------------------ autosave

  function agendarGravacao(patch: EncounterPatch) {
    patchAcumulado = { ...patchAcumulado, ...patch }

    if (temporizador) {
      clearTimeout(temporizador)
    }

    temporizador = setTimeout(() => void gravar(), ATRASO_AUTOSAVE_MS)
  }

  /**
   * Edição de campo. Atualiza a cópia local na hora — digitar não pode esperar rede — e agenda
   * a gravação. Nada de `invalidarTudo()` aqui.
   */
  function atualizar(patch: EncounterPatch) {
    if (!encounter.value || somenteLeitura.value) {
      return
    }

    encounter.value = { ...encounter.value, ...patch }
    gravarRascunho(encounter.value)
    agendarGravacao(patch)
  }

  async function gravar() {
    const atual = encounter.value

    if (!atual || Object.keys(patchAcumulado).length === 0) {
      return
    }

    const patch = patchAcumulado

    patchAcumulado = {}
    salvando.value = true

    try {
      const salvo = await encounterRepository.salvar(atual.id, patch, dispositivo.deviceId)

      encounter.value = { ...salvo }
      salvoEm.value = clinicClock.nowIso()
      descartarRascunho()
    } catch (falha) {
      if (falha instanceof EncounterLockedError) {
        /** Perdeu a edição no meio do caminho: mantém o texto na tela e passa para leitura. */
        encounter.value = atual.lock ? atual : { ...atual, lock: falha.lock }
        gravarRascunho(atual)
        erro.value = ''
      } else {
        erro.value = 'clinico.erros.mutacao'
      }
    } finally {
      salvando.value = false
    }
  }

  /** Chamado ao sair da tela: o que estava pendente não pode ficar só na memória. */
  async function descarregar() {
    if (temporizador) {
      clearTimeout(temporizador)
      temporizador = null
    }

    await gravar()

    if (encounter.value && !somenteLeitura.value) {
      await encounterRepository.liberarEdicao(encounter.value.id, dispositivo.deviceId)
    }
  }

  async function assumirEdicao() {
    if (!encounter.value) {
      return
    }

    encounter.value = await encounterRepository.assumirEdicao(encounter.value.id, {
      ...dispositivo,
      desde: clinicClock.nowIso(),
    })
  }

  // ------------------------------------------------------------------ retorno

  const sugestoesDeRetorno = ref<SlotSugestao[]>([])
  const buscandoRetorno = ref(false)

  /** Data de parede do atendimento — base do "em N dias" que a escolha de retorno mostra. */
  const dataDoAtendimento = computed(() =>
    encounter.value ? clinicClock.dateOf(encounter.value.abertoEm) : clinicClock.today(),
  )

  /**
   * Horários possíveis para o retorno indicado na conduta.
   *
   * Nasce vazio e só é buscado quando alguém pede — o retorno é opcional, e disparar a busca a
   * cada tecla digitada no campo de dias faria uma consulta de agenda por dígito.
   */
  async function buscarSugestoesDeRetorno() {
    const atual = encounter.value
    const emDias = atual?.conduta.retorno.emDias

    if (!atual || emDias === null || emDias === undefined) {
      sugestoesDeRetorno.value = []

      return
    }

    buscandoRetorno.value = true

    try {
      sugestoesDeRetorno.value = await agendaRepository.sugerirRetorno({
        petId: atual.petId,
        professionalId: atual.professionalId,
        /** Sem tipo escolhido, o retorno é uma consulta de retorno. */
        typeId: atual.conduta.retorno.typeId ?? 'tipo-retorno',
        aPartirDe: clinicClock.dateOf(atual.abertoEm),
        emDias,
      })
    } catch {
      sugestoesDeRetorno.value = []
    } finally {
      buscandoRetorno.value = false
    }
  }

  /**
   * Cria o retorno de verdade e amarra o id na conduta.
   *
   * Antes daqui, "Agendar retorno" só navegava para a agenda **focando o atendimento que
   * acabava de terminar**: nada era criado, o `emDias` e o tipo escolhidos ficavam para trás, e
   * `retorno.appointmentId` nunca era preenchido — então o aviso de "retorno pendente" não
   * sumia nem depois de o vet marcar o retorno à mão.
   *
   * O id gravado é o que fecha o ciclo: é por ele que a conduta sabe que o próximo atendimento
   * já existe, e é ele que some com o aviso.
   */
  async function agendarRetorno(slot: SlotSugestao) {
    const atual = encounter.value

    if (!atual || somenteLeitura.value) {
      return null
    }

    salvando.value = true

    try {
      const resultado = await agendaRepository.criar({
        petId: atual.petId,
        tutorId: atual.tutorId,
        professionalId: slot.professionalId,
        roomIds: [],
        typeId: atual.conduta.retorno.typeId ?? 'tipo-retorno',
        inicio: slot.inicio,
        fim: slot.fim,
        encaixe: false,
        observacao: '',
        origem: 'retorno',
      })

      const criado = resultado.atendimentos[0] ?? null

      if (criado) {
        /*
         * Passa pelo `atualizar` como qualquer edição de campo: entra no autosave, no rascunho
         * local e no bloqueio de somente leitura. Gravar direto no `encounter` deixaria o id
         * fora do rascunho, e uma interrupção logo depois perderia o vínculo com um
         * atendimento que **já existe** na agenda — o pior dos dois mundos.
         */
        atualizar({
          conduta: {
            ...atual.conduta,
            retorno: { ...atual.conduta.retorno, appointmentId: criado.id },
          },
        })

        sugestoesDeRetorno.value = []
        /** A agenda ganhou um atendimento: quem estiver olhando o dia precisa saber. */
        clinico.invalidarTudo()
      }

      return criado
    } catch {
      erro.value = 'clinico.erros.mutacao'

      return null
    } finally {
      salvando.value = false
    }
  }

  async function finalizar() {
    if (!encounter.value) {
      return
    }

    await gravar()

    const finalizado = await encounterRepository.finalizar(encounter.value.id)

    encounter.value = finalizado
    descartarRascunho()

    /** Finalizar muda a grade do dia, a carga da semana e o painel de atividades. */
    clinico.invalidarTudo()
  }

  /** Entrega o resumo ao responsável, no app. Ver `encounterRepository.liberarResumo`. */
  async function liberarResumo() {
    if (!encounter.value || encounter.value.status !== 'finalizado') {
      return
    }

    try {
      encounter.value = await encounterRepository.liberarResumo(encounter.value.id)
    } catch {
      erro.value = 'clinico.erros.mutacao'
    }
  }

  /**
   * Simulação de segundo dispositivo, para o painel de desenvolvimento: injeta um lock alheio
   * sem precisar de outra máquina aberta.
   */
  function alternarSegundoDispositivo() {
    simulandoSegundoDispositivo.value = !simulandoSegundoDispositivo.value

    if (!encounter.value) {
      return
    }

    encounter.value = {
      ...encounter.value,
      lock: simulandoSegundoDispositivo.value
        ? {
            deviceId: 'outro-dispositivo',
            deviceLabel: String(i18n.global.t('clinico.prontuario.dispositivo.simulado')),
            desde: clinicClock.nowIso(),
          }
        : null,
    }
  }

  function $limpar() {
    encounter.value = null
    consultaAnterior.value = null
    timeline.value = []
    rascunhoPendente.value = null
    sugestoesDeRetorno.value = []
    salvoEm.value = null
    erro.value = ''
    patchAcumulado = {}
  }

  return {
    encounter,
    consultaAnterior,
    timeline,
    carregando,
    salvando,
    salvoEm,
    erro,
    rascunhoPendente,
    sugestoesDeRetorno,
    buscandoRetorno,
    dataDoAtendimento,
    simulandoSegundoDispositivo,
    dispositivo,
    somenteLeitura,
    donoDaEdicao,
    pet,
    tutor,
    abrirPorAppointment,
    abrirComAnamnese,
    abrirPorId,
    atualizar,
    gravar,
    descarregar,
    assumirEdicao,
    buscarSugestoesDeRetorno,
    agendarRetorno,
    finalizar,
    liberarResumo,
    restaurarRascunho,
    descartarRascunho,
    alternarSegundoDispositivo,
    $limpar,
  }
})
