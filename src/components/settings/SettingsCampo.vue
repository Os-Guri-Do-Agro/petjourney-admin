<script setup lang="ts">
/**
 * O campo de texto das telas da conta (Perfil, Segurança).
 *
 * A entrada (login, cadastro, senha) usa o `AuthTextField`, do desenho dela.
 *
 * Rótulo em cima, caixa grande e o que der errado embaixo, com ícone e em vermelho: a pessoa lê o
 * erro onde está olhando, e não num aviso no canto da tela. A dica e o erro ficam ligados à caixa
 * (`aria-describedby`), então o leitor de tela diz os dois junto com o rótulo.
 *
 * `revelavel` põe o "Mostrar" dentro da caixa de senha — com a palavra, e não só o olho: quem
 * digita no balcão, com pressa, confere o que digitou antes de errar de novo.
 *
 * Só tokens do Trilha.
 */
import InputText from 'primevue/inputtext'
import { computed, ref, useAttrs, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({
  inheritAttrs: false,
})

const model = defineModel<string>({ default: '' })
const slots = useSlots()
const attrs = useAttrs()
const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    type?: string
    placeholder?: string
    autocomplete?: string
    required?: boolean
    hint?: string
    error?: string
    /** Senha com o botão "Mostrar" dentro da caixa. */
    revelavel?: boolean
  }>(),
  {
    type: 'text',
    placeholder: '',
    autocomplete: undefined,
    required: false,
    hint: '',
    error: '',
    revelavel: false,
  },
)

const visivel = ref(false)

const hasLabel = computed(() => Boolean(props.label))
const hasLeadingSlot = computed(() => Boolean(slots.leading))
const comMostrar = computed(() => props.revelavel && props.type === 'password')
const hasTrailingSlot = computed(() => Boolean(slots.trailing) || comMostrar.value)
const tipo = computed(() => (comMostrar.value && visivel.value ? 'text' : props.type))

const desligado = computed(() => attrs.disabled === true || attrs.disabled === '')

const idDaNota = computed(() => (props.error || props.hint ? `${props.id}-nota` : undefined))
</script>

<template>
  <div class="auth-text-field">
    <label v-if="hasLabel" class="auth-text-field__label" :for="id">
      {{ label }}
      <span v-if="required" class="auth-text-field__required" aria-hidden="true">*</span>
    </label>

    <span class="auth-text-field__control">
      <span v-if="hasLeadingSlot" class="auth-text-field__leading">
        <slot name="leading" />
      </span>

      <InputText
        v-bind="$attrs"
        :id="id"
        v-model="model"
        class="auth-text-field__input"
        :class="{
          'auth-text-field__input--with-leading': hasLeadingSlot,
          'auth-text-field__input--with-trailing': hasTrailingSlot,
          'auth-text-field__input--com-mostrar': comMostrar,
          'auth-text-field__input--invalid': Boolean(error),
        }"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :required="required"
        :type="tipo"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="idDaNota"
      />

      <span v-if="hasTrailingSlot" class="auth-text-field__trailing">
        <slot name="trailing">
          <button
            type="button"
            class="auth-text-field__mostrar"
            :aria-label="visivel ? t('auth.login.password.hide') : t('auth.login.password.show')"
            :aria-pressed="visivel"
            :aria-controls="id"
            :disabled="desligado"
            @click="visivel = !visivel"
          >
            <i :class="visivel ? 'ph ph-eye-slash' : 'ph ph-eye'" aria-hidden="true" />
            <span>{{ visivel ? t('auth.campo.ocultar') : t('auth.campo.mostrar') }}</span>
          </button>
        </slot>
      </span>
    </span>

    <span v-if="error" :id="idDaNota" class="auth-text-field__error" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      {{ error }}
    </span>

    <span v-else-if="hint" :id="idDaNota" class="auth-text-field__hint">
      {{ hint }}
    </span>
  </div>
</template>

<style scoped>
.auth-text-field {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.auth-text-field__label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.3;
}

.auth-text-field__required {
  margin-inline-start: 2px;
  color: var(--risco-tinta);
}

.auth-text-field__control {
  position: relative;
  display: block;
}

.auth-text-field__input.p-inputtext {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: none;
  caret-color: var(--musgo);
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 15.5px;
  line-height: 1.4;
  transition:
    border-color var(--pj-tempo-curto) var(--pj-curva-chega),
    box-shadow var(--pj-tempo-curto) var(--pj-curva-chega);
}

.auth-text-field__input.p-inputtext:enabled:hover {
  border-color: var(--tinta-2);
}

.auth-text-field__input.p-inputtext:enabled:focus {
  border-color: var(--musgo);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--musgo) 22%, transparent);
  outline: none;
}

.auth-text-field__input.p-inputtext:disabled {
  border-color: var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  opacity: 1;
}

.auth-text-field__input::placeholder {
  color: var(--tinta-3);
}

.auth-text-field__input--with-leading.p-inputtext {
  padding-inline-start: 44px;
}

.auth-text-field__input--with-trailing.p-inputtext {
  padding-inline-end: 48px;
}

/* O "Mostrar" com a palavra pede mais espaço do que o olho sozinho. */
.auth-text-field__input--com-mostrar.p-inputtext {
  padding-inline-end: 104px;
}

.auth-text-field__input--invalid.p-inputtext,
.auth-text-field__input--invalid.p-inputtext:enabled:hover {
  border-color: var(--risco);
}

.auth-text-field__input--invalid.p-inputtext:enabled:focus {
  border-color: var(--risco);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--risco) 22%, transparent);
}

.auth-text-field__leading,
.auth-text-field__trailing {
  position: absolute;
  top: 50%;
  display: inline-flex;
  align-items: center;
  color: var(--tinta-3);
  transform: translateY(-50%);
}

.auth-text-field__leading {
  inset-inline-start: 14px;
  font-size: 18px;
}

.auth-text-field__trailing {
  inset-inline-end: 6px;
}

.auth-text-field__mostrar {
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--musgo);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
}

.auth-text-field__mostrar i {
  font-size: 17px;
}

.auth-text-field__mostrar:hover:not(:disabled) {
  background: var(--musgo-fundo);
}

.auth-text-field__mostrar:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 0;
}

.auth-text-field__mostrar:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.auth-text-field__hint {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.auth-text-field__error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.4;
}

.auth-text-field__error i {
  flex: none;
  margin-top: 1px;
  font-size: 16px;
}

/* No celular, 16 px: abaixo disso o iPhone aproxima a tela ao tocar no campo. */
@media (max-width: 600px) {
  .auth-text-field__input.p-inputtext {
    height: 52px;
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-text-field__input.p-inputtext {
    transition: none;
  }
}
</style>
