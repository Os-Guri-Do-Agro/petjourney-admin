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
    confirmLabel?: string
    cancelLabel?: string
    severity?: 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast'
  }>(),
  {
    title: 'Confirmar ação',
    message: 'Tem certeza que deseja continuar?',
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
    '--confirm-shadow-rgb': colors.auth.shadowRgb,
  }
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
          <h2 class="confirm-dialog__title">{{ props.title }}</h2>
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

.confirm-dialog__title {
  margin: 0;
  color: var(--confirm-text);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.3;
}

.confirm-dialog__message {
  margin: 0;
  color: var(--confirm-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
