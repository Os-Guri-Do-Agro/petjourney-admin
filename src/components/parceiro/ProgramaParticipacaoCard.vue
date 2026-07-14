<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getCarteira, solicitarModo } from '@/service/parceiro/parceiro-portal-service'
import type { ModoParticipacao, StatusModoParceiro } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'
import {
  canSolicitarModo,
  getModoCardCopy,
  resolveModoCta,
  resolveSolicitarModoError,
} from '@/utils/parceiro/modo-participacao'
import { usePartnerFocusSurface } from '@/composables/usePartnerFocusSurface'
import { currentColors } from '@/theme/color-mode'

const props = withDefaults(
  defineProps<{
    modo: ModoParticipacao
    skeleton?: boolean
  }>(),
  {
    skeleton: false,
  },
)

const toast = useToast()
const { store, parceiroQuery } = useParceiroPortal()
const { focusSurfaceStyle } = usePartnerFocusSurface()
const submitting = ref(false)
const saldoSacavelCentavos = ref<number | null>(null)

const isFocusCard = computed(() => props.modo === 'afiliado')

const cardStyle = computed(() => {
  const colors = currentColors.value
  const base = {
    '--prog-card': colors.dashboard.surface,
    '--prog-surface': colors.dashboard.surfaceSoft,
    '--prog-line': colors.dashboard.line,
    '--prog-line-soft': colors.dashboard.lineSoft,
    '--prog-text': colors.dashboard.text,
    '--prog-muted': colors.dashboard.muted,
    '--prog-faint': colors.dashboard.faint,
    '--prog-primary': colors.vet.primary,
    '--prog-primary-soft': colors.vet.secondary,
    '--prog-primary-strong': colors.dashboard.primaryStrong,
    '--prog-success-bg': colors.dashboard.successBg,
    '--prog-success-text': colors.dashboard.successText,
    '--prog-amber-bg': colors.dashboard.amberBg,
    '--prog-amber-text': colors.dashboard.amberText,
    '--prog-warm-bg': colors.dashboard.warmBg,
    '--prog-warm-text': colors.dashboard.warmText,
    '--prog-shadow-rgb': colors.auth.shadowRgb,
  }

  if (!isFocusCard.value) {
    return base
  }

  return {
    ...base,
    ...focusSurfaceStyle.value,
  }
})

const meta = computed(() => getModoCardCopy(props.modo))

const modoStatus = computed<StatusModoParceiro>(() => {
  if (props.modo === 'afiliado') {
    return store.status?.statusAfiliado ?? 'NAO_SOLICITADO'
  }

  return store.status?.statusParticipativo ?? 'NAO_SOLICITADO'
})

const cta = computed(() => resolveModoCta(modoStatus.value, props.modo, store.isDono))

const showSolicitarButton = computed(
  () => cta.value.type === 'solicitar' || cta.value.type === 'solicitar-novamente',
)

const solicitarLabel = computed(() => {
  if (cta.value.type === 'solicitar' || cta.value.type === 'solicitar-novamente') {
    return cta.value.label
  }

  return ''
})

const badge = computed(() => {
  const labels: Record<StatusModoParceiro, { label: string; icon: string }> = {
    NAO_SOLICITADO: { label: 'Não ativo', icon: 'pi pi-minus-circle' },
    SOLICITADO: { label: 'Em análise', icon: 'pi pi-clock' },
    ATIVO: { label: 'Ativo', icon: 'pi pi-check' },
    REJEITADO: { label: 'Recusado', icon: 'pi pi-times' },
    SUSPENSO: { label: 'Suspenso', icon: 'pi pi-ban' },
  }

  return labels[modoStatus.value]
})

const ativoDesdeLabel = computed(() => {
  const raw = store.status?.auditadoEm

  if (!raw) {
    return null
  }

  return new Date(raw).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
})

const saldoLabel = computed(() => {
  if (saldoSacavelCentavos.value == null) {
    return '—'
  }

  return formatCentavosToBrl(saldoSacavelCentavos.value)
})

async function loadCarteiraResumo() {
  if (props.modo !== 'afiliado' || modoStatus.value !== 'ATIVO') {
    saldoSacavelCentavos.value = null
    return
  }

  try {
    const carteira = await getCarteira(parceiroQuery())
    saldoSacavelCentavos.value = carteira.saldoSacavelCentavos
  } catch {
    saldoSacavelCentavos.value = null
  }
}

async function handleSolicitar() {
  if (!store.isDono) {
    toast.add({
      severity: 'warn',
      summary: 'Ação indisponível',
      detail: 'Apenas o dono da empresa pode solicitar programas.',
      life: 4000,
    })
    return
  }

  if (!store.podeOperar || !canSolicitarModo(modoStatus.value)) {
    return
  }

  submitting.value = true

  try {
    const result = await solicitarModo(props.modo, parceiroQuery())
    store.patchModoStatus(result.modo, result.status)
    toast.add({
      severity: 'success',
      summary: 'Solicitação enviada',
      detail: 'Aguarde a análise do time PetJourney.',
      life: 4000,
    })
    void store.refreshStatus()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro ao solicitar',
      detail: resolveSolicitarModoError(err),
      life: 5000,
    })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (props.skeleton) {
    return
  }

  void loadCarteiraResumo()
})

watch(modoStatus, () => {
  if (props.skeleton) {
    return
  }

  void loadCarteiraResumo()
})
</script>

<template>
  <article
    v-if="skeleton"
    class="programa-card programa-card--skeleton"
    :class="[`programa-card--${meta.tone}`, { 'programa-card--focus': isFocusCard }]"
    :style="cardStyle"
    aria-hidden="true"
  >
    <div v-if="isFocusCard" class="programa-card__glow" />
    <header class="programa-card__head">
      <div class="programa-card__identity">
        <Skeleton width="2.75rem" height="2.75rem" border-radius="0.85rem" />
        <div class="programa-card__skel-identity">
          <Skeleton width="7.5rem" height="1.05rem" border-radius="4px" />
          <Skeleton width="9rem" height="0.8rem" border-radius="4px" />
        </div>
      </div>
      <Skeleton width="5rem" height="1.5rem" border-radius="999px" />
    </header>

    <div class="programa-card__skel-description">
      <Skeleton width="100%" height="0.85rem" border-radius="4px" />
      <Skeleton width="88%" height="0.85rem" border-radius="4px" />
    </div>

    <ul class="programa-card__features">
      <li v-for="index in 3" :key="index">
        <Skeleton width="0.9rem" height="0.9rem" border-radius="999px" />
        <Skeleton width="70%" height="0.8rem" border-radius="4px" />
      </li>
    </ul>

    <div class="programa-card__action">
      <Skeleton width="100%" height="2.75rem" border-radius="0.85rem" />
    </div>
  </article>

  <article
    v-else
    :id="modo === 'afiliado' ? 'programas-afiliado' : undefined"
    class="programa-card"
    :class="[`programa-card--${meta.tone}`, { 'programa-card--focus': isFocusCard }]"
    :data-status="modoStatus"
    :style="cardStyle"
  >
    <div v-if="isFocusCard" class="programa-card__glow" aria-hidden="true" />
    <header class="programa-card__head">
      <div class="programa-card__identity">
        <span class="programa-card__icon" aria-hidden="true">
          <i :class="meta.icon" />
        </span>
        <div>
          <h3>{{ meta.title }}</h3>
          <p>{{ meta.subtitle }}</p>
        </div>
      </div>
      <span class="programa-card__badge">
        <i :class="badge.icon" aria-hidden="true" />
        {{ badge.label }}
      </span>
    </header>

    <p class="programa-card__description">
      {{ meta.description }}
      <span v-if="modo === 'participativo'" class="programa-card__soon">(Em breve.)</span>
    </p>

    <ul class="programa-card__features">
      <li v-for="feature in meta.features" :key="feature">
        <i class="pi pi-check" aria-hidden="true" />
        <span>{{ feature }}</span>
      </li>
    </ul>

    <div
      v-if="modoStatus === 'ATIVO' && modo === 'afiliado'"
      class="programa-card__info programa-card__info--success"
    >
      <div>
        <span>Saldo disponível</span>
        <strong>{{ saldoLabel }}</strong>
      </div>
      <div v-if="ativoDesdeLabel">
        <span>Ativo desde</span>
        <strong>{{ ativoDesdeLabel }}</strong>
      </div>
    </div>

    <div
      v-else-if="modoStatus === 'SOLICITADO'"
      class="programa-card__info programa-card__info--pending"
    >
      <i class="pi pi-clock" aria-hidden="true" />
      <p>Sua solicitação foi enviada e está aguardando análise da equipe PetJourney.</p>
    </div>

    <div
      v-else-if="modoStatus === 'REJEITADO' || modoStatus === 'SUSPENSO'"
      class="programa-card__info programa-card__info--warning"
    >
      <i class="pi pi-info-circle" aria-hidden="true" />
      <p>
        {{
          modoStatus === 'REJEITADO'
            ? 'A solicitação foi recusada. Você pode enviar um novo pedido quando fizer sentido.'
            : 'O programa foi suspenso. Solicite novamente após alinhar com o time PetJourney.'
        }}
      </p>
    </div>

    <div class="programa-card__action">
      <button
        v-if="showSolicitarButton"
        class="programa-card__button programa-card__button--primary"
        type="button"
        :disabled="!store.podeOperar || submitting"
        @click="handleSolicitar"
      >
        <i v-if="submitting" class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>{{ solicitarLabel }}</span>
      </button>

      <RouterLink
        v-else-if="cta.type === 'carteira'"
        class="programa-card__button programa-card__button--primary"
        :to="cta.to"
      >
        <span>{{ cta.label }}</span>
        <i class="pi pi-arrow-right" aria-hidden="true" />
      </RouterLink>

      <button
        v-else-if="cta.type === 'aguardando'"
        class="programa-card__button programa-card__button--waiting"
        type="button"
        disabled
      >
        {{ cta.label }}
      </button>

      <p
        v-else-if="modoStatus === 'ATIVO' && modo === 'participativo'"
        class="programa-card__active-note"
      >
        Programa ativo. Benefícios operacionais são comunicados pela equipe PetJourney.
      </p>
    </div>
  </article>
</template>

<style scoped>
.programa-card {
  display: grid;
  gap: 0.95rem;
  align-content: start;
  min-height: 100%;
  padding: 1.25rem 1.3rem 1.25rem;
  border: 1px solid var(--prog-line);
  border-radius: 1.2rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--prog-surface) 82%, var(--prog-card)) 0%,
      var(--prog-card) 48%
    );
  box-shadow: 0 14px 30px rgb(var(--prog-shadow-rgb) / 0.045);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.programa-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--prog-primary) 28%, var(--prog-line));
  box-shadow: 0 18px 34px rgb(var(--prog-shadow-rgb) / 0.07);
}

.programa-card--focus {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    radial-gradient(
      circle at 88% -8%,
      rgb(var(--pf-glow-rgb) / 0.28) 0%,
      rgb(var(--pf-glow-rgb) / 0.08) 38%,
      transparent 64%
    ),
    linear-gradient(152deg, var(--pf-from), var(--pf-to));
  box-shadow: 0 18px 40px rgb(var(--pf-shadow-rgb) / 0.11);
  color: var(--pf-on);
}

.programa-card--focus:hover {
  border-color: transparent;
  box-shadow: 0 20px 44px rgb(var(--pf-shadow-rgb) / 0.14);
}

.programa-card__glow {
  position: absolute;
  top: -4rem;
  right: 0;
  z-index: 0;
  width: 11rem;
  max-width: 55%;
  height: 11rem;
  border-radius: 999px;
  background: rgb(var(--pf-glow-rgb) / 0.14);
  pointer-events: none;
  transform: translateX(30%);
}

.programa-card--focus > :not(.programa-card__glow) {
  position: relative;
  z-index: 1;
}

.programa-card--focus .programa-card__identity p,
.programa-card--focus .programa-card__description,
.programa-card--focus .programa-card__features li {
  color: var(--pf-on-soft);
}

.programa-card--focus .programa-card__icon {
  background: var(--pf-chip);
  color: var(--pf-on);
}

.programa-card--focus .programa-card__badge {
  background: var(--pf-chip);
  color: var(--pf-on);
}

.programa-card--focus .programa-card__info--success {
  background: var(--pf-field);
}

.programa-card--focus .programa-card__info--success span {
  color: var(--pf-on-soft);
}

.programa-card--focus .programa-card__button--primary {
  background: var(--pf-cta-bg);
  color: var(--pf-cta-text);
}

.programa-card--focus .programa-card__button--waiting {
  background: var(--pf-chip);
  color: var(--pf-on);
}

.programa-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.programa-card__identity {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

.programa-card__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.85rem;
  font-size: 1.05rem;
}

.programa-card--afiliado .programa-card__icon {
  background: color-mix(in srgb, var(--prog-primary) 20%, var(--prog-card));
  color: var(--prog-primary-strong);
}

.programa-card--participativo .programa-card__icon {
  background: color-mix(in srgb, var(--prog-amber-text) 14%, var(--prog-card));
  color: var(--prog-amber-text);
}

.programa-card__identity h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.programa-card__identity p {
  margin: 0.15rem 0 0;
  color: var(--prog-muted);
  font-size: 0.8rem;
}

.programa-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.62rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.programa-card[data-status='ATIVO'] .programa-card__badge {
  background: var(--prog-success-bg);
  color: var(--prog-success-text);
}

.programa-card[data-status='SOLICITADO'] .programa-card__badge {
  background: var(--prog-amber-bg);
  color: var(--prog-amber-text);
}

.programa-card[data-status='REJEITADO'] .programa-card__badge,
.programa-card[data-status='SUSPENSO'] .programa-card__badge {
  background: var(--prog-warm-bg);
  color: var(--prog-warm-text);
}

.programa-card[data-status='NAO_SOLICITADO'] .programa-card__badge {
  background: var(--prog-surface);
  color: var(--prog-muted);
}

.programa-card__description {
  margin: 0;
  color: var(--prog-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.programa-card__soon {
  color: var(--prog-amber-text);
  font-weight: 600;
}

.programa-card__features {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.programa-card__features li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--prog-text);
  font-size: 0.84rem;
}

.programa-card--afiliado:not(.programa-card--focus) .programa-card__features i {
  color: var(--prog-success-text);
}

.programa-card--participativo .programa-card__features i {
  color: var(--prog-amber-text);
}

.programa-card--focus .programa-card__features i {
  color: var(--pf-on);
}

.programa-card__info {
  display: grid;
  gap: 0.65rem;
  padding: 0.9rem 0.95rem;
  border-radius: 0.9rem;
}

.programa-card__info--success {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: color-mix(in srgb, var(--prog-success-bg) 55%, var(--prog-card));
}

.programa-card__info--success span {
  display: block;
  color: var(--prog-muted);
  font-size: 0.74rem;
}

.programa-card__info--success strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.08rem;
  letter-spacing: -0.02em;
}

.programa-card__info--pending,
.programa-card__info--warning {
  grid-template-columns: auto 1fr;
  align-items: start;
}

.programa-card__info--pending {
  background: color-mix(in srgb, var(--prog-amber-bg) 65%, var(--prog-card));
  color: var(--prog-amber-text);
}

.programa-card__info--warning {
  background: color-mix(in srgb, var(--prog-warm-bg) 65%, var(--prog-card));
  color: var(--prog-warm-text);
}

.programa-card__info p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
}

.programa-card__action {
  margin-top: auto;
  padding-top: 0.25rem;
}

.programa-card__button {
  display: inline-flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 0;
  border-radius: 0.85rem;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 140ms ease,
    opacity 140ms ease,
    transform 140ms ease;
}

.programa-card__button i {
  transition: transform 140ms ease;
}

.programa-card__button--primary {
  background: var(--prog-primary);
  color: color-mix(in srgb, white 96%, transparent);
}

.programa-card--participativo .programa-card__button--primary {
  background: color-mix(in srgb, var(--prog-primary) 88%, var(--prog-text));
}

.programa-card__button--primary:hover,
.programa-card__button--primary:focus-visible {
  transform: translateY(-1px);
  outline: none;
  filter: brightness(1.03);
}

.programa-card__button--primary:hover i,
.programa-card__button--primary:focus-visible i {
  transform: translateX(2px);
}

.programa-card__button--primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  filter: none;
}

.programa-card__button--waiting {
  background: color-mix(in srgb, var(--prog-amber-bg) 80%, var(--prog-card));
  color: var(--prog-amber-text);
  cursor: default;
}

.programa-card__active-note {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 0.85rem;
  background: var(--prog-success-bg);
  color: var(--prog-success-text);
  font-size: 0.82rem;
  line-height: 1.45;
}

.programa-card--skeleton {
  pointer-events: none;
}

.programa-card--skeleton:hover {
  transform: none;
  border-color: transparent;
  box-shadow: 0 18px 40px rgb(var(--pf-shadow-rgb, var(--prog-shadow-rgb)) / 0.11);
}

.programa-card:not(.programa-card--focus).programa-card--skeleton:hover {
  border-color: var(--prog-line);
  box-shadow: 0 14px 30px rgb(var(--prog-shadow-rgb) / 0.045);
}

.programa-card__skel-identity,
.programa-card__skel-description {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.programa-card--focus.programa-card--skeleton :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, white 30%, transparent);
  --p-skeleton-animation-background: color-mix(in srgb, white 14%, transparent);
}

.programa-card--skeleton:not(.programa-card--focus) :deep(.p-skeleton) {
  --p-skeleton-background: color-mix(in srgb, var(--prog-primary-soft) 42%, var(--prog-card));
  --p-skeleton-animation-background: color-mix(
    in srgb,
    var(--prog-primary-soft) 18%,
    transparent
  );
}

@media (prefers-reduced-motion: reduce) {
  .programa-card:hover,
  .programa-card__button--primary:hover {
    transform: none;
  }
}

@media (max-width: 720px) {
  .programa-card__info--success {
    grid-template-columns: 1fr;
  }
}
</style>
