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
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDensityToggle from '../base/ClinicDensityToggle.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useClinicPrefs } from '../../composables/useClinicPrefs'
import type { AppointmentStatus } from '../../data/types'
import { addDays } from '../../domain/clinic-time'
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

/*
 * A carga da semana vem do mesmo repositório da visão "Semana". Carrega quando a semana muda e
 * quando qualquer tela mexe na agenda (`clinico.revisao`): a fita precisa contar o encaixe que
 * acabou de entrar.
 */
watch(
  () => [agenda.inicioDaSemana, clinico.revisao],
  () => void agenda.carregarSemana(),
  { immediate: true },
)

const diasDaSemana = computed(() =>
  Array.from({ length: 7 }, (_, indice) => {
    const data = addDays(agenda.inicioDaSemana, indice)
    const carga = agenda.semanaDias.find((dia) => dia.data === data)

    return {
      data,
      semana: formato.diaDaSemanaCurto(data),
      numero: Number(data.slice(8, 10)),
      rotuloLongo: formato.dataLonga(data),
      hoje: data === clinicClock.today(),
      ocupacao: carga?.ocupacao ?? 0,
      agendados: carga?.agendados ?? 0,
      fechado: carga ? carga.capacidadeMinutos === 0 : false,
    }
  }),
)

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
    <!--
      A semana em fita: cada dia com a carga dele. Andar de dia em dia é o caso comum, e ver de
      relance qual dia está cheio é o que a recepção precisa para oferecer um horário por telefone.
    -->
    <div class="semana" role="group" :aria-label="t('clinico.agenda.semanaRotulo')">
      <Button
        class="semana__seta"
        icon="ph ph-caret-left"
        severity="secondary"
        text
        :title="`${t('clinico.agenda.diaAnterior')} (←)`"
        :aria-label="t('clinico.agenda.diaAnterior')"
        @click="agenda.avancar(-1)"
      />

      <ol class="semana__dias">
        <li v-for="dia in diasDaSemana" :key="dia.data">
          <button
            type="button"
            class="dia"
            :class="{
              'dia--escolhido': dia.data === agenda.data,
              'dia--hoje': dia.hoje,
              'dia--fechado': dia.fechado,
            }"
            :aria-pressed="dia.data === agenda.data"
            :aria-label="dia.rotuloLongo"
            @click="agenda.irPara(dia.data)"
          >
            <span class="dia__semana">{{ dia.semana }}</span>
            <span class="dia__numero ui-num">{{ dia.numero }}</span>
            <span class="dia__carga" aria-hidden="true">
              <span :style="{ width: `${Math.round(dia.ocupacao * 100)}%` }" />
            </span>
            <span class="dia__total ui-num">{{ dia.fechado ? '–' : dia.agendados }}</span>
          </button>
        </li>
      </ol>

      <Button
        class="semana__seta"
        icon="ph ph-caret-right"
        severity="secondary"
        text
        :title="`${t('clinico.agenda.proximoDia')} (→)`"
        :aria-label="t('clinico.agenda.proximoDia')"
        @click="agenda.avancar(1)"
      />

      <Button
        v-if="!ehHoje"
        class="semana__hoje"
        severity="secondary"
        size="small"
        icon="ph ph-arrow-u-up-left"
        :label="t('clinico.agenda.hoje')"
        :title="`${t('clinico.agenda.hoje')} (T)`"
        @click="agenda.hoje()"
      />
    </div>

    <div class="barra__acoes">
      <SelectButton
        v-model="agenda.visao"
        class="segmentado"
        :options="opcoesVisao"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('clinico.agenda.visaoDia')"
      >
        <template #option="{ option }">
          <span :title="`${option.rotulo} (${option.atalho})`">{{ option.rotulo }}</span>
        </template>
      </SelectButton>

      <Button
        class="painel-botao"
        :class="{ 'painel-botao--ativo': filtrosAtivos > 0 }"
        icon="ph ph-funnel-simple"
        severity="secondary"
        outlined
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
        :label="t('clinico.agenda.exibicao')"
        :aria-label="t('clinico.agenda.exibicao')"
        aria-haspopup="true"
        @click="exibicao?.toggle($event)"
      />

      <Button
        icon="ph ph-dots-three"
        severity="secondary"
        outlined
        :aria-label="t('clinico.agenda.maisAcoes')"
        :title="t('clinico.agenda.maisAcoes')"
        aria-haspopup="true"
        @click="acoes?.toggle($event)"
      />
    </div>

    <!-- ------------------------------------------------------------------ filtros -->
    <Popover ref="filtros" class="clinic-overlay">
      <div class="painel clinic-scope">
        <section class="painel__secao">
          <h3 class="painel__titulo">{{ t('clinico.agenda.filtroProfissionais') }}</h3>
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
          <h3 class="painel__titulo">{{ t('clinico.agenda.filtroSituacao') }}</h3>
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
    <Popover ref="exibicao" class="clinic-overlay">
      <div class="painel clinic-scope">
        <section v-if="agenda.visao === 'dia'" class="painel__secao">
          <h3 class="painel__titulo">{{ t('clinico.agenda.exibicao') }}</h3>
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
          <h3 class="painel__titulo">{{ t('clinico.agenda.formato.titulo') }}</h3>
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
          <h3 class="painel__titulo">{{ t('clinico.densidade.titulo') }}</h3>
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
  justify-content: space-between;
  gap: 12px 20px;
}

/* ------------------------------------------------------------------------- a semana em fita */

.semana {
  display: flex;
  align-items: center;
  gap: 4px;
}

.semana__dias {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dia {
  position: relative;
  display: grid;
  width: 58px;
  justify-items: center;
  gap: 2px;
  padding: 6px 4px 7px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.dia:hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.dia:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 1px;
}

.dia__semana {
  font-size: 12px;
  font-weight: 500;
}

.dia__numero {
  color: var(--tinta);
  font-size: 19px;
  font-weight: 650;
  line-height: 1.1;
}

/* A barrinha de carga: quanto do expediente já está marcado. */
.dia__carga {
  display: block;
  width: 30px;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--superficie-3);
}

.dia__carga span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--clinica);
}

.dia__total {
  color: var(--tinta-3);
  font-size: 11px;
}

.dia--hoje .dia__semana {
  color: var(--clinica-tinta);
  font-weight: 650;
}

.dia--hoje::after {
  position: absolute;
  top: 7px;
  right: 9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--clinica);
  content: '';
}

.dia--escolhido {
  border-color: color-mix(in oklab, var(--clinica) 45%, transparent);
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.dia--escolhido:hover {
  background: var(--clinica-fundo);
}

.dia--escolhido .dia__numero {
  color: var(--clinica-tinta);
}

.dia--escolhido .dia__carga {
  background: color-mix(in oklab, var(--clinica) 20%, var(--superficie));
}

.dia--fechado .dia__numero {
  color: var(--tinta-3);
}

.semana__hoje.p-button {
  margin-left: 6px;
}

/* --------------------------------------------------------------------------------- ações */

.barra__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.segmentado :deep(.p-togglebutton-checked .p-togglebutton-content) {
  font-weight: 650;
}

.segmentado__opcao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.segmentado__opcao i {
  font-size: 14px;
}

/* Filtro ativo se anuncia: contorno e fundo no lugar, além do contador — evita "a agenda sumiu". */
.painel-botao--ativo.p-button.p-button-secondary.p-button-outlined,
.painel-botao--ativo.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover,
.ficha--ativa.p-button.p-button-secondary.p-button-outlined,
.ficha--ativa.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinica);
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.painel {
  display: grid;
  gap: 18px;
  width: min(23rem, 90vw);
  padding: 6px;
}

.painel__secao {
  display: grid;
  gap: 8px;
}

.painel__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 600;
}

.painel__limpar.p-button {
  justify-self: start;
}

.painel__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
}

.painel__switch label {
  cursor: pointer;
}

.fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ficha.p-button {
  gap: 6px;
}

.ficha__cor {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.menu__item {
  gap: 10px;
}

.menu__rotulo {
  flex: 1;
}

.menu__item kbd {
  padding: 1px 6px;
  border: 1px solid var(--linha);
  border-radius: 5px;
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11px;
}

@media (max-width: 1100px) {
  .dia {
    width: 48px;
  }
}

@media (max-width: 720px) {
  .semana {
    width: 100%;
    overflow-x: auto;
  }

  .dia__total {
    display: none;
  }
}
</style>
