<script setup lang="ts">
/**
 * Painel de desenvolvimento do módulo clínico.
 *
 * O módulo roda inteiro sem API, e este painel é o que torna isso revisável: sobe latência,
 * força erro por operação, derruba tudo, desloca o relógio, recria os dados com outra semente
 * e **pula direto para cada um dos 15 casos difíceis**. Sem ele, alcançar "cirurgia em duas
 * salas que atravessa o almoço num dia de feriado" vira caça ao tesouro.
 *
 * A régua do épico: todo caso difícil precisa estar a até três cliques daqui.
 *
 * ## Por que ele não é mais só de `DEV`
 *
 * Era `import.meta.env.DEV` e só. Num build publicado — que é justamente onde a demonstração ao
 * cliente acontece — o painel sumia, e alcançar cada caso plantado voltava a exigir navegar até
 * ele à mão. O buraco estava listado no roteiro de demonstração como buraco **de produto**: os
 * quinze casos existiam e ninguém conseguia mostrá-los.
 *
 * Agora ele também aparece quando o **módulo clínico está desbloqueado para esta conta**. Não é
 * afrouxamento: esse desbloqueio já é um interruptor oculto, que exige `?clinico=on` ou digitar
 * a sequência secreta, e tudo o que está atrás dele é dado de demonstração. Quem chegou até aqui
 * chegou de propósito — e o que o painel controla é a camada mocada, que não existe para quem
 * abriu o portal para trabalhar.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onUnmounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useModuloClinico } from '@/composables/useModuloClinico'

import {
  getMockConfig,
  resetMockConfig,
  setMockConfig,
  type MockOperation,
} from '../../data/mock-runtime'
import { ATENDIMENTOS_NO_DIA_ANCORA, contarNoDia } from '../../data/seed'
import { getDataset, getSemente, resetDataset } from '../../data/store'
import { setClockSkew } from '../../domain/clinic-time'
import { useAgendaStore } from '../../stores/agenda'
import { useClinicoStore } from '../../stores/clinico'
import { useProntuarioStore } from '../../stores/prontuario'

const { ativo: moduloClinicoAtivo } = useModuloClinico()

const habilitado = computed(() => import.meta.env.DEV || moduloClinicoAtivo.value)

const { t } = useI18n()
const router = useRouter()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()

const idCampo = useId()
const aberto = ref(false)
const latencia = ref(getMockConfig().latenciaMs)
const offline = ref(getMockConfig().offline)
const horasDeslocadas = ref(0)
const semente = ref(getSemente())

const OPERACOES: MockOperation[] = [
  'agenda.dia',
  'agenda.mover',
  'agenda.status',
  'encounter.salvar',
  'fila.listar',
  'migracao.importar',
]

const taxas = ref<Record<string, number>>(
  Object.fromEntries(OPERACOES.map((operacao) => [operacao, 0])),
)

const resumo = computed(() => {
  const dataset = getDataset()

  return {
    ancora: dataset.ancora,
    atendimentos: contarNoDia(dataset, dataset.ancora),
    esperado: ATENDIMENTOS_NO_DIA_ANCORA,
    casos: dataset.casos,
  }
})

function aplicarLatencia() {
  setMockConfig({ latenciaMs: latencia.value })
}

function aplicarOffline() {
  setMockConfig({ offline: offline.value })
}

function aplicarTaxa(operacao: MockOperation) {
  setMockConfig({ erroPorOperacao: { [operacao]: taxas.value[operacao] ?? 0 } })
}

async function aplicarRelogio() {
  setClockSkew(horasDeslocadas.value * 3_600_000)
  await recarregarTudo()
}

/**
 * O `Slider` avisa a cada passo do arraste, e deslocar o relógio recarrega o módulo inteiro.
 * Espera o puxador parar antes de aplicar — o `change` do range nativo só vinha ao soltar.
 */
let esperaDoRelogio: ReturnType<typeof setTimeout> | undefined

function agendarRelogio() {
  clearTimeout(esperaDoRelogio)
  esperaDoRelogio = setTimeout(() => void aplicarRelogio(), 250)
}

onUnmounted(() => clearTimeout(esperaDoRelogio))

async function recriar() {
  resetDataset(semente.value)
  clinico.$resetModulo()
  await recarregarTudo()
}

async function recarregarTudo() {
  clinico.invalidarTudo()
  await clinico.carregar(true)
  await agenda.recarregar()
}

function restaurar() {
  resetMockConfig()
  latencia.value = getMockConfig().latenciaMs
  offline.value = false
  horasDeslocadas.value = 0
  clearTimeout(esperaDoRelogio)
  setClockSkew(0)

  for (const operacao of OPERACOES) {
    taxas.value[operacao] = 0
  }
}

function irPara(rota: string) {
  aberto.value = false
  void router.push(rota)
}
</script>

<template>
  <div v-if="habilitado" class="dev clinic-scope">
    <Button
      type="button"
      class="dev__gatilho"
      severity="secondary"
      outlined
      rounded
      size="small"
      :aria-expanded="aberto"
      :title="t('clinico.painel.abrir')"
      @click="aberto = !aberto"
    >
      <i class="pi pi-wrench" aria-hidden="true" />
      <span class="dev__contagem clinic-value">
        {{ resumo.atendimentos }}<template v-if="resumo.atendimentos !== resumo.esperado">
          /{{ resumo.esperado }}</template>
      </span>
    </Button>

    <section v-if="aberto" class="dev__painel" :aria-label="t('clinico.painel.titulo')">
      <header class="dev__topo">
        <strong>{{ t('clinico.painel.titulo') }}</strong>
        <Button
          type="button"
          icon="pi pi-times"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('clinico.atalhos.fechar')"
          @click="aberto = false"
        />
      </header>

      <p class="dev__descricao">{{ t('clinico.painel.descricao') }}</p>

      <p class="dev__resumo clinic-value">
        {{
          t('clinico.painel.resumo', {
            atendimentos: resumo.atendimentos,
            ancora: resumo.ancora,
          })
        }}
      </p>

      <div class="dev__campo">
        <span :id="`${idCampo}-latencia`" class="clinic-label">
          {{ t('clinico.painel.latencia') }}
        </span>
        <output class="clinic-value">{{ latencia }}</output>
        <Slider
          v-model="latencia"
          class="dev__trilho"
          :min="0"
          :max="3000"
          :step="50"
          :aria-labelledby="`${idCampo}-latencia`"
          @change="aplicarLatencia"
        />
      </div>

      <div class="dev__linha">
        <ToggleSwitch
          v-model="offline"
          :input-id="`${idCampo}-offline`"
          @update:model-value="aplicarOffline"
        />
        <label :for="`${idCampo}-offline`">{{ t('clinico.painel.offline') }}</label>
      </div>

      <fieldset class="dev__grupo">
        <legend class="clinic-label">{{ t('clinico.painel.erro') }}</legend>
        <div v-for="operacao in OPERACOES" :key="operacao" class="dev__campo">
          <span :id="`${idCampo}-${operacao}`" class="dev__operacao">{{ operacao }}</span>
          <output class="clinic-value">{{ Math.round((taxas[operacao] ?? 0) * 100) }}%</output>
          <Slider
            v-model="taxas[operacao]"
            class="dev__trilho"
            :min="0"
            :max="1"
            :step="0.25"
            :aria-labelledby="`${idCampo}-${operacao}`"
            @change="aplicarTaxa(operacao)"
          />
        </div>
      </fieldset>

      <div class="dev__campo">
        <span :id="`${idCampo}-relogio`" class="clinic-label">
          {{ t('clinico.painel.relogio') }}
        </span>
        <output class="clinic-value">{{ horasDeslocadas }}h</output>
        <Slider
          v-model="horasDeslocadas"
          class="dev__trilho"
          :min="-12"
          :max="12"
          :step="1"
          :aria-labelledby="`${idCampo}-relogio`"
          @change="agendarRelogio"
        />
      </div>

      <div class="dev__campo dev__campo--linha">
        <label :for="`${idCampo}-semente`" class="clinic-label">
          {{ t('clinico.painel.semente') }}
        </label>
        <InputNumber
          v-model="semente"
          :input-id="`${idCampo}-semente`"
          :use-grouping="false"
          size="small"
          fluid
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          size="small"
          :label="t('clinico.painel.recriar')"
          @click="recriar"
        />
      </div>

      <div class="dev__linha">
        <ToggleSwitch
          :input-id="`${idCampo}-segundo`"
          :model-value="prontuario.simulandoSegundoDispositivo"
          @update:model-value="prontuario.alternarSegundoDispositivo()"
        />
        <label :for="`${idCampo}-segundo`">{{ t('clinico.painel.segundoDispositivo') }}</label>
      </div>

      <fieldset class="dev__grupo">
        <legend class="clinic-label">{{ t('clinico.painel.casos') }}</legend>
        <ul class="dev__casos">
          <li v-for="caso in resumo.casos" :key="caso.id">
            <Button
              type="button"
              class="dev__caso"
              severity="secondary"
              text
              size="small"
              fluid
              :label="caso.id"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="irPara(caso.rota)"
            />
          </li>
        </ul>
      </fieldset>

      <Button
        type="button"
        severity="secondary"
        outlined
        size="small"
        fluid
        icon="pi pi-refresh"
        :label="t('clinico.tabela.tentarDeNovo')"
        @click="restaurar"
      />
    </section>
  </div>
</template>

<style scoped>
.dev {
  position: fixed;
  bottom: var(--clinic-space-4);
  inset-inline-start: var(--clinic-space-4);
  z-index: 70;
}

/* Tracejado de propósito: é ferramenta de bastidor, e não pode passar por ação do produto. */
.dev__gatilho.p-button {
  gap: 0.35rem;
  border-style: dashed;
  background: var(--clinic-surface);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  opacity: 0.8;
}

.dev__gatilho.p-button:hover {
  opacity: 1;
}

.dev__painel {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  inset-inline-start: 0;
  display: grid;
  gap: var(--clinic-space-3);
  width: min(22rem, 90vw);
  max-height: min(80vh, 40rem);
  overflow-y: auto;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-float);
}

.dev__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dev__descricao {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.dev__resumo {
  margin: 0;
  padding: var(--clinic-space-2);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.dev__campo {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.3rem;
}

/* O trilho ocupa a linha inteira embaixo do rótulo e do valor; a margem é a folga do puxador. */
.dev__trilho.p-slider {
  grid-column: 1 / -1;
  margin: 0.45rem 0.5rem;
}

.dev__campo--linha {
  grid-template-columns: auto 1fr auto;
}

.dev__operacao {
  color: var(--clinic-muted);
  font-family: ui-monospace, monospace;
  font-size: 0.65rem;
}

.dev__linha {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.dev__linha label {
  cursor: pointer;
}

.dev__grupo {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
}

.dev__casos {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dev__caso.p-button {
  justify-content: space-between;
  text-align: start;
}
</style>
