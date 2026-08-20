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
          <i class="pi pi-building" />
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
          <i class="pi pi-clock" />
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
            <i class="pi pi-hourglass" aria-hidden="true" />
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
          <i class="pi pi-times-circle" />
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
          <i class="pi pi-info-circle" aria-hidden="true" />
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
          <i class="pi pi-ban" />
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
            <i class="pi pi-whatsapp" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.whatsapp') }}</strong>
              <small>{{ SUPPORT_CONTACTS.whatsappDisplay }}</small>
            </span>
          </a>
        </li>
        <li>
          <a :href="SUPPORT_CONTACTS.instagramHref" target="_blank" rel="noopener noreferrer">
            <i class="pi pi-instagram" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.instagram') }}</strong>
              <small>{{ SUPPORT_CONTACTS.instagramHandle }}</small>
            </span>
          </a>
        </li>
        <li>
          <a :href="SUPPORT_CONTACTS.facebookHref" target="_blank" rel="noopener noreferrer">
            <i class="pi pi-facebook" aria-hidden="true" />
            <span>
              <strong>{{ t('frame.suspended.channels.facebook') }}</strong>
              <small>{{ SUPPORT_CONTACTS.facebookHandle }}</small>
            </span>
          </a>
        </li>
        <li>
          <a :href="`mailto:${SUPPORT_CONTACTS.email}`">
            <i class="pi pi-envelope" aria-hidden="true" />
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
        <i class="pi pi-verified" />
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
          <i class="pi pi-info-circle" aria-hidden="true" />
          {{ t('parceiroCadastro.aprovado.incomplete') }}
        </p>
      </div>

      <PartnerStatusBadge status="APROVADO" />
    </article>

    <!-- PENDENTE/APROVADO (dono): dados sempre visíveis para edição, como no Perfil -->
    <article
      v-if="showInlineEdit"
      class="funil__card funil__edit"
      aria-labelledby="funil-edit-title"
    >
      <header class="funil__edit-head">
        <h3 id="funil-edit-title">{{ t('parceiroCadastro.editar.title') }}</h3>
        <p>{{ t('parceiroCadastro.editar.lede') }}</p>
      </header>

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
    </article>
  </section>
</template>

<style scoped>
.funil {
  display: grid;
  gap: 1rem;
  width: 100%;
}

.funil__edit-head {
  display: grid;
  gap: 0.2rem;
}

.funil__edit-head h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.98rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.funil__edit-head p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.funil__card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.2rem;
  background: var(--partner-card);
  box-shadow: 0 12px 28px rgb(var(--partner-shadow-rgb) / 0.04);
}

.funil__card[data-tone='brand'] {
  border-color: color-mix(in srgb, var(--partner-primary) 28%, var(--partner-line));
  background:
    radial-gradient(
      120% 130% at 100% 0%,
      color-mix(in srgb, var(--partner-primary-soft) 32%, transparent),
      transparent 55%
    ),
    var(--partner-card);
}

.funil__card[data-tone='pending'] {
  border-color: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  background: var(--partner-card);
}

.funil__card[data-tone='success'] {
  border-color: color-mix(in srgb, var(--partner-success-text) 20%, var(--partner-line));
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--partner-success-bg) 40%, var(--partner-card)),
    var(--partner-card) 55%
  );
}

.funil__card--compact {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
}

.funil__card--compact .funil__icon {
  width: 2.2rem;
  height: 2.2rem;
  font-size: 0.95rem;
}

.funil__compact-main {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.funil__compact-main h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.funil__compact-main p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.funil__card[data-tone='warm'] {
  border-color: color-mix(in srgb, var(--partner-warm-text) 22%, var(--partner-line));
  background: var(--partner-card);
}

.funil__head {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.funil__head > div {
  flex: 1;
  min-width: 0;
}

.funil__head h3 {
  margin: 0;
  color: var(--partner-text);
  font-size: 1.05rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.funil__head p {
  margin: 0.25rem 0 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.funil__icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.85rem;
  font-size: 1.05rem;
}

.funil__icon--brand {
  background: color-mix(in srgb, var(--partner-primary) 18%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.funil__icon--pending {
  background: color-mix(in srgb, var(--partner-primary) 16%, var(--partner-card));
  color: var(--partner-primary-strong);
}

.funil__icon--warm {
  background: color-mix(in srgb, var(--partner-warm-text) 12%, var(--partner-card));
  color: var(--partner-warm-text);
}

.funil__icon--success {
  background: var(--partner-success-bg);
  color: var(--partner-success-text);
}

.funil__steps {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: funil-step;
}

.funil__steps li {
  display: grid;
  gap: 0.25rem;
  align-content: start;
  padding: 0.75rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 80%, transparent);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--partner-surface) 80%, var(--partner-card));
  counter-increment: funil-step;
}

.funil__steps strong {
  color: var(--partner-text);
  font-size: 0.83rem;
}

.funil__steps strong::before {
  content: counter(funil-step) '. ';
  color: var(--partner-primary-strong);
}

.funil__steps span {
  color: var(--partner-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.funil__motivo {
  padding: 0.85rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--partner-warm-text) 22%, var(--partner-line));
  border-radius: 0.85rem;
  background: var(--partner-surface);
  color: var(--partner-text);
}

.funil__motivo strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--partner-warm-text);
  font-size: 0.8rem;
}

.funil__motivo p {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.45;
}

.funil__submit-error {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--partner-warm-text) 24%, var(--partner-line));
  border-radius: 0.8rem;
  background: var(--partner-surface);
  color: var(--partner-warm-text);
  font-size: 0.85rem;
}

.funil__incomplete {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--partner-amber-text);
  font-size: 0.84rem;
}

.funil__hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.85rem;
}

.funil__hint--note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 22%, var(--partner-line));
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-primary-soft) 12%, var(--partner-card));
  line-height: 1.45;
}

.funil__hint--note i {
  margin-top: 0.12rem;
  color: var(--partner-primary-strong);
}

.funil__analise {
  display: grid;
  gap: 0.55rem;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 20%, var(--partner-line));
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
}

.funil__analise-label {
  color: var(--partner-text);
  font-size: 0.8rem;
  font-weight: 750;
  letter-spacing: 0.01em;
}

.funil__analise-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.funil__analise-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 75%, transparent);
  border-radius: 0.7rem;
  background: var(--partner-card);
  color: var(--partner-text);
  font-size: 0.85rem;
  font-weight: 650;
}

.funil__analise-list i {
  color: var(--partner-primary-strong);
  font-size: 0.8rem;
}

.funil__analise-hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.funil__support-lede {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
  font-weight: 650;
}

.funil__channels {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.funil__channels a {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  min-height: 100%;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.75rem;
  color: var(--partner-text);
  text-decoration: none;
}

.funil__channels a:hover,
.funil__channels a:focus-visible {
  border-color: var(--partner-primary-strong);
  outline: none;
}

.funil__channels a > i {
  color: var(--partner-primary-strong);
  font-size: 1rem;
}

.funil__channels span {
  display: grid;
  gap: 0.05rem;
  min-width: 0;
}

.funil__channels strong {
  font-size: 0.84rem;
  font-weight: 750;
}

.funil__channels small {
  color: var(--partner-muted);
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.funil__form-loading {
  display: grid;
  gap: 0.6rem;
}

@media (max-width: 960px) {
  .funil__channels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .funil__steps {
    grid-template-columns: 1fr;
  }

  .funil__channels {
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
