<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputOtp from 'primevue/inputotp'
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

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  vinculado: [detalhe: CompartilhamentoDetalhe]
}>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

/** 6 caixas, separadas visualmente em dois grupos de 3. */
const TAMANHO_CODIGO = 6
const POSICAO_SEPARADOR = 3

const codigoInput = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const throttledSeconds = ref(0)
const otpWrapper = ref<HTMLElement | null>(null)
let throttleTimer: ReturnType<typeof setInterval> | null = null

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

/** O Dialog só monta o conteúdo ao abrir; o foco tem que esperar o `show`. */
function focusPrimeiroDigito() {
  otpWrapper.value?.querySelector('input')?.focus()
}

function onCodigoModel(value: string | undefined) {
  codigoInput.value = value ?? ''
  errorMessage.value = ''
}

async function handleVincular() {
  if (!canSubmit.value) {
    if (!isCodigoVinculoValido(codigo.value)) {
      errorMessage.value = t('acessos.vincular.codigoInvalidoFormato')
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
        errorMessage.value = t('acessos.vincular.throttle')
        startThrottle()
      } else if (err.statusCode === 404) {
        errorMessage.value = t('acessos.vincular.naoEncontrado')
      } else if (err.statusCode === 409) {
        errorMessage.value = t('acessos.vincular.outraEmpresa')
      } else if (err.statusCode === 403) {
        errorMessage.value = t('acessos.vincular.naoOperacional')
      } else if (err.statusCode === 400) {
        errorMessage.value = t('acessos.vincular.codigoInvalidoFormato')
      } else {
        errorMessage.value = err.message
      }
    } else {
      errorMessage.value =
        err instanceof Error ? err.message : t('acessos.vincular.erroGenerico')
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
    class="vincular-dialog"
    :pt="{ root: { class: 'vincular-dialog' } }"
    @show="focusPrimeiroDigito"
  >
    <template #container="{ closeCallback }">
      <div class="vincular-dialog__shell" role="document" aria-labelledby="vinculo-title">
        <Button
          class="vincular-dialog__close"
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          :aria-label="t('common.close')"
          :disabled="submitting"
          @click="closeCallback"
        />

        <div class="vincular-dialog__badge" aria-hidden="true">
          <i class="ph ph-key" />
        </div>

        <h2 id="vinculo-title" class="vincular-dialog__title">
          {{ t('acessos.vincular.title') }}
        </h2>
        <p class="vincular-dialog__lede">{{ t('acessos.vincular.lede') }}</p>

        <div class="vincular-dialog__field">
          <label id="vinculo-codigo-label">{{ t('acessos.vincular.codigoLabel') }}</label>

          <div
            ref="otpWrapper"
            class="vincular-dialog__otp"
            role="group"
            aria-labelledby="vinculo-codigo-label"
            :aria-describedby="errorMessage ? 'vinculo-codigo-error' : 'vinculo-codigo-hint'"
            @keydown.enter.prevent="handleVincular"
          >
            <InputOtp
              :model-value="codigoInput"
              :length="TAMANHO_CODIGO"
              integer-only
              :disabled="submitting"
              @update:model-value="onCodigoModel"
            >
              <template #default="{ attrs, events, index }">
                <InputText
                  v-bind="attrs"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="1"
                  class="p-inputotp-input vincular-dialog__digit"
                  :class="{ 'vincular-dialog__digit--invalid': Boolean(errorMessage) }"
                  :disabled="submitting"
                  :invalid="Boolean(errorMessage)"
                  :aria-label="t('acessos.vincular.digitoAria', { n: index })"
                  v-on="events"
                />
                <span
                  v-if="index === POSICAO_SEPARADOR"
                  class="vincular-dialog__separator"
                  aria-hidden="true"
                  >-</span
                >
              </template>
            </InputOtp>
          </div>

          <small id="vinculo-codigo-hint" class="vincular-dialog__hint">
            {{ t('acessos.vincular.hint') }}
          </small>
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
          class="vincular-dialog__enviar"
          :label="
            throttledSeconds > 0
              ? t('acessos.vincular.aguarde', { s: throttledSeconds })
              : t('acessos.vincular.submit')
          "
          icon="ph ph-link"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="handleVincular"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/*
 * O painel é desenhado aqui (slot `#container`), nos tokens do Trilha: o overlay vai para o
 * `body`, e a raiz `html.trilha` já leva os dois temas até ele.
 */
.vincular-dialog__shell {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 8px;
  width: min(27rem, calc(100vw - 2rem));
  padding: 32px 28px 24px;
  border: 1px solid var(--linha);
  border-radius: 20px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
  color: var(--tinta);
}

.vincular-dialog__close.p-button {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--tinta-2);
}

.vincular-dialog__close.p-button:not(:disabled):hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

/* O ladrilho do Portal, no degradê do lugar, como o título das telas. */
.vincular-dialog__badge {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 17px;
  background: var(--pj-lugar-degrade, var(--portal));
  box-shadow:
    var(--pj-lugar-sombra, var(--sombra-1)),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  color: #fff;
  font-size: 26px;
}

.app-dark .vincular-dialog__badge {
  color: var(--rail);
}

.vincular-dialog__title {
  margin: 8px 0 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
  text-align: center;
}

.vincular-dialog__lede {
  max-width: 34ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
  text-align: center;
}

.vincular-dialog__field {
  display: grid;
  gap: 8px;
  justify-items: stretch;
  width: 100%;
  margin-top: 14px;
}

.vincular-dialog__field label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
  text-align: center;
}

.vincular-dialog__otp :deep(.p-inputotp) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* As seis caixas do código: algarismos grandes, de mesma largura. */
.vincular-dialog__digit.p-inputtext {
  width: clamp(2.4rem, 11vw, 3rem);
  height: 3.5rem;
  padding: 0;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  text-align: center;
  outline: none;
  box-shadow: none;
}

.vincular-dialog__digit.p-inputtext:enabled:focus {
  border-color: var(--musgo);
  background: var(--superficie);
  box-shadow: var(--anel-foco);
}

.vincular-dialog__digit.p-inputtext:disabled {
  opacity: 0.6;
}

.vincular-dialog__digit--invalid.p-inputtext {
  border-color: var(--risco);
  background: var(--risco-fundo);
}

.vincular-dialog__separator {
  color: var(--tinta-3);
  font-size: 20px;
  font-weight: 600;
  /* Não entra na navegação entre caixas: o InputOtp pula irmãos que não são input. */
  user-select: none;
}

.vincular-dialog__enviar.p-button {
  width: 100%;
  min-height: 46px;
  margin-top: 16px;
  font-size: 15px;
}

.vincular-dialog__hint {
  color: var(--tinta-2);
  font-size: 13px;
  text-align: center;
}

.vincular-dialog__error {
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 550;
  text-align: center;
}
</style>

<style>
/* O painel é o `.vincular-dialog__shell`; o do PrimeVue fica transparente em volta dele. */
.vincular-dialog.p-dialog,
.vincular-dialog .p-dialog {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.vincular-dialog .p-dialog-content {
  padding: 0 !important;
  background: transparent !important;
}
</style>
