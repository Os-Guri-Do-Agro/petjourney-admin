<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  getCarteira,
  solicitarSaque,
  updateCarteiraPix,
} from '@/service/parceiro/parceiro-portal-service'
import type { Carteira } from '@/service/parceiro/types'
import { formatCentavosToBrl, parseBrlToCentavos } from '@/utils/format/money'

const emit = defineEmits<{
  needsProgramas: []
}>()

const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const carteira = ref<Carteira | null>(null)
const loading = ref(true)
const error = ref('')
const chavePix = ref('')
const valorSaque = ref('')
const savingPix = ref(false)
const requestingSaque = ref(false)

const minSaqueCentavos = 5000
const comissaoIndicacaoEnabled = import.meta.env.VITE_COMISSAO_INDICACAO_ENABLED !== 'false'

const canRequestWithdraw = computed(() => {
  if (!carteira.value || !store.isDono) {
    return false
  }

  return (
    !carteira.value.bloqueadoParaSaque &&
    carteira.value.saldoSacavelCentavos > 0 &&
    Boolean(carteira.value.chavePix)
  )
})

const showComissaoDisabledNotice = computed(
  () =>
    comissaoIndicacaoEnabled === false &&
    carteira.value != null &&
    carteira.value.saldoTotalCentavos === 0,
)

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

    error.value = err instanceof Error ? err.message : 'Erro ao carregar carteira.'
  } finally {
    loading.value = false
  }
}

async function savePix() {
  if (!chavePix.value.trim()) {
    return
  }

  savingPix.value = true

  try {
    await updateCarteiraPix(chavePix.value.trim(), parceiroQuery())
    toast.add({ severity: 'success', summary: 'Chave PIX salva', life: 3000 })
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro ao salvar PIX',
      detail: err instanceof Error ? err.message : 'Tente novamente.',
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
      summary: 'Valor inválido',
      detail: 'O saque mínimo é R$ 50,00.',
      life: 4000,
    })
    return
  }

  if (carteira.value && centavos > carteira.value.saldoSacavelCentavos) {
    toast.add({
      severity: 'warn',
      summary: 'Saldo insuficiente',
      detail: `O máximo sacável agora é ${formatCentavosToBrl(carteira.value.saldoSacavelCentavos)}.`,
      life: 4000,
    })
    return
  }

  if (!carteira.value?.chavePix) {
    toast.add({
      severity: 'warn',
      summary: 'PIX obrigatório',
      detail: 'Cadastre uma chave PIX antes de solicitar saque.',
      life: 4000,
    })
    return
  }

  requestingSaque.value = true

  try {
    await solicitarSaque(centavos, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: 'Saque solicitado',
      detail: 'Acompanhe na aba Saques.',
      life: 4000,
    })
    valorSaque.value = ''
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro no saque',
      detail: err instanceof Error ? err.message : 'Tente novamente.',
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
  <div id="partner-panel-visao" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-visao">
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando carteira...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadCarteira">Tentar novamente</button>
    </div>

    <template v-else-if="carteira">
      <section class="carteira-metrics">
        <article class="metric">
          <span>Saldo total</span>
          <strong>{{ formatCentavosToBrl(carteira.saldoTotalCentavos) }}</strong>
        </article>
        <article class="metric">
          <span>Saldo sacável</span>
          <strong>{{ formatCentavosToBrl(carteira.saldoSacavelCentavos) }}</strong>
        </article>
        <article class="metric">
          <span>Total sacado</span>
          <strong>{{ formatCentavosToBrl(carteira.totalSacadoCentavos) }}</strong>
        </article>
      </section>

      <p v-if="carteira.bloqueadoParaSaque" class="carteira-alert">
        Saques temporariamente bloqueados (revisão antifraude ou saldo negativo).
      </p>

      <p v-else-if="carteira.saldoSacavelCentavos === 0 && carteira.saldoTotalCentavos > 0" class="carteira-alert">
        Saldo em período de hold (14 dias por crédito). O valor ainda não está disponível para saque.
      </p>

      <p v-if="showComissaoDisabledNotice" class="carteira-alert">
        Comissões por indicação estão temporariamente desativadas no ambiente — a carteira pode
        permanecer zerada mesmo com indicações ativas. Isso não é um erro do seu cadastro.
      </p>

      <section class="carteira-panel">
        <h3>Chave PIX</h3>
        <div class="carteira-form">
          <AuthTextField
            id="chave-pix"
            v-model="chavePix"
            :disabled="!store.isDono || savingPix"
            hint="Necessária para solicitar saques."
            label="Chave PIX"
            placeholder="email@empresa.com ou CNPJ"
          />
          <Button
            label="Salvar chave"
            :disabled="!store.isDono"
            :loading="savingPix"
            @click="savePix"
          />
        </div>
      </section>

      <section class="carteira-panel">
        <h3>Solicitar saque</h3>
        <p class="carteira-hint">
          Mínimo {{ formatCentavosToBrl(minSaqueCentavos) }}. Ciclo: corte dia 27, pagamento até dia 5.
        </p>
        <div class="carteira-form carteira-form--inline">
          <AuthTextField
            id="valor-saque"
            v-model="valorSaque"
            :disabled="!store.isDono || requestingSaque || carteira.bloqueadoParaSaque"
            label="Valor (R$)"
            placeholder="50,00"
          />
          <Button
            label="Solicitar"
            :disabled="!canRequestWithdraw"
            :loading="requestingSaque"
            @click="requestWithdraw"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
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

.portal-panel__state button {
  border: 1px solid var(--partner-line);
  border-radius: 0.6rem;
  padding: 0.45rem 0.85rem;
  background: var(--partner-card);
  cursor: pointer;
}

.carteira-panel,
.metric {
  padding: 1rem 1.05rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.95rem;
  background: var(--partner-card);
}

.carteira-hint,
.carteira-alert {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
}

.carteira-metrics {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 0.75rem;
}

.metric {
  display: grid;
  gap: 0.2rem;
}

.metric span {
  color: var(--partner-muted);
  font-size: 0.8rem;
}

.metric strong {
  font-size: 1.35rem;
}

.carteira-alert {
  margin-bottom: 0.75rem;
  padding: 0.8rem 0.95rem;
  border-radius: 0.8rem;
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
}

.carteira-panel {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.carteira-panel h3 {
  margin: 0;
  font-size: 0.98rem;
}

.carteira-form {
  display: grid;
  gap: 0.75rem;
}

.carteira-form--inline {
  align-items: end;
  grid-template-columns: 1fr auto;
}

@media (max-width: 760px) {
  .carteira-metrics {
    grid-template-columns: 1fr;
  }

  .carteira-form--inline {
    grid-template-columns: 1fr;
  }
}
</style>
