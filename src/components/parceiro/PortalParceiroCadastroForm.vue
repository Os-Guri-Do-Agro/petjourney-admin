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
  crmv: '',
  /* Sem campo visível: preservado do GET para a re-submissão não apagar o logo (semântica replace). */
  logoUrl: null as string | null,
})

const nomeError = ref('')

const categoriaOptions = computed(() =>
  CATEGORIAS.map((value) => ({
    value,
    label: t(`parceiroCadastro.categorias.${value}`),
  })),
)

function applyInitial(initial: ParceiroCadastro | null) {
  form.nome = initial?.nome ?? ''
  form.categoria = initial?.categoria ?? null
  form.cnpj = initial?.cnpj ?? ''
  form.telefoneComercial = initial?.telefoneComercial ?? ''
  form.crmv = initial?.crmv ?? ''
  form.logoUrl = initial?.logoUrl ?? null
  nomeError.value = ''
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

  if (!nome) {
    nomeError.value = t('parceiroCadastro.form.nomeRequired')
    return
  }

  nomeError.value = ''

  emit('submit', {
    nome,
    categoria: form.categoria,
    cnpj: form.cnpj.trim() || null,
    telefoneComercial: form.telefoneComercial.trim() || null,
    crmv: form.crmv.trim() || null,
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
      <label for="cad-cnpj">{{ t('parceiroCadastro.form.cnpj') }}</label>
      <InputText
        id="cad-cnpj"
        v-model="form.cnpj"
        :placeholder="t('parceiroCadastro.form.cnpjPlaceholder')"
        :invalid="errorField === 'cnpj'"
        inputmode="numeric"
      />
    </div>

    <div class="cad-form__field">
      <label for="cad-telefone">{{ t('parceiroCadastro.form.telefone') }}</label>
      <InputText
        id="cad-telefone"
        v-model="form.telefoneComercial"
        :placeholder="t('parceiroCadastro.form.telefonePlaceholder')"
        inputmode="tel"
        autocomplete="tel"
      />
    </div>

    <div class="cad-form__field">
      <label for="cad-crmv">{{ t('parceiroCadastro.form.crmv') }}</label>
      <InputText
        id="cad-crmv"
        v-model="form.crmv"
        :placeholder="t('parceiroCadastro.form.crmvPlaceholder')"
      />
      <small class="cad-form__hint">{{ t('parceiroCadastro.form.crmvHint') }}</small>
    </div>

    <p class="cad-form__legend">{{ t('parceiroCadastro.form.onlyNameRequired') }}</p>

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
