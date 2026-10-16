<script setup lang="ts">
/**
 * A moldura das etapas: o título da etapa, o voltar e a troca de uma etapa para a outra.
 *
 * Não sabe onde está — no celular do app ou na página pública. Quem a monta cria o fluxo
 * (`criarFluxoDoPedido`) e o entrega por `proverFluxo`; as etapas leem dali.
 *
 * A troca de etapa desliza um pouco na direção da leitura: diz "avançou" ou "voltou" e some em
 * 160 ms. Com movimento reduzido, troca seca.
 */
import Button from 'primevue/button'
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import EtapaClinica from './EtapaClinica.vue'
import EtapaCompletar from './EtapaCompletar.vue'
import EtapaEmergencia from './EtapaEmergencia.vue'
import EtapaEnviado from './EtapaEnviado.vue'
import EtapaHorario from './EtapaHorario.vue'
import EtapaInicio from './EtapaInicio.vue'
import EtapaModo from './EtapaModo.vue'
import EtapaMotivo from './EtapaMotivo.vue'
import EtapaPets from './EtapaPets.vue'
import EtapaPreferencia from './EtapaPreferencia.vue'
import EtapaProfissional from './EtapaProfissional.vue'
import EtapaRevisar from './EtapaRevisar.vue'
import EtapaSeusDados from './EtapaSeusDados.vue'
import { useFluxo, type EtapaDoFluxo } from './fluxo-do-pedido'
import './fluxo.css'

defineProps<{
  /** Endereço da página pública, para o link de acompanhamento depois de enviar. */
  enderecoDoLink?: string
}>()

const { t } = useI18n()
const fluxo = useFluxo()

const ETAPAS: Record<EtapaDoFluxo, Component> = {
  inicio: EtapaInicio,
  pets: EtapaPets,
  completar: EtapaCompletar,
  motivo: EtapaMotivo,
  clinica: EtapaClinica,
  modo: EtapaModo,
  profissional: EtapaProfissional,
  horario: EtapaHorario,
  preferencia: EtapaPreferencia,
  'seus-dados': EtapaSeusDados,
  revisar: EtapaRevisar,
  enviado: EtapaEnviado,
  emergencia: EtapaEmergencia,
}

const etapa = computed(() => fluxo.etapa.value)

const titulo = computed(() => {
  if (etapa.value === 'completar' && fluxo.petIncompleto.value) {
    return t('clinico.pedidos.app.etapa.completar', { nome: fluxo.petIncompleto.value.nome })
  }

  return t(`clinico.pedidos.app.etapa.${etapa.value}`)
})
</script>

<template>
  <div class="fx">
    <header v-if="etapa !== 'enviado'" class="fx-topo">
      <Button
        v-if="fluxo.podeVoltar.value"
        class="fx-topo__voltar"
        icon="ph ph-arrow-left"
        text
        rounded
        :aria-label="t('clinico.pedidos.app.voltar')"
        @click="fluxo.voltar()"
      />
      <h3 class="fx-topo__titulo">{{ titulo }}</h3>
    </header>

    <p
      v-if="fluxo.erro.value === 'CLINICA_NAO_RECEBE_PEDIDOS' || fluxo.erro.value === 'FALHA'"
      class="fx-linha fx-linha--risco"
      role="alert"
    >
      <i class="ph ph-warning-circle" aria-hidden="true" />
      {{ t(`clinico.pedidos.app.erro.${fluxo.erro.value}`) }}
    </p>

    <Transition
      :name="fluxo.direcao.value === 'volta' ? 'fx-etapa-volta' : 'fx-etapa'"
      mode="out-in"
    >
      <component
        :is="ETAPAS[etapa]"
        :key="etapa"
        v-bind="etapa === 'enviado' ? { enderecoDoLink } : {}"
      />
    </Transition>
  </div>
</template>

<style scoped>
/* O ícone de voltar espelha no árabe: a seta aponta para onde a leitura volta. */
[dir='rtl'] .fx-topo__voltar :deep(.ph) {
  transform: scaleX(-1);
}
</style>
