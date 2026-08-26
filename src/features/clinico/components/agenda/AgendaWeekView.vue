<script setup lang="ts">
/**
 * Visão de semana: carga por dia.
 *
 * A ocupação aparece **como número, além da barra**. Barra sozinha some em escala de cinza e
 * não responde à pergunta que a semana existe para responder — "onde ainda cabe alguém?".
 *
 * Clicar num dia leva para a grade daquele dia; é a rota mais curta entre "a quinta está
 * vazia" e "marquei na quinta".
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { faixaDeOcupacao } from '../../domain/load'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock } from '../../stores/clinico'

const emit = defineEmits<{ escolherDia: [data: string] }>()

const { t } = useI18n()
const agenda = useAgendaStore()
const formato = useClinicFormat()

const dias = computed(() =>
  agenda.semanaDias.map((dia) => ({
    ...dia,
    faixa: faixaDeOcupacao(dia.ocupacao),
    ehHoje: dia.data === clinicClock.today(),
    fechado: dia.capacidadeMinutos === 0,
  })),
)
</script>

<template>
  <div class="semana">
    <article
      v-for="dia in dias"
      :key="dia.data"
      class="dia"
      :class="[`dia--${dia.faixa}`, { 'dia--hoje': dia.ehHoje, 'dia--fechado': dia.fechado }]"
    >
      <button
        type="button"
        class="dia__botao clinic-focusable"
        @click="emit('escolherDia', dia.data)"
      >
        <header class="dia__topo">
          <span class="dia__semana">{{ formato.diaDaSemanaCurto(dia.data) }}</span>
          <span class="dia__data clinic-value">{{ formato.dataCurta(dia.data) }}</span>
        </header>

        <p v-if="dia.fechado" class="dia__fechado">{{ t('clinico.agenda.fechadaTitulo') }}</p>

        <template v-else>
          <p class="dia__ocupacao">
            <strong class="clinic-value">{{ formato.percentual(dia.ocupacao) }}</strong>
            <span>{{ t('clinico.agenda.semana.carga') }}</span>
          </p>

          <span class="dia__barra" aria-hidden="true">
            <span
              class="dia__preenchimento"
              :style="{ width: `${Math.min(dia.ocupacao, 1) * 100}%` }"
            />
          </span>

          <ul class="dia__numeros">
            <li>{{ t('clinico.agenda.semana.agendados', { contagem: dia.agendados }, dia.agendados) }}</li>
            <li v-if="dia.encaixes > 0">
              {{ t('clinico.agenda.semana.encaixes', { contagem: dia.encaixes }, dia.encaixes) }}
            </li>
            <li v-if="dia.faltas > 0" class="dia__faltas">
              {{ t('clinico.agenda.semana.faltas', { contagem: dia.faltas }, dia.faltas) }}
            </li>
          </ul>
        </template>
      </button>
    </article>
  </div>
</template>

<style scoped>
.semana {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--clinic-space-2);
}

.dia {
  min-width: 0;
}

.dia__botao {
  display: grid;
  width: 100%;
  align-content: start;
  gap: var(--clinic-space-2);
  min-height: 9rem;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.dia__botao:hover {
  border-color: var(--clinic-accent);
  box-shadow: var(--clinic-shadow-card);
}

.dia--hoje .dia__botao {
  border-color: var(--clinic-accent-strong);
  box-shadow: inset 0 2px 0 var(--clinic-accent-strong);
}

.dia--fechado .dia__botao {
  background: var(--clinic-surface-sunken);
}

.dia__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.3rem;
}

.dia__semana {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dia__data {
  color: var(--clinic-muted);
  font-weight: 700;
}

.dia__ocupacao {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.dia__ocupacao strong {
  color: var(--clinic-text);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.dia__barra {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--clinic-line);
}

.dia__preenchimento {
  display: block;
  height: 100%;
  background: var(--clinic-accent);
}

.dia--cheio .dia__preenchimento {
  background: var(--clinic-attention-text);
}

.dia--excedido .dia__preenchimento {
  background: var(--clinic-risk-text);
}

.dia__numeros {
  display: grid;
  gap: 0.1rem;
  margin: 0;
  padding: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  list-style: none;
}

.dia__faltas {
  color: var(--clinic-risk-text);
  font-weight: 700;
}

.dia__fechado {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

@media (max-width: 1100px) {
  .semana {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  }
}
</style>
