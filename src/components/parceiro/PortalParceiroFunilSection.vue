<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import PortalParceiroCadastroForm from '@/components/parceiro/PortalParceiroCadastroForm.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  atualizarParceiroCadastro,
  cadastrarParceiro,
  getParceiroCadastro,
} from '@/service/parceiro/parceiro-portal-service'
import type {
  ModoParticipacao,
  ParceiroCadastro,
  ParceiroCadastroPayload,
} from '@/service/parceiro/types'
import { programasEmAnalise, resolveCadastroErrorView } from '@/utils/parceiro/modo-participacao'
import { SUPPORT_CONTACTS } from '@/utils/parceiro/support-contacts'

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const cadastro = ref<ParceiroCadastro | null>(null)
const loadingCadastro = ref(false)
const submitting = ref(false)
const submitError = ref('')
const errorField = ref<'nome' | 'cnpj' | null>(null)

type FunilState = 'loading' | 'sem-parceiro' | 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'

const state = computed<FunilState>(() => {
  if (store.loadState === 'loading' || store.loadState === 'idle') {
    return 'loading'
  }

  if (store.semAcessoParceiro) {
    return 'sem-parceiro'
  }

  return store.status?.statusAuditoria ?? 'loading'
})

const motivoAuditoria = computed(() => store.status?.motivoAuditoria ?? '')

const auditadoEmLabel = computed(() => {
  const raw = store.status?.auditadoEm

  if (!raw) {
    return ''
  }

  return new Date(raw).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
})

/** GET /cadastro é DONO-only; OPERADOR acompanha só o status. */
const canEditCadastro = computed(() => store.isDono)

const cadastroIncompleto = computed(
  () => cadastro.value != null && (!cadastro.value.categoria || !cadastro.value.telefoneComercial),
)

/** REJEITADO reenvia pelo POST (replace); PENDENTE/APROVADO editam pelo PATCH. */
const formIsResubmit = computed(() => state.value === 'sem-parceiro' || state.value === 'REJEITADO')

/** Só o POST aceita `programas`; no PATCH o campo devolve 400. */
const programasBlocos = computed(() =>
  store.status
    ? { afiliado: store.status.afiliado, participativo: store.status.participativo }
    : null,
)

/** A tela de espera lista o que está em análise: o cadastro e cada programa pedido junto. */
const itensEmAnalise = computed(() => [
  { id: 'cadastro', label: t('parceiroCadastro.pendente.itemCadastro') },
  ...programasEmAnalise(store.status).map((modo) => ({
    id: modo,
    label: t(`parceiroCadastro.programas.${modo}.name`),
  })),
])

function programasToastDetail(programas: ModoParticipacao[] | undefined) {
  if (!programas?.length) {
    return t('parceiroCadastro.toast.enviadoDetail')
  }

  return t('parceiroCadastro.toast.enviadoComProgramas', {
    programas: programas.map((modo) => t(`parceiroCadastro.programas.${modo}.name`)).join(', '),
  })
}

/** PENDENTE/APROVADO: formulário sempre aberto com os dados, como no painel de Perfil. */
const showInlineEdit = computed(
  () => canEditCadastro.value && (state.value === 'PENDENTE' || state.value === 'APROVADO'),
)

async function loadCadastro() {
  if (!canEditCadastro.value || state.value === 'sem-parceiro') {
    return
  }

  loadingCadastro.value = true

  try {
    cadastro.value = await getParceiroCadastro(parceiroQuery())
  } catch {
    cadastro.value = null
  } finally {
    loadingCadastro.value = false
  }
}

watch(
  state,
  (next) => {
    if (next === 'REJEITADO' || next === 'APROVADO' || next === 'PENDENTE') {
      void loadCadastro()
    }
  },
  { immediate: true },
)

async function handleSubmit(payload: ParceiroCadastroPayload) {
  submitting.value = true
  submitError.value = ''
  errorField.value = null
  const isResubmit = formIsResubmit.value

  try {
    if (isResubmit) {
      const resultado = await cadastrarParceiro(payload)
      /* O service já trocou o access_token (claim do parceiro novo); fixar o id no
         store garante o alvo certo também em conta com mais de uma membership. */
      store.setParceiroId(resultado.parceiroId)
      toast.add({
        severity: 'success',
        summary: t('parceiroCadastro.toast.enviado'),
        /* A confirmação sai de `programasSolicitados`, não do que foi marcado: é o
           backend que diz o que ficou de fato como pedido. */
        detail: programasToastDetail(resultado.programasSolicitados),
        life: 6000,
      })
    } else {
      cadastro.value = await atualizarParceiroCadastro(payload, parceiroQuery())
      toast.add({
        severity: 'success',
        summary: t('parceiroCadastro.toast.salvo'),
        detail: t('parceiroCadastro.toast.salvoDetail'),
        life: 4000,
      })
    }

    await ensureContext(true)

    if (isResubmit) {
      void loadCadastro()
    }
  } catch (err) {
    const view = resolveCadastroErrorView(err)
    submitError.value = view.message
    errorField.value = view.field ?? null
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="funil" aria-labelledby="funil-title">
    <article v-if="state === 'loading'" class="funil__card" aria-hidden="true">
      <Skeleton width="10rem" height="1rem" border-radius="4px" />
      <Skeleton width="100%" height="3.2rem" border-radius="10px" />
      <Skeleton width="70%" height="0.85rem" border-radius="4px" />
    </article>

    <!-- Sem parceiro: wizard de auto-cadastro (POST /cadastro) -->
    <article v-else-if="state === 'sem-parceiro'" class="funil__card" data-tone="brand">
      <header class="funil__head">
        <span class="funil__icon funil__icon--brand" aria-hidden="true">
          <i class="ph ph-building" />
        </span>
        <div>
          <h3 id="funil-title">{{ t('parceiroCadastro.wizard.title') }}</h3>
          <p>{{ t('parceiroCadastro.wizard.lede') }}</p>
        </div>
      </header>

      <ol class="funil__steps">
        <li>
          <strong>{{ t('parceiroCadastro.wizard.step1Title') }}</strong>
          <span>{{ t('parceiroCadastro.wizard.step1Desc') }}</span>
        </li>
        <li>
          <strong>{{ t('parceiroCadastro.wizard.step2Title') }}</strong>
          <span>{{ t('parceiroCadastro.wizard.step2Desc') }}</span>
        </li>
        <li>
          <strong>{{ t('parceiroCadastro.wizard.step3Title') }}</strong>
          <span>{{ t('parceiroCadastro.wizard.step3Desc') }}</span>
        </li>
      </ol>

      <p v-if="submitError" class="funil__submit-error" role="alert">{{ submitError }}</p>

      <PortalParceiroCadastroForm
        :submit-label="t('parceiroCadastro.wizard.submit')"
        :submitting="submitting"
        :error-field="errorField"
        show-programas
        :programas-blocos="programasBlocos"
        @submit="handleSubmit"
      />
    </article>

    <!-- PENDENTE: em análise + revisar dados -->
    <article v-else-if="state === 'PENDENTE'" class="funil__card" data-tone="pending">
      <header class="funil__head">
        <span class="funil__icon funil__icon--pending" aria-hidden="true">
          <i class="ph ph-clock" />
        </span>
        <div>
          <h3 id="funil-title">{{ t('parceiroCadastro.pendente.title') }}</h3>
          <p>{{ t('parceiroCadastro.pendente.body') }}</p>
        </div>
        <PartnerStatusBadge status="PENDENTE" />
      </header>

      <!-- O parceiro precisa ver aqui que os programas foram junto e não ficaram para trás. -->
      <div class="funil__analise">
        <span class="funil__analise-label">{{ t('parceiroCadastro.pendente.analiseLabel') }}</span>
        <ul class="funil__analise-list">
          <li v-for="item in itensEmAnalise" :key="item.id">
            <i class="ph ph-hourglass" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </li>
        </ul>
        <p class="funil__analise-hint">{{ t('parceiroCadastro.pendente.analiseHint') }}</p>
      </div>
    </article>

    <!-- REJEITADO: motivo + corrigir e reenviar (POST) -->
    <article v-else-if="state === 'REJEITADO'" class="funil__card" data-tone="warm">
      <header class="funil__head">
        <span class="funil__icon funil__icon--warm" aria-hidden="true">
          <i class="ph ph-x-circle" />
        </span>
        <div>
          <h3 id="funil-title">{{ t('parceiroCadastro.rejeitado.title') }}</h3>
          <p>{{ t('parceiroCadastro.rejeitado.body') }}</p>
        </div>
        <PartnerStatusBadge status="REJEITADO" />
      </header>

      <div v-if="motivoAuditoria" class="funil__motivo" role="note">
        <strong>{{ t('parceiroCadastro.motivoLabel') }}</strong>
        <p>{{ motivoAuditoria }}</p>
      </div>

      <template v-if="canEditCadastro">
        <p class="funil__hint funil__hint--note">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('parceiroCadastro.rejeitado.programasHint') }}
        </p>
        <p v-if="submitError" class="funil__submit-error" role="alert">{{ submitError }}</p>
        <div v-if="loadingCadastro" class="funil__form-loading" aria-hidden="true">
          <Skeleton width="100%" height="2.4rem" border-radius="10px" />
          <Skeleton width="100%" height="2.4rem" border-radius="10px" />
        </div>
        <PortalParceiroCadastroForm
          v-else
          :initial="cadastro"
          :submit-label="t('parceiroCadastro.rejeitado.resubmit')"
          :submitting="submitting"
          :error-field="errorField"
          show-programas
          :programas-blocos="programasBlocos"
          @submit="handleSubmit"
        />
      </template>
      <p v-else class="funil__hint">{{ t('parceiroCadastro.rejeitado.operadorHint') }}</p>
    </article>

    <!-- SUSPENSO: travado, só suporte -->
    <article v-else-if="state === 'SUSPENSO'" class="funil__card" data-tone="warm">
      <header class="funil__head">
        <span class="funil__icon funil__icon--warm" aria-hidden="true">
          <i class="ph ph-prohibit" />
        </span>
        <div>
          <h3 id="funil-title">{{ t('parceiroCadastro.suspenso.title') }}</h3>
          <p>{{ t('parceiroCadastro.suspenso.body') }}</p>
        </div>
        <PartnerStatusBadge status="SUSPENSO" />
      </header>

      <div v-if="motivoAuditoria" class="funil__motivo" role="note">
        <strong>{{ t('parceiroCadastro.motivoLabel') }}</strong>
        <p>{{ motivoAuditoria }}</p>
      </div>

      <p class="funil__support-lede">{{ t('frame.suspended.channelsLede') }}</p>
      <ul class="funil__channels">
        <li>
          <a :href="SUPPORT_CONTACTS.whatsappHref" target="_blank" rel="noopener noreferrer">
            <i class="ph ph-whatsapp-logo" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.whatsapp') }}</strong>
              <small>{{ SUPPORT_CONTACTS.whatsappDisplay }}</small>
            </span>
          </a>
        </li>
        <li>
          <a :href="SUPPORT_CONTACTS.instagramHref" target="_blank" rel="noopener noreferrer">
            <i class="ph ph-instagram-logo" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.instagram') }}</strong>
              <small>{{ SUPPORT_CONTACTS.instagramHandle }}</small>
            </span>
          </a>
        </li>
        <li>
          <a :href="SUPPORT_CONTACTS.facebookHref" target="_blank" rel="noopener noreferrer">
            <i class="ph ph-facebook-logo" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.facebook') }}</strong>
              <small>{{ SUPPORT_CONTACTS.facebookHandle }}</small>
            </span>
          </a>
        </li>
        <li>
          <a :href="`mailto:${SUPPORT_CONTACTS.email}`">
            <i class="ph ph-envelope-simple" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.email') }}</strong>
              <small>{{ SUPPORT_CONTACTS.email }}</small>
            </span>
          </a>
        </li>
      </ul>
    </article>

    <!-- APROVADO: linha compacta de status -->
    <article v-else class="funil__card funil__card--compact" data-tone="success">
      <span class="funil__icon funil__icon--success" aria-hidden="true">
        <i class="ph ph-seal-check" />
      </span>

      <div class="funil__compact-main">
        <h3 id="funil-title">{{ t('parceiroCadastro.aprovado.title') }}</h3>
        <p>
          {{ t('parceiroCadastro.aprovado.body') }}
          <template v-if="auditadoEmLabel">
            {{ t('parceiroCadastro.aprovado.desde', { data: auditadoEmLabel }) }}
          </template>
        </p>
        <p v-if="canEditCadastro && cadastroIncompleto" class="funil__incomplete">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('parceiroCadastro.aprovado.incomplete') }}
        </p>
      </div>

      <PartnerStatusBadge status="APROVADO" />
    </article>

    <!-- PENDENTE/APROVADO (dono): dados sempre visíveis para edição, como no Perfil -->
    <article
      v-if="showInlineEdit"
      class="funil__edit ui-folha cfg-folha"
      aria-labelledby="funil-edit-title"
    >
      <!-- O mesmo desenho das outras abas: nome e frase à esquerda, os campos à direita. -->
      <section class="cfg-secao">
        <header class="cfg-secao__cabeca">
          <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
            <i class="ph ph-buildings" />
          </span>
          <h3 id="funil-edit-title" class="cfg-secao__titulo">
            {{ t('parceiroCadastro.editar.title') }}
          </h3>
          <p class="cfg-secao__descricao">{{ t('parceiroCadastro.editar.lede') }}</p>
        </header>

        <div class="cfg-secao__corpo">
          <p v-if="submitError" class="funil__submit-error" role="alert">{{ submitError }}</p>

          <div v-if="loadingCadastro" class="funil__form-loading" aria-hidden="true">
            <Skeleton width="100%" height="2.4rem" border-radius="10px" />
            <Skeleton width="100%" height="2.4rem" border-radius="10px" />
            <Skeleton width="60%" height="2.4rem" border-radius="10px" />
          </div>
          <PortalParceiroCadastroForm
            v-else
            :initial="cadastro"
            :submit-label="t('parceiroCadastro.editar.submit')"
            :submitting="submitting"
            :error-field="errorField"
            @submit="handleSubmit"
          />
        </div>
      </section>
    </article>
  </section>
</template>

<style scoped>
/*
 * O funil do cadastro (Configurações → Empresa) nos tokens do Trilha. Cada estado é uma folha;
 * o ícone do cabeçalho leva a cor do estado (atenção em análise, risco recusado ou suspenso, ok
 * aprovado) e o selo repete com palavra.
 */
.funil {
  display: grid;
  gap: 20px;
  width: 100%;
  color: var(--tinta);
}

.funil__card {
  display: grid;
  gap: 18px;
  padding: 22px 24px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
}

/* A linha do estado, quando aprovada: o tom de "ok" desce do alto e some no branco. */
.funil__card--compact {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
}

.funil__card--compact[data-tone='success'] {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ok-fundo) 60%, var(--superficie)),
    var(--superficie)
  );
}

.funil__card--compact .funil__icon {
  width: 44px;
  height: 44px;
  font-size: 22px;
}

.funil__compact-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.funil__compact-main h3 {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.funil__compact-main p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.funil__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.funil__head > div {
  flex: 1;
  min-width: 0;
}

.funil__head h3 {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.funil__head p {
  max-width: 64ch;
  margin: 4px 0 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.funil__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  font-size: 22px;
}

.funil__icon--brand {
  background: var(--portal-fundo);
  color: var(--portal-tinta);
}

.funil__icon--pending {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.funil__icon--warm {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.funil__icon--success {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

/* Os três passos do cadastro: número num disco, título e uma linha. */
.funil__steps {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: funil-step;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.funil__steps li {
  position: relative;
  display: grid;
  align-content: start;
  gap: 3px;
  padding: 14px 16px 14px 52px;
  border-radius: 12px;
  background: var(--superficie-2);
  counter-increment: funil-step;
}

.funil__steps li::before {
  position: absolute;
  top: 14px;
  inset-inline-start: 14px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 999px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  content: counter(funil-step);
  font-family: var(--font-dados);
  font-size: 13px;
  font-weight: 650;
}

[dir='rtl'] .funil__steps li {
  padding: 14px 52px 14px 16px;
}

.funil__steps strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.funil__steps span {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.funil__motivo {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--tinta);
}

.funil__motivo strong {
  display: block;
  margin-bottom: 2px;
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
}

.funil__motivo p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.funil__submit-error {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklab, var(--risco) 40%, var(--linha));
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 500;
}

.funil__incomplete {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px !important;
  color: var(--atencao-tinta) !important;
  font-weight: 500;
}

.funil__hint {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.funil__hint--note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
}

.funil__hint--note i {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 16px;
}

/* O que está em análise: o cadastro e cada programa pedido junto, um por linha. */
.funil__analise {
  display: grid;
  gap: 10px;
}

.funil__analise-label {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.funil__analise-list {
  display: grid;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.funil__analise-list li {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.funil__analise-list li + li {
  border-top: 1px solid var(--linha);
}

.funil__analise-list i {
  color: var(--atencao-tinta);
  font-size: 16px;
}

.funil__analise-hint {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.5;
}

.funil__support-lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
}

.funil__channels {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}

.funil__channels a {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  color: var(--tinta);
  text-decoration: none;
}

.funil__channels a:hover {
  background: var(--superficie-2);
}

.funil__channels a:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.funil__channels a > i {
  color: var(--tinta-2);
  font-size: 20px;
}

.funil__channels span {
  display: grid;
  min-width: 0;
}

.funil__channels strong {
  font-size: 14px;
  font-weight: 600;
}

.funil__channels small {
  color: var(--tinta-2);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.funil__form-loading {
  display: grid;
  gap: 10px;
}

@media (max-width: 720px) {
  .funil__card {
    padding: 18px 16px;
  }

  .funil__steps {
    grid-template-columns: 1fr;
  }

  .funil__head {
    flex-wrap: wrap;
  }

  .funil__card--compact {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .funil__card--compact > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
