/**
 * Store da anamnese por voz.
 *
 * Uma sessão por vez, presa ao prontuário em que nasceu. O caminho é sempre o mesmo, e cada
 * passo só existe depois do anterior:
 *
 * 1. **Autorização.** Nada grava antes de o responsável concordar — e o sim fica registrado com
 *    nome e hora, que é o que a tela mostra enquanto ouve.
 * 2. **Escuta.** A fonte entrega trechos; o motor relê a conversa a cada um e o prontuário
 *    proposto vai se preenchendo.
 * 3. **Revisão.** Nada nasce marcado. O veterinário marca o que entra, corrige o que precisar —
 *    sem refazer a gravação —, e a correção já conta como marcar.
 * 4. **Aplicação.** Só o marcado vai para a anamnese, pelo caminho de qualquer edição (autosave,
 *    rascunho local, bloqueio de somente leitura). A conversa fica, para o rastro.
 *
 * **O que não mora aqui: o prontuário.** A store devolve o patch e quem aplica é a página, como
 * na pré-consulta. A conversa também não é gravada no atendimento: vive na memória desta aba,
 * e sair do prontuário fecha o microfone mas guarda o que foi ouvido até ali.
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import {
  criarFonteDeDemonstracao,
  criarFonteDoMicrofone,
  microfoneDisponivel,
  type ErroDaEscuta,
  type EventosDaFonte,
  type FonteDaEscuta,
} from '../data/fontes-da-escuta'
import type {
  Anamnese,
  AntecedenteKind,
  ISODateTime,
  PetSex,
  TrechoDaConversa,
} from '../data/types'
import {
  alertasDaProposta,
  extrairDaConversa,
  patchDaEscuta,
  type AlertaDaProposta,
  type EscolhaDaRevisao,
  type PropostaDaEscuta,
  type ValorDaEscuta,
} from '../domain/escuta'

import { clinicClock } from './clinico'

export type FaseDaEscuta =
  | 'inativa'
  | 'gravando'
  | 'pausada'
  | 'encerrando'
  | 'revisao'
  | 'aplicada'

export type FonteDaEscutaId = 'microfone' | 'demonstracao'

export type DecisaoDaRevisao = {
  incluir: boolean
  valor: ValorDaEscuta
  tipo: AntecedenteKind | null
  quando: string
  /** O veterinário mudou o que a máquina propôs. */
  corrigida: boolean
}

export type AutorizacaoDaGravacao = {
  /** Como o responsável foi chamado na sala. */
  responsavel: string
  em: ISODateTime
}

const CHAVE_DA_FONTE = 'clinic.escuta.fonte'
/** O reconhecimento entende português: é a língua em que as regras do motor foram escritas. */
const IDIOMA_DA_ESCUTA = 'pt-BR'
/** A consulta de demonstração dura perto de dois minutos; três vezes mais rápido cabe no roteiro. */
const VELOCIDADE_DA_DEMONSTRACAO = 3

/**
 * A fonte lembrada. Quem apresenta usa a demonstração em toda consulta, e escolhê-la de novo a
 * cada paciente, na frente do cliente, é o tipo de atrito que a preferência existe para tirar.
 */
function fonteLembrada(): FonteDaEscutaId {
  if (typeof window === 'undefined') {
    return 'demonstracao'
  }

  try {
    const salva = window.localStorage.getItem(CHAVE_DA_FONTE)

    if (salva === 'demonstracao' || (salva === 'microfone' && microfoneDisponivel())) {
      return salva
    }
  } catch {
    /* Armazenamento bloqueado: segue o padrão. */
  }

  return microfoneDisponivel() ? 'microfone' : 'demonstracao'
}

export const useEscutaStore = defineStore('clinico-escuta', () => {
  const encounterId = ref<string | null>(null)
  const fase = ref<FaseDaEscuta>('inativa')
  const fonte = ref<FonteDaEscutaId>(fonteLembrada())
  const autorizacaoAberta = ref(false)
  const autorizacao = ref<AutorizacaoDaGravacao | null>(null)
  /** Substituída a cada trecho, nunca mutada: a extração relê a conversa inteira. */
  const trechos = shallowRef<TrechoDaConversa[]>([])
  const interino = ref('')
  const nivel = ref(0)
  const tempoMs = ref(0)
  const erro = ref<ErroDaEscuta | null>(null)
  const decisoes = ref<Record<string, DecisaoDaRevisao>>({})
  const aplicadaEm = ref<ISODateTime | null>(null)

  /**
   * O que está à vista no painel.
   *
   * Mora aqui, e não no componente, porque o painel desmonta quando o veterinário vai ao exame
   * físico — e quem recolheu a seção não quer encontrá-la aberta de novo na volta.
   *
   * Cada fase começa com a vista que serve a ela (`vistaDaFase`), e a pessoa muda à vontade
   * dentro da fase:
   *
   * - **Ouvindo**: tudo aberto. A transcrição chegando é o que prova que a escuta funciona.
   * - **Revisão**: aberta, mas **sem a conversa**. A decisão é sobre os campos, e cada um já traz
   *   a própria citação; a conversa inteira é prova sob demanda, a um clique.
   * - **Aplicada**: recolhida numa linha. Virou prontuário; o rastro fica guardado, não exposto.
   */
  const recolhida = ref(false)
  const conversaAberta = ref(true)

  let ativa: FonteDaEscuta | null = null

  const microfone = microfoneDisponivel()

  const resultado = computed(() => extrairDaConversa(trechos.value))
  const propostas = computed(() => resultado.value.propostas)
  const notas = computed(() => resultado.value.notas)
  const trechosPorId = computed(() => new Map(trechos.value.map((trecho) => [trecho.id, trecho])))

  const alertas = computed(
    () =>
      new Map<string, AlertaDaProposta[]>(
        propostas.value.map((proposta) => [
          proposta.id,
          alertasDaProposta(proposta, trechosPorId.value),
        ]),
      ),
  )

  const marcadas = computed(() =>
    propostas.value.filter((proposta) => decisoes.value[proposta.id]?.incluir),
  )

  const emCurso = computed(() => ['gravando', 'pausada', 'encerrando'].includes(fase.value))

  /** Há painel na tela: da primeira fala até a aplicação. */
  const aberta = computed(() => fase.value !== 'inativa')

  // ------------------------------------------------------------------ ciclo

  function soltarFonte() {
    ativa?.descartar()
    ativa = null
    nivel.value = 0
    interino.value = ''
  }

  function zerarConversa() {
    trechos.value = []
    interino.value = ''
    nivel.value = 0
    tempoMs.value = 0
    decisoes.value = {}
    aplicadaEm.value = null
  }

  const VISTA_DA_FASE: Record<FaseDaEscuta, { recolhida: boolean; conversa: boolean }> = {
    inativa: { recolhida: false, conversa: true },
    gravando: { recolhida: false, conversa: true },
    pausada: { recolhida: false, conversa: true },
    encerrando: { recolhida: false, conversa: true },
    revisao: { recolhida: false, conversa: false },
    aplicada: { recolhida: true, conversa: false },
  }

  /** A fase mudou: a vista volta ao padrão dela. Dentro da fase, quem manda é a pessoa. */
  function vistaDaFase(nova: FaseDaEscuta) {
    recolhida.value = VISTA_DA_FASE[nova].recolhida
    conversaAberta.value = VISTA_DA_FASE[nova].conversa
  }

  function alternarRecolhida() {
    recolhida.value = !recolhida.value
  }

  function alternarConversa() {
    conversaAberta.value = !conversaAberta.value
  }

  /** "Ver na conversa" com a conversa oculta: ela abre — e a seção também, se estava recolhida. */
  function abrirConversa() {
    recolhida.value = false
    conversaAberta.value = true
  }

  /** Pede a gravação: abre a autorização. Prontuário diferente do da sessão começa do zero. */
  function pedirGravacao(id: string) {
    if (encounterId.value !== id) {
      $limpar()
      encounterId.value = id
    }

    erro.value = null
    autorizacaoAberta.value = true
  }

  function escolherFonte(escolhida: FonteDaEscutaId) {
    fonte.value = escolhida

    try {
      window.localStorage.setItem(CHAVE_DA_FONTE, escolhida)
    } catch {
      /* Sem armazenamento, a escolha vale só para esta sessão. */
    }
  }

  /**
   * O responsável autorizou: começa a ouvir.
   *
   * O registro nasce aqui e não depois — é o sim que torna a gravação legítima, e a tela o mostra
   * durante toda a escuta.
   */
  function iniciar(contexto: {
    encounterId: string
    responsavel: string
    pet: string
    sexo: PetSex
    /** Com movimento reduzido, a fala entra inteira em vez de palavra a palavra. */
    reduzirMovimento: boolean
  }) {
    soltarFonte()
    zerarConversa()

    encounterId.value = contexto.encounterId
    erro.value = null
    autorizacao.value = { responsavel: contexto.responsavel, em: clinicClock.nowIso() }
    autorizacaoAberta.value = false

    const eventos: EventosDaFonte = {
      aoTrecho: (trecho) => {
        trechos.value = [...trechos.value, trecho]
      },
      aoInterino: (texto) => {
        interino.value = texto
      },
      aoNivel: (valor) => {
        nivel.value = valor
      },
      aoTempo: (ms) => {
        tempoMs.value = ms
      },
      aoFim: () => {
        ativa = null
        entrarNaRevisao()
      },
      aoErro: (falha) => {
        ativa = null
        erro.value = falha

        /*
         * Falhou antes de ouvir qualquer coisa — permissão negada, quase sempre: volta para a
         * autorização, que é onde dá para trocar para a demonstração. Falhou no meio: o que foi
         * ouvido até ali não se perde, vai para a revisão com o motivo à vista.
         */
        if (trechos.value.length === 0) {
          fase.value = 'inativa'
          autorizacaoAberta.value = true
        } else {
          entrarNaRevisao()
        }
      },
    }

    ativa =
      fonte.value === 'demonstracao'
        ? criarFonteDeDemonstracao(
            { pet: contexto.pet, sexo: contexto.sexo, responsavel: contexto.responsavel },
            eventos,
            {
              velocidade: VELOCIDADE_DA_DEMONSTRACAO,
              palavraAPalavra: !contexto.reduzirMovimento,
            },
          )
        : criarFonteDoMicrofone(eventos, { idioma: IDIOMA_DA_ESCUTA })

    fase.value = 'gravando'
    vistaDaFase('gravando')
    ativa.iniciar()
  }

  function pausar() {
    if (fase.value === 'gravando') {
      ativa?.pausar()
      fase.value = 'pausada'
    }
  }

  function retomar() {
    if (fase.value === 'pausada') {
      ativa?.retomar()
      fase.value = 'gravando'
    }
  }

  function encerrar() {
    if (fase.value !== 'gravando' && fase.value !== 'pausada') {
      return
    }

    fase.value = 'encerrando'

    if (ativa) {
      ativa.encerrar()
    } else {
      entrarNaRevisao()
    }
  }

  function adiantar() {
    ativa?.adiantar?.()
  }

  /**
   * Nada nasce marcado.
   *
   * Uma revisão que chega com tudo aceito treina o gesto de apertar o botão — e o dia em que o
   * motor errar é o dia em que ninguém olha. A decisão já tomada sobrevive, para o caso de a
   * sessão voltar à revisão depois de uma saída da tela.
   */
  function entrarNaRevisao() {
    fase.value = 'revisao'
    vistaDaFase('revisao')
    nivel.value = 0
    interino.value = ''

    const novas: Record<string, DecisaoDaRevisao> = {}

    for (const proposta of propostas.value) {
      novas[proposta.id] = decisoes.value[proposta.id] ?? {
        incluir: false,
        valor: proposta.valor,
        tipo: proposta.tipo,
        quando: proposta.quando,
        corrigida: false,
      }
    }

    decisoes.value = novas
  }

  function proposta(id: string): PropostaDaEscuta | undefined {
    return propostas.value.find((item) => item.id === id)
  }

  function marcar(id: string, incluir: boolean) {
    const atual = decisoes.value[id]

    if (atual && fase.value === 'revisao') {
      decisoes.value = { ...decisoes.value, [id]: { ...atual, incluir } }
    }
  }

  /** Corrigir é decidir: o campo corrigido entra marcado. */
  function corrigir(
    id: string,
    mudanca: Partial<Pick<DecisaoDaRevisao, 'valor' | 'tipo' | 'quando'>>,
  ) {
    const original = proposta(id)
    const atual = decisoes.value[id]

    if (!original || !atual || fase.value !== 'revisao') {
      return
    }

    const nova = { ...atual, ...mudanca, incluir: true }

    nova.corrigida =
      nova.valor !== original.valor ||
      nova.tipo !== original.tipo ||
      nova.quando.trim() !== original.quando

    decisoes.value = { ...decisoes.value, [id]: nova }
  }

  function desfazerCorrecao(id: string) {
    const original = proposta(id)
    const atual = decisoes.value[id]

    if (!original || !atual || fase.value !== 'revisao') {
      return
    }

    decisoes.value = {
      ...decisoes.value,
      [id]: {
        ...atual,
        valor: original.valor,
        tipo: original.tipo,
        quando: original.quando,
        corrigida: false,
      },
    }
  }

  /** Devolve o patch do que foi marcado. Quem grava é a página, pelo caminho de toda edição. */
  function aplicar(anamnese: Anamnese, novoId: () => string): Partial<Anamnese> {
    const escolhas: EscolhaDaRevisao[] = marcadas.value.flatMap((item) => {
      const decisao = decisoes.value[item.id]

      return decisao
        ? [{ campo: item.campo, valor: decisao.valor, tipo: decisao.tipo, quando: decisao.quando }]
        : []
    })

    fase.value = 'aplicada'
    vistaDaFase('aplicada')
    aplicadaEm.value = clinicClock.nowIso()

    return patchDaEscuta(anamnese, escolhas, novoId)
  }

  /** Joga fora a gravação inteira. Nada tinha entrado no prontuário. */
  function descartar() {
    soltarFonte()
    zerarConversa()
    autorizacao.value = null
    erro.value = null
    fase.value = 'inativa'
    vistaDaFase('inativa')
  }

  /**
   * Saída do prontuário: o microfone fecha na hora, o que foi ouvido fica.
   *
   * Microfone aberto numa tela que ninguém está olhando é exatamente o que a autorização do
   * responsável não cobre.
   */
  function suspender() {
    autorizacaoAberta.value = false

    if (emCurso.value) {
      soltarFonte()
      entrarNaRevisao()
    }
  }

  function $limpar() {
    soltarFonte()
    zerarConversa()
    encounterId.value = null
    autorizacao.value = null
    autorizacaoAberta.value = false
    erro.value = null
    fase.value = 'inativa'
    vistaDaFase('inativa')
  }

  return {
    encounterId,
    fase,
    fonte,
    microfone,
    autorizacaoAberta,
    autorizacao,
    trechos,
    trechosPorId,
    interino,
    nivel,
    tempoMs,
    erro,
    decisoes,
    aplicadaEm,
    recolhida,
    conversaAberta,
    propostas,
    notas,
    alertas,
    marcadas,
    emCurso,
    aberta,
    pedirGravacao,
    escolherFonte,
    iniciar,
    pausar,
    retomar,
    encerrar,
    adiantar,
    alternarRecolhida,
    alternarConversa,
    abrirConversa,
    marcar,
    corrigir,
    desfazerCorrecao,
    aplicar,
    descartar,
    suspender,
    $limpar,
  }
})
