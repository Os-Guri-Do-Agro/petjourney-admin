<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'

import { currentColors } from '@/theme/color-mode'

const visible = defineModel<boolean>('visible', { default: false })

const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    icon?: string
    confirmLabel?: string
    cancelLabel?: string
    severity?: 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast'
  }>(),
  {
    title: 'Confirmar ação',
    message: 'Tem certeza que deseja continuar?',
    icon: 'pi pi-exclamation-triangle',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    severity: 'danger',
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--confirm-bg': colors.auth.white,
    '--confirm-text': colors.auth.text,
    '--confirm-muted': colors.auth.muted,
    '--confirm-danger': colors.red,
    '--confirm-danger-bg': colors.dashboard.warmBg,
    '--confirm-shadow-rgb': colors.auth.shadowRgb,
  }
})

const confirmIcon = computed(() => {
  return props.icon
})

function handleCancel() {
  visible.value = false
  emit('cancel')
}

function handleConfirm() {
  visible.value = false
  emit('confirm')
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :draggable="false" class="confirm-action-dialog">
    <template #container>
      <Card class="confirm-dialog" :style="dialogStyle">
        <template #title>
          <div class="confirm-dialog__header">
            <span class="confirm-dialog__icon">
              <i :class="confirmIcon" aria-hidden="true" />
            </span>
            <span>{{ props.title }}</span>
          </div>
        </template>

        <template #content>
          <p class="confirm-dialog__message">{{ props.message }}</p>
        </template>

        <template #footer>
          <div class="confirm-dialog__actions">
            <Button
              :label="props.cancelLabel"
              severity="secondary"
              text
              type="button"
              @click="handleCancel"
            />
            <Button
              :label="props.confirmLabel"
              :severity="props.severity"
              type="button"
              @click="handleConfirm"
            />
          </div>
        </template>
      </Card>
    </template>
  </Dialog>
</template>

<style scoped>
.confirm-dialog,
.confirm-dialog.p-card {
  width: min(26rem, calc(100vw - 2rem));
  border: 0 !important;
  border-radius: 1.35rem;
  background: var(--confirm-bg);
  box-shadow: 0 24px 70px rgb(var(--confirm-shadow-rgb) / 0.18);
  outline: 0 !important;
  overflow: hidden !important;
}

.confirm-dialog:focus,
.confirm-dialog:focus-visible,
.confirm-dialog.p-card:focus,
.confirm-dialog.p-card:focus-visible {
  border: 0 !important;
  outline: 0 !important;
}

.confirm-action-dialog :deep(.p-dialog),
.confirm-action-dialog :deep(.p-dialog-content),
.confirm-action-dialog :deep(.p-dialog-header) {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none;
}

.confirm-dialog :deep(.p-card-body) {
  gap: 1.05rem;
  padding: 1.25rem;
  border: 0;
  border-radius: inherit;
  background: var(--confirm-bg);
}

.confirm-dialog :deep(.p-card-title),
.confirm-dialog :deep(.p-card-content),
.confirm-dialog :deep(.p-card-footer) {
  padding: 0;
}

.confirm-dialog__header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  color: var(--confirm-text);
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.confirm-dialog__icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.92rem;
  background: var(--confirm-danger-bg);
  color: var(--confirm-danger);
}

.confirm-dialog__icon .pi {
  font-size: 1.25rem;
}

.confirm-dialog__message {
  margin: 0;
  color: var(--confirm-muted);
  line-height: 1.6;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
