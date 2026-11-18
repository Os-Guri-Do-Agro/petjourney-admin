<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import Tabs from 'primevue/tabs'
import { computed, nextTick, reactive, ref, watch } from 'vue'
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
import {
  MODOS_PARTICIPACAO,
  resolveProgramasIniciais,
  type CampoDoCadastro,
} from '@/utils/parceiro/modo-participacao'
import { formatCnpj, isValidCnpj, stripCnpj } from '@/utils/validation/cnpj'

const props = withDefaults(
  defineProps<{
    initial?: ParceiroCadastro | null
    submitLabel: string
    submitting?: boolean
    /** Campo destacado (e focado) pelo erro do backend: unicidade ou exigência da categoria. */
    errorField?: CampoDoCadastro | null
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

/*
 * As categorias que o portal oferece. O veterinário autônomo (`VETERINARIO`) pede o CRMV do
 * parceiro, e este formulário não tem esse campo: ele só aparece quando o cadastro já o tem (feito
 * pelo site), para continuar marcado e não sumir no salvar.
 */
const CATEGORIAS: CategoriaParceiro[] = [
  'CLINICA_VETERINARIA',
  'PET_SHOP',
  'BANHO_TOSA',
  'ADESTRAMENTO',
  'HOTEL_CRECHE',
  'FARMACIA',
  'OUTRO',
]

/** De 1 a 8, sem repetir (pedidos de 17/11). */
const MAX_CATEGORIAS = 8

/** O id do campo que recebe o foco quando o erro do backend aponta para ele. */
const ID_DO_CAMPO: Record<CampoDoCadastro, string> = {
  nome: 'cad-nome',
  cnpj: 'cad-cnpj',
  categorias: 'cad-categorias',
}

type FormTab = 'dados' | 'programas'

const activeTab = ref<FormTab>('dados')
const raiz = ref<HTMLFormElement | null>(null)

const form = reactive({
  nome: '',
  /** Na ordem de escolha: a primeira é a principal. */
  categorias: [] as CategoriaParceiro[],
  cnpj: '',
  telefoneComercial: '',
  /* Sem campos visíveis: preservados do GET para a re-submissão não apagar (semântica replace).
     O CRMV do parceiro vai no corpo (campo crmv); a API não copia mais do perfil antigo (E1-07). */
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
const categoriasError = ref('')

/** As do cadastro, sem repetir e no máximo 8. Sem `categorias` (API antiga), a principal. */
function categoriasDe(initial: ParceiroCadastro | null): CategoriaParceiro[] {
  const lista = initial?.categorias?.length
    ? initial.categorias
    : initial?.categoria
      ? [initial.categoria]
      : []

  return [...new Set(lista)].slice(0, MAX_CATEGORIAS)
}

const categoriaOptions = computed(() =>
  [...new Set([...CATEGORIAS, ...categoriasDe(props.initial)])].map((value) => ({
    value,
    label: t(`parceiroCadastro.categorias.${value}`),
  })),
)

function tornarPrincipal(categoria: CategoriaParceiro) {
  form.categorias = [categoria, ...form.categorias.filter((item) => item !== categoria)]
}

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
  form.categorias = categoriasDe(initial)
  // O backend guarda o CNPJ canônico (letras e números, sem máscara): mascara para exibir.
  form.cnpj = formatCnpj(initial?.cnpj ?? '')
  form.telefoneComercial = formatPhone(initial?.telefoneComercial ?? '')
  form.crmv = initial?.crmv ?? null
  form.logoUrl = initial?.logoUrl ?? null
  nomeError.value = ''
  cnpjError.value = ''
  telefoneError.value = ''
  categoriasError.value = ''
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

/* O erro do backend (CNPJ em uso, categoria que exige CNPJ ou CRMV) leva o foco ao campo. */
watch(
  () => props.errorField,
  async (campo) => {
    if (!campo) {
      return
    }

    activeTab.value = 'dados'
    await nextTick()
    raiz.value?.querySelector<HTMLElement>(`#${ID_DO_CAMPO[campo]}`)?.focus()
  },
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

  /*
   * O CNPJ igual ao gravado não é conferido de novo: a API também não confere, e o cadastro antigo
   * com o dígito errado segue editável no resto (E1-08).
   */
  const cnpjGravado = cnpjDigitos !== '' && cnpjDigitos === stripCnpj(props.initial?.cnpj ?? '')

  if (!cnpjDigitos) {
    cnpjError.value = t('parceiroCadastro.form.cnpjRequired')
  } else if (!cnpjGravado && !isValidCnpj(cnpjDigitos)) {
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

  /*
   * Só `categorias` vai, com a principal na frente. Quem já tinha categoria não esvazia a lista
   * (a API recusa `[]`); no cadastro novo ela continua opcional e, vazia, não vai.
   */
  const categorias = [...new Set(form.categorias)].slice(0, MAX_CATEGORIAS)
  categoriasError.value =
    !categorias.length && categoriasDe(props.initial).length ? t('cadastro.categorias.minimo') : ''

  if (nomeError.value || cnpjError.value || telefoneError.value || categoriasError.value) {
    // O erro está sempre na aba de dados: enviar da aba de programas não pode dar tela muda.
    activeTab.value = 'dados'
    return
  }

  emit('submit', {
    nome,
    ...(categorias.length ? { categorias } : {}),
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
  <form ref="raiz" class="cad-form-shell" novalidate @submit.prevent="handleSubmit">
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

      <div class="cad-form__field cad-form__field--full">
        <label for="cad-categorias">{{ t('cadastro.categorias.rotulo') }}</label>
        <MultiSelect
          v-model="form.categorias"
          input-id="cad-categorias"
          :options="categoriaOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('parceiroCadastro.form.categoriaPlaceholder')"
          :selection-limit="MAX_CATEGORIAS"
          :invalid="Boolean(categoriasError) || errorField === 'categorias'"
          :aria-describedby="categoriasError ? 'cad-categorias-error' : 'cad-categorias-dica'"
          @change="categoriasError = ''"
        />
        <small id="cad-categorias-dica" class="cad-form__hint">
          {{ t('cadastro.categorias.dica') }}
        </small>

        <!-- A ordem só pede decisão com duas ou mais: a primeira é a principal. -->
        <ul v-if="form.categorias.length > 1" class="cad-categorias">
          <li
            v-for="(categoria, posicao) in form.categorias"
            :key="categoria"
            class="cad-categorias__item"
          >
            <span class="cad-categorias__nome">
              {{ t(`parceiroCadastro.categorias.${categoria}`) }}
            </span>
            <span v-if="posicao === 0" class="ui-selo">
              <i class="ph ph-star" aria-hidden="true" />
              {{ t('cadastro.categorias.principal') }}
            </span>
            <Button
              v-else
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('cadastro.categorias.tornarPrincipal')"
              :disabled="submitting"
              @click="tornarPrincipal(categoria)"
            />
          </li>
        </ul>

        <small
          v-if="categoriasError"
          id="cad-categorias-error"
          class="cad-form__error"
          role="alert"
        >
          {{ categoriasError }}
        </small>
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
          autocapitalize="characters"
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
      <!-- Ação de verdade (abre a escolha dos programas): botão visível, não texto solto. -->
      <Button
        v-if="activeTab === 'dados'"
        class="cad-resumo__link"
        type="button"
        severity="secondary"
        size="small"
        icon="ph ph-squares-four"
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
  background: var(--segmento-escolhido-fundo);
  box-shadow: var(--segmento-escolhido-contorno);
  color: var(--segmento-escolhido-tinta);
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
.cad-form__field :deep(.p-select),
.cad-form__field :deep(.p-multiselect) {
  width: 100%;
  min-height: 44px;
}

.cad-form__field :deep(.p-multiselect) {
  align-items: center;
}

/*
 * As escolhidas, na ordem: a principal com o selo, as outras com "Tornar principal". Item de campo
 * não ganha caixa própria: a caixa é a da seção.
 */
.cad-categorias {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.cad-categorias__item {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 8px;
}

.cad-categorias__nome {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
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
