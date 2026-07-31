<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  CategoriaParceiro,
  ParceiroCadastro,
  ParceiroCadastroPayload,
} from '@/service/parceiro/types'
import { formatPhone, stripPhone } from '@/utils/format/phone'
import { formatCnpj, isValidCnpj, stripCnpj } from '@/utils/validation/cnpj'

const props = withDefaults(
  defineProps<{
    initial?: ParceiroCadastro | null
    submitLabel: string
    submitting?: boolean
    /** Campo destacado por erro de unicidade (reason do backend). */
    errorField?: 'nome' | 'cnpj' | null
  }>(),
  {
    initial: null,
    submitting: false,
    errorField: null,
  },
)

const emit = defineEmits<{
  submit: [payload: ParceiroCadastroPayload]
}>()

const { t } = useI18n()

const CATEGORIAS: CategoriaParceiro[] = [
  'CLINICA_VETERINARIA',
  'PET_SHOP',
  'BANHO_TOSA',
  'ADESTRAMENTO',
  'HOTEL_CRECHE',
  'FARMACIA',
  'OUTRO',
]

const form = reactive({
  nome: '',
  categoria: null as CategoriaParceiro | null,
  cnpj: '',
  telefoneComercial: '',
  /* Sem campos visíveis: preservados do GET para a re-submissão não apagar (semântica replace).
     CRMV é gerenciado só no Perfil do usuário; o backend copia do veterinarioPerfil se ausente. */
  crmv: null as string | null,
  logoUrl: null as string | null,
})

/**
 * CNPJ e telefone passaram a ser obrigatórios: sem eles o time não consegue
 * aprovar o credenciamento no CMS nem entrar em contato com a empresa. Cadastro
 * antigo, salvo antes desta regra, cai aqui na primeira edição e precisa completar.
 */
const nomeError = ref('')
const cnpjError = ref('')
const telefoneError = ref('')

const categoriaOptions = computed(() =>
  CATEGORIAS.map((value) => ({
    value,
    label: t(`parceiroCadastro.categorias.${value}`),
  })),
)

function applyInitial(initial: ParceiroCadastro | null) {
  form.nome = initial?.nome ?? ''
  form.categoria = initial?.categoria ?? null
  // O backend guarda CNPJ canônico (só dígitos): mascara na entrada para exibir.
  form.cnpj = formatCnpj(initial?.cnpj ?? '')
  form.telefoneComercial = formatPhone(initial?.telefoneComercial ?? '')
  form.crmv = initial?.crmv ?? null
  form.logoUrl = initial?.logoUrl ?? null
  nomeError.value = ''
  cnpjError.value = ''
  telefoneError.value = ''
}

function onCnpjInput() {
  form.cnpj = formatCnpj(form.cnpj)
  cnpjError.value = ''
}

function onTelefoneInput() {
  form.telefoneComercial = formatPhone(form.telefoneComercial)
  telefoneError.value = ''
}

watch(
  () => props.initial,
  (initial) => {
    applyInitial(initial)
  },
  { immediate: true },
)

function handleSubmit() {
  const nome = form.nome.trim()
  const cnpjDigitos = stripCnpj(form.cnpj)
  const telefoneDigitos = stripPhone(form.telefoneComercial)

  nomeError.value = !nome ? t('parceiroCadastro.form.nomeRequired') : ''

  if (!cnpjDigitos) {
    cnpjError.value = t('parceiroCadastro.form.cnpjRequired')
  } else if (!isValidCnpj(cnpjDigitos)) {
    cnpjError.value = t('parceiroCadastro.form.cnpjInvalid')
  } else {
    cnpjError.value = ''
  }

  // Fixo (10) ou celular (11). Menos que isso não é telefone de contato.
  if (!telefoneDigitos) {
    telefoneError.value = t('parceiroCadastro.form.telefoneRequired')
  } else if (telefoneDigitos.length < 10 || telefoneDigitos.length > 11) {
    telefoneError.value = t('parceiroCadastro.form.telefoneInvalid')
  } else {
    telefoneError.value = ''
  }

  if (nomeError.value || cnpjError.value || telefoneError.value) {
    return
  }

  emit('submit', {
    nome,
    categoria: form.categoria,
    // CNPJ canônico: o backend normaliza para dígitos e a coluna é `@unique`.
    cnpj: cnpjDigitos,
    telefoneComercial: formatPhone(telefoneDigitos),
    crmv: form.crmv,
    logoUrl: form.logoUrl,
  })
}
</script>

<template>
  <form class="cad-form" novalidate @submit.prevent="handleSubmit">
    <div class="cad-form__field cad-form__field--full">
      <label for="cad-nome">
        {{ t('parceiroCadastro.form.nome') }}
        <span class="cad-form__required" aria-hidden="true">*</span>
      </label>
      <InputText
        id="cad-nome"
        v-model="form.nome"
        :placeholder="t('parceiroCadastro.form.nomePlaceholder')"
        :invalid="Boolean(nomeError) || errorField === 'nome'"
        :aria-describedby="nomeError ? 'cad-nome-error' : undefined"
        autocomplete="organization"
        @input="nomeError = ''"
      />
      <small v-if="nomeError" id="cad-nome-error" class="cad-form__error" role="alert">
        {{ nomeError }}
      </small>
    </div>

    <div class="cad-form__field">
      <label for="cad-categoria">{{ t('parceiroCadastro.form.categoria') }}</label>
      <Select
        id="cad-categoria"
        v-model="form.categoria"
        :options="categoriaOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('parceiroCadastro.form.categoriaPlaceholder')"
        show-clear
      />
    </div>

    <div class="cad-form__field">
      <label for="cad-cnpj">
        {{ t('parceiroCadastro.form.cnpj') }}
        <span class="cad-form__required" aria-hidden="true">*</span>
      </label>
      <InputText
        id="cad-cnpj"
        v-model="form.cnpj"
        :placeholder="t('parceiroCadastro.form.cnpjPlaceholder')"
        :invalid="Boolean(cnpjError) || errorField === 'cnpj'"
        :aria-describedby="cnpjError ? 'cad-cnpj-error' : undefined"
        inputmode="numeric"
        maxlength="18"
        @input="onCnpjInput"
      />
      <small v-if="cnpjError" id="cad-cnpj-error" class="cad-form__error" role="alert">
        {{ cnpjError }}
      </small>
    </div>

    <div class="cad-form__field">
      <label for="cad-telefone">
        {{ t('parceiroCadastro.form.telefone') }}
        <span class="cad-form__required" aria-hidden="true">*</span>
      </label>
      <InputText
        id="cad-telefone"
        v-model="form.telefoneComercial"
        :placeholder="t('parceiroCadastro.form.telefonePlaceholder')"
        :invalid="Boolean(telefoneError)"
        :aria-describedby="telefoneError ? 'cad-telefone-error' : undefined"
        inputmode="tel"
        autocomplete="tel"
        maxlength="15"
        @input="onTelefoneInput"
      />
      <small v-if="telefoneError" id="cad-telefone-error" class="cad-form__error" role="alert">
        {{ telefoneError }}
      </small>
    </div>

    <p class="cad-form__legend">{{ t('parceiroCadastro.form.requiredLegend') }}</p>

    <div class="cad-form__actions">
      <Button type="submit" :label="submitLabel" :loading="submitting" />
    </div>
  </form>
</template>

<style scoped>
.cad-form {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.cad-form__field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  /* Campos vizinhos com hint deixam a linha mais alta; sem isto o input estica junto. */
  align-content: start;
}

.cad-form__field--full {
  grid-column: 1 / -1;
}

.cad-form__field label {
  color: var(--partner-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.cad-form__required {
  color: var(--partner-warm-text);
}

.cad-form__error {
  color: var(--partner-warm-text);
  font-size: 0.78rem;
}

.cad-form__hint {
  color: var(--partner-faint);
  font-size: 0.75rem;
}

.cad-form__legend {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
}

.cad-form__actions {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.cad-form__field :deep(.p-inputtext),
.cad-form__field :deep(.p-select) {
  width: 100%;
  min-height: 2.85rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.8rem;
  background: var(--partner-surface);
  color: var(--partner-text);
  box-shadow: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.cad-form__field :deep(.p-inputtext) {
  padding: 0.7rem 0.85rem;
  caret-color: var(--partner-primary-strong);
}

.cad-form__field :deep(.p-inputtext::placeholder) {
  color: var(--partner-faint);
  opacity: 1;
}

.cad-form__field :deep(.p-select-label) {
  color: var(--partner-text);
}

.cad-form__field :deep(.p-select-label.p-placeholder) {
  color: var(--partner-faint);
}

.cad-form__field :deep(.p-select-dropdown),
.cad-form__field :deep(.p-select-clear-icon) {
  color: var(--partner-muted);
}

.cad-form__field :deep(.p-inputtext:hover),
.cad-form__field :deep(.p-select:not(.p-disabled):hover) {
  border-color: color-mix(in srgb, var(--partner-primary) 40%, var(--partner-line));
  background: var(--partner-surface);
}

.cad-form__field :deep(.p-inputtext:focus),
.cad-form__field :deep(.p-inputtext:focus-visible),
.cad-form__field :deep(.p-select.p-focus),
.cad-form__field :deep(.p-select:not(.p-disabled).p-focus) {
  outline: none;
  border-color: var(--partner-primary);
  background: var(--partner-surface);
  color: var(--partner-text);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-primary) 22%, transparent);
}

.cad-form__field :deep(.p-inputtext.p-invalid),
.cad-form__field :deep(.p-inputtext.p-invalid:focus),
.cad-form__field :deep(.p-inputtext.p-invalid:focus-visible) {
  border-color: var(--partner-warm-text);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-warm-text) 18%, transparent);
}

@media (max-width: 720px) {
  .cad-form {
    grid-template-columns: 1fr;
  }

  .cad-form__actions :deep(.p-button) {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>
