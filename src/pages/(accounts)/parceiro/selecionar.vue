<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { ApiError } from '@/service/api'
import { getPerfis, trocarParaParceiro, type PerfilParceiro } from '@/service/auth/auth-service'
import { getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { currentColors } from '@/theme/color-mode'
import { montarOpcoesParceiro, podeCadastrarNovaEmpresa } from '@/utils/parceiro/perfis-parceiro'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const store = useParceiroStore()

const parceiros = ref<PerfilParceiro[]>([])
const loading = ref(true)
const errorMessage = ref('')
const trocandoId = ref<string | null>(null)

const opcoes = computed(() =>
  montarOpcoesParceiro(parceiros.value, getAuthUser()?.parceiroAtivoId ?? store.parceiroId),
)
const mostrarCadastro = computed(
  () => !loading.value && !errorMessage.value && podeCadastrarNovaEmpresa(parceiros.value),
)

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--sel-card': colors.dashboard.surface,
    '--sel-soft': colors.dashboard.surfaceSoft,
    '--sel-line': colors.dashboard.line,
    '--sel-muted': colors.dashboard.muted,
    '--sel-accent': colors.vet.primary,
    '--sel-accent-strong': colors.dashboard.primaryStrong,
  }
})

async function carregarPerfis() {
  loading.value = true
  errorMessage.value = ''

  try {
    const perfis = await getPerfis()
    parceiros.value = perfis.parceiros
  } catch (err) {
    parceiros.value = []
    errorMessage.value =
      err instanceof Error ? err.message : String(t('parceiro.selecionar.errorLoad'))
  } finally {
    loading.value = false
  }
}

async function selecionar(parceiroId: string, jaAtivo: boolean) {
  if (jaAtivo || trocandoId.value) {
    return
  }

  trocandoId.value = parceiroId

  try {
    await trocarParaParceiro(parceiroId)
    /* Contexto novo: o cache do parceiro anterior não pode vazar na tela do próximo. */
    store.reset()
    store.setParceiroId(parceiroId)
    await store.bootstrap(true)
    await router.replace('/inicio')
  } catch (err) {
    /* 403 = lista velha (membership removida em outro lugar): recarrega em vez de insistir. */
    if (err instanceof ApiError && err.statusCode === 403) {
      toast.add({
        severity: 'warn',
        summary: t('parceiro.selecionar.toast.stale'),
        detail: t('parceiro.selecionar.toast.staleDetail'),
        life: 5000,
      })
      await carregarPerfis()
      return
    }

    toast.add({
      severity: 'error',
      summary: t('parceiro.selecionar.toast.error'),
      detail: err instanceof Error ? err.message : t('parceiro.selecionar.toast.errorDetail'),
      life: 5000,
    })
  } finally {
    trocandoId.value = null
  }
}

onMounted(() => {
  void carregarPerfis()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('parceiro.selecionar.subtitle')"
    :title="t('parceiro.selecionar.title')"
    :loading="loading"
    :error="errorMessage"
    :empty="!opcoes.length && !mostrarCadastro"
    :empty-title="t('parceiro.selecionar.emptyTitle')"
    :empty-description="t('parceiro.selecionar.emptyBody')"
    @retry="carregarPerfis"
  >
    <div class="select" :style="pageStyle">
      <p class="select__lede">{{ t('parceiro.selecionar.body') }}</p>

      <ul v-if="opcoes.length" class="select__list">
        <li v-for="opcao in opcoes" :key="opcao.parceiroId">
          <Button
            class="select__item"
            type="button"
            :class="{ 'select__item--active': opcao.ativo }"
            :disabled="trocandoId != null"
            :aria-current="opcao.ativo ? 'true' : undefined"
            @click="selecionar(opcao.parceiroId, opcao.ativo)"
          >
            <span class="select__icon" aria-hidden="true">
              <i :class="opcao.equipe ? 'pi pi-users' : 'pi pi-building'" />
            </span>

            <span class="select__copy">
              <strong>{{ opcao.nome }}</strong>
              <small>
                {{
                  opcao.equipe
                    ? t('parceiro.selecionar.roleOperador')
                    : t('parceiro.selecionar.roleDono')
                }}
              </small>
            </span>

            <span class="select__meta">
              <PartnerStatusBadge v-if="opcao.badgeStatus" :status="opcao.badgeStatus" />
              <span v-if="opcao.ativo" class="select__current">
                {{ t('parceiro.selecionar.current') }}
              </span>
              <i
                v-else-if="trocandoId === opcao.parceiroId"
                class="pi pi-spin pi-spinner"
                aria-hidden="true"
              />
              <i v-else class="pi pi-angle-right" aria-hidden="true" />
            </span>
          </Button>
        </li>
      </ul>

      <article v-if="mostrarCadastro" class="select__cta">
        <h2>{{ t('parceiro.selecionar.newTitle') }}</h2>
        <p>{{ t('parceiro.selecionar.newBody') }}</p>
        <Button
          :label="t('parceiro.selecionar.newCta')"
          severity="secondary"
          @click="router.push('/settings?aba=empresa')"
        />
      </article>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.select {
  display: grid;
  gap: 1rem;
  max-width: 38rem;
}

.select__lede {
  margin: 0;
  color: var(--sel-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.select__list {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Opção de perfil: Button com slot (ícone + nome + status), sem o visual de CTA do preset. */
.select__item.p-button {
  justify-content: flex-start;
  width: 100%;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--sel-line);
  border-radius: 0.95rem;
  background: var(--sel-card);
  color: inherit;
  font-size: inherit;
  text-align: start;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.select__item.p-button:not(:disabled):hover,
.select__item.p-button:not(:disabled):active,
.select__item.p-button:focus-visible {
  border-color: color-mix(in srgb, var(--sel-accent) 34%, var(--sel-line));
  background: color-mix(in srgb, var(--sel-soft) 55%, var(--sel-card));
  color: inherit;
  outline: none;
  transform: translateY(-1px);
}

.select__item.p-button:focus-visible {
  box-shadow: none;
  outline: 2px solid var(--sel-accent-strong);
  outline-offset: 2px;
}

.select__item.p-button:disabled {
  cursor: default;
  opacity: 0.7;
}

.select__item--active.p-button {
  border-color: color-mix(in srgb, var(--sel-accent) 45%, var(--sel-line));
  background: color-mix(in srgb, var(--sel-soft) 70%, var(--sel-card));
}

.select__icon {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--sel-accent) 16%, transparent);
  color: var(--sel-accent-strong);
}

.select__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.select__copy strong {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.select__copy small {
  color: var(--sel-muted);
  font-size: 0.78rem;
}

.select__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
  color: var(--sel-muted);
}

.select__current {
  color: var(--sel-accent-strong);
  font-size: 0.75rem;
  font-weight: 700;
}

.select__cta {
  display: grid;
  gap: 0.6rem;
  justify-items: start;
  padding: 1rem 1.05rem;
  border: 1px dashed var(--sel-line);
  border-radius: 0.95rem;
  background: transparent;
}

.select__cta h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.select__cta p {
  margin: 0;
  color: var(--sel-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

@media (max-width: 720px) {
  .select__meta {
    gap: 0.35rem;
  }
}
</style>
