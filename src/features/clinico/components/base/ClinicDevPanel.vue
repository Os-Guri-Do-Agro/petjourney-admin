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
import { computed, ref } from 'vue'
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
    <button
      type="button"
      class="dev__gatilho clinic-focusable"
      :aria-expanded="aberto"
      :title="t('clinico.painel.abrir')"
      @click="aberto = !aberto"
    >
      <i class="pi pi-wrench" aria-hidden="true" />
      <span class="dev__contagem clinic-value">
        {{ resumo.atendimentos }}<template v-if="resumo.atendimentos !== resumo.esperado">
          /{{ resumo.esperado }}</template>
      </span>
    </button>

    <section v-if="aberto" class="dev__painel" :aria-label="t('clinico.painel.titulo')">
      <header class="dev__topo">
        <strong>{{ t('clinico.painel.titulo') }}</strong>
        <button
          type="button"
          class="dev__fechar clinic-focusable"
          :aria-label="t('clinico.atalhos.fechar')"
          @click="aberto = false"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>
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

      <label class="dev__campo">
        <span class="clinic-label">{{ t('clinico.painel.latencia') }}</span>
        <input
          v-model.number="latencia"
          type="range"
          min="0"
          max="3000"
          step="50"
          @change="aplicarLatencia"
        />
        <output class="clinic-value">{{ latencia }}</output>
      </label>

      <label class="dev__linha">
        <input v-model="offline" type="checkbox" @change="aplicarOffline" />
        <span>{{ t('clinico.painel.offline') }}</span>
      </label>

      <fieldset class="dev__grupo">
        <legend class="clinic-label">{{ t('clinico.painel.erro') }}</legend>
        <label v-for="operacao in OPERACOES" :key="operacao" class="dev__campo dev__campo--curto">
          <span class="dev__operacao">{{ operacao }}</span>
          <input
            v-model.number="taxas[operacao]"
            type="range"
            min="0"
            max="1"
            step="0.25"
            @change="aplicarTaxa(operacao)"
          />
          <output class="clinic-value">{{ Math.round((taxas[operacao] ?? 0) * 100) }}%</output>
        </label>
      </fieldset>

      <label class="dev__campo">
        <span class="clinic-label">{{ t('clinico.painel.relogio') }}</span>
        <input
          v-model.number="horasDeslocadas"
          type="range"
          min="-12"
          max="12"
          step="1"
          @change="aplicarRelogio"
        />
        <output class="clinic-value">{{ horasDeslocadas }}h</output>
      </label>

      <div class="dev__campo dev__campo--linha">
        <span class="clinic-label">{{ t('clinico.painel.semente') }}</span>
        <input v-model.number="semente" type="number" class="dev__numero" />
        <button type="button" class="dev__acao clinic-focusable" @click="recriar">
          {{ t('clinico.painel.recriar') }}
        </button>
      </div>

      <label class="dev__linha">
        <input
          type="checkbox"
          :checked="prontuario.simulandoSegundoDispositivo"
          @change="prontuario.alternarSegundoDispositivo()"
        />
        <span>{{ t('clinico.painel.segundoDispositivo') }}</span>
      </label>

      <fieldset class="dev__grupo">
        <legend class="clinic-label">{{ t('clinico.painel.casos') }}</legend>
        <ul class="dev__casos">
          <li v-for="caso in resumo.casos" :key="caso.id">
            <button type="button" class="dev__caso clinic-focusable" @click="irPara(caso.rota)">
              <span>{{ caso.id }}</span>
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </fieldset>

      <button type="button" class="dev__acao dev__acao--largo clinic-focusable" @click="restaurar">
        <i class="pi pi-refresh" aria-hidden="true" />
        {{ t('clinico.tabela.tentarDeNovo') }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.dev {
  position: fixed;
  bottom: var(--clinic-space-4);
  left: var(--clinic-space-4);
  z-index: 70;
}

.dev__gatilho {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem var(--clinic-space-3);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  opacity: 0.8;
}

.dev__gatilho:hover {
  border-color: var(--clinic-accent);
  color: var(--clinic-accent-strong);
  opacity: 1;
}

.dev__painel {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 0;
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

.dev__fechar {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
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

.dev__campo input[type='range'] {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: var(--clinic-accent-deep);
}

.dev__campo--curto {
  grid-template-columns: 1fr auto;
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
  gap: 0.4rem;
  color: var(--clinic-muted);
  cursor: pointer;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.dev__grupo {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
}

.dev__numero {
  width: 100%;
  min-height: var(--clinic-hit-target);
  padding: 0 var(--clinic-space-2);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-text);
  font: inherit;
}

.dev__acao {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.dev__acao--largo {
  width: 100%;
}

.dev__casos {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dev__caso {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  padding: 0.25rem var(--clinic-space-2);
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  text-align: left;
}

.dev__caso:hover {
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.dev__caso i {
  font-size: 0.6rem;
  opacity: 0.6;
}
</style>
