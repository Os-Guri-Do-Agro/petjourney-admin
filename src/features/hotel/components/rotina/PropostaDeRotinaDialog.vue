<script setup lang="ts">
/**
 * A proposta de rotina em diálogo, para a ficha da estadia.
 *
 * O conteúdo inteiro mora em `PropostaDeRotina` — este arquivo só o embrulha. Existem porque os
 * dois lugares pedem formas diferentes:
 *
 * - Na **prancheta do turno** a proposta fica na coluna da direita, ao lado da lista que ela vai
 *   alterar. Ver as duas ao mesmo tempo é o que permite discordar com base em alguma coisa.
 * - Na **ficha da estadia** a página já é um dossiê denso, e a casa resolve toda decisão que
 *   produz registro em diálogo — `CheckInDialog`, `CheckOutDialog`, `PassagemDialog`. Abrir uma
 *   terceira forma só para esta seria inventar um padrão novo numa tela que já tem o dela.
 *
 * Duas formas, um conteúdo. Duplicar o painel para ganhar um diálogo seria duplicar a parede da
 * medicação junto, e parede copiada é parede que diverge.
 */
import Dialog from 'primevue/dialog'
import { useI18n } from 'vue-i18n'

import PropostaDeRotina from './PropostaDeRotina.vue'
import type { HospedeParaRotina } from '../../data/repositories'
import type { ClockTime, TarefaDaCasaKind } from '../../data/types'
import type { PropostaDeRotina as Proposta } from '../../domain/rotina-sugerida'

defineProps<{
  aberto: boolean
  hospedes: HospedeParaRotina[]
  hospedagemId: string
  proposta: Proposta | null
  gerando: boolean
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  'atualizar:hospedagemId': [id: string]
  aprovar: [
    payload: {
      hospedagemId: string
      sugestoes: { kind: TarefaDaCasaKind; horarios: ClockTime[]; motivo: string }[]
    },
  ]
}>()

const { t } = useI18n()
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.proposta.titulo')"
    :style="{ width: 'min(44rem, 94vw)' }"
    class="clinic-dialog"
    @update:visible="emit('fechar')"
  >
    <PropostaDeRotina
      :hospedes="hospedes"
      :hospedagem-id="hospedagemId"
      :proposta="proposta"
      :gerando="gerando"
      :salvando="salvando"
      :erro="erro"
      @fechar="emit('fechar')"
      @atualizar:hospedagem-id="(id: string) => emit('atualizar:hospedagemId', id)"
      @aprovar="(payload) => emit('aprovar', payload)"
    />
  </Dialog>
</template>
