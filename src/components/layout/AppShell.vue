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
const { espacos, aqui, lugar, navigationSections, hasClinicalProfile, hasHotelProfile } =
  oferecerEspacos()
const { open: abrirResgate, canOpen: podeResgatar } = useCupomResgateModal()
const { visible: cupomEmBreveVisivel, open: abrirCupomEmBreve } = useCupomComingSoon()
const cupomLigado = CUPOM_FEATURE_ENABLED

const recolhida = ref(lerRecolhida())
const compacto = ref(casaCompacto())
const gavetaAberta = ref(false)
const buscaAberta = ref(false)
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
  if (compacto.value) {
    gavetaAberta.value = !gavetaAberta.value
    return
  }

  recolhida.value = !recolhida.value
  window.localStorage.setItem(CHAVE_RECOLHIDA, String(recolhida.value))
}

function fecharGaveta() {
  gavetaAberta.value = false
}

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
    if (!hasClinicalProfile.value) {
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
    hasClinicalProfile.value &&
    lugar.value === 'clinica' &&
    !route.path.startsWith('/veterinario/agenda'),
)

/** No Hotel, a fita da casa; menos na Rotina, que já é a prancheta do dia hora a hora. */
const mostrarFitaDaCasa = computed(
  () =>
    hasHotelProfile.value && lugar.value === 'hotel' && route.path !== '/hotel/rotina',
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

    <div
      v-if="compacto && gavetaAberta"
      class="shell__veu"
      aria-hidden="true"
      @click="fecharGaveta"
    />

    <aside
      id="barra-do-portal"
      class="barra"
      :aria-hidden="compacto && !gavetaAberta ? 'true' : undefined"
      :inert="compacto && !gavetaAberta ? true : undefined"
    >
      <div class="barra__topo">
        <RouterLink class="barra__marca" to="/inicio" :title="parceiroStore.parceiroNome">
          <span class="barra__pata" aria-hidden="true">
            <img src="/pata-escura.png" alt="" />
          </span>
          <span v-if="!barraRecolhida" class="barra__empresa">
            <strong>{{ parceiroStore.parceiroNome }}</strong>
            <small>PetJourney</small>
          </span>
        </RouterLink>

        <button
          type="button"
          class="barra__recolher"
          :aria-label="
            compacto
              ? t('shell.drawer.close')
              : barraRecolhida
                ? t('shell.drawer.expand')
                : t('shell.drawer.collapse')
          "
          :title="barraRecolhida ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
          @click="alternarBarra"
        >
          <i
            :class="compacto ? 'ph ph-x' : barraRecolhida ? 'ph ph-caret-double-right' : 'ph ph-caret-double-left'"
            aria-hidden="true"
          />
        </button>
      </div>

      <div class="barra__ferramentas">
        <button
          v-if="hasClinicalProfile"
          type="button"
          class="barra__busca"
          :title="t('clinico.busca.abrir')"
          :aria-label="t('clinico.busca.abrir')"
          @click="buscaAberta = true"
        >
          <i class="ph ph-magnifying-glass" aria-hidden="true" />
          <span v-if="!barraRecolhida" class="barra__busca-texto">{{ t('clinico.busca.abrirCurto') }}</span>
          <kbd v-if="!barraRecolhida">{{ atalhoDaBusca }}</kbd>
        </button>
        <ShellCriar :recolhida="barraRecolhida" :clinica="hasClinicalProfile" />
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
        <button
          type="button"
          class="barra__cupom"
          :disabled="cupomLigado && !podeResgatar"
          :title="!cupomLigado ? t('comingSoon.cupom.navHint') : t('shell.cupom.cta')"
          @click="clicarCupom"
        >
          <i class="ph ph-ticket" aria-hidden="true" />
          <span v-if="!barraRecolhida" class="barra__cupom-texto">{{ t('shell.cupom.cta') }}</span>
          <span v-if="!cupomLigado && !barraRecolhida" class="barra__breve">
            {{ t('comingSoon.cupom.badge') }}
          </span>
        </button>
        <ShellConta :recolhida="barraRecolhida" />
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
          v-if="hasClinicalProfile"
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

      <main id="conteudo" class="palco__conteudo" tabindex="-1">
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
      v-if="hasClinicalProfile"
      :aberto="buscaAberta"
      :secoes="navigationSections"
      @fechar="buscaAberta = false"
    />
  </div>
</template>

<style scoped>
.shell {
  --barra-largura: 264px;

  display: grid;
  grid-template-columns: var(--barra-largura) minmax(0, 1fr);
  min-height: 100dvh;
  background: var(--fundo);
  color: var(--tinta);
  font-family: var(--font-texto);
}

.shell--recolhida {
  --barra-largura: 76px;
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

/* ------------------------------------------------------------------------------------- barra */

.barra {
  position: sticky;
  z-index: 40;
  top: 0;
  display: flex;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: var(--rail);
  color: var(--sobre-rail);
}

.barra__topo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 12px 14px 16px;
}

.barra__marca {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
}

.barra__marca:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 3px;
}

.barra__pata {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--sobre-rail);
}

.barra__pata img {
  width: 24px;
  height: 24px;
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
  white-space: nowrap;
}

.barra__empresa small {
  color: var(--sobre-rail-2);
  font-size: 12px;
}

.barra__recolher {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sobre-rail-2);
  cursor: pointer;
  font-size: 15px;
}

.barra__recolher:hover {
  background: rgb(255 255 255 / 8%);
  color: var(--sobre-rail);
}

.barra__recolher:focus-visible,
.barra__busca:focus-visible,
.barra__cupom:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

.barra__ferramentas {
  display: flex;
  gap: 8px;
  padding: 0 12px 16px;
}

.barra__busca {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 40px;
  align-items: center;
  gap: 10px;
  padding: 0 10px 0 12px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 10px;
  background: rgb(255 255 255 / 5%);
  color: var(--sobre-rail-2);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  text-align: left;
}

.barra__busca:hover {
  border-color: rgb(255 255 255 / 22%);
  color: var(--sobre-rail);
}

.barra__busca i {
  font-size: 17px;
}

.barra__busca-texto {
  flex: 1;
}

.barra__busca kbd {
  padding: 2px 6px;
  border-radius: 5px;
  background: rgb(255 255 255 / 10%);
  font-family: var(--font-dados);
  font-size: 11px;
}

.barra__mapa {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(255 255 255 / 18%) transparent;
  scrollbar-width: thin;
}

.barra__pe {
  display: grid;
  gap: 4px;
  padding: 10px 12px 14px;
  border-top: 1px solid rgb(255 255 255 / 8%);
}

.barra__cupom {
  display: flex;
  height: 40px;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--sobre-rail-2);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
}

.barra__cupom i {
  width: 28px;
  font-size: 18px;
  text-align: center;
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

/* Recolhida: tudo vira coluna de ícones centrada. */
.shell--recolhida .barra__topo {
  flex-direction: column;
  padding: 18px 0 12px;
}

.shell--recolhida .barra__marca {
  flex: none;
}

.shell--recolhida .barra__ferramentas {
  flex-direction: column;
  align-items: center;
  padding-inline: 0;
}

.shell--recolhida .barra__busca {
  width: 40px;
  flex: none;
  justify-content: center;
  padding: 0;
}

.shell--recolhida .barra__cupom {
  justify-content: center;
  padding: 0;
}

/* -------------------------------------------------------------------------------------- palco */

.palco {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.palco__fita {
  position: sticky;
  z-index: 30;
  top: 0;
}

/*
 * Gaveta lateral que não é modal (resposta de pedido, detalhe de saque) empurra a tela em vez de
 * cobri-la: `useSidePanelOffset` põe a largura dela em `--pj-side-panel-offset`.
 */
.palco__conteudo {
  flex: 1;
  min-width: 0;
  padding-inline-end: var(--pj-side-panel-offset, 0px);
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
  grid-template-columns: minmax(0, 1fr);
}

.shell--compacto .barra {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(304px, 86vw);
  box-shadow: var(--sombra-3);
  transform: translateX(-104%);
  transition: transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.shell--gaveta .barra {
  transform: none;
}

.shell--compacto .palco__fita {
  top: 56px;
}

.shell__veu {
  position: fixed;
  z-index: 39;
  inset: 0;
  background: rgb(8 18 15 / 45%);
}

@media (prefers-reduced-motion: reduce) {
  .shell--compacto .barra,
  .palco__conteudo {
    transition: none;
  }
}
</style>
