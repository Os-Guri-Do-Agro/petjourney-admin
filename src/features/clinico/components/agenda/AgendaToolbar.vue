<script setup lang="ts">
/**
 * Barra de comando da agenda.
 *
 * Antes eram doze controles em duas linhas — data, visão, agrupamento, densidade, zoom, um
 * checkbox, três botões, ajuda e uma fileira de fichas de profissional. Tudo visível o tempo
 * todo, e portanto nada em destaque.
 *
 * Agora a barra mostra só o que se usa a cada minuto — **onde estou** (data) e **o que estou
 * vendo** (dia ou semana) — e recolhe o resto em dois painéis nomeados. A ação principal (novo
 * atendimento) subiu para a saudação da página em 30/09/2026, como a pílula cheia: a barra ficou
 * só com o que mexe na grade.
 *
 *
 * - **Exibição**: agrupamento, densidade, zoom e cancelados. Escolhas que se faz uma vez por
 *   turno, não uma vez por paciente.
 * - **Filtros**: profissionais e situação, com um contador na própria etiqueta — filtro ativo
 *   escondido é a forma mais rápida de alguém achar que a agenda está vazia.
 *
 * Nenhum atalho de teclado foi removido: cada item continua mostrando a sua tecla no `title`.
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDensityToggle from '../base/ClinicDensityToggle.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useClinicPrefs } from '../../composables/useClinicPrefs'
import type { AppointmentStatus } from '../../data/types'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const emit = defineEmits<{
  encaixar: []
  bloquear: []
  ajuda: []
}>()

const { t } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const { ocultarCancelados, formatoDaAgenda } = useClinicPrefs()

const opcoesDeFormato = computed(() => [
  { valor: 'tabela', rotulo: t('clinico.agenda.formato.tabela'), icone: 'ph ph-table' },
  {
    valor: 'linha-do-tempo',
    rotulo: t('clinico.agenda.formato.linhaDoTempo'),
    icone: 'ph ph-clock',
  },
])

const exibicao = ref<InstanceType<typeof Popover> | null>(null)
const filtros = ref<InstanceType<typeof Popover> | null>(null)
const acoes = ref<InstanceType<typeof Menu> | null>(null)

const idOcultarCancelados = useId()

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

const filtrosAtivos = computed(() => agenda.filtroProfissionais.length + agenda.filtroStatus.length)

/** A tecla vai no `title` de cada opção: o atalho continua descobrível sem abrir a ajuda. */
const opcoesVisao = computed(() => [
  { valor: 'dia', rotulo: t('clinico.agenda.visaoDia'), atalho: 'D' },
  { valor: 'semana', rotulo: t('clinico.agenda.visaoSemana'), atalho: 'S' },
])

const opcoesAgrupamento = computed(() => [
  {
    valor: 'profissional',
    rotulo: t('clinico.agenda.agruparPorProfissional'),
    icone: 'ph ph-user',
    atalho: 'P',
  },
  {
    valor: 'sala',
    rotulo: t('clinico.agenda.agruparPorSala'),
    icone: 'ph ph-building',
    atalho: 'R',
  },
])

const itensAcoes = computed<MenuItem[]>(() => [
  {
    label: t('clinico.agenda.encaixar'),
    icon: 'ph ph-lightning',
    atalho: 'E',
    command: () => emit('encaixar'),
  },
  {
    label: t('clinico.agenda.bloquear'),
    icon: 'ph ph-prohibit',
    atalho: 'B',
    command: () => emit('bloquear'),
  },
  {
    label: t('clinico.atalhos.abrir'),
    icon: 'ph ph-question',
    atalho: '?',
    command: () => emit('ajuda'),
  },
])
</script>

<template>
  <div class="barra">
    <!-- onde estou -->
    <div class="barra__data">
      <Button
        icon="ph ph-caret-left"
        severity="secondary"
        outlined
        size="small"
        :title="`${t('clinico.agenda.diaAnterior')} (←)`"
        :aria-label="t('clinico.agenda.diaAnterior')"
        @click="agenda.avancar(-1)"
      />

      <div class="barra__hoje">
        <strong class="barra__titulo">{{ formato.dataLonga(agenda.data) }}</strong>
        <Button
          v-if="!ehHoje"
          class="barra__link"
          link
          size="small"
          :label="t('clinico.agenda.hoje')"
          :title="`${t('clinico.agenda.hoje')} (T)`"
          @click="agenda.hoje()"
        />
        <span v-else class="barra__marca">{{ t('clinico.agenda.hoje') }}</span>
      </div>

      <Button
        icon="ph ph-caret-right"
        severity="secondary"
        outlined
        size="small"
        :title="`${t('clinico.agenda.proximoDia')} (→)`"
        :aria-label="t('clinico.agenda.proximoDia')"
        @click="agenda.avancar(1)"
      />
    </div>

    <!-- o que estou vendo -->
    <SelectButton
      v-model="agenda.visao"
      class="segmentado"
      :options="opcoesVisao"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      size="small"
      :aria-label="t('clinico.agenda.visaoDia')"
    >
      <template #option="{ option }">
        <span :title="`${option.rotulo} (${option.atalho})`">{{ option.rotulo }}</span>
      </template>
    </SelectButton>

    <!-- ações -->
    <div class="barra__acoes">
      <Button
        class="painel-botao"
        :class="{ 'painel-botao--ativo': filtrosAtivos > 0 }"
        icon="ph ph-funnel"
        severity="secondary"
        outlined
        size="small"
        :label="t('clinico.agenda.filtros')"
        :badge="filtrosAtivos > 0 ? String(filtrosAtivos) : undefined"
        :aria-label="t('clinico.agenda.filtros')"
        aria-haspopup="true"
        @click="filtros?.toggle($event)"
      />

      <Button
        icon="ph ph-sliders-horizontal"
        severity="secondary"
        outlined
        size="small"
        :label="t('clinico.agenda.exibicao')"
        :aria-label="t('clinico.agenda.exibicao')"
        aria-haspopup="true"
        @click="exibicao?.toggle($event)"
      />

      <Button
        icon="ph ph-dots-three-vertical"
        severity="secondary"
        outlined
        size="small"
        :aria-label="t('clinico.agenda.maisAcoes')"
        :title="t('clinico.agenda.maisAcoes')"
        aria-haspopup="true"
        @click="acoes?.toggle($event)"
      />
    </div>

    <!-- ------------------------------------------------------------------ filtros -->
    <Popover ref="filtros" class="clinic-overlay hc-tema">
      <div class="painel clinic-scope">
        <section class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.agenda.agruparPorProfissional') }}</h3>
          <div class="fichas">
            <Button
              v-for="profissional in clinico.profissionais"
              :key="profissional.id"
              class="ficha"
              :class="{ 'ficha--ativa': agenda.filtroProfissionais.includes(profissional.id) }"
              severity="secondary"
              outlined
              rounded
              size="small"
              :aria-pressed="agenda.filtroProfissionais.includes(profissional.id)"
              @click="agenda.alternarFiltroProfissional(profissional.id)"
            >
              <span
                class="ficha__cor"
                :style="{ background: clinico.corDaColuna(profissional.id) }"
                aria-hidden="true"
              />
              <span>{{ profissional.nome }}</span>
            </Button>
          </div>
        </section>

        <section class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.status.agendado') }}</h3>
          <div class="fichas">
            <Button
              v-for="status in STATUS_FILTRAVEIS"
              :key="status"
              class="ficha"
              :class="{ 'ficha--ativa': agenda.filtroStatus.includes(status) }"
              severity="secondary"
              outlined
              rounded
              size="small"
              :label="formato.status(status)"
              :aria-pressed="agenda.filtroStatus.includes(status)"
              @click="agenda.alternarFiltroStatus(status)"
            />
          </div>
        </section>

        <Button
          v-if="filtrosAtivos > 0"
          class="painel__limpar"
          :label="t('clinico.agenda.limparFiltros')"
          icon="ph ph-x"
          severity="secondary"
          text
          size="small"
          @click="agenda.limparFiltros()"
        />
      </div>
    </Popover>

    <!-- ----------------------------------------------------------------- exibição -->
    <Popover ref="exibicao" class="clinic-overlay hc-tema">
      <div class="painel clinic-scope">
        <section v-if="agenda.visao === 'dia'" class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.agenda.exibicao') }}</h3>
          <SelectButton
            v-model="agenda.agrupamento"
            class="segmentado"
            :options="opcoesAgrupamento"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            size="small"
            fluid
            :aria-label="t('clinico.agenda.exibicao')"
          >
            <template #option="{ option }">
              <span class="segmentado__opcao" :title="`${option.rotulo} (${option.atalho})`">
                <i :class="option.icone" aria-hidden="true" />
                <span>{{ option.rotulo }}</span>
              </span>
            </template>
          </SelectButton>
        </section>

        <section v-if="agenda.visao === 'dia'" class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.agenda.formato.titulo') }}</h3>
          <SelectButton
            v-model="formatoDaAgenda"
            class="segmentado"
            :options="opcoesDeFormato"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            size="small"
            fluid
            :aria-label="t('clinico.agenda.formato.titulo')"
          >
            <template #option="{ option }">
              <span class="segmentado__opcao">
                <i :class="option.icone" aria-hidden="true" />
                <span>{{ option.rotulo }}</span>
              </span>
            </template>
          </SelectButton>
        </section>

        <section class="painel__secao">
          <h3 class="clinic-label">{{ t('clinico.densidade.titulo') }}</h3>
          <ClinicDensityToggle />
        </section>

        <div class="painel__switch">
          <ToggleSwitch v-model="ocultarCancelados" :input-id="idOcultarCancelados" />
          <label :for="idOcultarCancelados">{{ t('clinico.agenda.ocultarCancelados') }}</label>
        </div>
      </div>
    </Popover>

    <!-- -------------------------------------------------------------- mais ações -->
    <Menu ref="acoes" :model="itensAcoes" popup :pt="{ root: { class: 'clinic-overlay' } }">
      <template #item="{ item, props }">
        <a v-bind="props.action" class="menu__item">
          <span v-bind="props.icon" />
          <span v-bind="props.label" class="menu__rotulo">{{ item.label }}</span>
          <kbd>{{ item.atalho }}</kbd>
        </a>
      </template>
    </Menu>
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

/* "Hoje" é um link sob a data: sem o recuo de botão, alinhado à esquerda do título. */
.barra__link.p-button {
  justify-self: start;
  padding: 0;
  font-size: var(--clinic-font-label);
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
  margin-inline-start: auto;
}

/* Anel + peso: a marcação precisa se ler antes da cor, e sobreviver à escala de cinza. */
.segmentado :deep(.p-togglebutton-checked .p-togglebutton-content) {
  box-shadow:
    var(--clinic-shadow-card),
    inset 0 0 0 1.5px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.segmentado__opcao {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

.segmentado__opcao i {
  font-size: 0.7rem;
}

/*
 * Filtro ativo se anuncia: contorno e fundo no acento, além do contador na etiqueta — evita
 * "a agenda sumiu". O seletor repete as classes do botão para vencer a regra do módulo.
 */
.painel-botao--ativo.p-button.p-button-secondary.p-button-outlined,
.painel-botao--ativo.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover,
.ficha--ativa.p-button.p-button-secondary.p-button-outlined,
.ficha--ativa.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.painel {
  display: grid;
  gap: var(--clinic-space-4);
  width: min(22rem, 90vw);
  padding: var(--clinic-space-2);
}

.painel__secao {
  display: grid;
  gap: var(--clinic-space-2);
}

.painel__limpar.p-button {
  justify-self: start;
}

.painel__switch {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
  font-weight: 650;
}

.painel__switch label {
  cursor: pointer;
}

.fichas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-1);
}

.ficha.p-button {
  gap: 0.35rem;
}

.ficha__cor {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.menu__item {
  gap: var(--clinic-space-2);
}

.menu__rotulo {
  flex: 1;
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
    margin-inline-start: 0;
  }
}
</style>
