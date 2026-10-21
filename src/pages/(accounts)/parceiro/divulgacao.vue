<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PortalDivulgacaoPanel from '@/components/parceiro/panels/PortalDivulgacaoPanel.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const ABA_TO_HASH: Record<string, string> = {
  indicacao: '#indicacao',
  cupons: '#cupons',
  resgates: '#resgates',
}

const { t } = useI18n()

/** O que o painel carregou e a frase do topo precisa: código, link e leituras do QR. */
const estado = ref({ codigo: '', link: '', leituras: null as number | null, podeIndicar: false })

/**
 * A frase do topo: quantas leituras o QR já teve. O código está grande logo abaixo, então a frase
 * não o repete. Sem programa de afiliados ativo não existe código, e a frase diz o que falta.
 */
const fraseDoResumo = computed(() => {
  if (!estado.value.podeIndicar || !estado.value.codigo) {
    return t('divulgacao.saudacao.semCodigo')
  }

  if (estado.value.leituras == null) {
    return ''
  }

  const leituras = estado.value.leituras

  return leituras > 0
    ? t('divulgacao.tela.resumo', { n: leituras }, leituras)
    : t('divulgacao.tela.resumoZero')
})

const { store, ensureContext } = useParceiroPortal()
const route = useRoute()
const router = useRouter()

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

function scrollToHash() {
  const targetId = route.hash.replace('#', '')

  if (!targetId) {
    return
  }

  requestAnimationFrame(() => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function resolveLegacyTabQuery() {
  const aba = route.query.aba

  if (typeof aba !== 'string' || !(aba in ABA_TO_HASH)) {
    return
  }

  const nextQuery = { ...route.query }
  delete nextQuery.aba

  await router.replace({
    path: '/parceiro/divulgacao',
    query: nextQuery,
    hash: ABA_TO_HASH[aba],
  })
}

onMounted(async () => {
  await ensureContext()
  await resolveLegacyTabQuery()
  scrollToHash()
})

watch(
  () => route.hash,
  () => {
    scrollToHash()
  },
)

/* As seções chegam depois da API: a âncora pedida na URL rola quando elas existem. */
watch(
  () => estado.value.podeIndicar,
  () => {
    scrollToHash()
  },
)
</script>

<template>
  <UiPagina
    class="tela-divulgacao"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    guia
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <div class="divulgacao-pagina">
      <PartnerOperabilityBanner />

      <p v-if="isGuidanceVisible" class="divulgacao-pagina__lede">
        {{ t('divulgacao.lede') }}
      </p>

      <PortalDivulgacaoPanel @estado="estado = $event" />
    </div>
  </UiPagina>
</template>

<style scoped>
.divulgacao-pagina {
  display: grid;
  gap: 20px;
}

.divulgacao-pagina__lede {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

:deep(#indicacao),
:deep(#cupons),
:deep(#resgates) {
  scroll-margin-top: 24px;
}
</style>
