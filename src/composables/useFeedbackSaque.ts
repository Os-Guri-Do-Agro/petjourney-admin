import { readonly, ref, shallowRef } from 'vue'

import { ApiError } from '@/service/api'
import {
  getFeedbackElegibilidade,
  registrarFeedbackSaque,
} from '@/service/parceiro/parceiro-portal-service'
import type { IncentivoIndicacaoFeedback, PontoPositivoFeedback } from '@/service/parceiro/types'

/**
 * O questionário que aparece logo depois de um saque (Parte B do guia
 * `front-questionario-feedback-saque.md`; spec da API em
 * `docs/specs/2026/q4/q4-1/questionario-feedback-saque-parceiro.md`).
 *
 * O estado mora aqui, fora da tela da carteira, pelo mesmo motivo do `useCupomResgateModal`: o
 * diálogo é montado uma vez no `AppShell`. Dentro da carteira ele morria no meio da resposta ao
 * trocar de rota, e uma resposta perdida no meio é um parceiro que acha que algo deu errado no
 * momento em que acabou de mexer com dinheiro.
 *
 * As regras de produto que este arquivo garante:
 *
 * - **Fechar sem enviar é dispensar.** X, clique fora, Esc e "Agora não" gravam `DISPENSADO` em
 *   segundo plano, uma vez por saque, sem esperar e sem mostrar erro. Sem isso a regra das duas
 *   dispensas nunca dispara e o questionário volta em todo saque.
 * - **Depois de responder, fechar não dispensa.** O `@hide` do PrimeVue dispara em todo
 *   fechamento; por isso quem decide é a marca `registrado`, não o evento.
 * - **Fechar durante o envio fecha na hora**, sem dispensar: dispensar ali faria a resposta em voo
 *   voltar 409. O envio decide o registro.
 * - **Falha ao enviar mantém o diálogo aberto**, com o texto da pessoa intacto.
 */

/** Versão das perguntas na tela. Mudou pergunta: sobe aqui e na API. */
export const VERSAO_QUESTIONARIO_SAQUE = 1

/** O mesmo teto que a API cobra. */
export const SUGESTAO_MAX_LENGTH = 1000

/** A ordem é a da tela. Os valores são o contrato com a API e não mudam. */
export const PONTOS_POSITIVOS: readonly PontoPositivoFeedback[] = [
  'FACILIDADE_INDICAR',
  'ACOMPANHAR_INDICADOS',
  'CLAREZA_CARTEIRA',
  'RAPIDEZ_SAQUE',
  'VALOR_PARTICIPACAO',
  'APP_GERAL',
]

export const INCENTIVOS_INDICACAO: readonly IncentivoIndicacaoFeedback[] = [
  'MATERIAL_DIVULGACAO',
  'PARTICIPACAO_MAIOR',
  'TUTORES_ENGAJADOS',
  'FERRAMENTAS_NEGOCIO',
  'ENTENDER_PROGRAMA',
]

/** O 409 de saque com mais de 7 dias. O outro 409 é "já registrado". */
const FORA_DO_PRAZO = 'FEEDBACK_FORA_DO_PRAZO'

type PedidoDeFeedback = {
  saqueId: string
  parceiroId: string | null
}

export type RespostaFeedbackSaque = {
  notaRecomendacao: number
  pontosPositivos: PontoPositivoFeedback[]
  incentivos: IncentivoIndicacaoFeedback[]
  sugestao: string
}

/** `envio`: dá para tentar de novo. `prazo`: a API encerrou o saque; a frase é dela. */
export type ErroDoFeedback = { tipo: 'envio' } | { tipo: 'prazo'; mensagem: string }

const aberto = ref(false)
const pedido = shallowRef<PedidoDeFeedback | null>(null)
const enviando = ref(false)
const erro = shallowRef<ErroDoFeedback | null>(null)

/** Já existe registro deste saque (resposta, dispensa ou 409): fechar não grava de novo. */
let registrado = false

function consultaDo(atual: PedidoDeFeedback) {
  return atual.parceiroId ? { parceiroId: atual.parceiroId } : undefined
}

type Oferta = {
  /** O que precisa acabar antes de abrir: o diálogo do saque saindo de cena. */
  depoisDe?: Promise<unknown>
  /** Conferido no fim: quem saiu da carteira não recebe o questionário por cima de outra tela. */
  aindaNaTela?: () => boolean
  /** Chamado só quando o questionário de fato abre. */
  aoAbrir?: () => void
}

export function useFeedbackSaque() {
  /**
   * Depois de um saque concluído. Nunca interfere no saque: qualquer erro aqui é engolido, sem
   * toast e sem diálogo. Quem chama não espera por isto.
   */
  async function oferecer(saqueId: string, parceiroId: string | null, oferta: Oferta = {}) {
    if (!saqueId || aberto.value) {
      return
    }

    try {
      const [{ exibir }] = await Promise.all([
        getFeedbackElegibilidade(parceiroId ? { parceiroId } : undefined),
        oferta.depoisDe,
      ])

      if (!exibir || aberto.value || (oferta.aindaNaTela && !oferta.aindaNaTela())) {
        return
      }

      pedido.value = { saqueId, parceiroId }
      registrado = false
      enviando.value = false
      erro.value = null
      aberto.value = true
      oferta.aoAbrir?.()
    } catch {
      // Silencioso de propósito: o questionário é opcional e o saque já deu certo.
    }
  }

  function fechar() {
    const atual = pedido.value

    if (atual && !registrado && !enviando.value) {
      registrado = true
      registrarFeedbackSaque(
        {
          saqueId: atual.saqueId,
          status: 'DISPENSADO',
          versaoQuestionario: VERSAO_QUESTIONARIO_SAQUE,
        },
        consultaDo(atual),
      ).catch(() => {
        // Falhou a dispensa: o questionário só volta no próximo saque. Nada a mostrar.
      })
    }

    aberto.value = false
  }

  /** Devolve `true` quando a resposta ficou gravada: aí a tela agradece. */
  async function enviar(resposta: RespostaFeedbackSaque): Promise<boolean> {
    const atual = pedido.value

    if (!atual || registrado || enviando.value) {
      return false
    }

    enviando.value = true
    erro.value = null

    try {
      await registrarFeedbackSaque(
        {
          saqueId: atual.saqueId,
          status: 'RESPONDIDO',
          versaoQuestionario: VERSAO_QUESTIONARIO_SAQUE,
          notaRecomendacao: resposta.notaRecomendacao,
          pontosPositivos: resposta.pontosPositivos,
          incentivos: resposta.incentivos,
          sugestao: resposta.sugestao.trim() || undefined,
        },
        consultaDo(atual),
      )

      registrado = true
      aberto.value = false

      return true
    } catch (err) {
      const status = err instanceof ApiError ? err.statusCode : 0
      const reason = err instanceof ApiError ? err.reason : undefined

      if (status === 409 && reason === FORA_DO_PRAZO) {
        // Reenviar não adianta, e dispensar daria o mesmo 409.
        registrado = true

        if (aberto.value) {
          erro.value = { tipo: 'prazo', mensagem: (err as ApiError).message }
        }

        return false
      }

      // "Já registrado" (toque duplo, outra aba) ou 403: fecha como se tivesse dado certo.
      if (status === 409 || status === 403) {
        registrado = true
        aberto.value = false

        return false
      }

      // Fechou durante o envio: nada a mostrar, e sem registro o questionário volta no próximo.
      if (aberto.value) {
        erro.value = { tipo: 'envio' }
      }

      return false
    } finally {
      enviando.value = false
    }
  }

  return {
    aberto: readonly(aberto),
    pedido: readonly(pedido),
    enviando: readonly(enviando),
    erro: readonly(erro),
    oferecer,
    fechar,
    enviar,
  }
}
