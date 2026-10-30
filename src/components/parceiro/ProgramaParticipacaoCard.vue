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
/** O mínimo de saque que a API manda na carteira, como na Carteira e no Início. */
const saqueMinimoCentavos = ref<number | null>(null)
const carregandoCarteira = ref(false)

/**
 * O saque do Afiliados cita o mínimo da API, não um valor escrito no texto, que mentiria quando o
 * mínimo mudasse. Sem a carteira (programa não ativo, ou ela falhou), a frase vai sem o valor;
 * enquanto ela chega, um esqueleto, para a linha não trocar de texto diante de quem lê (`null`).
 */
const featureDoSaque = computed<string | null>(() => {
  if (carregandoCarteira.value) {
    return null
  }

  return saqueMinimoCentavos.value == null
    ? t('programas.card.afiliado.feature3SemValor')
    : t('programas.card.afiliado.feature3', {
        valor: formatCentavosToBrl(saqueMinimoCentavos.value, INTL_LOCALE[locale.value as Locale]),
      })
})

const meta = computed(() => {
  const copy = getModoCardCopy(props.modo)
  const ns = `programas.card.${props.modo}` as const

  return {
    icon: copy.icon,
    tone: copy.tone,
    title: t(`${ns}.title`),
    subtitle: t(`${ns}.subtitle`),
    description: t(`${ns}.description`),
    features: [
      t(`${ns}.feature1`),
      t(`${ns}.feature2`),
      props.modo === 'afiliado' ? featureDoSaque.value : t(`${ns}.feature3`),
    ],
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

/**
 * O selo do estado: palavra, ícone e cor andam juntos. A cor é a dos estados do sistema: neutro
 * para o que não começou, atenção para a análise, ok para o ativo, risco para recusa e suspensão.
 */
const SELO_DO_STATUS: Record<StatusModoParceiro, { classe: string; icone: string }> = {
  NAO_SOLICITADO: { classe: '', icone: 'ph ph-minus-circle' },
  SOLICITADO: { classe: 'ui-selo--atencao', icone: 'ph ph-hourglass' },
  ATIVO: { classe: 'ui-selo--ok', icone: 'ph ph-check-circle' },
  REJEITADO: { classe: 'ui-selo--risco', icone: 'ph ph-x-circle' },
  SUSPENSO: { classe: 'ui-selo--risco', icone: 'ph ph-prohibit' },
}

const badge = computed(() => ({
  label: t(`programas.card.status.${STATUS_I18N_KEYS[modoStatus.value]}`),
  ...SELO_DO_STATUS[modoStatus.value],
}))

/** Quem não é dono vê o estado, mas não pede: a frase diz por quê, no lugar do botão. */
const mostraSoDono = computed(
  () =>
    !canManageSolicitacao.value &&
    !store.semAcessoParceiro &&
    (modoStatus.value === 'NAO_SOLICITADO' || modoStatus.value === 'REJEITADO'),
)

const temPe = computed(
  () =>
    (modoStatus.value === 'ATIVO' && props.modo === 'afiliado') ||
    showSolicitarButton.value ||
    cta.value.type === 'carteira' ||
    mostraSoDono.value,
)

/**
 * Desde quando o programa vale: a decisão dele, ou a do credenciamento quando a API não manda a
 * do programa. Vale para os dois: só o de Afiliados dizia a data, e o Participativo, aprovado no
 * mesmo dia, ficava com um "Ativo" seco ao lado.
 */
const ativoDesdeLabel = computed(() => {
  const raw = modoBloco.value.decididoEm ?? store.status?.auditadoEm

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
    saqueMinimoCentavos.value = null
    return
  }

  carregandoCarteira.value = true

  try {
    const carteira = await getCarteira(parceiroQuery())
    saldoSacavelCentavos.value = carteira.saldoSacavelCentavos
    saqueMinimoCentavos.value = carteira.saqueMinimoCentavos ?? null
  } catch {
    saldoSacavelCentavos.value = null
    saqueMinimoCentavos.value = null
  } finally {
    carregandoCarteira.value = false
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
    Uma folha por programa: nome e estado no alto, o que o programa dá no meio, e no pé a ação
    certa para o estado (pedir, pedir de novo, ir para os ganhos). Em análise não há botão: a
    linha de atenção diz o que está acontecendo.
  -->
  <article v-if="skeleton" class="programa ui-folha ui-cartao" aria-hidden="true">
    <div class="ui-cartao__cabeca">
      <Skeleton width="44px" height="44px" border-radius="13px" />
      <div class="ui-cartao__titulos">
        <Skeleton width="11rem" height="1.1rem" border-radius="6px" />
        <Skeleton width="7rem" height="0.8rem" border-radius="6px" />
      </div>
    </div>
    <div class="ui-cartao__corpo programa__corpo">
      <Skeleton width="100%" height="0.85rem" border-radius="6px" />
      <Skeleton width="80%" height="0.85rem" border-radius="6px" />
      <div class="programa__da ui-poco">
        <Skeleton v-for="n in 3" :key="n" width="70%" height="0.8rem" border-radius="6px" />
      </div>
    </div>
  </article>

  <article
    v-else
    :id="modo === 'afiliado' ? 'programas-afiliado' : undefined"
    class="programa ui-folha ui-cartao"
    :class="`programa--${modo}`"
    :data-status="modoStatus"
    :aria-labelledby="`programa-${modo}-nome`"
  >
    <header
      class="ui-cartao__cabeca programa__cabeca"
      :class="{ 'ui-cartao__cabeca--lugar': modoStatus === 'ATIVO' }"
    >
      <span
        class="ui-ladrilho ui-ladrilho--g"
        :class="{ 'ui-ladrilho--lugar': modoStatus === 'ATIVO' }"
        aria-hidden="true"
      >
        <i :class="meta.icon" />
      </span>

      <div class="ui-cartao__titulos">
        <h3 :id="`programa-${modo}-nome`" class="ui-cartao__titulo programa__nome">
          {{ meta.title }}
        </h3>
        <p class="ui-cartao__descricao">{{ meta.subtitle }}</p>
      </div>

      <div class="ui-cartao__acoes">
        <span class="ui-selo programa__selo" :class="badge.classe">
          <i :class="badge.icone" aria-hidden="true" />
          {{
            modoStatus === 'ATIVO' && ativoDesdeLabel
              ? t('programas.linha.ativoDesde', { data: ativoDesdeLabel })
              : badge.label
          }}
        </span>
      </div>
    </header>

    <div class="ui-cartao__corpo programa__corpo">
      <p class="programa__descricao">{{ meta.description }}</p>

      <div class="programa__da ui-poco">
        <h4 class="programa__rotulo">{{ t('programas.card.oQueDa') }}</h4>
        <ul class="programa__lista">
          <li v-for="(feature, indice) in meta.features" :key="indice">
            <i class="ph ph-check" aria-hidden="true" />
            <Skeleton
              v-if="feature === null"
              class="programa__esqueleto"
              width="12rem"
              height="0.85rem"
              border-radius="6px"
            />
            <span v-else>{{ feature }}</span>
          </li>
        </ul>
      </div>

      <p v-if="modoStatus === 'ATIVO' && modo === 'participativo'" class="programa__aviso">
        <i class="ph ph-phone" aria-hidden="true" />
        <span>{{ t('programas.card.activeNoteParticipativo') }}</span>
      </p>

      <p
        v-else-if="modoStatus === 'SOLICITADO'"
        class="programa__aviso programa__aviso--atencao"
        role="status"
      >
        <i class="ph ph-hourglass" aria-hidden="true" />
        <span>{{ t('programas.card.info.pending') }}</span>
      </p>

      <div
        v-else-if="modoStatus === 'REJEITADO' || modoStatus === 'SUSPENSO'"
        class="programa__aviso programa__aviso--risco"
      >
        <i
          class="ph"
          :class="modoStatus === 'REJEITADO' ? 'ph-x-circle' : 'ph-prohibit'"
          aria-hidden="true"
        />
        <span class="programa__decisao">
          <span>
            {{
              modoStatus === 'REJEITADO'
                ? t('programas.card.info.rejected')
                : t('programas.card.info.suspended')
            }}
          </span>
          <span v-if="modoBloco.motivo">
            <strong>{{ t('programas.card.info.motivoLabel') }}</strong> {{ modoBloco.motivo }}
          </span>
          <span v-if="decididoEmLabel" class="programa__quando ui-num">
            {{ t('programas.card.info.decididoEm', { data: decididoEmLabel }) }}
          </span>
          <a
            v-if="modoStatus === 'SUSPENSO'"
            class="ui-mais programa__suporte"
            href="mailto:atendimento@petjourney.health"
          >
            <i class="ph ph-envelope-simple" aria-hidden="true" />
            {{ t('programas.card.info.contactSupport') }}
          </a>
        </span>
      </div>
    </div>

    <footer v-if="temPe" class="ui-cartao__pe programa__pe">
      <span v-if="modoStatus === 'ATIVO' && modo === 'afiliado'" class="programa__saldo">
        <span>{{ t('programas.card.info.saldo') }}</span>
        <strong class="ui-num">{{ saldoLabel }}</strong>
      </span>

      <p v-else-if="mostraSoDono" class="programa__so-dono">
        <i class="ph ph-lock-simple" aria-hidden="true" />
        {{ t('programas.card.toast.ownerOnly') }}
      </p>

      <Button
        v-if="showSolicitarButton"
        type="button"
        class="programa__acao"
        icon="ph ph-paper-plane-tilt"
        :label="ctaLabel"
        :loading="submitting"
        @click="handleSolicitar"
      />

      <Button
        v-else-if="cta.type === 'carteira'"
        :as="RouterLink"
        :to="cta.to"
        class="programa__acao"
        icon="ph ph-wallet"
        :label="t('programas.linha.irParaGanhos')"
        severity="secondary"
        outlined
      />
    </footer>
  </article>
</template>

<style scoped>
/* Um cartão por programa: a cabeça com o nome e o estado, o corpo e, no pé, a ação. */
.programa {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: clip;
}

.programa__cabeca {
  align-items: flex-start;
  padding-top: 18px;
}

.programa__nome.ui-cartao__titulo {
  font-size: 17px;
}

.programa__cabeca .ui-cartao__acoes {
  padding-top: 2px;
}

.programa__corpo {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 16px;
}

.programa__descricao {
  max-width: 62ch;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.55;
}

.programa__da.ui-poco {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
}

.programa__rotulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.programa__lista {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.programa__lista li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.programa__lista i {
  display: grid;
  width: 20px;
  height: 20px;
  flex: none;
  place-items: center;
  margin-top: 1px;
  border-radius: 999px;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 12px;
}

.programa[data-status='ATIVO'] .programa__lista i {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

/* O mínimo de saque chegando: na altura da linha de texto que vai ocupar o lugar. */
.programa__esqueleto {
  align-self: center;
  max-width: 100%;
}

/* O estado em linha: ícone na tinta do estado, texto em tinta normal. */
.programa__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.programa__aviso > i {
  margin-top: 1px;
  color: var(--tinta-2);
  font-size: 17px;
}

.programa__aviso--atencao {
  background: var(--atencao-fundo);
}

.programa__aviso--atencao > i {
  color: var(--atencao-tinta);
}

.programa__aviso--risco {
  background: var(--risco-fundo);
}

.programa__aviso--risco > i {
  color: var(--risco-tinta);
}

.programa__decisao {
  display: grid;
  gap: 4px;
}

.programa__decisao strong {
  font-weight: 600;
}

.programa__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

.programa__suporte.ui-mais {
  justify-self: start;
  margin-top: 2px;
  color: var(--risco-tinta);
}

/* O pé: o que se lê à esquerda, a ação à direita. */
.programa__pe.ui-cartao__pe {
  justify-content: space-between;
  gap: 12px 16px;
  padding-block: 14px 16px;
}

.programa__saldo {
  display: grid;
  gap: 1px;
}

.programa__saldo span {
  color: var(--tinta-2);
  font-size: 13px;
}

.programa__saldo strong {
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.programa__so-dono {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.programa__acao.p-button {
  margin-inline-start: auto;
}

@media (max-width: 520px) {
  .programa__cabeca {
    flex-wrap: wrap;
  }

  .programa__cabeca .ui-cartao__acoes {
    width: 100%;
    justify-content: flex-start;
    padding-inline-start: 58px;
  }

  .programa__acao.p-button {
    width: 100%;
  }
}
</style>
