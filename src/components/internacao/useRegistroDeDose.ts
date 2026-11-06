/**
 * O registro de dose dos dois checklists (E5-02b, guia e5 14.3 e 14.4): o "dei" (ou "conferi")
 * de um toque, que só abre a gaveta quando a API pede confirmação (dose adiantada ou dobrada); o
 * "pulei" e o "recusou", sempre pela gaveta (motivo); e o desfazer de quem registrou.
 *
 * Os recados (já registrada por outra pessoa, alergia nova, sem ficha de profissional) ficam numa
 * frase ao lado da lista, nunca num toast sobre a gaveta.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  desfazerDose,
  registrarDose,
  type Registro,
} from '@/service/parceiro/plantao-da-internacao-service'

import type { PedidoDeRegistro } from './RegistrarDoseGaveta.vue'

type DoseDaLinha = { id: string; previstaPara: string; conferencia: boolean }

export function useRegistroDeDose(aoMudar: () => void) {
  const { t } = useI18n()
  const { parceiroQuery } = useParceiroPortal()

  const pedido = ref<PedidoDeRegistro | null>(null)
  const gavetaAberta = ref(false)
  const registrando = ref<string | null>(null)
  const recado = ref('')
  /* Uma chave por dose: o duplo toque no "dei" repete a resposta, não registra duas. */
  const chaves = new Map<string, string>()

  function abrir(
    dose: DoseDaLinha,
    titulo: string,
    status: Registro['status'],
    confirmar?: PedidoDeRegistro['confirmar'],
  ) {
    pedido.value = {
      doseId: dose.id,
      titulo,
      previstaPara: dose.previstaPara,
      conferencia: dose.conferencia,
      status,
      confirmar,
    }
    gavetaAberta.value = true
  }

  async function dei(dose: DoseDaLinha, titulo: string) {
    registrando.value = dose.id
    recado.value = ''
    const chave = chaves.get(dose.id) ?? novaChaveDeIdempotencia()
    chaves.set(dose.id, chave)
    try {
      await registrarDose(dose.id, { status: 'FEITA' }, chave, parceiroQuery())
      chaves.delete(dose.id)
      aoMudar()
    } catch (err) {
      chaves.delete(dose.id)
      const lido = lerErroDoCadastro(err, t('internacao.dose.erro'))
      const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
      if (lido.codigo === 'DOSE_FORA_DA_JANELA' || lido.codigo === 'INTERVALO_CURTO_ENTRE_DOSES') {
        abrir(dose, titulo, 'FEITA', { codigo: lido.codigo, detalhes })
        return
      }
      if (
        lido.codigo === 'ALERGIA_NOVA_NA_PRESCRICAO' ||
        lido.codigo === 'ESPECIE_PROIBIDA_NA_PRESCRICAO'
      ) {
        recado.value = t(`internacao.dose.${lido.codigo}`)
        aoMudar()
        return
      }
      recado.value = lido.mensagem
      if (lido.codigo === 'DOSE_JA_REGISTRADA' || lido.codigo === 'REGISTRO_DESFEITO') aoMudar()
    } finally {
      registrando.value = null
    }
  }

  function naoDei(dose: DoseDaLinha, titulo: string, status: 'PULADA' | 'RECUSADA') {
    recado.value = ''
    abrir(dose, titulo, status)
  }

  async function desfazer(doseId: string) {
    registrando.value = doseId
    recado.value = ''
    try {
      await desfazerDose(doseId, parceiroQuery())
      aoMudar()
    } catch (err) {
      recado.value = lerErroDoCadastro(err, t('internacao.dose.erroDesfazer')).mensagem
    } finally {
      registrando.value = null
    }
  }

  return { pedido, gavetaAberta, registrando, recado, dei, naoDei, desfazer }
}
