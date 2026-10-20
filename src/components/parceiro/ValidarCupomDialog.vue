<script setup lang="ts">
/**
 * Validar cupom no balcão (aberto pelo "Validar cupom" da barra lateral).
 *
 * Três momentos na mesma janela: digitar o código que o responsável mostra no app; o desconto
 * confirmado (o número grande é o que a recepção aplica no caixa); ou o motivo de não ter
 * validado, com o caminho de volta. Nos tokens do Trilha, com a cor do Portal no selo.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { validarCupom } from '@/service/parceiro/parceiro-portal-service'
import type { ValidarCupomResultado } from '@/service/parceiro/types'
import {
  isCodigoResgateFormatoValido,
  normalizarCodigoResgate,
  type ValidarCupomErrorView,
} from '@/utils/parceiro/cupom-resgate'

const { t } = useI18n()
const { visible, close, markSuccess, canOpen } = useCupomResgateModal()
const { store, parceiroQuery } = useParceiroPortal()

type Step = 'input' | 'success' | 'error'

const step = ref<Step>('input')
const codigoInput = ref('')
const submitting = ref(false)
const formatHint = ref('')
const errorView = ref<ValidarCupomErrorView | null>(null)
const resultado = ref<ValidarCupomResultado | null>(null)

const codigoNormalizado = computed(() => normalizarCodigoResgate(codigoInput.value))
const codigoLength = computed(() => codigoNormalizado.value.length)

const canSubmit = computed(
  () =>
    !submitting.value &&
    store.podeOperar &&
    isCodigoResgateFormatoValido(codigoNormalizado.value),
)

const lengthTone = computed(() => {
  if (codigoLength.value === 0) {
    return 'idle'
  }

  if (codigoLength.value < 6) {
    return 'short'
  }

  if (isCodigoResgateFormatoValido(codigoNormalizado.value)) {
    return 'ok'
  }

  return 'warn'
})

function resetForm() {
  step.value = 'input'
  codigoInput.value = ''
  formatHint.value = ''
  errorView.value = null
  resultado.value = null
  submitting.value = false
}

watch(visible, () => {
  resetForm()
})

watch(canOpen, (ok) => {
  if (!ok && visible.value) {
    close()
  }
})

function onCodigoModel(value: string | undefined) {
  codigoInput.value = normalizarCodigoResgate(value ?? '')
  formatHint.value = ''
}

function closeDialog() {
  close()
}

function backToInput() {
  step.value = 'input'
  errorView.value = null
  resultado.value = null
}

function startAnother() {
  resetForm()
}

function resolveErrorView(error: unknown): ValidarCupomErrorView {
  if (!(error instanceof ApiError)) {
    const message =
      error instanceof Error ? error.message : t('shell.cupom.errors.generic.message')

    return {
      title: t('shell.cupom.errors.generic.title'),
      message,
      suggestCheckHistorico: true,
    }
  }

  if (error.statusCode === 404) {
    return {
      title: t('shell.cupom.errors.invalid.title'),
      message: t('shell.cupom.errors.invalid.message'),
    }
  }

  if (error.statusCode === 410) {
    return {
      title: t('shell.cupom.errors.expired.title'),
      message: t('shell.cupom.errors.expired.message'),
    }
  }

  if (error.statusCode === 409) {
    return {
      title: t('shell.cupom.errors.conflict.title'),
      message: error.message,
      suggestCheckHistorico: true,
    }
  }

  if (error.statusCode === 403) {
    return {
      title: t('shell.cupom.errors.forbidden.title'),
      message: t('shell.cupom.errors.forbidden.message'),
    }
  }

  if (error.statusCode === 400) {
    return {
      title: t('shell.cupom.errors.noBusiness.title'),
      message: error.message || t('shell.cupom.errors.noBusiness.message'),
    }
  }

  return {
    title: t('shell.cupom.errors.generic.title'),
    message: error.message || t('shell.cupom.errors.generic.messageShort'),
    suggestCheckHistorico: true,
  }
}

async function handleValidar() {
  const codigo = codigoNormalizado.value

  if (!store.podeOperar) {
    errorView.value = {
      title: t('shell.cupom.errors.noOp.title'),
      message: t('shell.cupom.errors.noOp.message'),
    }
    step.value = 'error'
    return
  }

  if (!isCodigoResgateFormatoValido(codigo)) {
    formatHint.value = t('shell.cupom.formatHint')
    return
  }

  submitting.value = true
  formatHint.value = ''
  errorView.value = null

  try {
    const data = await validarCupom(
      { codigo, canal: 'CODIGO_MANUAL' },
      parceiroQuery(),
    )

    resultado.value = data
    step.value = 'success'
    markSuccess()
  } catch (err) {
    errorView.value = resolveErrorView(err)
    step.value = 'error'
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
    class="validar-cupom-dialog"
    :pt="{ root: { class: 'validar-cupom-dialog' } }"
    @hide="closeDialog"
  >
    <template #container="{ closeCallback }">
      <div class="vc" role="document" aria-labelledby="validar-cupom-title">
        <Button
          class="vc__fechar"
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          :aria-label="t('shell.cupom.close')"
          :disabled="submitting"
          @click="closeCallback"
        />

        <!-- ------------------------------------------------ digitar o código -->
        <template v-if="step === 'input'">
          <span class="vc__selo" aria-hidden="true"><i class="ph ph-ticket" /></span>
          <h2 id="validar-cupom-title" class="vc__titulo">{{ t('shell.cupom.title') }}</h2>
          <p class="vc__lede">{{ t('shell.cupom.lede') }}</p>

          <p v-if="!store.podeOperar" class="vc__faixa" role="status">
            <i class="ph ph-lock" aria-hidden="true" />
            <span>{{ t('shell.cupom.blockedBanner') }}</span>
          </p>

          <div class="vc__campo" :data-tone="lengthTone">
            <div class="vc__campo-cab">
              <label for="cupom-resgate-codigo">{{ t('shell.cupom.codeLabel') }}</label>
              <span class="vc__contador ui-num" :data-tone="lengthTone">{{ codigoLength }}/32</span>
            </div>

            <InputText
              id="cupom-resgate-codigo"
              :model-value="codigoInput"
              class="vc__entrada"
              maxlength="32"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('shell.cupom.codePlaceholder')"
              :disabled="submitting || !store.podeOperar"
              :invalid="Boolean(formatHint)"
              aria-describedby="cupom-resgate-hint"
              autofocus
              @update:model-value="onCodigoModel"
              @keydown.enter.prevent="handleValidar"
            />

            <p id="cupom-resgate-hint" class="vc__dica">{{ t('shell.cupom.hint') }}</p>
            <p v-if="formatHint" class="vc__erro" role="alert">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              {{ formatHint }}
            </p>
          </div>
        </template>

        <!-- ------------------------------------------------ validado -->
        <template v-else-if="step === 'success' && resultado">
          <div class="vc__resultado" role="status">
            <span class="vc__selo vc__selo--ok" aria-hidden="true"><i class="ph ph-check" /></span>
            <h2 id="validar-cupom-title" class="vc__titulo">{{ t('shell.cupom.successTitle') }}</h2>

            <p class="vc__desconto">
              <strong class="ui-num">{{ resultado.cupom.descontoPercentual }}%</strong>
              <span>{{ t('shell.cupom.discountLabel') }}</span>
            </p>

            <dl class="vc__ficha">
              <div>
                <dt>{{ t('shell.cupom.meta.campaign') }}</dt>
                <dd>{{ resultado.cupom.titulo }}</dd>
              </div>
              <div>
                <dt>{{ t('shell.cupom.meta.code') }}</dt>
                <dd class="ui-num"><bdi dir="ltr">{{ resultado.cupom.codigo }}</bdi></dd>
              </div>
              <div v-if="resultado.tutorPrimeiroNome">
                <dt>{{ t('shell.cupom.meta.customer') }}</dt>
                <dd>{{ resultado.tutorPrimeiroNome }}</dd>
              </div>
              <div>
                <dt>{{ t('shell.cupom.meta.channel') }}</dt>
                <dd>{{ t('shell.cupom.meta.channelManual') }}</dd>
              </div>
            </dl>
          </div>
        </template>

        <!-- ------------------------------------------------ não validado -->
        <template v-else-if="step === 'error' && errorView">
          <div class="vc__resultado" role="alert">
            <span class="vc__selo vc__selo--risco" aria-hidden="true">
              <i class="ph ph-warning-circle" />
            </span>
            <h2 id="validar-cupom-title" class="vc__titulo">{{ errorView.title }}</h2>
            <p class="vc__lede">{{ errorView.message }}</p>
            <p v-if="errorView.suggestCheckHistorico" class="vc__nota">
              {{ t('shell.cupom.networkHintBefore') }}
              <RouterLink class="ui-mais" to="/parceiro/divulgacao#resgates" @click="closeDialog">
                {{ t('shell.cupom.networkHintLink') }}
              </RouterLink>
              {{ t('shell.cupom.networkHintAfter') }}
            </p>
          </div>
        </template>

        <footer class="vc__pe">
          <template v-if="step === 'input'">
            <Button
              :label="t('common.cancel')"
              severity="secondary"
              text
              type="button"
              :disabled="submitting"
              @click="closeDialog"
            />
            <Button
              class="vc__cta"
              :label="t('shell.cupom.submit')"
              icon="ph ph-check"
              type="button"
              :loading="submitting"
              :disabled="!canSubmit || submitting"
              @click="handleValidar"
            />
          </template>

          <template v-else-if="step === 'success'">
            <Button
              :label="t('shell.cupom.validateAnother')"
              severity="secondary"
              text
              type="button"
              @click="startAnother"
            />
            <Button
              class="vc__cta"
              :label="t('shell.cupom.applyOk')"
              icon="ph ph-check"
              type="button"
              @click="closeDialog"
            />
          </template>

          <template v-else>
            <Button
              :label="t('shell.cupom.close')"
              severity="secondary"
              text
              type="button"
              @click="closeDialog"
            />
            <Button
              class="vc__cta"
              :label="t('common.tryAgain')"
              icon="ph ph-arrow-clockwise"
              type="button"
              @click="backToInput"
            />
          </template>
        </footer>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/*
 * O painel é desenhado aqui (slot `#container`), nos tokens do Trilha: o overlay vai para o
 * `body`, e a raiz `html.trilha` já leva os dois temas até ele.
 */
.vc {
  position: relative;
  display: grid;
  justify-items: center;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  width: min(30rem, calc(100vw - 2rem));
  max-height: min(92vh, 48rem);
  overflow: auto;
  padding: 32px 28px 22px;
  border: 1px solid var(--linha);
  border-radius: 20px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
  color: var(--tinta);

  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);
}

.vc__fechar.p-button {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

.vc__selo {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 18px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-size: 26px;
}

.vc__selo--ok {
  border-radius: 999px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.vc__selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.vc__titulo {
  margin: 8px 0 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
  text-align: center;
}

.vc__lede {
  max-width: 36ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
  text-align: center;
}

.vc__faixa {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.vc__faixa i {
  margin-top: 2px;
  color: var(--atencao-tinta);
}

.vc__campo {
  display: grid;
  width: 100%;
  gap: 8px;
  margin-top: 14px;
}

.vc__campo-cab {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.vc__campo-cab label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.vc__contador {
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 600;
}

.vc__contador[data-tone='short'],
.vc__contador[data-tone='warn'] {
  color: var(--atencao-tinta);
}

.vc__contador[data-tone='ok'] {
  color: var(--ok-tinta);
}

/* O código grande, centrado, em algarismos de mesma largura: é o que se confere com o app. */
.vc__entrada.p-inputtext {
  width: 100%;
  height: 64px;
  border: 1px solid var(--linha-forte);
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 26px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  text-align: center;
  caret-color: var(--musgo);
}

.vc__entrada.p-inputtext::placeholder {
  color: var(--tinta-3);
  font-weight: 500;
}

.vc__entrada.p-inputtext:enabled:focus {
  border-color: var(--musgo);
  background: var(--superficie);
  box-shadow: var(--anel-foco);
}

.vc__campo[data-tone='ok'] .vc__entrada.p-inputtext {
  border-color: var(--ok);
}

.vc__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
}

.vc__erro {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.45;
}

.vc__erro i {
  margin-top: 2px;
}

.vc__resultado {
  display: grid;
  width: 100%;
  justify-items: center;
  gap: 8px;
}

/* O desconto: o número que a recepção aplica no caixa. */
.vc__desconto {
  display: grid;
  justify-items: center;
  gap: 0;
  margin: 6px 0 4px;
}

.vc__desconto strong {
  color: var(--tinta);
  font-size: 52px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1;
}

.vc__desconto span {
  color: var(--tinta-2);
  font-size: 14px;
}

.vc__ficha {
  display: grid;
  width: 100%;
  margin: 8px 0 0;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.vc__ficha > div {
  display: grid;
  min-width: 0;
  gap: 2px;
  margin-block-end: -1px;
  margin-inline-end: -1px;
  padding: 12px 14px;
  border-inline-end: 1px solid var(--linha);
  border-block-end: 1px solid var(--linha);
}

.vc__ficha dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.vc__ficha dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.vc__nota {
  max-width: 40ch;
  margin: 6px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
  text-align: center;
}

.vc__nota .ui-mais {
  display: inline;
}

.vc__pe {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  margin-top: 18px;
}

@media (max-width: 520px) {
  .vc {
    padding: 28px 18px 18px;
  }

  .vc__ficha {
    grid-template-columns: minmax(0, 1fr);
  }

  .vc__pe {
    flex-direction: column-reverse;
  }

  .vc__pe :deep(.p-button) {
    width: 100%;
  }
}
</style>

<style>
.validar-cupom-dialog.p-dialog,
.validar-cupom-dialog .p-dialog {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.validar-cupom-dialog .p-dialog-content {
  padding: 0 !important;
  background: transparent !important;
}
</style>
