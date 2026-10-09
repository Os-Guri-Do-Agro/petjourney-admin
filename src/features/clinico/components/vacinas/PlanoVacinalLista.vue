<script setup lang="ts">
/**
 * O protocolo do paciente, na ordem em que pede ação.
 *
 * Uma linha por vacina, e a urgência mora no **disco do ícone** e na frase ao lado dele — nunca
 * na linha inteira pintada. A sequência de doses só abre onde ela é a informação: série em
 * andamento, e filhote que ainda não começou. O adulto em dia é uma linha, com a data do
 * reforço; desenhar para ele três bolinhas já cheias seria enfeite.
 *
 * "Onde ele está" é a dose marcada como **agora** na sequência: a primeira que não foi dada. É o
 * que o vet confere antes de aplicar e o que o responsável do filhote pergunta no balcão.
 */
import Button from 'primevue/button'
import {
  PhCheckCircle,
  PhClock,
  PhHourglass,
  PhSyringe,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDaVacina } from '../../composables/useRotulosDaVacina'
import type { PlanoVacinal, SituacaoNoPlano, VacinaNoPlano } from '../../domain/protocolo-vacinal'

const props = defineProps<{
  plano: PlanoVacinal
  somenteLeitura?: boolean
}>()

const emit = defineEmits<{
  aplicar: [vacinaId: string]
}>()

const { t } = useI18n()
const rotulos = useRotulosDaVacina()
const formato = useClinicFormat()

/**
 * O bloco do ícone, como o da pauta da Visão geral: o desenho da coisa (a seringa) e a gravidade no
 * bloco. Só o atrasado é cheio; numa lista de seis, seis blocos cheios seriam uma parede e o
 * atrasado deixaria de saltar. Quem aguarda idade leva a ampulheta, quem está em dia, o visto.
 */
const ICONE_DO_BLOCO: Record<SituacaoNoPlano, { icone: Component; peso: 'fill' | 'duotone' }> = {
  atrasada: { icone: PhWarningCircle, peso: 'fill' },
  devida: { icone: PhSyringe, peso: 'duotone' },
  'a-vencer': { icone: PhClock, peso: 'duotone' },
  'nao-iniciada': { icone: PhSyringe, peso: 'duotone' },
  'aguarda-idade': { icone: PhHourglass, peso: 'duotone' },
  'em-dia': { icone: PhCheckCircle, peso: 'duotone' },
}

/** A sequência abre onde ela responde alguma coisa. */
function mostrarSequencia(item: VacinaNoPlano): boolean {
  if (item.total <= 1) {
    return false
  }

  return !item.serieCompleta
}

/** Onde a dose foi dada, quando não foi aqui. */
function localExterno(item: VacinaNoPlano, numero: number): string | null {
  const dose = item.doses.find((d) => d.numero === numero && d.tipo === 'serie')

  return dose?.aplicacao?.externa?.local ?? null
}

/** A dose que pede ação agora — é nela que o botão da linha aplica. */
function pedeAplicacao(item: VacinaNoPlano): boolean {
  return ['atrasada', 'devida', 'nao-iniciada'].includes(item.situacao)
}

const linhas = computed(() =>
  props.plano.vacinas.map((item) => {
    const proxima = item.proxima

    /* Dose única não é série: "série de filhote, 1 doses" dizia duas coisas erradas de uma vez. */
    if (item.total === 1) {
      return {
        item,
        proxima,
        meta:
          item.aplicadasNaSerie === 0
            ? t('clinico.vacinas.plano.unicaNaoComecou')
            : t('clinico.vacinas.plano.unicaComReforco'),
      }
    }

    return {
      item,
      proxima,
      meta: item.serieCompleta
        ? t('clinico.vacinas.plano.serieCompleta', { serie: rotulos.serie(item.tipoDeSerie) })
        : item.aplicadasNaSerie === 0
          ? t('clinico.vacinas.plano.naoComecou', {
              serie: rotulos.serie(item.tipoDeSerie),
              total: item.total,
            })
          : t('clinico.vacinas.plano.emAndamento', {
              serie: rotulos.serie(item.tipoDeSerie),
              feitas: item.aplicadasNaSerie,
              total: item.total,
            }),
    }
  }),
)
</script>

<template>
  <ul class="plano">
    <li
      v-for="{ item, proxima, meta } in linhas"
      :key="item.vacina.id"
      class="plano__linha"
      :data-situacao="item.situacao"
    >
      <span class="plano__bloco" :class="`plano__bloco--${item.situacao}`" aria-hidden="true">
        <component
          :is="ICONE_DO_BLOCO[item.situacao].icone"
          class="plano__bloco-icone"
          :weight="ICONE_DO_BLOCO[item.situacao].peso"
        />
      </span>

      <div class="plano__corpo">
        <p class="plano__titulo">
          <strong>{{ item.vacina.nome }}</strong>
          <ClinicAlertChip
            v-if="item.vacina.obrigatoria"
            severidade="atencao"
            :rotulo="t('clinico.vacinas.obrigatoria')"
          />
        </p>
        <p class="plano__meta">{{ meta }}</p>

        <!--
          A sequência inteira, e a dose da vez marcada como "agora". Doses dadas fora levam o
          nome do lugar: é a primeira pergunta de quem vê uma dose sem lote.
        -->
        <ol
          v-if="mostrarSequencia(item)"
          class="sequencia"
          :aria-label="t('clinico.vacinas.plano.sequencia', { vacina: item.vacina.nome })"
        >
          <li
            v-for="(dose, indice) in item.doses"
            :key="`${dose.tipo}-${dose.numero}-${indice}`"
            class="sequencia__passo"
            :class="[
              `sequencia__passo--${dose.estado}`,
              { 'sequencia__passo--agora': dose === proxima },
            ]"
            :aria-current="dose === proxima ? 'step' : undefined"
          >
            <span class="sequencia__marca" aria-hidden="true">
              <i v-if="dose.estado === 'aplicada'" class="ph ph-check" />
              <i v-else-if="dose.estado === 'aguarda-idade'" class="ph ph-hourglass" />
              <i v-else-if="dose.tipo === 'reforco'" class="ph ph-arrow-counter-clockwise" />
            </span>
            <span class="sequencia__rotulo">
              <strong>{{ rotulos.numero(dose) }}</strong>
              <span>{{ rotulos.quando(dose) }}</span>
              <span v-if="dose === proxima" class="sequencia__agora">
                {{ t('clinico.vacinas.plano.agora') }}
              </span>
              <span
                v-else-if="dose.estado === 'aplicada' && localExterno(item, dose.numero)"
                class="sequencia__fora"
              >
                <i class="ph ph-map-pin" aria-hidden="true" />
                {{ localExterno(item, dose.numero) }}
              </span>
            </span>
          </li>
        </ol>
      </div>

      <div v-if="proxima" class="plano__proxima">
        <strong :class="`plano__quando--${item.situacao}`">{{ rotulos.quando(proxima) }}</strong>
        <span>{{ rotulos.numero(proxima) }} · {{ rotulos.data(proxima.em) }}</span>
        <span v-if="proxima.agendamento" class="plano__marcada">
          <i class="ph ph-calendar-blank" aria-hidden="true" />
          {{
            t('clinico.vacinas.plano.marcadaPara', {
              data: rotulos.data(proxima.agendamento.inicio.slice(0, 10)),
              hora: formato.hora(proxima.agendamento.inicio),
            })
          }}
        </span>
        <!--
          Contornado, não cheio: a ação principal da tela é o "Aplicar vacina" do topo. Este é o
          atalho que já chega com a vacina da linha escolhida.
        -->
        <Button
          v-if="!somenteLeitura && pedeAplicacao(item)"
          :label="t('clinico.vacinas.aplicar.atalho')"
          size="small"
          class="plano__aplicar"
          @click="emit('aplicar', item.vacina.id)"
        />
      </div>
    </li>

    <li v-if="plano.opcionaisNaoIniciadas.length > 0" class="plano__opcionais">
      <i class="ph ph-info" aria-hidden="true" />
      <span>
        {{
          t('clinico.vacinas.plano.opcionais', {
            lista: plano.opcionaisNaoIniciadas.map((vacina) => vacina.nome).join(' · '),
          })
        }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.plano {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plano__linha {
  display: grid;
  align-items: start;
  padding: var(--clinic-space-3) 0;
  border-bottom: 1px solid var(--clinic-line-soft);
  gap: var(--clinic-space-3);
  grid-template-columns: auto minmax(0, 1fr) minmax(9rem, auto);
}

.plano__linha:first-child {
  padding-top: 0;
}

/* O bloco carrega a urgência. A linha continua da cor do papel. */
.plano__bloco {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.7rem;
  background: var(--clinic-neutral-bg);
  color: var(--clinic-neutral-text);
  place-items: center;
}

.plano__bloco-icone {
  width: 1.3rem;
  height: 1.3rem;
}

/* O atrasado invertido: o fundo na tinta e o ícone no fundo do selo. */
.plano__bloco--atrasada {
  background: var(--clinic-risk-text);
  color: var(--clinic-risk-bg);
}

.plano__bloco--devida,
.plano__bloco--a-vencer {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.plano__bloco--em-dia {
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.plano__corpo {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.plano__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-value);
}

.plano__meta {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.plano__proxima {
  display: grid;
  justify-items: end;
  gap: 0.15rem;
  text-align: end;
}

.plano__proxima strong {
  font-size: var(--clinic-font-value);
  font-weight: 750;
}

.plano__proxima > span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.plano__quando--atrasada {
  color: var(--clinic-risk-text);
}

.plano__quando--devida,
.plano__quando--a-vencer {
  color: var(--clinic-attention-text);
}

.plano__marcada {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-accent-strong) !important;
  font-weight: 700;
}

/*
 * Contornado, em pílula, como as ações da Visão geral. Sem `severity`: as regras do botão
 * secundário da clínica venceriam estas, e o atalho voltaria a ser o botão de caixa reta.
 */
.plano__aplicar.p-button {
  min-height: 2rem;
  margin-top: 0.35rem;
  padding: 0 0.85rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: 999px;
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
  font-size: 0.8125rem;
  font-weight: 600;
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.plano__aplicar.p-button:not(:disabled):hover {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-surface);
  box-shadow: 0 4px 12px -6px rgb(20 32 28 / 25%);
  color: var(--clinic-accent-strong);
}

@media (prefers-reduced-motion: reduce) {
  .plano__aplicar.p-button {
    transition: none;
  }
}

.plano__opcionais {
  display: flex;
  align-items: baseline;
  padding-top: var(--clinic-space-3);
  gap: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ sequência */

.sequencia {
  display: flex;
  flex-wrap: wrap;
  margin: var(--clinic-space-2) 0 0;
  padding: 0;
  gap: var(--clinic-space-2) 0;
  list-style: none;
}

.sequencia__passo {
  position: relative;
  display: grid;
  min-width: 6.5rem;
  align-items: start;
  padding-inline-end: var(--clinic-space-3);
  gap: 0.35rem;
  grid-template-columns: auto minmax(0, 1fr);
}

/* O fio entre um passo e o seguinte. */
.sequencia__passo:not(:last-child)::after {
  position: absolute;
  top: 0.55rem;
  width: var(--clinic-space-3);
  height: 1px;
  background: var(--clinic-line);
  content: '';
  inset-inline-end: 0;
}

.sequencia__marca {
  display: grid;
  width: 1.1rem;
  height: 1.1rem;
  margin-top: 0.05rem;
  border: 1.5px solid var(--clinic-line);
  border-radius: 50%;
  background: var(--clinic-surface);
  color: var(--clinic-faint);
  font-size: 0.55rem;
  place-items: center;
}

.sequencia__passo--aplicada .sequencia__marca {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
}

.sequencia__passo--agora .sequencia__marca {
  border-width: 2px;
  border-color: var(--clinic-accent-strong);
  box-shadow: 0 0 0 3px var(--clinic-accent-tint);
}

.sequencia__passo--atrasada.sequencia__passo--agora .sequencia__marca {
  border-color: var(--clinic-risk-text);
  box-shadow: 0 0 0 3px var(--clinic-risk-bg);
}

.sequencia__rotulo {
  display: grid;
  gap: 0.05rem;
  font-size: var(--clinic-font-label);
}

.sequencia__rotulo strong {
  font-weight: 700;
}

.sequencia__rotulo > span {
  color: var(--clinic-faint);
}

.sequencia__passo--agora .sequencia__rotulo > span:first-of-type {
  color: var(--clinic-text);
  font-weight: 600;
}

.sequencia__agora {
  width: fit-content;
  padding: 0 0.4rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong) !important;
  font-size: 0.625rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.sequencia__fora {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.sequencia__fora .ph {
  font-size: 0.6rem;
}

@media (max-width: 720px) {
  .plano__linha {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .plano__proxima {
    justify-items: start;
    grid-column: 2;
    text-align: start;
  }
}
</style>
