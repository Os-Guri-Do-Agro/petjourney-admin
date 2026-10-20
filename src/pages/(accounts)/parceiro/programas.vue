<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from 'primevue/button'

import ProgramasParticipacaoView from '@/components/parceiro/ProgramasParticipacaoView.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { EQUIPE_MENU_ENABLED } from '@/composables/useAppNavigation'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { t } = useI18n()

const LEGACY_ABA_REDIRECTS: Record<string, { path: string; hash?: string; aba?: string }> = {
  visao: { path: '/parceiro/programas' },
  credenciamento: { path: '/settings', aba: 'empresa' },
  afiliado: { path: '/parceiro/programas', hash: '#programas' },
  participativo: { path: '/parceiro/programas', hash: '#programas' },
  divulgacao: { path: '/parceiro/divulgacao' },
  indicacao: { path: '/parceiro/divulgacao', hash: '#indicacao' },
  cupons: { path: '/parceiro/divulgacao', hash: '#cupons' },
  resgates: { path: '/parceiro/divulgacao', hash: '#resgates' },
  equipe: { path: EQUIPE_MENU_ENABLED ? '/parceiro/equipe' : '/inicio' },
}

const { store, ensureContext } = useParceiroPortal()

/**
 * A frase do topo: quantos programas estão valendo. Com os dois ativos, a tela é de consulta e
 * a frase diz isso; com um pedido em análise, diz que está em análise.
 */
const fraseDoResumo = computed(() => {
  if (store.loadState !== 'ready') {
    return ''
  }

  const afiliado = store.modoBloco('afiliado').status
  const participativo = store.modoBloco('participativo').status

  if (afiliado === 'ATIVO' && participativo === 'ATIVO') {
    return t('programas.saudacao.todosAtivos')
  }

  if (afiliado === 'ATIVO' || participativo === 'ATIVO') {
    return t('programas.saudacao.umAtivo', {
      programa: t(`programas.card.${afiliado === 'ATIVO' ? 'afiliado' : 'participativo'}.title`),
    })
  }

  if (afiliado === 'SOLICITADO' || participativo === 'SOLICITADO') {
    return t('programas.saudacao.emAnalise')
  }

  return t('programas.saudacao.nenhum')
})

const route = useRoute()
const router = useRouter()

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

  if (typeof aba !== 'string' || !(aba in LEGACY_ABA_REDIRECTS)) {
    return
  }

  const target = LEGACY_ABA_REDIRECTS[aba]!

  const nextQuery = { ...route.query }
  delete nextQuery.aba

  if (target.aba) {
    nextQuery.aba = target.aba
  }

  await router.replace({
    path: target.path,
    query: nextQuery,
    hash: target.hash ? target.hash : '',
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
</script>

<template>
  <!--
    Sem cadastro de parceiro a tela continua aberta (ela ensina como entrar); só o acesso encerrado
    toma o lugar do conteúdo.
  -->
  <UiPagina
    class="tela-programas"
    :erro="store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : ''"
    :sem-acesso-de-parceiro="store.acessoEncerrado"
    bloquear-se-suspenso
    guia
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-identification-card"
        :label="t('programas.cred.zoneTitle')"
        @click="router.push('/settings?aba=empresa')"
      />
    </template>

    <div class="programas">
      <!--
        Sem acesso de parceiro o texto não é apoio: é a instrução de como conseguir acesso. Só a
        versão de quem já é parceiro entra na preferência de explicações.
      -->
      <p v-if="store.semAcessoParceiro || isGuidanceVisible" class="programas__lede">
        {{ store.semAcessoParceiro ? t('programas.ledeNoAccess') : t('programas.lede') }}
      </p>

      <ProgramasParticipacaoView />
    </div>
  </UiPagina>
</template>

<style scoped>
/* Botões de contorno e de texto nas cores do Trilha (fora do antigo `.hc-tema`). */
.tela-programas {
  --p-button-outlined-secondary-border-color: var(--linha-forte);
  --p-button-outlined-secondary-color: var(--tinta);
  --p-button-outlined-secondary-hover-background: var(--superficie-2);
  --p-button-outlined-secondary-active-background: var(--superficie-3);
  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);
}

.programas {
  display: grid;
  gap: 20px;
}

.programas__lede {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

:deep(#programas) {
  scroll-margin-top: 24px;
}
</style>
