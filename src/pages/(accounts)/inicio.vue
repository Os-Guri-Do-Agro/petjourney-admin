<script setup lang="ts">
/**
 * Visão geral: o que está parado agora, como anda o dia e quanto a parceria rendeu.
 *
 * ## A forma
 *
 * O Prodify na paleta da casa, a pedido. Fundo claro com uma grade fina que some descendo e dois
 * brilhos de sálvia no topo; a data pequena, o "Olá" e um resumo em degradê com as pílulas de ação
 * na mesma linha. Embaixo, duas colunas de cartões brancos:
 *
 * - à esquerda, o que pede ação (o "My Tasks"), o andamento do dia (o "My Goals") e, fechando a
 *   coluna, o cartão da marca, que cresce até a altura da coluna da direita;
 * - à direita, os módulos (o "Projects"), a agenda da semana (o "Calendar") e os ganhos, com o
 *   QR e o código de indicação ao lado do valor.
 *
 * Em uma coluna só, a esquerda vem primeiro: quem opera no tablet vê o trabalho antes do resto.
 * Conta sem clínica nem hotel não tem pauta, andamento nem agenda: ganhos de um lado, módulos do
 * outro.
 *
 * ## O dia
 *
 * Andamento, módulos e agenda leem o mesmo dia da casa — a agenda da clínica e o hotel de hoje.
 * Ele é carregado uma vez aqui e entregue aos cartões por `provide`, para que três cartões não
 * peçam três vezes a mesma coisa nem mostrem números de momentos diferentes.
 */
import Button from 'primevue/button'
import { PhCalendarBlank, PhMapTrifold, PhQrCode } from '@phosphor-icons/vue'
import { computed, onMounted, onUnmounted, provide, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import '@/components/home/home-card.css'
import HomeAgenda from '@/components/home/HomeAgenda.vue'
import HomeAndamento from '@/components/home/HomeAndamento.vue'
import HomeIndique from '@/components/home/HomeIndique.vue'
import HomeMarca from '@/components/home/HomeMarca.vue'
import HomeModulos from '@/components/home/HomeModulos.vue'
import HomePauta from '@/components/home/HomePauta.vue'
import HomeSaldo from '@/components/home/HomeSaldo.vue'
import { CHAVE_DO_DIA, useLinhaDoDia } from '@/components/home/useLinhaDoDia'
import { usePautaDaHome } from '@/components/home/usePautaDaHome'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { useAppNavigation } from '@/composables/useAppNavigation'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getAuthUser } from '@/service/auth/auth-session'

const { t, locale } = useI18n()
const { store, ensureContext } = useParceiroPortal()
const { hasClinicalProfile, hasHotelProfile } = useAppNavigation()
const { resumo } = usePautaDaHome()

provide(
  CHAVE_DO_DIA,
  useLinhaDoDia({
    clinica: () => hasClinicalProfile.value,
    hotel: () => hasHotelProfile.value,
  }),
)

const indique = ref<InstanceType<typeof HomeIndique> | null>(null)

const now = ref(new Date())
let clockId: ReturnType<typeof setInterval> | undefined

/**
 * O nome só entra quando o contexto chegou. Antes disso a store devolve "Parceiro" fixo em
 * português — nos seis idiomas —, e o título trocava de "Olá, Parceiro" para o nome real diante
 * de quem olhava.
 */
const greetingTitle = computed(() => {
  if (store.semAcessoParceiro) {
    const nome = getAuthUser()?.nome?.trim()
    return nome ? t('inicio.greeting.helloName', { name: nome }) : t('inicio.greeting.hello')
  }

  if (store.loadState !== 'ready' || !store.dashboard) {
    return t('inicio.greeting.hello')
  }

  return t('inicio.greeting.helloName', { name: store.parceiroNome })
})

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

/**
 * Curta, como o "Mon, July 7" de lá. Só a primeira letra sobe: `text-transform: capitalize` fazia
 * "Qui., 17 De Set." e, no sérvio, mês com maiúscula (erro nos dois idiomas).
 */
const todayLabel = computed(() => {
  const intlLocale = INTL_LOCALE[locale.value as Locale]
  const label = now.value.toLocaleDateString(intlLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })

  return label.charAt(0).toLocaleUpperCase(intlLocale) + label.slice(1)
})

/**
 * A segunda linha da saudação, em degradê: o que a pauta diz, em uma frase. É a "How can I help
 * you today?" do Prodify, só que com conteúdo — um número que a pessoa confere logo abaixo.
 */
const fraseDoResumo = computed(() => {
  const atual = resumo.value

  switch (atual.estado) {
    case 'semModulos':
      return t('inicio.resumo.portal')
    case 'conferindo':
      return t('inicio.resumo.conferindo')
    case 'urgentes':
      return t('inicio.resumo.urgentes', { total: atual.total }, atual.total)
    case 'esperando':
      return t('inicio.resumo.esperando', { total: atual.total }, atual.total)
    case 'falhou':
      return t('inicio.resumo.falhou')
    default:
      return t('inicio.resumo.emDia')
  }
})

type Acao = {
  id: string
  rotulo: string
  icone: Component
  to?: string
  executar?: () => void
}

/**
 * As pílulas de ação: o que se começa daqui, não o menu de novo. Só entra o que a conta pode
 * fazer — agenda com a clínica ligada, mapa de vagas com o hotel, compartilhar quando há QR — e a
 * primeira é cheia, em degradê, como o "✦ Ask AI" do Prodify.
 */
const acoes = computed<Acao[]>(() => {
  const lista: Acao[] = []

  if (hasClinicalProfile.value) {
    lista.push({
      id: 'agenda',
      rotulo: t('inicio.acoes.agenda'),
      icone: PhCalendarBlank,
      to: '/veterinario/agenda',
    })
  }

  if (hasHotelProfile.value) {
    lista.push({
      id: 'mapa',
      rotulo: t('inicio.acoes.mapa'),
      icone: PhMapTrifold,
      to: '/hotel/mapa',
    })
  }

  if (indique.value?.temQr) {
    lista.push({
      id: 'compartilhar',
      rotulo: t('inicio.acoes.compartilhar'),
      icone: PhQrCode,
      executar: () => indique.value?.abrirQr(),
    })
  }

  return lista
})

/** Com clínica ou hotel ligados, a página ganha a pauta, o andamento e a agenda. */
const temModulos = computed(() => hasClinicalProfile.value || hasHotelProfile.value)

onMounted(() => {
  /* A visão geral rola sem barra à vista (`home-card.css`); a classe sai quando a página sai. */
  document.documentElement.classList.add('sem-barra-de-rolagem')
  void ensureContext()
  clockId = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onUnmounted(() => {
  document.documentElement.classList.remove('sem-barra-de-rolagem')

  if (clockId) {
    clearInterval(clockId)
  }
})
</script>

<template>
  <PartnerPageFrame
    class="inicio-pagina"
    :title="greetingTitle"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    block-when-suspended
    guidance
    @retry="ensureContext(true)"
  >
    <template #cabecalho>
      <div class="saudacao">
        <time class="saudacao__data" :datetime="now.toISOString()">{{ todayLabel }}</time>
        <h1 class="saudacao__titulo">{{ greetingTitle }}</h1>

        <div class="saudacao__linha">
          <p class="saudacao__resumo" aria-live="polite">{{ fraseDoResumo }}</p>

          <nav v-if="acoes.length > 0" class="acoes" :aria-label="t('inicio.acoes.rotulo')">
            <template v-for="(acao, indice) in acoes" :key="acao.id">
              <RouterLink
                v-if="acao.to"
                class="acao"
                :class="{ 'acao--cheia': indice === 0 }"
                :to="acao.to"
              >
                <component
                  :is="acao.icone"
                  class="acao__icone"
                  :weight="indice === 0 ? 'fill' : 'duotone'"
                  aria-hidden="true"
                />
                {{ acao.rotulo }}
              </RouterLink>
              <Button
                v-else
                type="button"
                class="acao"
                :class="{ 'acao--cheia': indice === 0 }"
                :label="acao.rotulo"
                @click="acao.executar?.()"
              >
                <template #icon>
                  <component
                    :is="acao.icone"
                    class="acao__icone"
                    :weight="indice === 0 ? 'fill' : 'duotone'"
                    aria-hidden="true"
                  />
                </template>
              </Button>
            </template>
          </nav>
        </div>
      </div>
    </template>

    <div class="inicio">
      <PartnerOperabilityBanner />

      <p v-if="isGuidanceVisible" class="inicio__lede">
        {{ temModulos ? t('inicio.ledePauta') : t('inicio.lede') }}
      </p>

      <div class="inicio__grade">
        <div class="inicio__coluna">
          <template v-if="temModulos">
            <HomePauta />
            <HomeAndamento :clinica="hasClinicalProfile" :hotel="hasHotelProfile" />
          </template>
          <HomeSaldo v-else>
            <template #indicacao><HomeIndique ref="indique" /></template>
          </HomeSaldo>
          <!-- A ação do cartão da marca ainda não foi decidida: `abrir` fica sem ouvinte. -->
          <HomeMarca />
        </div>

        <div class="inicio__coluna">
          <HomeModulos :clinica="hasClinicalProfile" :hotel="hasHotelProfile" />
          <template v-if="temModulos">
            <HomeAgenda :clinica="hasClinicalProfile" :hotel="hasHotelProfile" />
            <HomeSaldo>
              <template #indicacao><HomeIndique ref="indique" /></template>
            </HomeSaldo>
          </template>
        </div>
      </div>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
/*
 * O fundo do Prodify: cinza quase branco, dois brilhos da marca no topo e uma grade fina que se
 * apaga descendo. A grade mora num pseudo-elemento para poder levar máscara sem apagar o resto.
 */
.inicio-pagina.partner-page {
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(52rem 26rem at 8% -6rem, rgb(120 196 178 / 30%), transparent 70%),
    radial-gradient(44rem 24rem at 96% -4rem, rgb(96 178 196 / 22%), transparent 70%),
    var(--hc-pagina);
}

.inicio-pagina.partner-page::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image:
    linear-gradient(var(--hc-grade) 1px, transparent 1px),
    linear-gradient(90deg, var(--hc-grade) 1px, transparent 1px);
  background-size: 28px 28px;
  content: '';
  mask-image: linear-gradient(to bottom, #000 0, rgb(0 0 0 / 60%) 16rem, transparent 34rem);
  pointer-events: none;
}

.app-dark .inicio-pagina.partner-page {
  background:
    radial-gradient(52rem 26rem at 8% -6rem, rgb(108 201 181 / 13%), transparent 70%),
    radial-gradient(44rem 24rem at 96% -4rem, rgb(108 198 208 / 9%), transparent 70%),
    var(--hc-pagina);
}

/* ------------------------------------------------------------------ saudação */

.saudacao {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.saudacao__data {
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  font-weight: 500;
}

.saudacao__titulo {
  margin: 0.35rem 0 0;
  color: var(--hc-tinta);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.025em;
}

/* O resumo e as pílulas dividem a linha, como o "How can I help you today?" e o "Ask AI" de lá. */
.saudacao__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
}

.saudacao__resumo {
  margin: 0;
  background: var(--hc-degrade);
  background-clip: text;
  color: transparent;
  font-size: 2rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.025em;
  -webkit-text-fill-color: transparent;
}

/* ------------------------------------------------------------------ pílulas de ação */

.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.acao,
.acao.p-button {
  --acao-sombra: 0 1px 2px rgb(20 32 28 / 5%);

  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0 0.95rem;
  border: 1px solid #bfdcd3;
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: var(--acao-sombra);
  transition:
    background-color 150ms ease-out,
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.app-dark .acao,
.app-dark .acao.p-button {
  border-color: #2c4a42;
}

.acao:hover,
.acao.p-button:not(:disabled):hover {
  --acao-sombra: 0 4px 12px -6px rgb(20 32 28 / 25%);

  border-color: var(--hc-marca);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

/* A primeira pílula, cheia e em degradê: o "✦ Ask AI" de lá. */
.acao--cheia,
.acao--cheia.p-button {
  --acao-sombra: 0 6px 16px -8px var(--hc-marca-sombra);

  border-color: transparent;
  background: var(--hc-degrade-botao);
  color: var(--hc-sobre-marca);
  font-weight: 600;
}

.acao--cheia:hover,
.acao--cheia.p-button:not(:disabled):hover {
  --acao-sombra: 0 10px 22px -8px var(--hc-marca-sombra-forte);

  border-color: transparent;
  background: var(--hc-degrade-botao);
  color: var(--hc-sobre-marca);
}

.acao:focus-visible,
.acao.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
}

.acao__icone {
  flex-shrink: 0;
  width: 1.05rem;
  height: 1.05rem;
  color: var(--hc-marca);
}

.acao--cheia .acao__icone {
  color: currentColor;
}

/* ------------------------------------------------------------------ grade
 * A grade responde à largura do próprio conteúdo, não da janela: com trilho e painel abertos, um
 * tablet de 1024 px deixa ~720 px para a página.
 */
.inicio {
  display: grid;
  gap: 1.25rem;
  width: 100%;
  container-type: inline-size;
  container-name: inicio;
}

.inicio__lede {
  max-width: 44rem;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
  line-height: 1.5;
}

/*
 * Duas colunas independentes, como no Prodify: cada uma empilha os próprios cartões, e a altura de
 * um lado não abre buraco no outro.
 */
.inicio__grade {
  display: grid;
  gap: 1.25rem;
}

/* Coluna em pilha; o cartão da marca, por último, cresce até a altura da coluna vizinha. */
.inicio__coluna {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

@container inicio (min-width: 56rem) {
  .inicio__grade {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .acao,
  .acao.p-button {
    transition: none;
  }
}
</style>
