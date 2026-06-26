<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const visible = defineModel<boolean>('visible', { default: false })

withDefaults(
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
      <section class="confirm-dialog">
        <span class="confirm-dialog__icon">
          <i :class="icon" aria-hidden="true" />
        </span>

        <div class="confirm-dialog__content">
          <h2>{{ title }}</h2>
          <p>{{ message }}</p>
        </div>

        <div class="confirm-dialog__actions">
          <Button :label="cancelLabel" severity="secondary" text type="button" @click="handleCancel" />
          <Button :label="confirmLabel" :severity="severity" type="button" @click="handleConfirm" />
        </div>
      </section>
    </template>
  </Dialog>
</template>

<style scoped>
.confirm-dialog {
  width: min(26rem, calc(100vw - 2rem));
  padding: 1.5rem;
  border: 1px solid #edf0f4;
  border-radius: 1.35rem;
  background: #fff;
  box-shadow: 0 24px 70px rgb(29 53 87 / 0.18);
}

.confirm-dialog__icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 1rem;
  background: #fff4f4;
  color: #f28482;
}

.confirm-dialog__icon .pi {
  font-size: 1.25rem;
}

.confirm-dialog__content {
  margin-top: 1rem;
}

.confirm-dialog__content h2 {
  margin: 0;
  color: #1d3557;
  font-size: 1.25rem;
  letter-spacing: -0.03em;
}

.confirm-dialog__content p {
  margin: 0.5rem 0 0;
  color: #5b6b8c;
  line-height: 1.6;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.35rem;
}
</style>
