<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { StatusAuditoriaParceiro, StatusModoParceiro } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'

const props = defineProps<{
  status: StatusAuditoriaParceiro | StatusModoParceiro
}>()

const { t, te } = useI18n()

const badgeStyle = computed(() => {
  const colors = currentColors.value

  const defaultTone = {
    bg: colors.dashboard.mutedPillBg,
    text: colors.dashboard.mutedPillText,
    border: colors.dashboard.line,
  }

  const toneMap: Record<string, { bg: string; text: string; border: string }> = {
    APROVADO: {
      bg: colors.dashboard.successBg,
      text: colors.dashboard.successText,
      border: colors.dashboard.line,
    },
    ATIVO: {
      bg: colors.dashboard.successBg,
      text: colors.dashboard.successText,
      border: colors.dashboard.line,
    },
    PENDENTE: {
      bg: colors.dashboard.amberBg,
      text: colors.dashboard.amberText,
      border: colors.dashboard.line,
    },
    SOLICITADO: {
      bg: colors.dashboard.amberBg,
      text: colors.dashboard.amberText,
      border: colors.dashboard.line,
    },
    REJEITADO: {
      bg: colors.dashboard.warmBg,
      text: colors.dashboard.warmText,
      border: colors.dashboard.warmLine,
    },
    SUSPENSO: {
      bg: colors.dashboard.warmBg,
      text: colors.dashboard.warmText,
      border: colors.dashboard.warmLine,
    },
    NAO_SOLICITADO: defaultTone,
  }

  const tone = toneMap[props.status] ?? defaultTone

  return {
    '--badge-bg': tone.bg,
    '--badge-text': tone.text,
    '--badge-border': tone.border,
  }
})

const label = computed(() => {
  const key = `statusBadge.${props.status}`
  return te(key) ? t(key) : props.status
})
</script>

<template>
  <span class="partner-status-badge" :style="badgeStyle">{{ label }}</span>
</template>

<style scoped>
.partner-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.62rem;
  border: 1px solid var(--badge-border);
  border-radius: 999px;
  background: var(--badge-bg);
  color: var(--badge-text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
</style>
