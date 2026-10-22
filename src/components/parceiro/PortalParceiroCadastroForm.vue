<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PortalParceiroProgramasPicker from '@/components/parceiro/PortalParceiroProgramasPicker.vue'
import type {
  CategoriaParceiro,
  ModoParticipacao,
  ModoStatusBloco,
  ParceiroCadastro,
  ParceiroCadastroPayload,
} from '@/service/parceiro/types'
import { formatPhone, stripPhone } from '@/utils/format/phone'
import { MODOS_PARTICIPACAO, resolveProgramasIniciais } from '@/utils/parceiro/modo-participacao'
import { formatCnpj, isValidCnpj, stripCnpj } from '@/utils/validation/cnpj'

const props = withDefaults(
  defineProps<{
    initial?: ParceiroCadastro | null
    submitLabel: string
    submitting?: boolean
    /** Campo destacado por erro de unicidade (reason do backend). */
    errorField?: 'nome' | 'cnpj' | null
    /**
     * Só a submissão (POST) leva programas: o PATCH devolve 400 com o campo, então
     * a edição inline do cadastro aprovado renderiza o formulário sem a aba.
     */
    showProgramas?: boolean
    /** Blocos do `GET /status`, para não mexer em programa já ativo ou suspenso. */
    programasBlocos?: Partial<Record<ModoParticipacao, ModoStatusBloco>> | null
  }>(),
  {
    initial: null,
    submitting: false,
    errorField: null,
    showProgramas: false,
    programasBlocos: null,
  },
)

const emit = defineEmits<{
  submit: [payload: ParceiroCadastroPayload]
}>()

const { t } = useI18n()

const CATEGORIAS: CategoriaParceiro[] = [
  'CLINICA_VETERINARIA',
  'VETERINARIO',
  'PET_SHOP',
  'BANHO_TOSA',
  'ADESTRAMENTO',
  'HOTEL_CRECHE',
  'FARMACIA',
  'OUTRO',
]

type FormTab = 'dados' | 'programas'

const activeTab = ref<FormTab>('dados')

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

const programas = ref<ModoParticipacao[]>([])

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

const tabs = computed(() => [
  { id: 'dados' as const, label: t('parceiroCadastro.tabs.dados'), icon: 'ph ph-building' },
  { id: 'programas' as const, label: t('parceiroCadastro.tabs.programas'), icon: 'ph ph-sparkle' },
])

/** Resumo do que a submissão leva: o parceiro precisa ver isso sem abrir a outra aba. */
const resumoEnvio = computed(() => [
  t('parceiroCadastro.resumo.cadastro'),
  ...programas.value.map((modo) => t(`parceiroCadastro.programas.${modo}.name`)),
])

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

/* A recusa devolve programa só pedido para NAO_SOLICITADO e o backend esquece a
   intenção: o default do reenvio é o mesmo do primeiro cadastro, senão o parceiro
   reenvia sem programa nenhum sem perceber.

   A chave é a combinação de status, não o objeto: qualquer refresh do `GET /status`
   recria os blocos, e observar a identidade apagaria a escolha de quem está com o
   formulário aberto. */
watch(
  () => MODOS_PARTICIPACAO.map((modo) => props.programasBlocos?.[modo]?.status ?? '-').join('|'),
  () => {
    programas.value = resolveProgramasIniciais(props.programasBlocos)
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
    // O erro está sempre na aba de dados: enviar da aba de programas não pode dar tela muda.
    activeTab.value = 'dados'
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
    ...(props.showProgramas ? { programas: [...programas.value] } : {}),
  })
}
</script>

<template>
  <form class="cad-form-shell" novalidate @submit.prevent="handleSubmit">
    <!-- Painéis ficam abaixo via v-show (cad-panel-*): id/aria-controls do Tab apontam para eles. -->
    <Tabs
      v-if="showProgramas"
      :value="activeTab"
      @update:value="(value) => (activeTab = value as FormTab)"
    >
      <TabList
        class="cad-tabs"
        :pt="{ tabList: { 'aria-label': t('parceiroCadastro.tabs.aria') } }"
      >
        <Tab
          v-for="tab in tabs"
          :id="`cad-tab-${tab.id}`"
          :key="tab.id"
          class="cad-tabs__button"
          :value="tab.id"
          :aria-controls="`cad-panel-${tab.id}`"
        >
          <i :class="tab.icon" aria-hidden="true" />
          <span>{{ tab.label }}</span>
          <span v-if="tab.id === 'programas'" class="cad-tabs__count">{{ programas.length }}</span>
        </Tab>
      </TabList>
    </Tabs>

    <div
      v-show="!showProgramas || activeTab === 'dados'"
      id="cad-panel-dados"
      role="tabpanel"
      :aria-labelledby="showProgramas ? 'cad-tab-dados' : undefined"
      class="cad-form"
    >
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
    </div>

    <div
      v-if="showProgramas"
      v-show="activeTab === 'programas'"
      id="cad-panel-programas"
      role="tabpanel"
      aria-labelledby="cad-tab-programas"
    >
      <PortalParceiroProgramasPicker
        v-model="programas"
        :blocos="programasBlocos"
        :disabled="submitting"
      />
    </div>

    <div v-if="showProgramas" class="cad-resumo" role="note">
      <span class="cad-resumo__label">{{ t('parceiroCadastro.resumo.label') }}</span>
      <ul class="cad-resumo__list">
        <li v-for="item in resumoEnvio" :key="item">
          <i class="ph ph-check" aria-hidden="true" />
          {{ item }}
        </li>
      </ul>
      <Button
        v-if="activeTab === 'dados'"
        class="cad-resumo__link"
        type="button"
        link
        size="small"
        :label="t('parceiroCadastro.resumo.edit')"
        @click="activeTab = 'programas'"
      />
    </div>

    <div class="cad-form__actions">
      <Button type="submit" :label="submitLabel" :loading="submitting" />
    </div>
  </form>
</template>

<style scoped>
/* O formulário do cadastro nos tokens do Trilha: rótulos de campo em frase, campos do kit. */
.cad-form-shell {
  display: grid;
  gap: 18px;
}

/* Dados | Programas: um controle segmentado, não uma fileira de pílulas. */
.cad-tabs.p-tablist {
  overflow: visible;
  background: transparent;
}

.cad-tabs :deep(.p-tablist-content) {
  overflow: visible;
}

.cad-tabs :deep(.p-tablist-tab-list) {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border: 0;
  border-radius: 12px;
  background: var(--superficie-3);
}

.cad-tabs :deep(.p-tablist-active-bar) {
  display: none;
}

.cad-tabs__button.p-tab {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.cad-tabs__button i {
  font-size: 16px;
}

.cad-tabs__button.p-tab:not(.p-tab-active):not(.p-disabled):hover {
  background: transparent;
  color: var(--tinta);
}

.cad-tabs__button.p-tab-active {
  background: var(--superficie);
  box-shadow: var(--sombra-1);
  color: var(--tinta);
  font-weight: 600;
}

.cad-tabs__button.p-tab:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 1px;
}

.cad-tabs__count {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-family: var(--font-dados);
  font-size: 12px;
  font-weight: 650;
}

.cad-form {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.cad-form__field {
  display: grid;
  gap: 6px;
  min-width: 0;
  /* Campos vizinhos com hint deixam a linha mais alta; sem isto o input estica junto. */
  align-content: start;
}

.cad-form__field--full {
  grid-column: 1 / -1;
}

.cad-form__field label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.cad-form__required {
  color: var(--risco-tinta);
}

.cad-form__error {
  color: var(--risco-tinta);
  font-size: 13px;
}

.cad-form__hint {
  color: var(--tinta-2);
  font-size: 13px;
}

.cad-form__legend {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.cad-form__field :deep(.p-inputtext),
.cad-form__field :deep(.p-select) {
  width: 100%;
  min-height: 44px;
}

/* O que vai junto no envio: uma faixa no tom de fundo, com o link para mudar. */
.cad-resumo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.cad-resumo__label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.cad-resumo__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cad-resumo__list li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cad-resumo__list i {
  color: var(--ok-tinta);
  font-size: 14px;
}

.cad-resumo__link.p-button {
  margin-inline-start: auto;
  padding: 0;
  color: var(--musgo);
  font-size: 13.5px;
}

.cad-resumo__link.p-button :deep(.p-button-label) {
  font-weight: 600;
}

.cad-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 720px) {
  .cad-form {
    grid-template-columns: 1fr;
  }

  .cad-resumo__link.p-button {
    margin-inline-start: 0;
  }

  .cad-form__actions :deep(.p-button) {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>
