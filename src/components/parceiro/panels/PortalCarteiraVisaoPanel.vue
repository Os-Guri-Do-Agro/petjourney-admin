<script setup lang="ts">
/**
 * O resumo da carteira: os fatos numa linha, e os diálogos de saque e de chave PIX.
 *
 * Era a aba "Visão geral": três cartões de número (saldo sacável, saldo total, total sacado),
 * dois formulários abertos lado a lado e quatro cartões de ajuda. O saldo sacável subiu para a
 * frase do topo da página, e as duas ações viraram as pílulas dela; aqui ficam o que a frase não
 * diz (quanto já foi sacado, o mínimo, o ciclo, a chave) e os dois diálogos que as pílulas abrem.
 *
 * A página monta a saudação e chama `abrirSaque` / `abrirPix`; este painel carrega a carteira e
 * conta à página o que ela precisa saber pelo evento `estado`.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  getCarteira,
  solicitarSaque,
  updateCarteiraPix,
} from '@/service/parceiro/parceiro-portal-service'
import {
  capacidadeDeSaque,
  MIN_SAQUE_CENTAVOS,
  type CapacidadeDeSaque,
} from '@/service/parceiro/regras-de-saque'
import type { Carteira } from '@/service/parceiro/types'
import {
  formatCentavosToBrl,
  maskBrlCurrencyInput,
  parseBrlToCentavos,
} from '@/utils/format/money'

export type EstadoDaCarteira = {
  carregando: boolean
  saldoSacavelCentavos: number
  saldoTotalCentavos: number
  capacidade: CapacidadeDeSaque | null
  ehDono: boolean
}

const emit = defineEmits<{
  needsProgramas: []
  estado: [estado: EstadoDaCarteira]
}>()

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

/** Valores em BRL escritos no formato do idioma da tela. */
function formatBrl(centavos: number) {
  return formatCentavosToBrl(centavos, INTL_LOCALE[locale.value as Locale])
}

const carteira = ref<Carteira | null>(null)
const loading = ref(true)
const error = ref('')
const chavePix = ref('')
const valorSaque = ref('')
const savingPix = ref(false)
const requestingSaque = ref(false)
const saqueAberto = ref(false)
const pixAberto = ref(false)

/** A mesma regra que a visão geral usa para dizer se dá para sacar — ver `regras-de-saque`. */
const minSaqueCentavos = MIN_SAQUE_CENTAVOS
const comissaoIndicacaoEnabled = import.meta.env.VITE_COMISSAO_INDICACAO_ENABLED !== 'false'

const capacidade = computed(() =>
  carteira.value ? capacidadeDeSaque(carteira.value, store.isDono) : null,
)

/**
 * O motivo de não dar para sacar, numa frase — a mesma da Visão geral. Só aparece quando há
 * motivo: com o saque liberado, a linha de fatos não precisa se justificar.
 */
const motivo = computed(() => {
  const situacao = capacidade.value

  if (!situacao || situacao === 'liberado') {
    return ''
  }

  return t(`inicio.saldo.capacidade.${situacao}`, { minimo: formatBrl(minSaqueCentavos) })
})

/**
 * A chave na linha de fatos, com o meio escondido: "089…560" diz qual é a chave para quem a
 * cadastrou, sem expor o CPF ou o telefone inteiro para quem passa atrás do balcão.
 */
const chaveMascarada = computed(() => {
  const chave = carteira.value?.chavePix ?? ''

  return chave.length > 8 ? `${chave.slice(0, 3)}…${chave.slice(-3)}` : chave
})

const retidoCentavos = computed(() =>
  carteira.value
    ? Math.max(0, carteira.value.saldoTotalCentavos - carteira.value.saldoSacavelCentavos)
    : 0,
)

const showComissaoDisabledNotice = computed(
  () =>
    comissaoIndicacaoEnabled === false &&
    carteira.value != null &&
    carteira.value.saldoTotalCentavos === 0,
)

watch(
  () => ({
    carregando: loading.value,
    saldoSacavelCentavos: carteira.value?.saldoSacavelCentavos ?? 0,
    saldoTotalCentavos: carteira.value?.saldoTotalCentavos ?? 0,
    capacidade: capacidade.value,
    ehDono: store.isDono,
  }),
  (estado) => emit('estado', estado),
  { immediate: true },
)

function onValorSaqueInput(value: string) {
  valorSaque.value = maskBrlCurrencyInput(value)
}

async function loadCarteira() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    carteira.value = await getCarteira(parceiroQuery())
    chavePix.value = carteira.value.chavePix ?? ''
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.visao.errorLoad')
  } finally {
    loading.value = false
  }
}

/** O saque abre com o saldo inteiro: sacar tudo é o caso comum, e mudar o valor é um campo. */
function abrirSaque() {
  valorSaque.value = carteira.value
    ? maskBrlCurrencyInput(String(carteira.value.saldoSacavelCentavos))
    : ''
  saqueAberto.value = true
}

function abrirPix() {
  chavePix.value = carteira.value?.chavePix ?? ''
  pixAberto.value = true
}

defineExpose({ abrirSaque, abrirPix })

async function savePix() {
  if (!chavePix.value.trim()) {
    return
  }

  savingPix.value = true

  try {
    await updateCarteiraPix(chavePix.value.trim(), parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('carteira.toast.pixSaved'),
      detail: t('carteira.toast.pixSavedDetail'),
      life: 3000,
    })
    pixAberto.value = false
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('carteira.toast.pixSaveError'),
      detail: err instanceof Error ? err.message : t('carteira.toast.tryAgain'),
      life: 5000,
    })
  } finally {
    savingPix.value = false
  }
}

async function requestWithdraw() {
  const centavos = parseBrlToCentavos(valorSaque.value)

  if (centavos == null || centavos < minSaqueCentavos) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.invalidValue'),
      detail: t('carteira.toast.minWithdraw'),
      life: 4000,
    })
    return
  }

  if (carteira.value && centavos > carteira.value.saldoSacavelCentavos) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.insufficient'),
      detail: t('carteira.toast.maxWithdraw', {
        valor: formatBrl(carteira.value.saldoSacavelCentavos),
      }),
      life: 4000,
    })
    return
  }

  if (!carteira.value?.chavePix) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.pixRequired'),
      detail: t('carteira.toast.pixRequiredDetail'),
      life: 4000,
    })
    return
  }

  requestingSaque.value = true

  try {
    await solicitarSaque(centavos, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('carteira.toast.withdrawRequested'),
      detail: t('carteira.toast.withdrawRequestedDetail'),
      life: 4000,
    })
    valorSaque.value = ''
    saqueAberto.value = false
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('carteira.toast.withdrawError'),
      detail:
        err instanceof Error ? err.message : t('carteira.toast.withdrawErrorDetail'),
      life: 5000,
    })
  } finally {
    requestingSaque.value = false
  }
}

onMounted(() => {
  void loadCarteira()
})
</script>

<template>
  <div class="carteira-resumo">
    <div
      v-if="loading"
      class="hc carteira-fatos"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="t('carteira.visao.loadingAria')"
    >
      <Skeleton width="60%" height="1rem" border-radius="4px" />
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <Button
        type="button"
        :label="t('carteira.visao.retry')"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        size="small"
        @click="loadCarteira"
      />
    </div>

    <template v-else-if="carteira">
      <section class="hc carteira-fatos" :aria-label="t('carteira.resumo.aria')">
        <p v-if="motivo" class="carteira-fatos__motivo">
          <i class="pi pi-info-circle" aria-hidden="true" />
          {{ motivo }}
        </p>

        <ul class="carteira-fatos__lista">
          <li v-if="retidoCentavos > 0 && capacidade !== 'tudoRetido'">
            {{ t('carteira.resumo.retido', { valor: formatBrl(retidoCentavos) }) }}
          </li>
          <li>
            <strong>{{ formatBrl(carteira.totalSacadoCentavos) }}</strong>
            {{ t('carteira.resumo.jaSacados') }}
          </li>
          <li>
            {{ t('carteira.resumo.minimo') }} <strong>{{ formatBrl(minSaqueCentavos) }}</strong>
          </li>
          <li>{{ t('carteira.resumo.ciclo') }}</li>
          <li v-if="carteira.chavePix">
            {{ t('carteira.resumo.pix') }} <strong>{{ chaveMascarada }}</strong>
          </li>
        </ul>
      </section>

      <p v-if="showComissaoDisabledNotice" class="carteira-fatos__motivo">
        <i class="pi pi-info-circle" aria-hidden="true" />
        {{ t('carteira.visao.alertComissaoDisabled') }}
      </p>
    </template>

    <Dialog
      v-model:visible="saqueAberto"
      modal
      class="clinic-dialog hc-tema"
      :style="{ width: 'min(28rem, 94vw)' }"
      :header="t('carteira.visao.saque.title')"
      dismissable-mask
    >
      <div v-if="carteira" class="carteira-dialogo">
        <p class="carteira-dialogo__saldo">
          {{ t('carteira.dialogo.disponivel', { valor: formatBrl(carteira.saldoSacavelCentavos) }) }}
        </p>
        <AuthTextField
          id="valor-saque"
          :model-value="valorSaque"
          :disabled="requestingSaque"
          inputmode="numeric"
          autocomplete="off"
          :label="t('carteira.visao.saque.valorLabel')"
          :placeholder="t('carteira.visao.saque.valorPlaceholder')"
          @update:model-value="onValorSaqueInput"
        >
          <template #leading>
            <span class="carteira-currency">{{ t('carteira.visao.saque.currency') }}</span>
          </template>
        </AuthTextField>
        <p class="carteira-dialogo__dica">
          {{ t('carteira.dialogo.paraPix', { chave: chaveMascarada }) }}
          {{ t('carteira.visao.saque.hint', { valor: formatBrl(minSaqueCentavos) }) }}
        </p>
      </div>

      <template #footer>
        <Button
          :label="t('carteira.dialogo.cancelar')"
          severity="secondary"
          text
          @click="saqueAberto = false"
        />
        <Button
          :label="t('carteira.visao.saque.submit')"
          icon="pi pi-arrow-right"
          :loading="requestingSaque"
          :disabled="capacidade !== 'liberado'"
          @click="requestWithdraw"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="pixAberto"
      modal
      class="clinic-dialog hc-tema"
      :style="{ width: 'min(28rem, 94vw)' }"
      :header="t('carteira.visao.pix.title')"
      dismissable-mask
    >
      <div class="carteira-dialogo">
        <AuthTextField
          id="chave-pix"
          v-model="chavePix"
          :disabled="!store.isDono || savingPix"
          :hint="t('carteira.visao.pix.hint')"
          :label="t('carteira.visao.pix.label')"
          :placeholder="t('carteira.visao.pix.placeholder')"
        />
      </div>

      <template #footer>
        <Button
          :label="t('carteira.dialogo.cancelar')"
          severity="secondary"
          text
          @click="pixAberto = false"
        />
        <Button
          :label="t('carteira.visao.pix.save')"
          icon="pi pi-check"
          :disabled="!store.isDono || !chavePix.trim()"
          :loading="savingPix"
          @click="savePix"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.carteira-resumo {
  display: grid;
  gap: 0.75rem;
}

.portal-panel__state {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--partner-muted);
  text-align: center;
}

.portal-panel__state--error p {
  margin: 0;
  color: var(--partner-warm-text);
}

/* Os fatos numa linha: o que a frase do topo não diz, sem cartão para cada número. */
.carteira-fatos {
  display: grid;
  gap: 0.5rem;
  padding-block: 0.85rem;
}

.carteira-fatos__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--partner-muted);
  font-size: 0.875rem;
}

.carteira-fatos__lista strong {
  color: var(--partner-text);
  font-weight: 700;
}

/* O motivo de não dar para sacar: uma linha com ícone na tinta de atenção, sem faixa pintada. */
.carteira-fatos__motivo {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--hc-pessego-tinta);
  font-size: 0.875rem;
  font-weight: 600;
}

/* O que está dentro dos diálogos vai para o `body`, fora da página: só tokens `--hc-*` aqui. */
.carteira-dialogo {
  display: grid;
  gap: 0.75rem;
}

.carteira-dialogo__saldo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 650;
}

.carteira-dialogo__dica {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.carteira-currency {
  color: var(--hc-tinta-2);
  font-weight: 700;
}
</style>
