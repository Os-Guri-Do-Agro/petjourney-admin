/**
 * Marcar a prancheta do hotel (E7-05a, guia e7 42): o "Feito" de um toque, que só abre a gaveta
 * quando a API pede confirmação (antes da hora, dose perto da anterior); o "Não feito", sempre pela
 * gaveta (motivo); o desfazer de quem registrou; e a ronda, que manda só os ids que a tela mostrou.
 *
 * Os recados (já registrada por outra pessoa, sem ficha, animal internado, a ronda que parou) ficam
 * numa frase em cima da prancheta, nunca num toast.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  desfazerTarefa,
  marcarRonda,
  marcarTarefa,
  RONDA_MAX,
  type TarefaDaPrancheta,
} from '@/service/parceiro/hotel-rotina-service'

import type { PedidoDeMarcacao } from './MarcarTarefaGaveta.vue'
import { emLotes } from './rotina-do-hotel'

export type Recado = { texto: string; tom: 'erro' | 'ok' | 'aviso' }

/** Os códigos em que a prancheta na tela ficou velha: o recado vai e ela se relê. */
const RELER = new Set([
  'TAREFA_JA_REGISTRADA',
  'TAREFA_SUSPENSA',
  'TAREFA_RETIRADA',
  'TAREFA_ANIMAL_INTERNADO',
  'HOSPEDAGEM_ENCERRADA',
  'RONDA_INCONSISTENTE',
  'MEDICACAO_NAO_ACEITA_LOTE',
  'OWNERSHIP_FORBIDDEN',
])

export function useMarcacaoDaTarefa(aoMudar: () => void) {
  const { t, te } = useI18n()
  const { parceiroQuery } = useParceiroPortal()

  const pedido = ref<PedidoDeMarcacao | null>(null)
  const gavetaAberta = ref(false)
  const ocupada = ref<string | null>(null)
  const recado = ref<Recado | null>(null)
  /* Uma chave por tarefa: o duplo toque no "Feito" repete a resposta, não registra duas vezes. */
  const chaves = new Map<string, string>()

  const hora = (iso: string) => iso.slice(11, 16)

  /** A frase de um erro da prancheta, com os textos que o guia pede ao front. */
  function frase(err: unknown, generico: string) {
    const lido = lerErroDoCadastro(err, generico)
    const detalhes = err instanceof ApiError ? err.detalhes : {}
    switch (lido.codigo) {
      case 'PROFISSIONAL_OBRIGATORIO':
        return { codigo: lido.codigo, texto: t('rotinaDoHotel.semFicha') }
      case 'TAREFA_JA_REGISTRADA':
        return {
          codigo: lido.codigo,
          texto: t('rotinaDoHotel.tarefa.jaRegistrada', {
            nome: String(detalhes.porNome ?? ''),
            hora: hora(String(detalhes.em ?? '')),
          }),
        }
      case 'TAREFA_ANIMAL_INTERNADO':
        return { codigo: lido.codigo, texto: t('rotinaDoHotel.tarefa.internado') }
      default:
        return { codigo: lido.codigo, texto: lido.mensagem }
    }
  }

  function abrir(
    tarefa: TarefaDaPrancheta,
    status: PedidoDeMarcacao['status'],
    confirmar?: PedidoDeMarcacao['confirmar'],
  ) {
    pedido.value = { tarefa, status, confirmar }
    gavetaAberta.value = true
  }

  async function feito(tarefa: TarefaDaPrancheta) {
    ocupada.value = tarefa.id
    recado.value = null
    const chave = chaves.get(tarefa.id) ?? novaChaveDeIdempotencia()
    chaves.set(tarefa.id, chave)
    try {
      await marcarTarefa(tarefa.id, { status: 'FEITA' }, chave, parceiroQuery())
      chaves.delete(tarefa.id)
      aoMudar()
    } catch (err) {
      chaves.delete(tarefa.id)
      const lido = lerErroDoCadastro(err, t('rotinaDoHotel.tarefa.erro'))
      const detalhes = err instanceof ApiError ? err.detalhes : {}
      if (lido.codigo === 'TAREFA_FORA_DA_JANELA' || lido.codigo === 'TAREFA_INTERVALO_CURTO') {
        abrir(tarefa, 'FEITA', { codigo: lido.codigo, detalhes: { ...detalhes } })
        return
      }
      const { codigo, texto } = frase(err, t('rotinaDoHotel.tarefa.erro'))
      recado.value = { texto, tom: 'erro' }
      if (RELER.has(codigo)) aoMudar()
    } finally {
      ocupada.value = null
    }
  }

  function naoFeito(tarefa: TarefaDaPrancheta) {
    recado.value = null
    abrir(tarefa, 'RECUSADA')
  }

  async function desfazer(tarefa: TarefaDaPrancheta) {
    ocupada.value = tarefa.id
    recado.value = null
    try {
      await desfazerTarefa(tarefa.id, parceiroQuery())
      aoMudar()
    } catch (err) {
      const { codigo, texto } = frase(err, t('rotinaDoHotel.tarefa.erroDesfazer'))
      recado.value = { texto, tom: 'erro' }
      if (RELER.has(codigo)) aoMudar()
    } finally {
      ocupada.value = null
    }
  }

  /**
   * A ronda: só os ids que a tela mostrou, em lotes de 60, um depois do outro. A API marca uma por
   * vez e para na primeira que não pega; as anteriores ficam marcadas.
   */
  async function ronda(chaveDaRonda: string, ids: string[], nomes: Map<string, string>) {
    ocupada.value = chaveDaRonda
    recado.value = null
    let marcadas = 0
    try {
      for (const lote of emLotes(ids, RONDA_MAX)) {
        const feita = await marcarRonda(lote, novaChaveDeIdempotencia(), parceiroQuery())
        marcadas += feita.marcadas.length
        if (feita.falhou) {
          const quem = nomes.get(feita.falhou.id) ?? ''
          const porque =
            feita.falhou.codigo === 'TAREFA_JA_REGISTRADA' && feita.falhou.porNome
              ? t('rotinaDoHotel.ronda.jaRegistradaPor', { nome: feita.falhou.porNome })
              : te(`rotinaDoHotel.ronda.falha.${feita.falhou.codigo}`)
                ? t(`rotinaDoHotel.ronda.falha.${feita.falhou.codigo}`)
                : t('rotinaDoHotel.ronda.falha.OUTRA')
          recado.value = {
            texto: t('rotinaDoHotel.ronda.parou', { n: marcadas, nome: quem, porque }, marcadas),
            tom: 'aviso',
          }
          return
        }
      }
      recado.value = { texto: t('rotinaDoHotel.ronda.feita', { n: marcadas }, marcadas), tom: 'ok' }
    } catch (err) {
      const { texto } = frase(err, t('rotinaDoHotel.tarefa.erro'))
      recado.value = {
        texto: marcadas
          ? `${t('rotinaDoHotel.ronda.feita', { n: marcadas }, marcadas)} ${texto}`
          : texto,
        tom: 'erro',
      }
    } finally {
      ocupada.value = null
      aoMudar()
    }
  }

  return { pedido, gavetaAberta, ocupada, recado, feito, naoFeito, desfazer, ronda }
}
