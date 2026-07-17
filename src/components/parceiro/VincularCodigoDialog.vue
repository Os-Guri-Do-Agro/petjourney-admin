<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  isCodigoVinculoValido,
  normalizarCodigoVinculo,
  vincularCompartilhamento,
} from '@/service/parceiro/compartilhamentos-service'
import type { CompartilhamentoDetalhe } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  vinculado: [detalhe: CompartilhamentoDetalhe]
}>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const codigoInput = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const throttledSeconds = ref(0)
let throttleTimer: ReturnType<typeof setInterval> | null = null

const dialogStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--vk-bg': colors.dashboard.surface,
    '--vk-text': colors.dashboard.text,
    '--vk-muted': colors.dashboard.muted,
    '--vk-line': colors.dashboard.line,
    '--vk-warm-bg': colors.dashboard.warmBg,
    '--vk-warm-text': colors.dashboard.warmText,
  }
})

const codigo = computed(() => normalizarCodigoVinculo(codigoInput.value))
const canSubmit = computed(
  () => !submitting.value && throttledSeconds.value === 0 && isCodigoVinculoValido(codigo.value),
)

function clearThrottle() {
  if (throttleTimer) {
    clearInterval(throttleTimer)
    throttleTimer = null
  }

  throttledSeconds.value = 0
}

/** 429: throttle de 10 tentativas/min; desabilita por 60s. */
function startThrottle() {
  throttledSeconds.value = 60
  throttleTimer = setInterval(() => {
    throttledSeconds.value -= 1

    if (throttledSeconds.value <= 0) {
      clearThrottle()
    }
  }, 1000)
}

watch(visible, (open) => {
  if (open) {
    codigoInput.value = ''
    errorMessage.value = ''
  }
})

onBeforeUnmount(() => {
  clearThrottle()
})

function onCodigoModel(value: string | undefined) {
  codigoInput.value = value ?? ''
  errorMessage.value = ''
}

async function handleVincular() {
  if (!canSubmit.value) {
    if (!isCodigoVinculoValido(codigo.value)) {
      errorMessage.value = t('atendimentos.vincular.codigoInvalidoFormato')
    }
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const detalhe = await vincularCompartilhamento(codigo.value, parceiroQuery())
    visible.value = false
    emit('vinculado', detalhe)
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.statusCode === 429) {
        errorMessage.value = t('atendimentos.vincular.throttle')
        startThrottle()
      } else if (err.statusCode === 404) {
        errorMessage.value = t('atendimentos.vincular.naoEncontrado')
      } else if (err.statusCode === 409) {
        errorMessage.value = t('atendimentos.vincular.outraEmpresa')
      } else if (err.statusCode === 403) {
        errorMessage.value = t('atendimentos.vincular.naoOperacional')
      } else if (err.statusCode === 400) {
        errorMessage.value = t('atendimentos.vincular.codigoInvalidoFormato')
      } else {
        errorMessage.value = err.message
      }
    } else {
      errorMessage.value =
        err instanceof Error ? err.message : t('atendimentos.vincular.erroGenerico')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :style="dialogStyle"
    class="vincular-dialog"
    :header="t('atendimentos.vincular.title')"
  >
    <div class="vincular-dialog__body">
      <p class="vincular-dialog__lede">{{ t('atendimentos.vincular.lede') }}</p>

      <div class="vincular-dialog__field">
        <label for="vinculo-codigo">{{ t('atendimentos.vincular.codigoLabel') }}</label>
        <InputText
          id="vinculo-codigo"
          class="vincular-dialog__code-input"
          :model-value="codigoInput"
          :placeholder="t('atendimentos.vincular.codigoPlaceholder')"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="12"
          :invalid="Boolean(errorMessage)"
          :aria-describedby="errorMessage ? 'vinculo-codigo-error' : undefined"
          @update:model-value="onCodigoModel"
          @keydown.enter.prevent="handleVincular"
        />
        <small class="vincular-dialog__hint">{{ t('atendimentos.vincular.hint') }}</small>
        <small
          v-if="errorMessage"
          id="vinculo-codigo-error"
          class="vincular-dialog__error"
          role="alert"
        >
          {{ errorMessage }}
        </small>
      </div>

      <Button
        :label="
          throttledSeconds > 0
            ? t('atendimentos.vincular.aguarde', { s: throttledSeconds })
            : t('atendimentos.vincular.submit')
        "
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleVincular"
      />
    </div>
  </Dialog>
</template>

<style scoped>
.vincular-dialog__body {
  display: grid;
  gap: 0.9rem;
  min-width: min(22rem, 80vw);
}

.vincular-dialog__lede {
  margin: 0;
  color: var(--vk-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.vincular-dialog__field {
  display: grid;
  gap: 0.35rem;
}

.vincular-dialog__field label {
  color: var(--vk-text);
  font-size: 0.82rem;
  font-weight: 650;
}

.vincular-dialog__code-input {
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.2rem;
  font-weight: 650;
  letter-spacing: 0.4em;
}

.vincular-dialog__code-input::placeholder {
  letter-spacing: 0.4em;
}

.vincular-dialog__body > :deep(.p-button) {
  width: 100%;
}

.vincular-dialog__hint {
  color: var(--vk-muted);
  font-size: 0.75rem;
}

.vincular-dialog__error {
  color: var(--vk-warm-text);
  font-size: 0.8rem;
}
</style>
