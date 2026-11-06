<script setup lang="ts">
/**
 * A semana (E3-02, guia e3 2.4): segunda a domingo, com a carga que o servidor calcula (agendados,
 * ocupação, faltas e encaixes) e os primeiros horários de cada dia. A barra usa as faixas da
 * demonstração (`load.ts`: vazio, tranquilo, cheio, excedido). Escolher um dia abre ele.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { STATUS_RISCADOS } from '@/components/agendamentos/leitura-da-agenda'
import { comMaiuscula } from '@/components/pedidos/leitura-do-pedido'
import { faixaDeOcupacao } from '@/features/clinico/domain/load'
import type { AgendaDaSemana, Agendamento } from '@/service/parceiro/agenda-service'

const props = defineProps<{ semana: AgendaDaSemana; hoje: string; ocultarRiscados: boolean }>()
const emit = defineEmits<{ escolher: [data: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()

const POR_DIA = 6

function diaDaSemana(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  const nome = new Intl.DateTimeFormat(rotulos.intl(), { weekday: 'long', timeZone: 'UTC' }).format(
    Date.UTC(ano!, mes! - 1, dia!),
  )
  return comMaiuscula(nome, rotulos.intl())
}

function diaCurto(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Intl.DateTimeFormat(rotulos.intl(), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.UTC(ano!, mes! - 1, dia!))
}

/* O grupo de duas salas conta uma vez: a perna principal (id igual ao grupoId). */
function principal(agendamento: Agendamento) {
  return !agendamento.grupoId || agendamento.grupoId === agendamento.id
}

const dias = computed(() =>
  props.semana.dias.map((dia) => {
    const doDia = props.semana.agendamentos
      .filter((item) => item.inicio.slice(0, 10) === dia.data && principal(item))
      .filter((item) => !(props.ocultarRiscados && STATUS_RISCADOS.includes(item.status)))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
    return {
      dia,
      faixa: faixaDeOcupacao(dia.ocupacao),
      largura: `${Math.min(100, Math.round(dia.ocupacao * 100))}%`,
      lista: doDia.slice(0, POR_DIA),
      resto: Math.max(0, doDia.length - POR_DIA),
    }
  }),
)
</script>

<template>
  <ol class="sem">
    <li v-for="item in dias" :key="item.dia.data">
      <button
        type="button"
        class="sem__dia"
        :class="{
          'sem__dia--hoje': item.dia.data === hoje,
          'sem__dia--fechado': item.dia.clinicaFechada,
        }"
        :aria-label="`${diaDaSemana(item.dia.data)}, ${diaCurto(item.dia.data)}`"
        @click="emit('escolher', item.dia.data)"
      >
        <span class="sem__topo">
          <strong>{{ diaDaSemana(item.dia.data) }}</strong>
          <span class="ui-num">{{ diaCurto(item.dia.data) }}</span>
        </span>

        <template v-if="item.dia.clinicaFechada">
          <span class="sem__fechado">
            <i class="ph ph-door" aria-hidden="true" />
            {{ item.dia.feriado || t('agendamentos.semana.fechado') }}
          </span>
        </template>
        <template v-else>
          <span class="sem__numeros ui-num">
            {{ t('agendamentos.semana.agendados', { n: item.dia.agendados }, item.dia.agendados) }}
          </span>
          <span
            class="sem__barra"
            role="img"
            :aria-label="t(`agendamentos.semana.faixa.${item.faixa}`)"
            :title="t(`agendamentos.semana.faixa.${item.faixa}`)"
          >
            <span
              :class="`sem__ocupado sem__ocupado--${item.faixa}`"
              :style="{ width: item.largura }"
            />
          </span>
          <span v-if="item.dia.feriado" class="sem__nota">{{ item.dia.feriado }}</span>
          <span v-if="item.dia.faltas || item.dia.encaixes" class="sem__nota ui-num">
            <template v-if="item.dia.faltas">
              {{ t('agendamentos.semana.faltas', { n: item.dia.faltas }, item.dia.faltas) }}
            </template>
            <template v-if="item.dia.faltas && item.dia.encaixes"> · </template>
            <template v-if="item.dia.encaixes">
              {{ t('agendamentos.semana.encaixes', { n: item.dia.encaixes }, item.dia.encaixes) }}
            </template>
          </span>

          <ul v-if="item.lista.length" class="sem__lista">
            <li
              v-for="agendamento in item.lista"
              :key="agendamento.id"
              :class="{ sem__riscado: STATUS_RISCADOS.includes(agendamento.status) }"
            >
              <span class="ui-num">{{ agendamento.inicio.slice(11, 16) }}</span>
              <bdi>{{ agendamento.paciente.nome }}</bdi>
            </li>
            <li v-if="item.resto" class="sem__resto">
              {{ t('agendamentos.semana.eMais', { n: item.resto }) }}
            </li>
          </ul>
        </template>
      </button>
    </li>
  </ol>
</template>

<style scoped>
.sem {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  list-style: none;
}

@media (max-width: 1100px) {
  .sem {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.sem > li {
  display: grid;
}

.sem__dia {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 12rem;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: var(--app-cartao, var(--superficie));
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: border-color 150ms ease-out;
}

.sem__dia:hover {
  border-color: var(--app-regua, var(--linha));
}

.sem__dia:focus-visible {
  outline: 2px solid var(--tinta);
  outline-offset: 2px;
}

.sem__dia--hoje {
  border-color: var(--tinta-2);
}

.sem__dia--fechado {
  background: transparent;
}

.sem__topo {
  display: grid;
  gap: 1px;
}

.sem__topo strong {
  font-size: 14px;
  font-weight: 650;
}

.sem__topo span,
.sem__nota,
.sem__numeros {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.sem__fechado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.sem__barra {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tinta-3) 18%, transparent);
}

.sem__ocupado {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.sem__ocupado--tranquilo {
  background: var(--ok-tinta);
}

.sem__ocupado--cheio {
  background: var(--atencao-tinta);
}

.sem__ocupado--excedido {
  background: var(--risco-tinta);
}

.sem__lista {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  font-size: 12.5px;
  list-style: none;
}

.sem__lista li {
  display: flex;
  min-width: 0;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
}

.sem__lista li span {
  color: var(--tinta-2);
}

.sem__riscado bdi {
  color: var(--tinta-2);
  text-decoration: line-through;
}

.sem__resto {
  color: var(--tinta-2);
}

@media (prefers-reduced-motion: reduce) {
  .sem__dia {
    transition: none;
  }
}
</style>
