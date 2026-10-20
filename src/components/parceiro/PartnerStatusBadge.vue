<script setup lang="ts">
/**
 * O estado do cadastro (ou de um programa) num selo: palavra e ícone na cor do estado — ok para
 * aprovado e ativo, atenção para o que está em análise, risco para recusado e suspenso, neutro
 * para o que não começou.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { StatusAuditoriaParceiro, StatusModoParceiro } from '@/service/parceiro/types'

const props = defineProps<{
  status: StatusAuditoriaParceiro | StatusModoParceiro
}>()

const { t, te } = useI18n()

const TOM: Record<string, { classe: string; icone: string }> = {
  APROVADO: { classe: 'ui-selo--ok', icone: 'ph ph-seal-check' },
  ATIVO: { classe: 'ui-selo--ok', icone: 'ph ph-check-circle' },
  PENDENTE: { classe: 'ui-selo--atencao', icone: 'ph ph-hourglass' },
  SOLICITADO: { classe: 'ui-selo--atencao', icone: 'ph ph-hourglass' },
  REJEITADO: { classe: 'ui-selo--risco', icone: 'ph ph-x-circle' },
  SUSPENSO: { classe: 'ui-selo--risco', icone: 'ph ph-prohibit' },
  NAO_SOLICITADO: { classe: '', icone: 'ph ph-minus-circle' },
}

const tom = computed(() => TOM[props.status] ?? { classe: '', icone: 'ph ph-circle' })

/** O ícone já diz "feito": o "✓" que o texto antigo trazia sai daqui. */
const label = computed(() => {
  const key = `statusBadge.${props.status}`
  return (te(key) ? t(key) : props.status).replace(/\s*✓\s*$/, '')
})
</script>

<template>
  <span class="partner-status-badge ui-selo" :class="tom.classe">
    <i :class="tom.icone" aria-hidden="true" />
    {{ label }}
  </span>
</template>
