<script setup lang="ts">
/**
 * Portal › Divulgação, em duas abas (17/11/2026): "Convidar", com o código, o link e o QR, as
 * leituras do QR e as regras; e "Indicados", a lista de quem entrou pelo código, que era uma tela à
 * parte no menu. A lista mostra nome de cliente: só o dono vê a aba, e sem ela a tela fica sem abas.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import IndicadosDaEmpresa from '@/components/parceiro/IndicadosDaEmpresa.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PortalDivulgacaoPanel from '@/components/parceiro/panels/PortalDivulgacaoPanel.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import type { Aba } from '@/navegacao/espacos'

const ABAS = ['convidar', 'indicados'] as const
type AbaDaDivulgacao = (typeof ABAS)[number]

const ICONE_DA_ABA: Record<AbaDaDivulgacao, string> = {
  convidar: 'ph ph-user-plus',
  indicados: 'ph ph-user-list',
}

/** Os `?aba=` antigos, de quando cada parte era uma aba: viram âncoras da aba Convidar. */
const ABA_TO_HASH: Record<string, string> = {
  indicacao: '#indicacao',
  cupons: '#cupons',
  resgates: '#resgates',
}

const { t } = useI18n()

/** O que o painel carregou e a frase do topo precisa: código, link e leituras do QR. */
const estado = ref({
  codigo: '',
  link: '',
  leituras: null as number | null,
  podeIndicar: false,
  carregando: true,
})

/**
 * A frase do topo: quantas leituras o QR já teve. O código está grande logo abaixo, então a frase
 * não o repete. Sem programa de afiliados ativo não existe código, e a frase diz o que falta.
 */
const fraseDoResumo = computed(() => {
  if (abaAberta.value === 'indicados') {
    return t('divulgacao.abas.indicados.dica')
  }

  /* Sem frase enquanto carrega: "O código aparece quando o programa estiver ativo" aparecia por um
     instante para quem já tem o programa ativo. */
  if (estado.value.carregando) {
    return ''
  }

  if (!estado.value.podeIndicar || !estado.value.codigo) {
    return t('divulgacao.saudacao.semCodigo')
  }

  /* Sem leitura nenhuma, quem diz isso é o bloco das leituras, logo abaixo: a mesma frase no topo
     e no bloco lia como repetição. */
  const leituras = estado.value.leituras ?? 0

  return leituras > 0 ? t('divulgacao.tela.resumo', { n: leituras }, leituras) : ''
})

const { store, ensureContext } = useParceiroPortal()
const route = useRoute()
const router = useRouter()
const { activeTab } = usePartnerTabs(ABAS, 'convidar')

/* A lista de indicados mostra nome de cliente: a aba só existe para o dono (a API só entrega a ele). */
const comIndicados = computed(() => store.menuComIndicados)

const abaAberta = computed<AbaDaDivulgacao>(() =>
  activeTab.value === 'indicados' && comIndicados.value ? 'indicados' : 'convidar',
)

/** A aba é a mesma URL com outro `?aba=`; Convidar é a tela sem o parâmetro. */
function destinoDa(aba: AbaDaDivulgacao) {
  const query = { ...route.query }

  if (aba === 'convidar') {
    delete query.aba
  } else {
    query.aba = aba
  }

  return { path: '/parceiro/divulgacao', query }
}

/* As abas no formato das de destino, nas orelhas de pasta da faixa, como as das Configurações. */
const abas = computed<Aba[]>(() =>
  comIndicados.value
    ? ABAS.map((id) => ({
        rotulo: t(`divulgacao.abas.${id}.rotulo`),
        icone: ICONE_DA_ABA[id],
        to: router.resolve(destinoDa(id)).fullPath,
        tituloDoSelo: t(`divulgacao.abas.${id}.dica`),
      }))
    : [],
)

const abaAtual = computed(() => router.resolve(destinoDa(abaAberta.value)).fullPath)

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
    :abas-da-tela="abas"
    :aba-atual="abaAtual"
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <div class="divulgacao-pagina">
      <PartnerOperabilityBanner />

      <!-- Convidar fica montada ao trocar de aba: voltar a ela não carrega tudo de novo. -->
      <div v-show="abaAberta === 'convidar'" class="divulgacao-pagina__aba">
        <p v-if="isGuidanceVisible" class="divulgacao-pagina__lede">
          {{ t('divulgacao.lede') }}
        </p>

        <PortalDivulgacaoPanel @estado="estado = $event" />
      </div>

      <IndicadosDaEmpresa v-if="abaAberta === 'indicados'" />
    </div>
  </UiPagina>
</template>

<style scoped>
.divulgacao-pagina {
  display: grid;
  gap: 20px;
}

.divulgacao-pagina__aba {
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
