<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getPortalIndicacao } from '@/service/parceiro/parceiro-portal-service'
import type { PortalIndicacao } from '@/service/parceiro/types'

const toast = useToast()
const { ensureContext, parceiroQuery } = useParceiroPortal()
const indicacao = ref<PortalIndicacao | null>(null)
const loading = ref(true)
const error = ref('')

async function loadIndicacao() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    indicacao.value = await getPortalIndicacao(parceiroQuery())
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erro ao carregar indicação.'
  } finally {
    loading.value = false
  }
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ severity: 'success', summary: 'Copiado', detail: `${label} copiado.`, life: 2500 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Não foi possível copiar', life: 3000 })
  }
}

onMounted(() => {
  void loadIndicacao()
})
</script>

<template>
  <div id="partner-panel-indicacao" class="portal-panel" role="tabpanel" aria-labelledby="partner-tab-indicacao">
    <div v-if="loading" class="portal-panel__state" role="status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      <span>Carregando indicação...</span>
    </div>

    <div v-else-if="error" class="portal-panel__state portal-panel__state--error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="loadIndicacao">Tentar novamente</button>
    </div>

    <article v-else-if="indicacao" class="indicacao-card">
      <p v-if="indicacao.aviso" class="indicacao-card__aviso">{{ indicacao.aviso }}</p>

      <div class="indicacao-card__grid">
        <div>
          <span class="indicacao-card__label">Código</span>
          <strong class="indicacao-card__code">{{ indicacao.codigoIndicacao }}</strong>
          <Button
            class="mt-2"
            icon="pi pi-copy"
            label="Copiar código"
            severity="secondary"
            size="small"
            :disabled="!indicacao.podeIndicar"
            @click="copyToClipboard(indicacao.codigoIndicacao, 'Código')"
          />
        </div>

        <div v-if="indicacao.qrCodeDataUrl" class="indicacao-card__qr">
          <img :src="indicacao.qrCodeDataUrl" alt="QR Code de indicação" />
        </div>
      </div>

      <div class="indicacao-card__link">
        <span class="indicacao-card__label">Link para compartilhar</span>
        <p>{{ indicacao.link }}</p>
        <Button
          icon="pi pi-link"
          label="Copiar link"
          :disabled="!indicacao.podeIndicar"
          @click="copyToClipboard(indicacao.link, 'Link')"
        />
      </div>

      <p class="indicacao-card__hint">
        Comissão na carteira exige programa afiliado ativo. Cupons de desconto não geram comissão.
      </p>
    </article>
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

.indicacao-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.indicacao-card__aviso {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  background: var(--partner-amber-bg);
  color: var(--partner-amber-text);
  font-size: 0.88rem;
}

.indicacao-card__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr auto;
  align-items: start;
}

.indicacao-card__label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--partner-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.indicacao-card__code {
  font-size: 1.6rem;
  letter-spacing: 0.08em;
}

.indicacao-card__qr img {
  width: 8.5rem;
  height: 8.5rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.75rem;
}

.indicacao-card__link p {
  margin: 0 0 0.65rem;
  word-break: break-all;
  font-size: 0.92rem;
}

.indicacao-card__hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
}

@media (max-width: 640px) {
  .indicacao-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
