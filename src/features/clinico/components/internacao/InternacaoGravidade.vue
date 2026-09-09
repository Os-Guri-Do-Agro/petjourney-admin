<script setup lang="ts">
/**
 * Gravidade do paciente internado, como chip.
 *
 * Delega ao `ClinicAlertChip` em vez de inventar cor própria, e isso não é economia de código: é
 * o que garante que "crítico" na internação tenha exatamente o mesmo tratamento visual —
 * ícone, borda, contraste — que "risco" tem no prontuário. Duas escalas de gravidade parecidas
 * mas diferentes na mesma tela é como a leitura rápida deixa de ser confiável.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import type { AlertSeverity, GravidadeClinica } from '../../data/types'

const props = withDefaults(
  defineProps<{
    gravidade: GravidadeClinica
    compacto?: boolean
  }>(),
  { compacto: false },
)

const { t } = useI18n()

const SEVERIDADE: Record<GravidadeClinica, AlertSeverity> = {
  estavel: 'info',
  atencao: 'atencao',
  critico: 'risco',
}

const ICONE: Record<GravidadeClinica, string> = {
  estavel: 'pi pi-check-circle',
  atencao: 'pi pi-eye',
  critico: 'pi pi-exclamation-triangle',
}

const severidade = computed(() => SEVERIDADE[props.gravidade])
const icone = computed(() => ICONE[props.gravidade])
const rotulo = computed(() => t(`clinico.internacao.gravidade.${props.gravidade}`))
</script>

<template>
  <ClinicAlertChip
    :severidade="severidade"
    :rotulo="rotulo"
    :icone="icone"
    :compacto="compacto"
  />
</template>
