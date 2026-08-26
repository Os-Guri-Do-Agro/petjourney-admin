<script setup lang="ts">
/**
 * Barra de comando da agenda.
 *
 * Antes eram doze controles em duas linhas — data, visão, agrupamento, densidade, zoom, um
 * checkbox, três botões, ajuda e uma fileira de fichas de profissional. Tudo visível o tempo
 * todo, e portanto nada em destaque.
 *
 * Agora a barra mostra só o que se usa a cada minuto — **onde estou** (data), **o que estou
 * vendo** (dia ou semana) e **a ação principal** (novo atendimento) — e recolhe o resto em dois
 * painéis nomeados:
 *
 * - **Exibição**: agrupamento, densidade, zoom e cancelados. Escolhas que se faz uma vez por
 *   turno, não uma vez por paciente.
 * - **Filtros**: profissionais e situação, com um contador na própria etiqueta — filtro ativo
 *   escondido é a forma mais rápida de alguém achar que a agenda está vazia.
 *
 * Nenhum atalho de teclado foi removido: cada item continua mostrando a sua tecla no `title`.
 */
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDensityToggle from '../base/ClinicDensityToggle.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useClinicPrefs } from '../../composables/useClinicPrefs'
import type { AppointmentStatus } from '../../data/types'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const emit = defineEmits<{
  novo: []
  encaixar: []
  bloquear: []
  ajuda: []
}>()

const { t } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const { ocultarCancelados } = useClinicPrefs()

const exibicao = ref<InstanceType<typeof Popover> | null>(null)
const filtros = ref<InstanceType<typeof Popover> | null>(null)
const acoes = ref<InstanceType<typeof Popover> | null>(null)

const ehHoje = computed(() => agenda.data === clinicClock.today())

/** Situações que valem virar filtro: as que a recepção procura, não as sete do domínio. */
const STATUS_FILTRAVEIS: AppointmentStatus[] = [
  'confirmado',
  'aguardando',
  'em-atendimento',
  'finalizado',
  'falta',
  'cancelado',
]

const filtrosAtivos = computed(
  () => agenda.filtroProfissionais.length + agenda.filtroStatus.length,
)
</script>

<template>
  <div class="barra">
    <!-- onde estou -->
    <div class="barra__data">
      <button
        type="button"
        class="barra__seta clinic-focusable"
        :title="`${t('clinico.agenda.diaAnterior')} (←)`"
        :aria-label="t('clinico.agenda.diaAnterior')"
        @click="agenda.avancar(-1)"
      >
        <i class="pi pi-chevron-left" aria-hidden="true" />
      </button>

      <div class="barra__hoje">
        <strong class="barra__titulo">{{ formato.dataLonga(agenda.data) }}</strong>
        <button
          v-if="!ehHoje"
          type="button"
          class="barra__link clinic-focusable"
          :title="`${t('clinico.agenda.hoje')} (T)`"
          @click="agenda.hoje()"
        >
          {{ t('clinico.agenda.hoje') }}
        </button>
        <span v-else class="barra__marca">{{ t('clinico.agenda.hoje') }}</span>
      </div>

      <button
        type="button"
        class="barra__seta clinic-focusable"
        :title="`${t('clinico.agenda.proximoDia')} (→)`"
        :aria-label="t('clinico.agenda.proximoDia')"
        @click="agenda.avancar(1)"
      >
        <i class="pi pi-chevron-right" aria-hidden="true" />
      </button>
    </div>

    <!-- o que estou vendo -->
    <div class="segmentado" role="radiogroup" :aria-label="t('clinico.agenda.visaoDia')">
      <button
        type="button"
        class="segmentado__botao clinic-focusable"
        :class="{ 'segmentado__botao--ativo': agenda.visao === 'dia' }"
        role="radio"
        :aria-checked="agenda.visao === 'dia'"
        :title="`${t('clinico.agenda.visaoDia')} (D)`"
        @click="agenda.visao = 'dia'"
      >
        {{ t('clinico.agenda.visaoDia') }}
      </button>
      <button
        type="button"
        class="segmentado__botao clinic-focusable"
        :class="{ 'segmentado__botao--ativo': agenda.visao === 'semana' }"
        role="radio"
        :aria-checked="agenda.visao === 'semana'"
        :title="`${t('clinico.agenda.visaoSemana')} (S)`"
        @click="agenda.visao = 'semana'"
      >
        {{ t('clinico.agenda.visaoSemana') }}
      </button>
    </div>

    <!-- ações -->
    <div class="barra__acoes">
      <button
        type="button"
        class="painel-botao clinic-focusable"
        :class="{ 'painel-botao--ativo': filtrosAtivos > 0 }"
        :aria-label="t('clinico.agenda.filtros')"
        @click="filtros?.toggle($event)"
      >
        <i class="pi pi-filter" aria-hidden="true" />
        <span>{{ t('clinico.agenda.filtros') }}</span>
        <span v-if="filtrosAtivos > 0" class="painel-botao__contagem">{{ filtrosAtivos }}</span>
      </button>

      <button
        type="button"
        class="painel-botao clinic-focusable"
        :aria-label="t('clinico.agenda.exibicao')"
        @click="exibicao?.toggle($event)"
      >
        <i class="pi pi-sliders-h" aria-hidden="true" />
        <span>{{ t('clinico.agenda.exibicao') }}</span>
      </button>

      <Button
        :label="t('clinico.agenda.novoAtendimento')"
        icon="pi pi-plus"
        size="small"
        :title="`${t('clinico.agenda.novoAtendimento')} (N)`"
        @click="emit('novo')"
      />

      <button
        type="button"
        class="painel-botao painel-botao--icone clinic-focusable"
        :aria-label="t('clinico.agenda.maisAcoes')"
        :title="t('clinico.agenda.maisAcoes')"
        @click="acoes?.toggle($event)"
      >
        <i class="pi pi-ellipsis-v" aria-hidden="true" />
      </button>
    </div>

    <!-- ------------------------------------------------------------------ filtros -->
    <Popover ref="filtros" class="clinic-overlay">
      <div class="painel clinic-scope">
        <section class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.agenda.agruparPorProfissional') }}</h3>
          <div class="fichas">
            <button
              v-for="profissional in clinico.profissionais"
              :key="profissional.id"
              type="button"
              class="ficha clinic-focusable"
              :class="{ 'ficha--ativa': agenda.filtroProfissionais.includes(profissional.id) }"
              :aria-pressed="agenda.filtroProfissionais.includes(profissional.id)"
              @click="agenda.alternarFiltroProfissional(profissional.id)"
            >
              <span
                class="ficha__cor"
                :style="{ background: clinico.corDaColuna(profissional.id) }"
                aria-hidden="true"
              />
              {{ profissional.nome }}
            </button>
          </div>
        </section>

        <section class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.status.agendado') }}</h3>
          <div class="fichas">
            <button
              v-for="status in STATUS_FILTRAVEIS"
              :key="status"
              type="button"
              class="ficha clinic-focusable"
              :class="{ 'ficha--ativa': agenda.filtroStatus.includes(status) }"
              :aria-pressed="agenda.filtroStatus.includes(status)"
              @click="agenda.alternarFiltroStatus(status)"
            >
              {{ formato.status(status) }}
            </button>
          </div>
        </section>

        <Button
          v-if="filtrosAtivos > 0"
          :label="t('clinico.agenda.limparFiltros')"
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          @click="agenda.limparFiltros()"
        />
      </div>
    </Popover>

    <!-- ----------------------------------------------------------------- exibição -->
    <Popover ref="exibicao" class="clinic-overlay">
      <div class="painel clinic-scope">
        <section v-if="agenda.visao === 'dia'" class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.agenda.exibicao') }}</h3>
          <div class="segmentado segmentado--largo" role="radiogroup">
            <button
              type="button"
              class="segmentado__botao clinic-focusable"
              :class="{ 'segmentado__botao--ativo': agenda.agrupamento === 'profissional' }"
              role="radio"
              :aria-checked="agenda.agrupamento === 'profissional'"
              :title="`${t('clinico.agenda.agruparPorProfissional')} (P)`"
              @click="agenda.agrupamento = 'profissional'"
            >
              <i class="pi pi-user" aria-hidden="true" />
              <span>{{ t('clinico.agenda.agruparPorProfissional') }}</span>
            </button>
            <button
              type="button"
              class="segmentado__botao clinic-focusable"
              :class="{ 'segmentado__botao--ativo': agenda.agrupamento === 'sala' }"
              role="radio"
              :aria-checked="agenda.agrupamento === 'sala'"
              :title="`${t('clinico.agenda.agruparPorSala')} (R)`"
              @click="agenda.agrupamento = 'sala'"
            >
              <i class="pi pi-building" aria-hidden="true" />
              <span>{{ t('clinico.agenda.agruparPorSala') }}</span>
            </button>
          </div>
        </section>

        <section class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.densidade.titulo') }}</h3>
          <ClinicDensityToggle />
        </section>

        <label class="painel__switch">
          <input v-model="ocultarCancelados" type="checkbox" />
          <span>{{ t('clinico.agenda.ocultarCancelados') }}</span>
        </label>
      </div>
    </Popover>

    <!-- -------------------------------------------------------------- mais ações -->
    <Popover ref="acoes" class="clinic-overlay">
      <div class="painel painel--menu clinic-scope">
        <button type="button" class="menu__item clinic-focusable" @click="emit('encaixar')">
          <i class="pi pi-bolt" aria-hidden="true" />
          <span>{{ t('clinico.agenda.encaixar') }}</span>
          <kbd>E</kbd>
        </button>
        <button type="button" class="menu__item clinic-focusable" @click="emit('bloquear')">
          <i class="pi pi-ban" aria-hidden="true" />
          <span>{{ t('clinico.agenda.bloquear') }}</span>
          <kbd>B</kbd>
        </button>
        <button type="button" class="menu__item clinic-focusable" @click="emit('ajuda')">
          <i class="pi pi-question-circle" aria-hidden="true" />
          <span>{{ t('clinico.atalhos.abrir') }}</span>
          <kbd>?</kbd>
        </button>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.barra__data {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.barra__seta {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
}

.barra__seta:hover {
  border-color: var(--clinic-accent);
  color: var(--clinic-accent-strong);
}

.barra__hoje {
  display: grid;
  gap: 0.1rem;
  min-width: 11rem;
}

.barra__titulo {
  font-size: var(--clinic-font-value);
  font-weight: 750;
  letter-spacing: -0.01em;
}

/*
 * `capitalize` transformava "sexta-feira, 21 de agosto" em "Sexta-Feira, 21 De Agosto".
 * Em português só a primeira letra sobe.
 */
.barra__titulo::first-letter {
  text-transform: uppercase;
}

.barra__link {
  justify-self: start;
  padding: 0;
  border: none;
  background: none;
  color: var(--clinic-accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.barra__marca {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* As ações vão para a direita; a barra respira no meio. */
.barra__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
  margin-left: auto;
}

.segmentado {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.segmentado--largo {
  width: 100%;
}

.segmentado__botao {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0 var(--clinic-space-3);
  border: none;
  border-radius: calc(var(--clinic-radius-control) - 2px);
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* Anel + peso: a marcação precisa se ler antes da cor, e sobreviver à escala de cinza. */
.segmentado__botao--ativo {
  background: var(--clinic-surface);
  box-shadow:
    var(--clinic-shadow-card),
    inset 0 0 0 1.5px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.segmentado__botao i {
  font-size: 0.7rem;
}

.painel-botao {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  align-items: center;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.painel-botao:hover {
  border-color: var(--clinic-accent);
  color: var(--clinic-accent-strong);
}

.painel-botao--icone {
  padding-inline: var(--clinic-space-2);
}

/* Filtro ativo se anuncia: contador na etiqueta evita "a agenda sumiu". */
.painel-botao--ativo {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.painel-botao__contagem {
  min-width: 1.1rem;
  padding: 0 0.25rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
  font-size: 0.62rem;
  font-weight: 800;
  text-align: center;
}

.painel {
  display: grid;
  gap: var(--clinic-space-4);
  width: min(22rem, 90vw);
  padding: var(--clinic-space-2);
}

.painel--menu {
  gap: 0.15rem;
  width: min(15rem, 90vw);
}

.painel__secao {
  display: grid;
  gap: var(--clinic-space-2);
}

.painel__switch {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--clinic-muted);
  cursor: pointer;
  font-size: var(--clinic-font-base);
  font-weight: 650;
}

.fichas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-1);
}

.ficha {
  display: inline-flex;
  min-height: 1.7rem;
  align-items: center;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.ficha--ativa {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.ficha__cor {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.menu__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--clinic-space-2);
  min-height: var(--clinic-row-height);
  padding: 0 var(--clinic-space-2);
  border: none;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.menu__item:hover {
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.menu__item span {
  flex: 1;
}

.menu__item i {
  color: var(--clinic-muted);
  font-size: 0.75rem;
}

.menu__item kbd {
  padding: 0 0.3rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: 0.3rem;
  color: var(--clinic-faint);
  font-family: inherit;
  font-size: 0.62rem;
}

@media (max-width: 900px) {
  .barra__acoes {
    width: 100%;
    margin-left: 0;
  }
}
</style>
