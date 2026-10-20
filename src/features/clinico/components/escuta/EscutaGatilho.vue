<script setup lang="ts">
/**
 * "Gravar consulta", no cabeçalho da anamnese.
 *
 * Recolhido de propósito: um botão, e não uma faixa. A anamnese por voz é um jeito de preencher
 * a anamnese, não uma seção dela — e toda consulta que não usa a voz não pode pagar espaço por
 * ela. Depois de começada, quem manda é o painel; o botão sai de cena.
 *
 * Em somente leitura ele continua visível, desligado e com o motivo: sumir faria a pessoa
 * procurar por um recurso que existe.
 *
 * Discreto e óbvio ao mesmo tempo: contornado, como toda ação que não é a da tela, mas com o
 * microfone desenhado e o nome dizendo o que faz — e com altura de alvo de toque.
 */
import { PhMicrophone } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useEscutaStore } from '../../stores/escuta'

const props = defineProps<{
  encounterId: string
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const { t } = useI18n()
const escuta = useEscutaStore()

function gravar() {
  escuta.pedirGravacao(props.encounterId)
}
</script>

<template>
  <Button
    v-if="escuta.fase === 'inativa' || escuta.encounterId !== encounterId"
    :label="t('clinico.escuta.gravar')"
    class="gatilho"
    severity="secondary"
    outlined
    :disabled="somenteLeitura"
    :title="somenteLeitura ? motivoLeitura : t('clinico.escuta.gravarDica')"
    data-fora-do-teclado
    @click="gravar"
  >
    <template #icon>
      <PhMicrophone weight="bold" class="p-button-icon p-button-icon-left" aria-hidden="true" />
    </template>
  </Button>
</template>

<style scoped>
.gatilho.p-button {
  min-height: 38px;
  font-size: 14px;
}

.gatilho :deep(svg) {
  color: var(--risco);
}
</style>
