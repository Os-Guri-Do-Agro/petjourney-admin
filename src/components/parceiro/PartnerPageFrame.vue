<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { isGuidanceVisible, toggleGuidance } from '@/composables/useLayoutPreferences'
import { useLogout } from '@/composables/useLogout'
import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'
import { SUPPORT_CONTACTS } from '@/utils/parceiro/support-contacts'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    loading?: boolean
    error?: string
    /** Conta sem membership de Parceiro (API 403). */
    noPartnerAccess?: boolean
    /**
     * Quando true, cadastro SUSPENSO substitui o conteúdo pelo gate de contato.
     * Use só em telas operacionais do portal — não em Configurações/Clínica.
     */
    blockWhenSuspended?: boolean
    empty?: boolean
    emptyTitle?: string
    emptyDescription?: string
    emptyActionLabel?: string
    /**
     * A tela tem texto de apoio escondido atrás da preferência de explicações.
     *
     * Só quem declara isso ganha o botão no cabeçalho. Um botão de "mostrar explicações" numa
     * tela sem explicação a mostrar não faz nada — e um controle que não faz nada ensina a
     * ignorar o controle.
     */
    guidance?: boolean
    /**
     * A tela tem um tutorial guiado, e o botão de ajuda passa a abri-lo.
     *
     * O mesmo botão, outro comportamento: em vez de ligar parágrafos de apoio, ele percorre a
     * tela passo a passo, apontando para cada parte. Onde há tutorial, a explicação mora ao lado
     * do que explica — ler "a coluna de documentação é ordenável" não ajuda quem ainda não sabe
     * qual é a coluna.
     *
     * Quem não declara continua com o botão de sempre. As duas formas convivem porque migrar
     * todas as telas do portal de uma vez não é assunto de quem só precisava de tutorial numa.
     */
    tour?: boolean
  }>(),
  {
    subtitle: '',
    loading: false,
    error: '',
    noPartnerAccess: false,
    blockWhenSuspended: false,
    empty: false,
    guidance: false,
    tour: false,
    emptyTitle: '',
    emptyDescription: '',
    emptyActionLabel: '',
  },
)

const emit = defineEmits<{
  retry: []
  emptyAction: []
  tour: []
}>()

const { t } = useI18n()
const parceiroStore = useParceiroStore()
const { logout } = useLogout()
const showClinicalCta = computed(() => hasVeterinarioProfile())
const resolvedEmptyTitle = computed(() => props.emptyTitle || t('frame.emptyDefault'))

/**
 * O acesso existia e caiu (parceiro excluído pelo admin). Mesma porta fechada do `noPartnerAccess`,
 * composição diferente: aqui não se promete liberação, se oferece saída e contato.
 */
const showAccessRevoked = computed(() => props.noPartnerAccess && parceiroStore.acessoEncerrado)

/** Cadastro SUSPENSO: bloqueia só telas operacionais do portal. */
const showSuspended = computed(
  () =>
    props.blockWhenSuspended &&
    !props.noPartnerAccess &&
    !props.loading &&
    !props.error &&
    parceiroStore.loadState === 'ready' &&
    parceiroStore.cadastroSuspenso,
)

const suspendedReason = computed(() => parceiroStore.status?.motivoAuditoria?.trim() || '')

const supportChannels = [
  {
    id: 'whatsapp',
    href: SUPPORT_CONTACTS.whatsappHref,
    icon: 'pi pi-whatsapp',
    labelKey: 'frame.suspended.channels.whatsapp',
    value: SUPPORT_CONTACTS.whatsappDisplay,
    external: true,
  },
  {
    id: 'instagram',
    href: SUPPORT_CONTACTS.instagramHref,
    icon: 'pi pi-instagram',
    labelKey: 'frame.suspended.channels.instagram',
    value: SUPPORT_CONTACTS.instagramHandle,
    external: true,
  },
  {
    id: 'facebook',
    href: SUPPORT_CONTACTS.facebookHref,
    icon: 'pi pi-facebook',
    labelKey: 'frame.suspended.channels.facebook',
    value: SUPPORT_CONTACTS.facebookHandle,
    external: true,
  },
  {
    id: 'email',
    href: `mailto:${SUPPORT_CONTACTS.email}`,
    icon: 'pi pi-envelope',
    labelKey: 'frame.suspended.channels.email',
    value: SUPPORT_CONTACTS.email,
    external: false,
  },
] as const

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--partner-bg': colors.dashboard.bg,
    '--partner-card': colors.dashboard.surface,
    '--partner-surface': colors.dashboard.surfaceSoft,
    '--partner-line': colors.dashboard.line,
    '--partner-text': colors.dashboard.text,
    '--partner-muted': colors.dashboard.muted,
    '--partner-faint': colors.dashboard.faint,
    '--partner-primary': colors.vet.primary,
    '--partner-primary-soft': colors.vet.secondary,
    '--partner-primary-strong': colors.dashboard.primaryStrong,
    /** Sempre branco real: `auth.white` é superfície (quebrada no claro, escura no dark). */
    '--partner-on-primary': LightColors.text.inverse,
    '--partner-warm-bg': colors.dashboard.warmBg,
    '--partner-warm-text': colors.dashboard.warmText,
    '--partner-success-bg': colors.dashboard.successBg,
    '--partner-success-text': colors.dashboard.successText,
    '--partner-amber-bg': colors.dashboard.amberBg,
    '--partner-amber-text': colors.dashboard.amberText,
    '--partner-shadow-rgb': colors.auth.shadowRgb,
  }
})
</script>

<template>
  <section class="partner-page" :style="pageStyle">
    <header class="partner-page__header">
      <div>
        <p v-if="subtitle" class="partner-page__subtitle">{{ subtitle }}</p>
        <h1 class="partner-page__title">{{ title }}</h1>
      </div>
      <div
        v-if="(guidance || tour || $slots.actions) && !noPartnerAccess && !showSuspended"
        class="partner-page__actions"
      >
        <!--
          O botão vem antes das ações da tela de propósito: ele é o mesmo em todas as páginas e
          fica sempre no mesmo lugar, encostado no título. Ação de tela muda de página para
          página; controle de leitura, não.
        -->
        <Button
          v-if="tour"
          class="partner-page__guidance"
          type="button"
          icon="pi pi-question-circle"
          :label="t('shell.guidance.tour')"
          outlined
          rounded
          severity="secondary"
          size="small"
          :title="t('shell.guidance.tourTitulo')"
          @click="emit('tour')"
        />

        <Button
          v-else-if="guidance"
          class="partner-page__guidance"
          :class="{ 'partner-page__guidance--ativo': isGuidanceVisible }"
          type="button"
          icon="pi pi-info-circle"
          :label="isGuidanceVisible ? t('shell.guidance.hide') : t('shell.guidance.show')"
          outlined
          rounded
          severity="secondary"
          size="small"
          :aria-pressed="isGuidanceVisible"
          :title="isGuidanceVisible ? t('shell.guidance.hide') : t('shell.guidance.show')"
          @click="toggleGuidance"
        />

        <slot name="actions" />
      </div>
    </header>

    <div v-if="loading" class="partner-page__state" role="status" aria-live="polite">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>{{ t('frame.loading') }}</span>
    </div>

    <div
      v-else-if="showAccessRevoked"
      class="partner-page__state partner-page__state--revoked"
      role="status"
    >
      <i class="pi pi-lock" aria-hidden="true" />
      <div>
        <strong>{{ t('frame.accessRevoked.title') }}</strong>
        <p>{{ t('frame.accessRevoked.body') }}</p>
        <p class="partner-page__hint">{{ t('frame.accessRevoked.hint') }}</p>
      </div>

      <div class="partner-page__cta-row">
        <a
          class="partner-page__cta partner-page__cta--primary"
          :href="SUPPORT_CONTACTS.whatsappHref"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('frame.accessRevoked.ctaSupport') }}
        </a>
        <RouterLink class="partner-page__cta partner-page__cta--ghost" to="/settings?aba=empresa">
          {{ t('frame.accessRevoked.ctaNewCompany') }}
        </RouterLink>
        <Button :label="t('shell.logout')" severity="secondary" @click="logout" />
      </div>

      <p class="partner-page__contact">
        {{ t('frame.noAccess.contactLabel') }}
        <a :href="`mailto:${SUPPORT_CONTACTS.email}`">{{ SUPPORT_CONTACTS.email }}</a>
      </p>
    </div>

    <div
      v-else-if="noPartnerAccess"
      class="partner-page__state partner-page__state--blocked"
      role="status"
    >
      <i class="pi pi-building" aria-hidden="true" />
      <div>
        <strong>{{ t('frame.noAccess.title') }}</strong>
        <p>
          {{ t('frame.noAccess.body') }}
        </p>
        <p class="partner-page__hint">
          {{ t('frame.noAccess.hint') }}
        </p>
      </div>

      <div class="partner-page__cta-row">
        <RouterLink class="partner-page__cta partner-page__cta--primary" to="/settings?aba=empresa">
          {{ t('frame.noAccess.ctaPrograms') }}
        </RouterLink>
        <RouterLink
          v-if="showClinicalCta"
          class="partner-page__cta partner-page__cta--ghost"
          to="/settings?aba=perfil"
        >
          {{ t('frame.noAccess.ctaSettings') }}
        </RouterLink>
        <Button :label="t('frame.noAccess.retry')" severity="secondary" @click="emit('retry')" />
      </div>

      <p class="partner-page__contact">
        {{ t('frame.noAccess.contactLabel') }}
        <a href="mailto:atendimento@petjourney.health">atendimento@petjourney.health</a>
      </p>
    </div>

    <div v-else-if="error" class="partner-page__state partner-page__state--error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <div>
        <strong>{{ t('frame.error.title') }}</strong>
        <p>{{ error }}</p>
      </div>
      <Button :label="t('frame.error.retry')" severity="secondary" @click="emit('retry')" />
    </div>

    <div
      v-else-if="showSuspended"
      class="partner-page__state partner-page__state--suspended"
      role="alert"
    >
      <i class="pi pi-ban" aria-hidden="true" />
      <div>
        <strong>{{ t('frame.suspended.title') }}</strong>
        <p>{{ t('frame.suspended.body') }}</p>
        <p v-if="suspendedReason" class="partner-page__hint">
          {{ t('frame.operability.reasonPrefix') }} {{ suspendedReason }}
        </p>
      </div>

      <div class="partner-page__support">
        <p class="partner-page__support-lede">{{ t('frame.suspended.channelsLede') }}</p>
        <ul class="partner-page__channels">
          <li v-for="channel in supportChannels" :key="channel.id">
            <a
              class="partner-page__channel"
              :href="channel.href"
              :target="channel.external ? '_blank' : undefined"
              :rel="channel.external ? 'noopener noreferrer' : undefined"
            >
              <span class="partner-page__channel-icon" aria-hidden="true">
                <i :class="channel.icon" />
              </span>
              <span class="partner-page__channel-copy">
                <strong>{{ t(channel.labelKey) }}</strong>
                <small>{{ channel.value }}</small>
              </span>
              <i class="pi pi-external-link partner-page__channel-arrow" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div v-else-if="empty" class="partner-page__state partner-page__state--empty">
      <i class="pi pi-inbox" aria-hidden="true" />
      <div>
        <strong>{{ resolvedEmptyTitle }}</strong>
        <p v-if="emptyDescription">{{ emptyDescription }}</p>
      </div>
      <Button v-if="emptyActionLabel" :label="emptyActionLabel" @click="emit('emptyAction')" />
    </div>

    <div v-else class="partner-page__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.partner-page {
  min-height: calc(100vh - 4.25rem);
  max-width: 100%;
  padding: 1.5rem 1.35rem 2rem;
  overflow-x: clip;
  background: var(--partner-bg);
  color: var(--partner-text);
}

.partner-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.35rem;
}

.partner-page__subtitle {
  margin: 0 0 0.2rem;
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.partner-page__title {
  margin: 0;
  font-size: clamp(1.45rem, 2vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.partner-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.partner-page__guidance.p-button {
  min-height: 2.2rem;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-color: var(--partner-line, transparent);
  color: var(--partner-faint, inherit);
  font-size: 0.76rem;
}

.partner-page__guidance.p-button :deep(.p-button-label) {
  font-weight: 650;
}

.partner-page__guidance.p-button:not(:disabled):hover {
  border-color: var(--partner-line, transparent);
  background: var(--partner-card, transparent);
  color: var(--partner-muted, inherit);
}

.partner-page__guidance--ativo.p-button,
.partner-page__guidance--ativo.p-button:not(:disabled):hover {
  background: var(--partner-card, transparent);
  color: var(--partner-text, inherit);
}

/* No estreito sobra o ícone: o rótulo empurraria as ações da tela para outra linha. */
@media (max-width: 720px) {
  .partner-page__guidance.p-button {
    padding-inline: 0.55rem;
  }

  .partner-page__guidance.p-button :deep(.p-button-label) {
    display: none;
  }
}

.partner-page__body {
  display: grid;
  gap: 1rem;
}

.partner-page__state {
  display: grid;
  gap: 0.85rem;
  justify-items: center;
  max-width: 40rem;
  margin-inline: auto;
  padding: 3rem 1.5rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  text-align: center;
}

.partner-page__state i {
  font-size: 1.5rem;
  color: var(--partner-primary-strong);
}

.partner-page__state--error i {
  color: var(--partner-warm-text);
}

.partner-page__state--blocked i {
  color: var(--partner-primary-strong);
}

/** Estado terminal: sem alarme de risco, só a porta fechada. */
.partner-page__state--revoked {
  border-color: color-mix(in srgb, var(--partner-muted) 22%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-surface) 45%, var(--partner-card));
}

.partner-page__state--revoked > i {
  color: var(--partner-muted);
}

.partner-page__state--suspended {
  border-color: color-mix(in srgb, var(--partner-warm-text) 24%, var(--partner-line));
  background: var(--partner-card);
}

.partner-page__state--suspended > i {
  color: var(--partner-warm-text);
}

.partner-page__support {
  display: grid;
  gap: 0.75rem;
  width: min(100%, 42rem);
  margin-top: 0.25rem;
  text-align: start;
}

.partner-page__support-lede {
  margin: 0 !important;
  color: var(--partner-muted);
  font-size: 0.84rem !important;
  font-weight: 650;
  text-align: center;
}

.partner-page__channels {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.partner-page__channel {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  min-height: 100%;
  padding: 0.7rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 90%, transparent);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--partner-surface) 55%, var(--partner-card));
  color: inherit;
  text-decoration: none;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.partner-page__channel:hover,
.partner-page__channel:focus-visible {
  border-color: color-mix(in srgb, var(--partner-primary) 32%, var(--partner-line));
  background: color-mix(in srgb, var(--partner-primary-soft) 28%, var(--partner-card));
  outline: none;
  transform: translateY(-1px);
}

.partner-page__channel-icon {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.95rem;
}

.partner-page__channel-copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.partner-page__channel-copy strong {
  margin: 0 !important;
  font-size: 0.86rem !important;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.partner-page__channel-copy small {
  color: var(--partner-muted);
  font-size: 0.78rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.partner-page__channel-arrow {
  display: none;
}

@media (max-width: 960px) {
  .partner-page__channels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .partner-page__channels {
    grid-template-columns: 1fr;
  }

  .partner-page__channel-arrow {
    display: block;
    flex: 0 0 auto;
    margin-inline-start: auto;
    color: var(--partner-faint);
    font-size: 0.75rem;
  }

  .partner-page__channel:hover .partner-page__channel-arrow,
  .partner-page__channel:focus-visible .partner-page__channel-arrow {
    color: var(--partner-primary-strong);
  }
}

.partner-page__state strong {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 1.1rem;
}

.partner-page__state p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.partner-page__hint {
  margin-top: 0.65rem !important;
  font-size: 0.86rem !important;
}

.partner-page__cta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem;
  margin-top: 0.35rem;
}

.partner-page__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.6rem;
  padding: 0 1.1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
}

.partner-page__cta--primary {
  background: var(--partner-primary);
  color: var(--partner-on-primary);
}

.partner-page__cta--ghost {
  border: 1px solid var(--partner-line);
  background: transparent;
  color: var(--partner-text);
}

.partner-page__contact {
  margin-top: 0.25rem !important;
  font-size: 0.82rem !important;
}

.partner-page__contact a {
  color: var(--partner-primary-strong);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 720px) {
  .partner-page {
    padding: 1rem 0.85rem 1.5rem;
  }

  .partner-page__header {
    flex-direction: column;
  }

  .partner-page__cta-row {
    flex-direction: column;
    width: 100%;
  }

  .partner-page__cta-row :deep(.p-button),
  .partner-page__cta {
    width: 100%;
  }
}
</style>
