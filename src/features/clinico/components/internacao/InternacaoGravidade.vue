<script setup lang="ts">
/**
 * Gravidade do paciente internado, como selo: ícone, cor e palavra.
 *
 * É o mesmo selo de estado do resto do sistema (`ui-selo`), e não uma escala própria: "crítico"
 * na internação tem exatamente a cara que "urgente" tem na pauta do Hoje. Duas escalas de
 * gravidade parecidas mas diferentes na mesma tela é como a leitura rápida deixa de ser confiável.
 *
 * Três canais, de propósito: a cor para quem passa os olhos, o ícone e a palavra para quem lê e
 * para quem não distingue a cor.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GravidadeClinica } from '../../data/types'

const props = withDefaults(
  defineProps<{
    gravidade: GravidadeClinica
    /** Sem o ícone: para linhas apertadas, onde a palavra basta. */
    compacto?: boolean
  }>(),
  { compacto: false },
)

const { t } = useI18n()

const TOM: Record<GravidadeClinica, 'ok' | 'atencao' | 'risco'> = {
  estavel: 'ok',
  atencao: 'atencao',
  critico: 'risco',
}

const ICONE: Record<GravidadeClinica, string> = {
  estavel: 'ph ph-check-circle',
  atencao: 'ph ph-warning',
  critico: 'ph ph-warning-octagon',
}

const rotulo = computed(() => t(`clinico.internacao.gravidade.${props.gravidade}`))
</script>

<template>
  <span class="ui-selo gravidade" :class="`ui-selo--${TOM[gravidade]}`">
    <i v-if="!compacto" :class="ICONE[gravidade]" aria-hidden="true" />
    {{ rotulo }}
  </span>
</template>
