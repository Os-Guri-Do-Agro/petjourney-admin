<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getCarteira, solicitarModo } from '@/service/parceiro/parceiro-portal-service'
import type { ModoParticipacao, StatusModoParceiro } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'
import {
  canManageSolicitacaoModo,
  getModoCardCopy,
  resolveModoCta,
  resolveSolicitarModoError,
} from '@/utils/parceiro/modo-participacao'

const props = withDefaults(
  defineProps<{
    modo: ModoParticipacao
    skeleton?: boolean
  }>(),
  {
    skeleton: false,
  },
)

const { t, locale } = useI18n()
const toast = useToast()
const { store, parceiroQuery } = useParceiroPortal()
const submitting = ref(false)
const saldoSacavelCentavos = ref<number | null>(null)

const meta = computed(() => {
  const copy = getModoCardCopy(props.modo)
  const ns = `programas.card.${props.modo}` as const

  return {
    icon: copy.icon,
    tone: copy.tone,
    title: t(`${ns}.title`),
    subtitle: t(`${ns}.subtitle`),
    description: t(`${ns}.description`),
    features: [t(`${ns}.feature1`), t(`${ns}.feature2`), t(`${ns}.feature3`)],
  }
})

const modoBloco = computed(() => store.modoBloco(props.modo))
const modoStatus = computed<StatusModoParceiro>(() => modoBloco.value.status)

const canManageSolicitacao = computed(() =>
  canManageSolicitacaoModo(store.isDono, store.semAcessoParceiro),
)

const cta = computed(() => resolveModoCta(modoBloco.value, props.modo, canManageSolicitacao.value))

const showSolicitarButton = computed(
  () => cta.value.type === 'solicitar' || cta.value.type === 'solicitar-novamente',
)

const ctaLabel = computed(() => {
  switch (cta.value.type) {
    case 'solicitar':
      return t('programas.card.cta.solicitar')
    case 'solicitar-novamente':
      return t('programas.card.cta.solicitarNovamente')
    case 'aguardando':
      return t('programas.card.cta.aguardando')
    case 'carteira':
      return t('programas.card.cta.carteira')
    default:
      return ''
  }
})

const STATUS_I18N_KEYS: Record<StatusModoParceiro, string> = {
  NAO_SOLICITADO: 'naoSolicitado',
  SOLICITADO: 'solicitado',
  ATIVO: 'ativo',
  REJEITADO: 'rejeitado',
  SUSPENSO: 'suspenso',
}

const badge = computed(() => {
  const icons: Record<StatusModoParceiro, string> = {
    NAO_SOLICITADO: 'pi pi-minus-circle',
    SOLICITADO: 'pi pi-clock',
    ATIVO: 'pi pi-check',
    REJEITADO: 'pi pi-times',
    SUSPENSO: 'pi pi-ban',
  }

  return {
    label: t(`programas.card.status.${STATUS_I18N_KEYS[modoStatus.value]}`),
    icon: icons[modoStatus.value],
  }
})

/** O tom do selo de status: verde ativo, pêssego em análise, coral recusado ou suspenso. */
const TOM_DO_STATUS: Record<StatusModoParceiro, string> = {
  NAO_SOLICITADO: 'hc--cinza',
  SOLICITADO: 'hc--pessego',
  ATIVO: 'hc--verde',
  REJEITADO: 'hc--coral',
  SUSPENSO: 'hc--coral',
}

const ativoDesdeLabel = computed(() => {
  const raw = store.status?.auditadoEm

  if (!raw) {
    return null
  }

  return new Date(raw).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
})

const saldoLabel = computed(() => {
  if (saldoSacavelCentavos.value == null) {
    return '-'
  }

  return formatCentavosToBrl(saldoSacavelCentavos.value, INTL_LOCALE[locale.value as Locale])
})

const decididoEmLabel = computed(() => {
  const raw = modoBloco.value.decididoEm

  if (!raw) {
    return null
  }

  return new Date(raw).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
  if (!canManageSolicitacao.value) {
    toast.add({
      severity: 'warn',
      summary: t('programas.card.toast.actionUnavailable'),
      detail: t('programas.card.toast.ownerOnly'),
      life: 4000,
    })
    return
  }

  if (!modoBloco.value.podeSolicitar) {
    return
  }

  submitting.value = true

  try {
    const result = await solicitarModo(props.modo, parceiroQuery())
    store.patchModoStatus(result.modo, result.status)
    toast.add({
      severity: 'success',
      summary: t('programas.card.toast.sent'),
      detail: t('programas.card.toast.sentDetail'),
      life: 4000,
    })

    try {
      await store.bootstrap(true)
    } catch {
      try {
        await store.refreshStatus()
      } catch {
        /* status pode permanecer local após patch */
      }
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('programas.card.toast.error'),
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
  <!--
    Uma linha por programa, e não um cartão: ícone, nome com o selo de status, o benefício numa
    frase e a ação à direita. Os dois programas cabem numa lista só; com os dois ativos, a tela é
    de consulta, e um cartão verde de ponta a ponta para um deles gritava sem motivo.
  -->
  <article v-if="skeleton" class="programa-linha" aria-hidden="true">
    <Skeleton width="2.6rem" height="2.6rem" border-radius="0.75rem" />
    <div class="programa-linha__corpo">
      <Skeleton width="12rem" height="1rem" border-radius="4px" />
      <Skeleton width="80%" height="0.8rem" border-radius="4px" />
    </div>
    <Skeleton width="8rem" height="2.25rem" border-radius="999px" />
  </article>

  <article
    v-else
    :id="modo === 'afiliado' ? 'programas-afiliado' : undefined"
    class="programa-linha"
    :data-status="modoStatus"
  >
    <span class="programa-linha__icone" aria-hidden="true">
      <i :class="meta.icon" />
    </span>

    <div class="programa-linha__corpo">
      <p class="programa-linha__nome">
        <strong>{{ meta.title }}</strong>
        <span class="hc-selo" :class="TOM_DO_STATUS[modoStatus]">
          {{
            modoStatus === 'ATIVO' && modo === 'afiliado' && ativoDesdeLabel
              ? t('programas.linha.ativoDesde', { data: ativoDesdeLabel })
              : badge.label
          }}
        </span>
      </p>

      <p class="programa-linha__frase">{{ meta.description }}</p>

      <p v-if="modoStatus === 'ATIVO' && modo === 'participativo'" class="programa-linha__nota">
        {{ t('programas.card.activeNoteParticipativo') }}
      </p>

      <p v-else-if="modoStatus === 'SOLICITADO'" class="programa-linha__aviso">
        <i class="pi pi-clock" aria-hidden="true" />
        {{ t('programas.card.info.pending') }}
      </p>

      <div
        v-else-if="modoStatus === 'REJEITADO' || modoStatus === 'SUSPENSO'"
        class="programa-linha__decisao"
      >
        <p class="programa-linha__aviso programa-linha__aviso--risco">
          <i class="pi pi-info-circle" aria-hidden="true" />
          {{
            modoStatus === 'REJEITADO'
              ? t('programas.card.info.rejected')
              : t('programas.card.info.suspended')
          }}
        </p>
        <p v-if="modoBloco.motivo" class="programa-linha__nota">
          <strong>{{ t('programas.card.info.motivoLabel') }}</strong> {{ modoBloco.motivo }}
        </p>
        <p v-if="decididoEmLabel" class="programa-linha__nota">
          {{ t('programas.card.info.decididoEm', { data: decididoEmLabel }) }}
        </p>
        <a
          v-if="modoStatus === 'SUSPENSO'"
          class="programa-linha__suporte"
          href="mailto:atendimento@petjourney.health"
        >
          {{ t('programas.card.info.contactSupport') }}
        </a>
      </div>
    </div>

    <div class="programa-linha__acao">
      <span v-if="modoStatus === 'ATIVO' && modo === 'afiliado'" class="programa-linha__saldo">
        <span>{{ t('programas.card.info.saldo') }}</span>
        <strong>{{ saldoLabel }}</strong>
      </span>

      <Button
        v-if="showSolicitarButton"
        type="button"
        :label="ctaLabel"
        :loading="submitting"
        size="small"
        @click="handleSolicitar"
      />

      <Button
        v-else-if="cta.type === 'carteira'"
        :as="RouterLink"
        :to="cta.to"
        :label="t('programas.linha.irParaGanhos')"
        icon="pi pi-arrow-right"
        icon-pos="right"
        severity="secondary"
        outlined
        size="small"
      />

      <Button
        v-else-if="cta.type === 'aguardando'"
        type="button"
        :label="ctaLabel"
        severity="secondary"
        outlined
        size="small"
        disabled
      />
    </div>
  </article>
</template>

<style scoped>
.programa-linha {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 0;
}

.programa-linha + .programa-linha {
  border-top: 1px solid var(--hc-linha);
}

.programa-linha__icone {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 1.05rem;
}

.programa-linha__corpo {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 0.3rem;
}

.programa-linha__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
}

.programa-linha__frase,
.programa-linha__nota {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.programa-linha__nota strong {
  color: var(--hc-tinta);
}

.programa-linha__aviso {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--hc-pessego-tinta);
  font-size: 0.8125rem;
  font-weight: 600;
}

.programa-linha__aviso--risco {
  color: var(--hc-coral-tinta);
}

.programa-linha__decisao {
  display: grid;
  gap: 0.25rem;
}

.programa-linha__suporte {
  color: var(--hc-marca-forte);
  font-size: 0.8125rem;
  font-weight: 650;
}

.programa-linha__acao {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1rem;
  align-self: center;
}

.programa-linha__saldo {
  display: grid;
  justify-items: end;
  gap: 0.1rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.programa-linha__saldo strong {
  color: var(--hc-tinta);
  font-size: 0.9375rem;
}

@media (max-width: 900px) {
  .programa-linha {
    flex-wrap: wrap;
  }

  .programa-linha__acao {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
