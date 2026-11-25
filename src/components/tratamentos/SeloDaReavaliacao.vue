<script setup lang="ts">
/**
 * O selo da reavaliação do uso contínuo na linha do tratamento (PJ-HC2AKL, guia 9): "Reavaliar em
 * 10/03", "Reavaliação vencida" em destaque (a deixa para chamar o paciente) ou a resposta do
 * responsável. Sem data, sem resposta ou sem compartilhar, não aparece.
 */
import { computed } from 'vue'

import { useFrasesDaAdesao, type ReavaliacaoDaAdesao } from './useFrasesDaAdesao'

const props = defineProps<{ item: ReavaliacaoDaAdesao }>()

const frases = useFrasesDaAdesao()
const selo = computed(() => frases.reavaliacao(props.item))
</script>

<template>
  <span
    v-if="selo"
    class="ui-selo"
    :class="selo.vencida ? 'ui-selo--atencao' : 'ui-selo--contorno'"
  >
    <i v-if="selo.vencida" class="ph ph-calendar-x" aria-hidden="true" />
    {{ selo.texto }}
  </span>
</template>
