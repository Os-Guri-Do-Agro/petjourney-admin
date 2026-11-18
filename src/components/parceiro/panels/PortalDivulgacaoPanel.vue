<script setup lang="ts">
/**
 * O convite para quem ainda não usa o PetJourney: quem cria a conta com o código da empresa fica
 * ligado a ela, e as assinaturas dessa pessoa rendem participação no programa de afiliados. Três
 * jeitos de convidar, cada um num cartão na cor dele (o código, o link e o QR), as leituras do QR e
 * o "Como funciona" em etapas, com as regras completas sob demanda (17/11/2026: "algo fácil de
 * entender para não precisar ter tanto texto, mas legal"). Com a flag de cupons ligada, os cupons e
 * os resgates ganham seções próprias embaixo.
 *
 * As âncoras `#indicacao`, `#cupons` e `#resgates` são o destino dos redirects legados
 * (`?aba=indicacao|cupons|resgates`) e do link "Resgates" do diálogo de validar cupom.
 */
import { PhKeyboard, PhLink, PhQrCode } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import IndicacaoMetricasCard from '@/components/parceiro/IndicacaoMetricasCard.vue'
import IndicacaoQrBlock from '@/components/parceiro/IndicacaoQrBlock.vue'
import UiPassos, { type PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
// Volta junto com o teaser de cupom (ver o comentário no fim do template).
// import { useCupomComingSoon } from '@/composables/useCupomComingSoon'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  getPortalCupons,
  getPortalIndicacao,
  getPortalIndicacaoMetricas,
  getPortalResgates,
} from '@/service/parceiro/parceiro-portal-service'
import type {
  CupomParceiro,
  IndicacaoMetricas,
  PortalIndicacao,
  ResgateParceiro,
} from '@/service/parceiro/types'
import { resolveMetricasErro, type MetricasEstadoErro } from '@/utils/parceiro/indicacao-metricas'

/** Mesmo destino do gate da Carteira (`goToProgramas`): a âncora abre a lista. */
const PROGRAMAS_ROUTE = { path: '/parceiro/programas', hash: '#programas' } as const

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const { lastSuccessAt, canOpen: podeValidarCupom, open: abrirValidarCupom } = useCupomResgateModal()
// const { open: openCupomComingSoon } = useCupomComingSoon()
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED

/**
 * Termos concretos da participação, do jeito que o backend calcula
 * (`comissao.config.ts`): 5% do plano, a cada renovação paga, janela de 18 meses
 * desde a primeira assinatura paga do indicado, hold de 14 dias e saque mínimo
 * de R$ 50.
 *
 * Divulgação em dois níveis: o ganho numa frase sempre à vista (5%, todo mês, 18 meses); o
 * detalhe completo (incluindo hold, saque e a condição de ativação) abre sob demanda.
 */
const TERM_IDS = ['percent', 'recurring', 'window', 'hold', 'payout', 'requirement'] as const

const TERM_ICONS: Record<(typeof TERM_IDS)[number], string> = {
  percent: 'ph ph-percent',
  recurring: 'ph ph-arrows-clockwise',
  window: 'ph ph-calendar-blank',
  hold: 'ph ph-hourglass',
  payout: 'ph ph-bank',
  requirement: 'ph ph-seal-check',
}

const termsOpen = ref(false)

/** "Como funciona" em três etapas, sem botão: quem age é a pessoa convidada. */
const passosDoConvite = computed<PassoDoGuia[]>(() =>
  [
    { id: 'convida', icone: 'ph ph-share-network' },
    { id: 'conta', icone: 'ph ph-user-circle-plus' },
    { id: 'rende', icone: 'ph ph-percent' },
  ].map(({ id, icone }) => ({
    id,
    icone,
    titulo: t(`divulgacao.convite.passos.${id}.titulo`),
    texto: t(`divulgacao.convite.passos.${id}.texto`),
  })),
)

/** Pedido já feito, ou o cadastro em análise: a primeira etapa da espera está feita. */
const esperaEmAnalise = computed(
  () => store.statusAuditoria === 'PENDENTE' || store.modoBloco('afiliado').status === 'SOLICITADO',
)

/**
 * O título da espera. Com o pedido já feito (ou o cadastro em análise), "Programa afiliado
 * necessário" mandava pedir de novo o que estava em análise.
 */
const tituloDaEspera = computed(() =>
  esperaEmAnalise.value ? t('carteira.gate.emAnaliseTitle') : t('carteira.gate.title'),
)

/** Como o código é liberado: o pedido (feito, se já foi), a aprovação e o código nesta tela. */
const passosDaEspera = computed<PassoDoGuia[]>(() => [
  {
    id: 'pedir',
    icone: 'ph ph-paper-plane-tilt',
    titulo: t('carteira.gate.guia.pedir.titulo'),
    texto: t('carteira.gate.guia.pedir.texto'),
    feito: esperaEmAnalise.value,
  },
  {
    id: 'analise',
    icone: 'ph ph-hourglass',
    titulo: t('carteira.gate.guia.analise.titulo'),
    texto: t('carteira.gate.guia.analise.texto'),
  },
  {
    id: 'codigo',
    icone: 'ph ph-qr-code',
    titulo: t('divulgacao.espera.guia.codigo.titulo'),
    texto: t('divulgacao.espera.guia.codigo.texto'),
  },
])

const indicacaoTerms = computed(() =>
  TERM_IDS.map((id) => ({
    id,
    icon: TERM_ICONS[id],
    title: t(`divulgacao.terms.${id}.title`),
    body: t(`divulgacao.terms.${id}.body`),
  })),
)

const indicacao = ref<PortalIndicacao | null>(null)

/**
 * Só existem quando `podeIndicar` (cadastro aprovado E afiliado ATIVO); fora
 * disso a API devolve `null` e a tela nem chega a renderizar este bloco. O
 * `?? ''` evita espalhar narrowing pelo template.
 */
const codigoIndicacao = computed(() => indicacao.value?.codigoIndicacao ?? '')
const linkIndicacao = computed(() => indicacao.value?.link ?? '')

/** O link sem o protocolo: é o que cabe na linha e o que a pessoa reconhece. */
const linkLegivel = computed(() => linkIndicacao.value.replace(/^https?:\/\//, ''))

/** A mensagem pronta para o WhatsApp: o código e o link, numa frase do parceiro. */
const whatsappHref = computed(
  () =>
    `https://wa.me/?text=${encodeURIComponent(
      t('divulgacao.kit.mensagem', { codigo: codigoIndicacao.value, link: linkIndicacao.value }),
    )}`,
)

const metricas = ref<IndicacaoMetricas | null>(null)
const metricasLoading = ref(false)
const metricasErro = ref<MetricasEstadoErro | null>(null)

const cupons = ref<CupomParceiro[]>([])
const resgates = ref<ResgateParceiro[]>([])
const cuponsCursor = ref<string | null>(null)
const resgatesCursor = ref<string | null>(null)

const loading = ref(true)
const loadingCuponsMore = ref(false)
const loadingResgatesMore = ref(false)
const error = ref('')

const metrics = computed(() => {
  const totais = store.dashboard?.totais

  return [
    {
      id: 'cupons',
      label: t('divulgacao.metrics.cuponsAtivos'),
      value: totais?.cuponsAtivos ?? cupons.value.filter((c) => c.ativo).length,
      icon: 'ph ph-ticket',
    },
    {
      id: 'total',
      label: t('divulgacao.metrics.resgatesTotais'),
      value: totais?.resgatesTotal ?? resgates.value.length,
      icon: 'ph ph-check-circle',
    },
    {
      id: 'recentes',
      label: t('divulgacao.metrics.ultimos30d'),
      value: totais?.resgatesUltimos30d ?? 0,
      icon: 'ph ph-chart-line',
    },
  ]
})

/*
 * O que acabou de ser copiado: o próprio botão diz "Copiado" por dois segundos, ali onde o olho
 * está, em vez de um aviso no canto da tela.
 */
const copiado = ref<'codigo' | 'link' | null>(null)
let tempoDoCopiado: ReturnType<typeof setTimeout> | undefined

async function copiar(qual: 'codigo' | 'link') {
  const valor = qual === 'codigo' ? codigoIndicacao.value : linkIndicacao.value

  if (await copyToClipboard(valor)) {
    copiado.value = qual
    clearTimeout(tempoDoCopiado)
    tempoDoCopiado = setTimeout(() => {
      copiado.value = null
    }, 2000)
  }
}

onBeforeUnmount(() => clearTimeout(tempoDoCopiado))

/** Copia; quando o navegador recusa, o aviso diz como copiar à mão. */
async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('divulgacao.toast.copyFail'),
      detail: t('divulgacao.toast.copyFailDetail'),
      life: 3000,
    })
    return false
  }
}

/**
 * Métricas rodam fora do `loadAll`: 409 (cadastro não aprovado ou afiliado não
 * ativo) e 503 (QR fora) são estados do card, não erro da tela, e não podem
 * derrubar o painel. Sem `podeIndicar` nem chamamos — o 409 seria garantido.
 */
async function loadMetricas() {
  if (!indicacao.value?.podeIndicar) {
    metricas.value = null
    metricasErro.value = null
    return
  }

  metricasLoading.value = true
  metricasErro.value = null

  try {
    metricas.value = await getPortalIndicacaoMetricas(parceiroQuery())
  } catch (err) {
    metricas.value = null
    metricasErro.value = resolveMetricasErro(err)
  } finally {
    metricasLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()
    const query = parceiroQuery()

    if (!CUPOM_FEATURE_ENABLED) {
      indicacao.value = await getPortalIndicacao(query)
      cupons.value = []
      cuponsCursor.value = null
      resgates.value = []
      resgatesCursor.value = null
      void loadMetricas()
      return
    }

    const [indicacaoData, cuponsPage, resgatesPage] = await Promise.all([
      getPortalIndicacao(query),
      getPortalCupons({ ...query, limit: 10 }),
      getPortalResgates({ ...query, limit: 10 }),
    ])

    indicacao.value = indicacaoData
    cupons.value = cuponsPage.data
    cuponsCursor.value = cuponsPage.meta.proximoCursor ?? null
    resgates.value = resgatesPage.data
    resgatesCursor.value = resgatesPage.meta.proximoCursor ?? null
    void loadMetricas()
  } catch (err) {
    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('divulgacao.errorLoad')
  } finally {
    loading.value = false
  }
}

async function loadMoreCupons() {
  if (!cuponsCursor.value) {
    return
  }

  loadingCuponsMore.value = true

  try {
    const page = await getPortalCupons({
      ...parceiroQuery(),
      cursor: cuponsCursor.value,
      limit: 10,
    })
    cupons.value = [...cupons.value, ...page.data]
    cuponsCursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('divulgacao.toast.error'),
      detail: err instanceof Error ? err.message : t('divulgacao.toast.moreCuponsFail'),
      life: 4000,
    })
  } finally {
    loadingCuponsMore.value = false
  }
}

async function loadMoreResgates() {
  if (!resgatesCursor.value) {
    return
  }

  loadingResgatesMore.value = true

  try {
    const page = await getPortalResgates({
      ...parceiroQuery(),
      cursor: resgatesCursor.value,
      limit: 10,
    })
    resgates.value = [...resgates.value, ...page.data]
    resgatesCursor.value = page.meta.proximoCursor ?? null
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('divulgacao.toast.error'),
      detail: err instanceof Error ? err.message : t('divulgacao.toast.moreResgatesFail'),
      life: 4000,
    })
  } finally {
    loadingResgatesMore.value = false
  }
}

/** A categoria vem do enum (`PET_SHOP`): sem o sublinhado e só com a primeira maiúscula. */
function formatCategoria(value: string) {
  const texto = value.replaceAll('_', ' ').toLocaleLowerCase(INTL_LOCALE[locale.value as Locale])

  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1)
}

function formatResgateDate(value: string) {
  return new Date(value).toLocaleString(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * O que a frase do topo da página precisa saber: o código, o link e as leituras do QR. A página
 * monta a frase; o painel é quem carrega os dados.
 */
const emit = defineEmits<{
  estado: [
    estado: {
      codigo: string
      link: string
      leituras: number | null
      podeIndicar: boolean
      carregando: boolean
    },
  ]
}>()

watch(
  () => ({
    codigo: codigoIndicacao.value,
    link: linkIndicacao.value,
    leituras: metricas.value?.scanCount ?? null,
    podeIndicar: Boolean(indicacao.value?.podeIndicar),
    carregando: loading.value,
  }),
  (estado) => emit('estado', estado),
  { immediate: true },
)

onMounted(() => {
  void loadAll()
})

watch(lastSuccessAt, (at) => {
  if (!at) {
    return
  }

  void loadAll()
  void store.bootstrap(true).catch(() => undefined)
})
</script>

<template>
  <div class="divulgacao">
    <div v-if="error" class="estado ui-folha" role="alert">
      <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--risco" aria-hidden="true">
        <i class="ph ph-warning-circle" />
      </span>
      <p>{{ error }}</p>
      <Button
        type="button"
        icon="ph ph-arrow-clockwise"
        :label="t('divulgacao.retry')"
        severity="secondary"
        outlined
        @click="loadAll"
      />
    </div>

    <!-- ------------------------------------------------------------ carregando -->
    <template v-else-if="loading">
      <div
        class="convite"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('divulgacao.indicacao.loadingAria')"
      >
        <Skeleton width="20rem" height="1.2rem" border-radius="6px" />
        <ul class="convite__vias" aria-hidden="true">
          <li v-for="n in 3" :key="n">
            <Skeleton width="100%" height="15rem" border-radius="22px" />
          </li>
        </ul>
      </div>

      <div
        v-if="cupomFeatureEnabled"
        class="listas"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('divulgacao.lists.loadingAria')"
      >
        <div v-for="n in 2" :key="n" class="ui-folha esqueleto" aria-hidden="true">
          <div v-for="m in 3" :key="m" class="esqueleto__linha">
            <span class="esqueleto__texto">
              <Skeleton width="9rem" height="0.9rem" border-radius="6px" />
              <Skeleton width="6rem" height="0.75rem" border-radius="6px" />
            </span>
            <Skeleton width="3.5rem" height="1.4rem" border-radius="7px" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="indicacao">
      <!-- ------------------------------------------------------------ o kit -->
      <section id="indicacao" class="indicacao" :aria-label="t('divulgacao.indicacao.title')">
        <p v-if="isGuidanceVisible" class="divulgacao__lede">
          {{ t('divulgacao.indicacao.lede') }}
        </p>

        <!--
          Sem afiliado ativo não há código: o que falta, como o código é liberado e o caminho dos
          programas. O `aviso` da API diz o que falta em cada estado (cadastro em análise,
          recusado, programa não pedido...) e vem no idioma da tela desde o PJ-4BI7TE; a frase
          fixa só entra quando ele não vem. Indicação nunca no botão cheio (03/11): as etapas não
          têm botão (o de pedir seria o cheio) e "Ver programas" vai embaixo, contornado.
        -->
        <UiVazioIlustrado
          v-if="!indicacao.podeIndicar"
          icone="ph ph-hourglass"
          :titulo="tituloDaEspera"
          :texto="indicacao.aviso || t('divulgacao.shareKit.esperaHint')"
          :guia-titulo="t('divulgacao.espera.guia.titulo')"
          :passos="passosDaEspera"
        >
          <template #acao>
            <Button
              :as="RouterLink"
              :to="PROGRAMAS_ROUTE"
              icon="ph ph-squares-four"
              :label="t('divulgacao.shareKit.esperaCta')"
              severity="secondary"
              outlined
            />
          </template>
        </UiVazioIlustrado>

        <!--
          Os três jeitos de convidar, cada um num cartão na cor dele, lado a lado, no desenho das
          Ações rápidas do Início (17/11/2026, "algo mais legal, fácil de entender, sem tanto
          texto"): o verbo e uma frase curta, a coisa em si num quadro branco do mesmo tamanho nos
          três (o código, o link, o QR) e os botões embaixo. O ícone do jeito, grande e meio
          girado, sai pela borda do cartão.
        -->
        <UiSecao v-else id="convite" :titulo="t('divulgacao.kit.titulo')">
          <ul class="convite__vias">
            <li class="via via--pets">
              <PhKeyboard class="via__fundo" weight="duotone" aria-hidden="true" />
              <div class="via__cabeca">
                <span class="via__selo" aria-hidden="true"><i class="ph ph-keyboard" /></span>
                <span class="via__titulos">
                  <h3 class="via__titulo">{{ t('divulgacao.kit.codigo') }}</h3>
                  <span class="via__dica">{{ t('divulgacao.convite.codigoDica') }}</span>
                </span>
              </div>
              <div class="via__quadro" role="group" :aria-label="t('inicio.indique.seuCodigo')">
                <strong class="via__codigo ui-num"
                  ><bdi dir="ltr">{{ codigoIndicacao }}</bdi></strong
                >
              </div>
              <div class="via__acoes">
                <Button
                  type="button"
                  :icon="copiado === 'codigo' ? 'ph ph-check' : 'ph ph-copy'"
                  :label="
                    copiado === 'codigo'
                      ? t('divulgacao.convite.copiado')
                      : t('divulgacao.kit.copiar')
                  "
                  :aria-label="t('divulgacao.shareKit.copyCodeAria')"
                  @click="copiar('codigo')"
                />
              </div>
            </li>

            <li class="via via--clinica">
              <PhLink class="via__fundo" weight="duotone" aria-hidden="true" />
              <div class="via__cabeca">
                <span class="via__selo" aria-hidden="true"><i class="ph ph-link" /></span>
                <span class="via__titulos">
                  <h3 class="via__titulo">{{ t('divulgacao.kit.link') }}</h3>
                  <span class="via__dica">{{ t('divulgacao.convite.linkDica') }}</span>
                </span>
              </div>
              <div class="via__quadro">
                <bdi class="via__link" dir="ltr" :title="linkIndicacao">{{ linkLegivel }}</bdi>
              </div>
              <div class="via__acoes">
                <Button
                  type="button"
                  :icon="copiado === 'link' ? 'ph ph-check' : 'ph ph-copy'"
                  :label="
                    copiado === 'link'
                      ? t('divulgacao.convite.copiado')
                      : t('divulgacao.shareKit.copyLink')
                  "
                  @click="copiar('link')"
                />
                <Button
                  as="a"
                  :href="whatsappHref"
                  target="_blank"
                  rel="noopener noreferrer"
                  icon="ph ph-whatsapp-logo"
                  label="WhatsApp"
                  :aria-label="t('divulgacao.kit.whatsapp')"
                  severity="secondary"
                  outlined
                />
              </div>
            </li>

            <li v-if="indicacao.qrImageUrl" class="via via--portal">
              <PhQrCode class="via__fundo" weight="duotone" aria-hidden="true" />
              <div class="via__cabeca">
                <span class="via__selo" aria-hidden="true"><i class="ph ph-qr-code" /></span>
                <span class="via__titulos">
                  <h3 class="via__titulo">{{ t('divulgacao.kit.qr') }}</h3>
                  <span class="via__dica">{{ t('divulgacao.convite.qrDica') }}</span>
                </span>
              </div>
              <IndicacaoQrBlock
                class="via__qr"
                :image-url="indicacao.qrImageUrl"
                :code="codigoIndicacao"
                :disabled="!indicacao.podeIndicar"
                forma="cartao"
              />
            </li>
          </ul>
        </UiSecao>
      </section>

      <!-- ------------------------------------------------- como funciona, logo depois dos cartões -->
      <section
        id="div-terms"
        class="regras ui-folha ui-cartao"
        :class="{ 'regras--aberta': termsOpen }"
        aria-labelledby="div-terms-titulo"
      >
        <header class="ui-cartao__cabeca regras__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-lightbulb" /></span>
          <div class="ui-cartao__titulos">
            <h2 id="div-terms-titulo" class="ui-cartao__titulo">
              {{ t('divulgacao.convite.passos.titulo') }}
            </h2>
          </div>
          <div class="ui-cartao__acoes">
            <Button
              type="button"
              :label="
                termsOpen ? t('divulgacao.terms.toggleHide') : t('divulgacao.terms.toggleShow')
              "
              :icon="termsOpen ? 'ph ph-caret-up' : 'ph ph-caret-down'"
              icon-pos="right"
              severity="secondary"
              text
              size="small"
              :aria-expanded="termsOpen"
              aria-controls="div-terms-full"
              @click="termsOpen = !termsOpen"
            />
          </div>
        </header>

        <!-- As três etapas dizem o essencial; o detalhe (carência, saque, condição) abre embaixo. -->
        <UiPassos class="regras__passos" :passos="passosDoConvite" />

        <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
        <dl v-show="termsOpen" id="div-terms-full" class="regras__lista">
          <div v-for="term in indicacaoTerms" :key="term.id" class="regra ui-poco">
            <dt>
              <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
                ><i :class="term.icon"
              /></span>
              {{ term.title }}
            </dt>
            <dd>{{ term.body }}</dd>
          </div>
        </dl>
      </section>

      <!-- Leituras do QR: só faz sentido quando existe código para ler. -->
      <IndicacaoMetricasCard
        v-if="indicacao.podeIndicar"
        class="divulgacao__metricas"
        :metricas="metricas"
        :loading="metricasLoading"
        :erro="metricasErro"
        @retry="loadMetricas"
      />

      <!-- ------------------------------------------------------------ cupons e resgates -->
      <template v-if="cupomFeatureEnabled">
        <ul class="ui-indicadores numeros" :aria-label="t('divulgacao.metrics.aria')">
          <li v-for="metric in metrics" :key="metric.id" class="ui-indicador">
            <span class="ui-ladrilho" aria-hidden="true"><i :class="metric.icon" /></span>
            <strong class="ui-indicador__valor ui-num">{{ metric.value }}</strong>
            <span class="ui-indicador__rotulo">{{ metric.label }}</span>
          </li>
        </ul>

        <p v-if="isGuidanceVisible" class="divulgacao__lede">{{ t('divulgacao.lists.lede') }}</p>

        <div class="listas">
          <div id="cupons" class="listas__coluna">
            <section
              class="ui-folha ui-cartao lista-cartao"
              aria-labelledby="divulgacao-cupons-titulo"
            >
              <header class="ui-cartao__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-ticket" /></span>
                <div class="ui-cartao__titulos">
                  <h2 id="divulgacao-cupons-titulo" class="ui-cartao__titulo">
                    {{ t('divulgacao.cupons.title') }}
                    <span class="ui-contagem">{{ cupons.length }}</span>
                  </h2>
                  <p v-if="isGuidanceVisible" class="ui-cartao__descricao">
                    {{ t('divulgacao.cupons.lede') }}
                  </p>
                </div>
              </header>

              <UiVazioIlustrado
                v-if="cupons.length === 0"
                aninhado
                icone="ph ph-ticket"
                :titulo="t('divulgacao.cupons.empty')"
                :texto="t('divulgacao.cupons.vazioTexto')"
              />

              <ul v-else class="ui-lista">
                <li v-for="cupom in cupons" :key="cupom.id" class="ui-linha cupom">
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ cupom.titulo }}</span>
                    <span class="ui-linha__meta">
                      <bdi class="ui-num" dir="ltr">{{ cupom.codigo }}</bdi>
                      · {{ formatCategoria(cupom.categoria) }}
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <span class="cupom__usos ui-num">
                      {{
                        t('divulgacao.cupons.usos', { n: cupom.totalResgates }, cupom.totalResgates)
                      }}
                    </span>
                    <strong class="cupom__desconto ui-num">{{ cupom.descontoPercentual }}%</strong>
                    <span class="ui-selo" :class="{ 'ui-selo--ok': cupom.ativo }">
                      <i
                        class="ph"
                        :class="cupom.ativo ? 'ph-check-circle' : 'ph-pause-circle'"
                        aria-hidden="true"
                      />
                      {{
                        cupom.ativo
                          ? t('programas.card.status.ativo')
                          : t('programas.card.status.suspenso')
                      }}
                    </span>
                  </span>
                </li>
              </ul>
            </section>

            <Button
              v-if="cuponsCursor"
              class="listas__mais"
              type="button"
              :label="t('divulgacao.cupons.loadMore')"
              severity="secondary"
              outlined
              :loading="loadingCuponsMore"
              @click="loadMoreCupons"
            />
          </div>

          <div id="resgates" class="listas__coluna">
            <section
              class="ui-folha ui-cartao lista-cartao"
              aria-labelledby="divulgacao-resgates-titulo"
            >
              <header class="ui-cartao__cabeca">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-receipt" /></span>
                <div class="ui-cartao__titulos">
                  <h2 id="divulgacao-resgates-titulo" class="ui-cartao__titulo">
                    {{ t('divulgacao.resgates.title') }}
                    <span class="ui-contagem">{{ resgates.length }}</span>
                  </h2>
                  <p v-if="isGuidanceVisible" class="ui-cartao__descricao">
                    {{ t('divulgacao.resgates.lede') }}
                  </p>
                </div>
              </header>

              <!-- O resgate nasce no balcão: o vazio leva ao "Validar cupom", contornado (Divulgação). -->
              <UiVazioIlustrado
                v-if="resgates.length === 0"
                aninhado
                icone="ph ph-receipt"
                :titulo="t('divulgacao.resgates.empty')"
                :texto="t('divulgacao.resgates.vazioTexto')"
              >
                <template v-if="podeValidarCupom" #acao>
                  <Button
                    type="button"
                    icon="ph ph-ticket"
                    :label="t('shell.cupom.cta')"
                    severity="secondary"
                    outlined
                    @click="abrirValidarCupom"
                  />
                </template>
              </UiVazioIlustrado>

              <ul v-else class="ui-lista">
                <li v-for="resgate in resgates" :key="resgate.resgateId" class="ui-linha">
                  <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
                    <i class="ph" :class="resgate.canal === 'QR' ? 'ph-qr-code' : 'ph-keyboard'" />
                  </span>
                  <span class="ui-linha__texto">
                    <bdi class="ui-linha__titulo ui-num" dir="ltr">{{ resgate.cupomCodigo }}</bdi>
                    <span class="ui-linha__meta">
                      {{
                        resgate.canal === 'QR'
                          ? t('divulgacao.resgates.canalQr')
                          : t('divulgacao.resgates.canalManual')
                      }}
                    </span>
                  </span>
                  <span class="ui-linha__fim resgate__fim">
                    <strong
                      v-if="resgate.descontoPercentualSnapshot != null"
                      class="cupom__desconto ui-num"
                    >
                      {{ resgate.descontoPercentualSnapshot }}%
                    </strong>
                    <time class="resgate__quando ui-num" :datetime="resgate.resgatadoEm">
                      {{ formatResgateDate(resgate.resgatadoEm) }}
                    </time>
                  </span>
                </li>
              </ul>
            </section>

            <Button
              v-if="resgatesCursor"
              class="listas__mais"
              type="button"
              :label="t('divulgacao.resgates.loadMore')"
              severity="secondary"
              outlined
              :loading="loadingResgatesMore"
              @click="loadMoreResgates"
            />
          </div>
        </div>
      </template>

      <!--
        Teaser de cupom removido da Divulgação (pedido de 2026-07-31): a feature não sai agora e
        o cartão prometia o que não existe. Para restaurar, volte o `useCupomComingSoon` no script
        e ponha aqui uma seção com `id="cupons"` (e `id="resgates"` dentro dela) que abra
        `openCupomComingSoon`. Enquanto estiver fora, `#cupons` e `#resgates` não existem com a
        flag de cupom desligada: os redirects legados de `?aba=` caem no topo da tela.
      -->
    </template>
  </div>
</template>

<style scoped>
.divulgacao {
  display: grid;
  min-width: 0;
  gap: 24px;
  container: divulgacao / inline-size;
}

.divulgacao__lede {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.indicacao {
  display: grid;
  gap: 12px;
}

/* ------------------------------------------------------------------ estados */

.estado {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 36px 24px;
  text-align: center;
}

.estado h2 {
  margin: 6px 0 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.estado p {
  max-width: 52ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ o convite
 * Três cartões lado a lado, com o ícone grande saindo pela borda do fim, como as Ações rápidas do
 * Início. A cor de cada jeito é um toque (17/11/2026, "cores muito fortes"): o fundo é o papel com
 * um pouco do pastel, o texto fica na tinta da página, e a cor cheia só no selo e no ícone de
 * fundo. Dentro, de cima para baixo: o selo com o verbo e a frase, o quadro com a coisa (mesma
 * altura nos três) e os botões. Abaixo de ~760 px de largura do bloco, um embaixo do outro.
 */

.convite {
  display: grid;
  gap: 14px;
}

.convite__vias {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
}

@container divulgacao (max-width: 760px) {
  .convite__vias {
    grid-template-columns: minmax(0, 1fr);
  }
}

.via {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  padding: 18px;
  isolation: isolate;
  border-radius: 22px;
  background: color-mix(in oklab, var(--tom-fundo) 38%, var(--app-cartao, var(--superficie)));
  color: var(--tinta);
  container: via / inline-size;
}

.app-dark .via {
  background: color-mix(in oklab, var(--tom-fundo) 45%, var(--app-cartao, var(--superficie)));
}

/* O ícone do jeito, em duotone, saindo pelo canto de cima do fim: marca-d'água, não figura. */
.via__fundo {
  position: absolute;
  z-index: -1;
  inset-block-start: -20px;
  inset-inline-end: -20px;
  width: 112px;
  height: 112px;
  color: var(--tom-tinta);
  opacity: 0.16;
  rotate: -16deg;
}

.app-dark .via__fundo {
  opacity: 0.22;
}

:dir(rtl) .via__fundo {
  rotate: 16deg;
}

.via__cabeca {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding-inline-end: 56px;
}

/* O selo: a cor cheia do jeito, como os ladrilhos da casa; é ele que diz qual cartão é qual. */
.via__selo {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--tom-fundo);
  color: var(--tom-tinta);
  font-size: 21px;
}

.via__titulos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.via__titulo {
  margin: 0;
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.via__dica {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

/* O quadro branco: a coisa em si, centrada, na mesma altura nos três cartões. */
.via__quadro {
  display: grid;
  min-width: 0;
  height: 7rem;
  place-items: center;
  padding: 10px 16px;
  border: 1px solid color-mix(in oklab, var(--tom-tinta) 14%, transparent);
  border-radius: 16px;
  background: var(--app-cartao, var(--superficie));
  color: var(--tinta);
}

/* O quadro do QR com o mesmo fio dos outros (o papel dele é branco nos dois temas: leitura). */
.via :deep(.indicacao-qr__frame) {
  border: 1px solid color-mix(in oklab, var(--tom-tinta) 14%, transparent);
}

.via__codigo {
  font-family: var(--font-dados);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

/* O link inteiro, em até duas linhas: cortado com reticências, ninguém sabia o que mandava. */
.via__link {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-family: var(--font-dados);
  font-size: 14.5px;
  font-weight: 600;
  overflow-wrap: anywhere;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* Os botões embaixo, sempre no pé do cartão, mesmo quando a frase de um quebra em duas linhas. */
.via__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.via__acoes :deep(.p-button) {
  flex: 1 1 auto;
  justify-content: center;
}

/*
 * Cartão estreito (os três lado a lado no tablet): os botões ficam numa linha só, mais compactos.
 * Quebrando em duas, os cartões de dois botões cresciam e abriam um vão no do código.
 */
@container via (max-width: 330px) {
  .via__acoes,
  .via :deep(.indicacao-qr__acoes) {
    flex-wrap: nowrap;
    gap: 6px;
  }

  .via :deep(.p-button) {
    min-width: 0;
    padding-inline: 10px;
    font-size: 14px;
  }
}

/* O QR: o quadro dele ocupa o lugar do quadro branco, e os botões o pé, como nos outros. */
.via__qr {
  flex: 1;
}

.via--pets {
  --tom-fundo: var(--pets-fundo);
  --tom-tinta: var(--pets-tinta);
}

.via--clinica {
  --tom-fundo: var(--clinica-fundo);
  --tom-tinta: var(--clinica-tinta);
}

.via--portal {
  --tom-fundo: var(--portal-fundo);
  --tom-tinta: var(--portal-tinta);
}

/* ------------------------------------------------------------------ regras */

.regras {
  overflow: clip;
}

.regras__passos {
  padding-top: 18px;
}

.regras__lista {
  display: grid;
  gap: 12px;
  margin: 0;
  padding-top: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.regra.ui-poco {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px 16px;
}

.regra dt {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.regra dd {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .regras__lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .regras__lista {
    grid-template-columns: minmax(0, 1fr);
  }

  /* No estreito o botão de abrir desce para baixo do título, alinhado com o texto. */
  .regras__cabeca {
    flex-wrap: wrap;
  }

  .regras__cabeca .ui-cartao__titulos {
    flex-basis: 0;
  }

  .regras__cabeca .ui-cartao__acoes {
    flex-basis: 100%;
    justify-content: flex-start;
    margin-top: -4px;
    padding-inline-start: 42px;
  }
}

/* ------------------------------------------------------------------ números e listas */

.numeros {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista-cartao {
  overflow: clip;
}

.lista-cartao .ui-lista > li:first-child > .ui-linha {
  border-radius: 0;
}

.listas {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
}

.listas__coluna {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.listas__mais.p-button {
  justify-self: center;
}

.cupom__usos {
  color: var(--tinta-2);
  font-size: 13px;
}

.cupom__desconto {
  min-width: 3ch;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  text-align: end;
}

.resgate__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

.esqueleto {
  display: grid;
}

.esqueleto__linha {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
}

.esqueleto__linha + .esqueleto__linha {
  border-top: 1px solid var(--linha);
}

.esqueleto__texto {
  display: grid;
  gap: 6px;
}

@media (max-width: 640px) {
  .cupom__usos {
    display: none;
  }
}
</style>
