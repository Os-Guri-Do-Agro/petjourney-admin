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
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { faixaDeOcupacao } from '../../domain/load'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const emit = defineEmits<{ escolherDia: [data: string] }>()

const { t } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()

/* A semana identifica o profissional pelas iniciais e pela cor da coluna dele na grade: é o
 * mesmo par que a pessoa já aprendeu olhando o dia, e o card não tem largura para nomes. */
function nomeDe(professionalId: string) {
  return clinico.profissional(professionalId)?.nome ?? ''
}

function iniciaisDe(professionalId: string) {
  return clinico.profissional(professionalId)?.iniciais ?? '?'
}

function corDe(professionalId: string) {
  return clinico.corDaColuna(professionalId)
}
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
      <Button
        class="dia__botao"
        severity="secondary"
        outlined
        fluid
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

          <!--
            A quebra por profissional é o que faz a semana responder a pergunta do balcão. O
            agregado do dia diz 50% quando uma agenda está cheia e a outra vazia — e não diz a
            quem oferecer. Manhã e tarde em barras separadas porque ninguém pergunta pelo dia
            inteiro: pergunta "tem alguma coisa de manhã na terça?".
          -->
          <ul class="pessoas">
            <li
              v-for="pessoa in dia.porProfissional"
              :key="pessoa.professionalId"
              class="pessoa"
              :title="
                t('clinico.agenda.semana.detalhePessoa', {
                  nome: nomeDe(pessoa.professionalId),
                  manha: formato.percentual(pessoa.ocupacaoManha),
                  tarde: formato.percentual(pessoa.ocupacaoTarde),
                })
              "
            >
              <span class="pessoa__iniciais" :style="{ background: corDe(pessoa.professionalId) }">
                {{ iniciaisDe(pessoa.professionalId) }}
              </span>

              <span class="pessoa__periodos" aria-hidden="true">
                <span
                  class="pessoa__periodo"
                  :class="`pessoa__periodo--${faixaDeOcupacao(pessoa.ocupacaoManha)}`"
                >
                  <span :style="{ width: `${Math.min(pessoa.ocupacaoManha, 1) * 100}%` }" />
                </span>
                <span
                  class="pessoa__periodo"
                  :class="`pessoa__periodo--${faixaDeOcupacao(pessoa.ocupacaoTarde)}`"
                >
                  <span :style="{ width: `${Math.min(pessoa.ocupacaoTarde, 1) * 100}%` }" />
                </span>
              </span>

              <span class="pessoa__valor clinic-value">
                {{ formato.percentual(pessoa.ocupacao) }}
              </span>
            </li>
          </ul>
        </template>
      </Button>
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

/*
 * O dia inteiro é o alvo do clique. O botão perde o miolo centralizado de botão e vira cartão:
 * conteúdo empilhado, à esquerda, com a borda e a sombra dos cartões do módulo.
 */
.dia__botao.p-button {
  display: grid;
  align-content: start;
  justify-content: stretch;
  gap: var(--clinic-space-2);
  min-height: 9rem;
  padding: var(--clinic-space-3);
  border-color: var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  box-shadow: var(--clinic-shadow-card);
  font-size: var(--clinic-font-base);
  font-weight: inherit;
  text-align: start;
}

/* Repete as classes do botão para vencer a regra de botão contornado do módulo. */
.dia__botao.p-button.p-button-secondary.p-button-outlined {
  border-color: var(--clinic-line);
  background: var(--clinic-surface);
}

.dia--hoje .dia__botao.p-button.p-button-secondary.p-button-outlined {
  border-color: var(--clinic-accent-strong);
  box-shadow: inset 0 2px 0 var(--clinic-accent-strong);
}

.dia--fechado .dia__botao.p-button.p-button-secondary.p-button-outlined {
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

/* --------------------------------------------------------- carga por profissional */

.pessoas {
  display: grid;
  gap: 0.2rem;
  margin: 0.15rem 0 0;
  padding: 0.35rem 0 0;
  border-top: 1px solid var(--clinic-line);
  list-style: none;
}

.pessoa {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.3rem;
}

.pessoa__iniciais {
  display: grid;
  width: 1.1rem;
  height: 1.1rem;
  place-items: center;
  border-radius: 0.3rem;
  color: var(--clinic-text);
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

/* Duas barras por pessoa: manhã e tarde. Juntas, ocupam a mesma altura de uma. */
.pessoa__periodos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}

.pessoa__periodo {
  display: block;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--clinic-line);
}

.pessoa__periodo span {
  display: block;
  height: 100%;
  background: var(--clinic-accent);
}

.pessoa__periodo--cheio span {
  background: var(--clinic-attention-text);
}

.pessoa__periodo--excedido span {
  background: var(--clinic-risk-text);
}

.pessoa__valor {
  color: var(--clinic-faint);
  font-size: 0.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
