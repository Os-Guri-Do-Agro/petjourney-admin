<script setup lang="ts">
/**
 * Painel de desenvolvimento do módulo hotel.
 *
 * O módulo roda inteiro sem API, e este painel é o que torna isso demonstrável: sobe latência,
 * força erro por operação, derruba tudo, recria os dados com outra semente e **pula direto para
 * cada caso plantado**. Sem ele, alcançar "a carteira que vence no meio da estadia" vira caça ao
 * tesouro — e um caso que o apresentador não acha é um caso que não existe.
 *
 * A régua, herdada do módulo clínico: todo caso plantado precisa estar a até três cliques daqui.
 *
 * ## Por que ele não é só de `DEV`
 *
 * O módulo clínico aprendeu isso da pior forma. Preso a `import.meta.env.DEV`, o painel sumia
 * justamente no build publicado — que é onde a demonstração ao cliente acontece —, e os casos
 * plantados voltavam a exigir navegação à mão.
 *
 * Aqui ele segue o **desbloqueio do módulo**, que já é um interruptor oculto: exige `?hotel=on` ou
 * digitar a sequência. Quem chegou até aqui chegou de propósito, e tudo o que o painel controla é
 * a camada mocada, que não existe para quem abriu o portal para trabalhar.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { getMockConfig, setMockConfig } from '@/features/clinico/data/mock-runtime'
import { useModuloHotel } from '@/composables/useModuloHotel'

import { definirFalha, limparFalhas, type HotelOperation } from '../../data/mock-runtime'
import { getDataset, getSemente, resetDataset } from '../../data/store'
import { useHospedagemStore } from '../../stores/hospedagem'
import { useHotelStore } from '../../stores/hotel'
import { useReservasStore } from '../../stores/reservas'

const { ativo: moduloAtivo } = useModuloHotel()

const habilitado = computed(() => import.meta.env.DEV || moduloAtivo.value)

const { t } = useI18n()
const router = useRouter()
const hotelStore = useHotelStore()
const reservas = useReservasStore()
const hospedagem = useHospedagemStore()

const idCampo = useId()
const aberto = ref(false)
const latencia = ref(getMockConfig().latenciaMs)
const offline = ref(getMockConfig().offline)
const semente = ref(getSemente())

/**
 * As operações oferecidas são as que **alguém precisa ver falhar**.
 *
 * Marcar uma refeição é a mais importante da lista: é a que acontece no celular, no fundo do
 * canil, com o wi-fi ruim — e a única em que o erro precisa aparecer sem derrubar a prancheta.
 */
const OPERACOES: HotelOperation[] = [
  'rotina.marcar',
  'mapa.periodo',
  'reserva.criar',
  'checkin.executar',
  'hospedagem.checkout',
]

const taxas = ref<Record<string, number>>(
  Object.fromEntries(OPERACOES.map((operacao) => [operacao, 0])),
)

const casos = computed(() => getDataset().casos)

function aplicarLatencia() {
  setMockConfig({ latenciaMs: latencia.value })
}

function aplicarOffline() {
  setMockConfig({ offline: offline.value })
}

function aplicarTaxa(operacao: HotelOperation) {
  definirFalha(operacao, taxas.value[operacao] ?? 0)
}

async function recriar() {
  resetDataset(semente.value)
  limparFalhas()
  taxas.value = Object.fromEntries(OPERACOES.map((operacao) => [operacao, 0]))
  hotelStore.$resetModulo()

  /*
   * Recarrega o que estiver montado. Sem isto, recriar o dataset deixaria a tela mostrando os
   * hóspedes de antes — e quem apertou o botão concluiria que ele não funciona.
   */
  await hotelStore.carregar(true)
  await reservas.carregarMapa()
  await hospedagem.carregarHospedes()
}

async function irPara(rota: string) {
  aberto.value = false
  await router.push(rota)
}
</script>

<template>
  <div v-if="habilitado" class="dev">
    <Button
      type="button"
      class="dev__gatilho"
      icon="pi pi-wrench"
      :label="t('hotel.dev.titulo')"
      severity="secondary"
      outlined
      size="small"
      :aria-expanded="aberto"
      @click="aberto = !aberto"
    />

    <section v-if="aberto" class="dev__painel">
      <header class="dev__cabecalho">
        <strong>{{ t('hotel.dev.titulo') }}</strong>
        <Button
          type="button"
          icon="pi pi-times"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('hotel.dev.fechar')"
          @click="aberto = false"
        />
      </header>

      <!--
        Os casos vêm primeiro. É para eles que o painel existe; a latência e o modo offline são
        ferramentas de quem constrói, e os casos são de quem apresenta.
      -->
      <div class="dev__bloco">
        <h3 class="dev__titulo">{{ t('hotel.dev.casos') }}</h3>

        <ul class="dev__casos">
          <li v-for="caso in casos" :key="caso.id">
            <button type="button" class="dev__caso" @click="irPara(caso.rota)">
              <strong>{{ caso.titulo }}</strong>
              <span>{{ caso.descricao }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="dev__bloco">
        <h3 class="dev__titulo">{{ t('hotel.dev.rede') }}</h3>

        <label class="dev__campo" :for="`${idCampo}-latencia`">
          {{ t('hotel.dev.latencia', { valor: latencia }) }}
        </label>
        <Slider
          :id="`${idCampo}-latencia`"
          v-model="latencia"
          :min="0"
          :max="2000"
          :step="20"
          @change="aplicarLatencia"
        />

        <div class="dev__linha">
          <label :for="`${idCampo}-offline`">{{ t('hotel.dev.offline') }}</label>
          <ToggleSwitch
            :input-id="`${idCampo}-offline`"
            v-model="offline"
            @update:model-value="aplicarOffline"
          />
        </div>

        <div v-for="operacao in OPERACOES" :key="operacao" class="dev__linha">
          <label :for="`${idCampo}-${operacao}`">{{ operacao }}</label>
          <InputNumber
            :input-id="`${idCampo}-${operacao}`"
            v-model="taxas[operacao]"
            :min="0"
            :max="1"
            :step="0.25"
            :max-fraction-digits="2"
            show-buttons
            size="small"
            @update:model-value="aplicarTaxa(operacao)"
          />
        </div>
      </div>

      <div class="dev__bloco">
        <h3 class="dev__titulo">{{ t('hotel.dev.dados') }}</h3>

        <div class="dev__linha">
          <label :for="`${idCampo}-semente`">{{ t('hotel.dev.semente') }}</label>
          <InputNumber :input-id="`${idCampo}-semente`" v-model="semente" size="small" />
        </div>

        <Button
          type="button"
          :label="t('hotel.dev.recriar')"
          icon="pi pi-refresh"
          severity="secondary"
          size="small"
          @click="recriar"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.dev {
  position: fixed;
  z-index: 60;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
}

.dev__gatilho.p-button {
  background: var(--clinic-surface);
}

.dev__painel {
  position: absolute;
  display: grid;
  width: min(24rem, calc(100vw - 2rem));
  max-height: min(34rem, calc(100vh - 6rem));
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-4);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-float);
  inset-block-end: 2.8rem;
  inset-inline-end: 0;
  overflow-y: auto;
}

.dev__cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dev__bloco {
  display: grid;
  gap: var(--clinic-space-2);
}

.dev__titulo {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dev__casos {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.dev__caso {
  display: grid;
  width: 100%;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: 0.15rem;
  background: var(--clinic-surface-soft);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.dev__caso:hover,
.dev__caso:focus-visible {
  border-color: var(--clinic-accent-soft);
  background: var(--clinic-accent-tint);
}

.dev__caso strong {
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.dev__caso span {
  color: var(--clinic-faint);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dev__campo,
.dev__linha label {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.dev__linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}
</style>
