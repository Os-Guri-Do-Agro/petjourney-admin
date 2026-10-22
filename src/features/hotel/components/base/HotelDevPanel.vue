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
    <!-- Tracejado e no canto: é ferramenta de bastidor, e não pode passar por ação do produto. -->
    <Button
      type="button"
      class="dev__gatilho"
      icon="ph ph-wrench"
      :label="t('hotel.dev.titulo')"
      severity="secondary"
      outlined
      rounded
      size="small"
      :aria-expanded="aberto"
      @click="aberto = !aberto"
    />

    <section v-if="aberto" class="dev__painel" :aria-label="t('hotel.dev.titulo')">
      <header class="dev__cabecalho">
        <strong>{{ t('hotel.dev.titulo') }}</strong>
        <Button
          type="button"
          icon="ph ph-x"
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
          icon="ph ph-arrow-clockwise"
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
  inset-block-end: 16px;
  inset-inline-end: 16px;
}

.dev__gatilho.p-button {
  min-height: 36px;
  border-style: dashed;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
  opacity: 0.85;
}

.dev__gatilho.p-button:hover {
  color: var(--tinta);
  opacity: 1;
}

.dev__painel {
  position: absolute;
  display: grid;
  width: min(380px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 96px));
  gap: 18px;
  padding: 16px 18px 18px;
  grid-template-columns: minmax(0, 1fr);
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
  color: var(--tinta);
  inset-block-end: calc(100% + 8px);
  inset-inline-end: 0;
  overflow-y: auto;
}

.dev__cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
}

.dev__cabecalho strong {
  font-weight: 600;
}

/* `minmax(0, 1fr)`: o campo numérico com botões tem largura mínima maior que a folha estreita. */
.dev__bloco {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr);
}

.dev__titulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.dev__casos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dev__caso {
  display: grid;
  width: 100%;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 10px;
  background: var(--superficie);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: background-color var(--pj-tempo-curto) ease;
}

.dev__caso:hover {
  background: var(--superficie-2);
}

.dev__caso:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--hotel));
  outline-offset: 1px;
}

.dev__caso strong {
  font-size: 13.5px;
  font-weight: 600;
}

.dev__caso span {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.dev__campo,
.dev__linha label {
  color: var(--tinta-2);
  font-size: 13px;
}

.dev__linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dev__linha :deep(.p-inputnumber-input) {
  width: 5.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .dev__caso {
    transition: none;
  }
}
</style>
