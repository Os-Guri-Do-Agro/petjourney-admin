<script setup lang="ts">
/**
 * A moldura do portal.
 *
 * Uma barra só, à esquerda, com tudo o que não muda de tela para tela: a empresa, a busca, o
 * "criar", o mapa (Início e os espaços com seus destinos) e a conta. O resto da largura é da tela.
 * Não há cabeçalho: o título da tela é o primeiro texto da tela, e o "onde estou" mora no mapa,
 * aceso na cor do espaço, e nas abas do destino.
 *
 * Na Clínica, a fita do dia fica presa no alto: o expediente inteiro, com a agulha em agora.
 *
 * Até 900 px a barra vira gaveta, e um topo fino com o menu e o nome da tela toma o lugar dela.
 */
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import ComingSoonFeatureDialog from '@/components/common/ComingSoonFeatureDialog.vue'
import ShellAvisos from '@/components/layout/ShellAvisos.vue'
import ShellConta from '@/components/layout/ShellConta.vue'
import ShellCriar from '@/components/layout/ShellCriar.vue'
import ShellNavegacao from '@/components/layout/ShellNavegacao.vue'
import FeedbackSaqueDialog from '@/components/parceiro/FeedbackSaqueDialog.vue'
import ValidarCupomDialog from '@/components/parceiro/ValidarCupomDialog.vue'
import { useCupomComingSoon } from '@/composables/useCupomComingSoon'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { isCompactDensity, isListNavigator } from '@/composables/useLayoutPreferences'
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { oferecerEspacos } from '@/navegacao/espacos'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'

/** Preferência de layout (não é sessão): recolhida deixa só os ícones. */
const CHAVE_RECOLHIDA = 'petjourney-navigator-collapsed'
const CONSULTA_COMPACTA = '(max-width: 900px)'

const { t } = useI18n()
const route = useRoute()
const parceiroStore = useParceiroStore()
const usuarioPerfilStore = useUsuarioPerfilStore()
const { espacos, aqui, lugar, navigationSections, clinicaNaDemonstracao, hotelNaDemonstracao } =
  oferecerEspacos()
const { open: abrirResgate, canOpen: podeResgatar } = useCupomResgateModal()
const { visible: cupomEmBreveVisivel, open: abrirCupomEmBreve } = useCupomComingSoon()
const cupomLigado = CUPOM_FEATURE_ENABLED

const recolhida = ref(lerRecolhida())
const compacto = ref(casaCompacto())
const gavetaAberta = ref(false)
const buscaAberta = ref(false)
const avisosAbertos = ref(false)
let consulta: MediaQueryList | undefined

function casaCompacto() {
  return typeof window !== 'undefined' && window.matchMedia(CONSULTA_COMPACTA).matches
}

function lerRecolhida() {
  return typeof window !== 'undefined' && window.localStorage.getItem(CHAVE_RECOLHIDA) === 'true'
}

/** Na gaveta a barra está sempre inteira: recolher é coisa de tela larga. */
const barraRecolhida = computed(() => recolhida.value && !compacto.value)

function alternarBarra() {
  recolhida.value = !recolhida.value
  window.localStorage.setItem(CHAVE_RECOLHIDA, String(recolhida.value))
}

function fecharGaveta() {
  gavetaAberta.value = false
}

/* Na gaveta do tablet, a lista de avisos abre no lugar da barra, e não por cima dela. */
watch(avisosAbertos, (aberta) => {
  if (aberta) fecharGaveta()
})

function aoMudarTela(evento: MediaQueryListEvent) {
  compacto.value = evento.matches

  if (!evento.matches) {
    gavetaAberta.value = false
  }
}

function aoTeclar(evento: KeyboardEvent) {
  /*
   * `Ctrl/⌘ + K` abre a busca, e atravessa campo de texto de propósito: quem está no meio de uma
   * anamnese e precisa conferir o histórico do paciente não vai clicar fora antes.
   */
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
    if (!clinicaNaDemonstracao.value) {
      return
    }

    evento.preventDefault()
    buscaAberta.value = !buscaAberta.value
    return
  }

  if (evento.key === 'Escape' && gavetaAberta.value) {
    gavetaAberta.value = false
  }
}

const ClinicBuscaGlobal = defineAsyncComponent(
  () => import('@/features/clinico/components/base/ClinicBuscaGlobal.vue'),
)
const FitaDoDia = defineAsyncComponent(
  () => import('@/features/clinico/components/base/FitaDoDia.vue'),
)
const FitaDaCasa = defineAsyncComponent(
  () => import('@/features/hotel/components/base/FitaDaCasa.vue'),
)

const atalhoDaBusca = computed(() =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K',
)

/**
 * A fita aparece em toda a Clínica, menos na Agenda: lá a grade já é o dia inteiro, com a
 * própria linha do agora, e a fita só tomaria a altura de que a grade precisa.
 */
const mostrarFita = computed(
  () =>
    clinicaNaDemonstracao.value &&
    lugar.value === 'clinica' &&
    !route.path.startsWith('/clinica/agenda'),
)

/** No Hotel, a fita da casa; menos na Rotina, que já é a prancheta do dia hora a hora. */
const mostrarFitaDaCasa = computed(
  () =>
    hotelNaDemonstracao.value && lugar.value === 'hotel' && route.path !== '/hotel/rotina',
)

/** No topo do celular: o nome do destino, ou do espaço, ou da tela solta. */
const tituloNoTopo = computed(() => {
  if (aqui.value.destino) {
    return aqui.value.destino.rotulo
  }

  if (route.path.startsWith('/settings') || route.path.startsWith('/perfil')) {
    return t('shell.user.settings')
  }

  return aqui.value.espaco?.rotulo ?? t('shell.barra.inicio')
})

function clicarCupom() {
  if (!cupomLigado) {
    abrirCupomEmBreve()
    return
  }

  abrirResgate()
}

watch(
  () => route.fullPath,
  () => {
    gavetaAberta.value = false
  },
)

/*
 * Em tela larga quem rola é a folha, e ela não é trocada entre telas: sem isto, abrir a ficha de
 * um paciente a partir do fim da lista abriria a ficha já rolada até o fim. Só troca de caminho
 * volta ao alto — mudar a aba de um filtro (a query) mantém a leitura onde estava.
 */
const conteudo = ref<HTMLElement | null>(null)

/*
 * Diálogos, gavetas e menus vão para o `body` (teleport) e saem de dentro da moldura: sem a cor
 * do espaço lá, os ladrilhos e as marcas deles ficariam neutros. O `body` leva a mesma classe de
 * lugar da moldura.
 */
watch(
  lugar,
  (atual, anterior) => {
    if (typeof document === 'undefined') {
      return
    }

    if (anterior) {
      document.body.classList.remove(`pj-lugar--${anterior}`)
    }

    document.body.classList.add(`pj-lugar--${atual}`)
  },
  { immediate: true },
)

onUnmounted(() => {
  document.body.classList.remove(`pj-lugar--${lugar.value}`)
})

watch(
  () => route.path,
  () => {
    conteudo.value?.scrollTo({ top: 0 })
  },
)

onMounted(() => {
  consulta = window.matchMedia(CONSULTA_COMPACTA)
  compacto.value = consulta.matches
  consulta.addEventListener('change', aoMudarTela)
  window.addEventListener('keydown', aoTeclar)

  usuarioPerfilStore.hydrate()
  usuarioPerfilStore.syncFromAuth()
  void usuarioPerfilStore.ensureFotoCarregada()
  void parceiroStore.bootstrap().catch(() => undefined)
})

onUnmounted(() => {
  consulta?.removeEventListener('change', aoMudarTela)
  window.removeEventListener('keydown', aoTeclar)
})
</script>

<template>
  <div
    class="shell"
    :class="[
      `pj-lugar--${lugar}`,
      {
        'shell--recolhida': barraRecolhida,
        'shell--compacto': compacto,
        'shell--gaveta': compacto && gavetaAberta,
        'shell--densa': isCompactDensity,
      },
    ]"
  >
    <a class="shell__pular" href="#conteudo">{{ t('shell.barra.pular') }}</a>

    <Transition name="shell-veu">
      <div
        v-if="compacto && gavetaAberta"
        class="shell__veu"
        aria-hidden="true"
        @click="fecharGaveta"
      />
    </Transition>

    <aside
      id="barra-do-portal"
      class="barra"
      :aria-hidden="compacto && !gavetaAberta ? 'true' : undefined"
      :inert="compacto && !gavetaAberta ? true : undefined"
    >
      <!-- Na gaveta do celular, o "fechar" no canto de cima. -->
      <button
        v-if="compacto"
        type="button"
        class="barra__fechar"
        :aria-label="t('shell.drawer.close')"
        aria-controls="barra-do-portal"
        @click="fecharGaveta"
      >
        <i class="ph ph-x" aria-hidden="true" />
      </button>

      <div class="barra__miolo">
        <div class="barra__topo">
          <RouterLink class="barra__marca" to="/inicio" :title="parceiroStore.parceiroNome">
            <span class="barra__pata" aria-hidden="true">
              <img src="/pata-escura.png" alt="" />
            </span>
            <span class="barra__empresa shell-rotulo">
              <strong>{{ parceiroStore.parceiroNome }}</strong>
              <small>PetJourney</small>
            </span>
          </RouterLink>

          <!-- Recolher/expandir: ao lado da empresa; recolhida, logo abaixo da pata. -->
          <button
            v-if="!compacto"
            type="button"
            class="barra__recolher"
            :aria-label="barraRecolhida ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
            :aria-expanded="!barraRecolhida"
            aria-controls="barra-do-portal"
            :title="barraRecolhida ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
            @click="alternarBarra"
          >
            <i class="ph ph-sidebar-simple" aria-hidden="true" />
          </button>
        </div>

        <div class="barra__ferramentas">
          <button
            v-if="clinicaNaDemonstracao"
            type="button"
            class="barra__busca"
            :title="t('clinico.busca.abrir')"
            :aria-label="t('clinico.busca.abrir')"
            @click="buscaAberta = true"
          >
            <i class="ph ph-magnifying-glass" aria-hidden="true" />
            <span class="barra__busca-texto shell-rotulo">{{ t('clinico.busca.abrirCurto') }}</span>
            <kbd class="shell-rotulo">{{ atalhoDaBusca }}</kbd>
          </button>
          <ShellCriar :recolhida="barraRecolhida" :clinica="clinicaNaDemonstracao" />
        </div>

        <ShellNavegacao
          class="barra__mapa"
          :espacos="espacos"
          :aqui="aqui"
          :recolhida="barraRecolhida"
          :todos-abertos="isListNavigator"
          @navegou="fecharGaveta"
        />

        <div class="barra__pe">
          <ShellAvisos v-model:aberta="avisosAbertos" :recolhida="barraRecolhida" />
          <button
            type="button"
            class="barra__cupom"
            :disabled="cupomLigado && !podeResgatar"
            :title="!cupomLigado ? t('comingSoon.cupom.navHint') : t('shell.cupom.cta')"
            @click="clicarCupom"
          >
            <span class="barra__cupom-icone" aria-hidden="true"><i class="ph ph-ticket" /></span>
            <span class="barra__cupom-texto shell-rotulo">{{ t('shell.cupom.cta') }}</span>
            <span v-if="!cupomLigado" class="barra__breve shell-rotulo">
              {{ t('comingSoon.cupom.badge') }}
            </span>
          </button>
          <ShellConta :recolhida="barraRecolhida" />
        </div>
      </div>
    </aside>

    <div class="palco">
      <header v-if="compacto" class="topo">
        <button
          type="button"
          class="topo__menu"
          :aria-label="t('shell.drawer.open')"
          aria-controls="barra-do-portal"
          :aria-expanded="gavetaAberta"
          @click="gavetaAberta = true"
        >
          <i class="ph ph-list" aria-hidden="true" />
        </button>
        <span class="topo__lugar" aria-hidden="true"><i :class="aqui.espaco?.icone ?? 'ph ph-house-simple'" /></span>
        <strong class="topo__titulo">{{ tituloNoTopo }}</strong>
        <button
          v-if="clinicaNaDemonstracao"
          type="button"
          class="topo__menu"
          :aria-label="t('clinico.busca.abrir')"
          @click="buscaAberta = true"
        >
          <i class="ph ph-magnifying-glass" aria-hidden="true" />
        </button>
      </header>

      <FitaDoDia v-if="mostrarFita" class="palco__fita" />
      <FitaDaCasa v-else-if="mostrarFitaDaCasa" class="palco__fita" />

      <main id="conteudo" ref="conteudo" class="palco__conteudo" tabindex="-1">
        <slot />
      </main>
    </div>

    <ValidarCupomDialog v-if="cupomLigado" />
    <ComingSoonFeatureDialog v-model:visible="cupomEmBreveVisivel" />

    <!--
      O questionário pós-saque mora na moldura, e não na carteira: lá ele morria no meio da
      resposta ao trocar de rota. Quem abre é a carteira, depois de um saque concluído.
    -->
    <FeedbackSaqueDialog />

    <ClinicBuscaGlobal
      v-if="clinicaNaDemonstracao"
      :aberto="buscaAberta"
      :secoes="navigationSections"
      @fechar="buscaAberta = false"
    />
  </div>
</template>

<style scoped>
.shell {
  --barra-largura: 272px;
  --palco-margem: 10px;

  display: grid;
  height: 100dvh;
  grid-template-columns: var(--barra-largura) minmax(0, 1fr);
  overflow: hidden;
  background: var(--rail);
  color: var(--tinta);
  font-family: var(--font-texto);
  transition: grid-template-columns 300ms var(--pj-curva-chega);
}

/* 72 px: 12 de margem de cada lado e uma coluna de 48 onde cada ícone fica no centro (x = 36). */
.shell--recolhida {
  --barra-largura: 72px;
}

.shell__pular {
  position: fixed;
  z-index: 100;
  top: 8px;
  left: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  font-weight: 600;
  transform: translateY(-160%);
}

.shell__pular:focus {
  transform: none;
}

/* ------------------------------------------------------------------------------------- barra
 * A moldura verde: um degradê leve de cima para baixo e o brilho do espaço no canto. Dentro dela, o
 * que é peça (a empresa, a busca, o painel dos destinos, a conta) mora em vidro — o mesmo cartão
 * das telas, em versão escura.
 */

.barra {
  position: sticky;
  z-index: 40;
  top: 0;
  height: 100dvh;
  min-width: 0;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--rail) 90%, var(--pets)) 0%,
    var(--rail) 46%
  );
  color: var(--sobre-rail);
}

.barra__miolo {
  position: relative;
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
}

.barra__miolo::before {
  position: absolute;
  inset: 0 0 auto;
  height: 340px;
  background: radial-gradient(
    120% 100% at 0% 0%,
    color-mix(in oklab, var(--pj-lugar-claro) 14%, transparent),
    transparent 70%
  );
  content: '';
  pointer-events: none;
}

.barra__miolo > * {
  position: relative;
}

/*
 * As palavras da barra esmaecem ao recolher, em vez de sumir de uma vez: a coluna encolhe por
 * baixo delas e os ícones ficam onde estavam.
 */
.barra :deep(.shell-rotulo) {
  transition: opacity 180ms var(--pj-curva-chega);
}

.shell--recolhida .barra :deep(.shell-rotulo) {
  opacity: 0;
  pointer-events: none;
}

.barra__topo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 12px 12px;
}

.barra__marca {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 14px;
  background: rgb(255 255 255 / 5%);
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color var(--pj-tempo-curto) ease;
}

.barra__marca:hover {
  background: rgb(255 255 255 / 8%);
}

.barra__marca:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

.barra__pata {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: var(--sobre-rail);
  box-shadow: 0 6px 14px -6px rgb(0 0 0 / 60%);
}

.barra__pata img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.barra__empresa {
  display: grid;
  min-width: 0;
  line-height: 1.2;
}

.barra__empresa strong {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 650;
  text-overflow: ellipsis;
}

.barra__empresa small {
  color: var(--sobre-rail-2);
  font-size: 12px;
}

/* Recolher/expandir: o mesmo vidro da busca, num quadrado do tamanho do "criar", logo abaixo. */
.barra__recolher {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 11px;
  background: rgb(255 255 255 / 5%);
  color: var(--sobre-rail-2);
  cursor: pointer;
  font-size: 18px;
  transition:
    border-color var(--pj-tempo-curto) ease,
    background-color var(--pj-tempo-curto) ease,
    color var(--pj-tempo-curto) ease;
}

.barra__recolher:hover {
  border-color: rgb(255 255 255 / 20%);
  background: rgb(255 255 255 / 8%);
  color: var(--sobre-rail);
}

[dir='rtl'] .barra__recolher i {
  scale: -1 1;
}

.barra__ferramentas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 16px;
}

.barra__busca {
  display: flex;
  flex: 1 1 120px;
  min-width: 40px;
  height: 40px;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 0 10px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 11px;
  background: rgb(255 255 255 / 5%);
  color: var(--sobre-rail-2);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  text-align: left;
  white-space: nowrap;
  transition:
    border-color var(--pj-tempo-curto) ease,
    background-color var(--pj-tempo-curto) ease;
}

.barra__busca:hover {
  border-color: rgb(255 255 255 / 20%);
  background: rgb(255 255 255 / 8%);
  color: var(--sobre-rail);
}

.barra__busca i {
  flex: none;
  font-size: 18px;
}

.barra__busca-texto {
  flex: 1;
}

.barra__busca kbd {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgb(255 255 255 / 10%);
  font-family: var(--font-dados);
  font-size: 11px;
}

.barra__busca:focus-visible,
.barra__recolher:focus-visible,
.barra__cupom:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

/* O mapa rola, mas sem barra à vista: na coluna estreita ela comia o lugar dos ícones. */
.barra__mapa {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.barra__mapa::-webkit-scrollbar {
  display: none;
}

.barra__pe {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding: 10px 12px 14px;
  border-top: 1px solid rgb(255 255 255 / 7%);
}

.barra__cupom {
  display: flex;
  height: 42px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  padding: 0 10px 0 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--sobre-rail-2);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
  white-space: nowrap;
}

.barra__cupom-icone {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 7%);
  font-size: 18px;
}

.barra__cupom:hover:not(:disabled) {
  background: rgb(255 255 255 / 6%);
  color: var(--sobre-rail);
}

.barra__cupom:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.barra__cupom-texto {
  flex: 1;
}

.barra__breve {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgb(255 255 255 / 10%);
  color: var(--sobre-rail-2);
  font-size: 11px;
  font-weight: 600;
}

/*
 * Recolhida: só os ícones, um embaixo do outro no eixo da coluna. A empresa perde a moldura e
 * fica só a pata, com o recolher logo abaixo; a busca vira um quadrado do tamanho do "criar".
 */
.shell--recolhida .barra__topo {
  flex-direction: column;
  align-items: center;
}

.shell--recolhida .barra__marca {
  flex: none;
  width: 48px;
  padding: 5px;
  border-color: transparent;
  background: transparent;
}

.shell--recolhida .barra__marca:hover {
  background: rgb(255 255 255 / 8%);
}

.shell--recolhida .barra__ferramentas {
  flex-direction: column;
  align-items: center;
}

.shell--recolhida .barra__busca {
  flex: none;
  width: 40px;
}

/* -------------------------------------------------------------------------------------- palco
 * A folha: presa na moldura com cantos de 22px, e quem rola é o conteúdo dela — a barra e a fita
 * ficam paradas. No alto, a luz do espaço (um brilho na cor do lugar) diz onde se está antes de
 * qualquer palavra, e some com a rolagem.
 */

.palco {
  position: relative;
  display: flex;
  height: calc(100dvh - var(--palco-margem) * 2);
  min-width: 0;
  flex-direction: column;
  margin: var(--palco-margem) var(--palco-margem) var(--palco-margem) 0;
  overflow: hidden;
  border-radius: var(--raio-painel);
  background: var(--fundo);
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 6%),
    0 24px 60px -24px rgb(0 0 0 / 55%);
}

.app-dark .palco {
  outline: 1px solid rgb(255 255 255 / 6%);
  outline-offset: -1px;
}

.palco__fita {
  position: relative;
  z-index: 30;
  flex: none;
}

/*
 * Gaveta lateral que não é modal (resposta de pedido, detalhe de saque) empurra a tela em vez de
 * cobri-la: `useSidePanelOffset` põe a largura dela em `--pj-side-panel-offset`.
 */
.palco__conteudo {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-inline-end: var(--pj-side-panel-offset, 0px);
  background:
    radial-gradient(1100px 360px at 0% -120px, var(--pj-lugar-brilho), transparent 72%),
    radial-gradient(900px 320px at 78% -180px, var(--pj-lugar-brilho-2), transparent 72%),
    var(--fundo);
  background-attachment: local, local, local;
  background-repeat: no-repeat;
  scrollbar-gutter: stable;
  transition: padding-inline-end 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.palco__conteudo:focus {
  outline: none;
}

/* ---------------------------------------------------------------------- celular e tela estreita */

.topo {
  position: sticky;
  z-index: 35;
  top: 0;
  display: flex;
  height: 56px;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  background: var(--rail);
  color: var(--sobre-rail);
}

.topo__menu {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 22px;
}

.topo__menu:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: -2px;
}

.topo__lugar {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  background: var(--pj-lugar-claro);
  color: var(--rail);
  font-size: 15px;
}

.topo__titulo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell--compacto {
  height: auto;
  min-height: 100dvh;
  grid-template-columns: minmax(0, 1fr);
  overflow: visible;
}

/* No celular a folha ocupa a tela inteira e quem rola é a janela, como em qualquer página. */
.shell--compacto .palco {
  height: auto;
  min-height: calc(100dvh - 56px);
  margin: 0;
  overflow: visible;
  border-radius: 0;
  box-shadow: none;
  outline: none;
}

.shell--compacto .palco__fita {
  position: sticky;
  top: 56px;
}

.shell--compacto .palco__conteudo {
  overflow: visible;
}

.shell--compacto .barra {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(304px, 86vw);
  border-radius: 0 var(--raio-painel) var(--raio-painel) 0;
  box-shadow: var(--sombra-3);
  transform: translateX(-104%);
  transition: transform 320ms var(--pj-curva-chega);
}

.shell--compacto .barra__miolo {
  border-radius: inherit;
}

/* O "fechar" da gaveta, no canto de cima, dentro da barra. */
.barra__fechar {
  position: absolute;
  z-index: 2;
  top: 22px;
  inset-inline-end: 14px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 9%);
  color: var(--sobre-rail);
  cursor: pointer;
  font-size: 17px;
}

.barra__fechar:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

.shell--compacto .barra__topo {
  padding-inline-end: 60px;
}

.shell--gaveta .barra {
  transform: none;
}

.shell__veu {
  position: fixed;
  z-index: 39;
  inset: 0;
  background: rgb(8 18 15 / 45%);
  backdrop-filter: blur(2px);
}

.shell-veu-enter-active,
.shell-veu-leave-active {
  transition: opacity 320ms var(--pj-curva-chega);
}

.shell-veu-enter-from,
.shell-veu-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .shell,
  .shell--compacto .barra,
  .palco__conteudo,
  .barra :deep(.shell-rotulo),
  .shell-veu-enter-active,
  .shell-veu-leave-active {
    transition: none;
  }
}
</style>
