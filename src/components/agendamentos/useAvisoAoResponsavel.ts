/**
 * Avisar o responsável pelo app ao marcar, mudar ou cancelar um horário (E3-06, guia e3 4.1).
 *
 * O interruptor vem ligado quando o pet está ligado ao app do responsável (como no app do parceiro)
 * e desligado quando não está ou ainda não se sabe; a recepção pode ligar mesmo assim, e a resposta
 * diz "sem canal no app: ligue". A mensagem só vai com o interruptor ligado e conta como a API conta.
 */
import { computed, ref } from 'vue'

import {
  MENSAGEM_DO_AVISO_MAX,
  pedidoDoAviso,
  tamanhoDaMensagem,
} from '@/service/parceiro/agenda-service'
import { obterVinculo } from '@/service/parceiro/vinculo-service'

type ParceiroQuery = { parceiroId?: string } | undefined

export function useAvisoAoResponsavel() {
  /** `true` com o pet ligado ao app; `false` sem; `null` enquanto não se sabe. */
  const temApp = ref<boolean | null>(null)
  const escolha = ref<boolean | null>(null)
  const mensagem = ref('')
  /** Lendo o vínculo: o padrão do interruptor ainda pode mudar. */
  const lendo = ref(false)

  const avisar = computed({
    get: () => escolha.value ?? temApp.value === true,
    set: (valor: boolean) => {
      escolha.value = valor
    },
  })

  const tamanho = computed(() => tamanhoDaMensagem(mensagem.value))
  const longa = computed(() => avisar.value && tamanho.value > MENSAGEM_DO_AVISO_MAX)

  let vez = 0

  /** Volta ao começo; `app` é o que já se sabe do canal (o comprovante da gaveta, por exemplo). */
  function reiniciar(app: boolean | null = null) {
    vez += 1
    lendo.value = false
    temApp.value = app
    escolha.value = null
    mensagem.value = ''
  }

  /** Lê o vínculo do paciente com o app para decidir o padrão do interruptor. */
  async function lerVinculo(pacienteId: string | null | undefined, params?: ParceiroQuery) {
    const minha = ++vez
    temApp.value = null
    if (!pacienteId) {
      lendo.value = false
      return
    }
    lendo.value = true
    try {
      const vinculo = await obterVinculo(pacienteId, params)
      if (minha === vez) temApp.value = vinculo != null
    } catch {
      /* Sem a leitura, o interruptor fica desligado e a recepção decide. */
      if (minha === vez) temApp.value = null
    } finally {
      if (minha === vez) lendo.value = false
    }
  }

  /** O que vai no corpo do criar, do mover e do cancelar. */
  function corpo() {
    return pedidoDoAviso(avisar.value, mensagem.value)
  }

  return { temApp, avisar, mensagem, tamanho, longa, lendo, reiniciar, lerVinculo, corpo }
}

export type AvisoAoResponsavel = ReturnType<typeof useAvisoAoResponsavel>
