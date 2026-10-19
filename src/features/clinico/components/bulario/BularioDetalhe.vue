<script setup lang="ts">
/**
 * Ficha do medicamento.
 *
 * A ordem das seções é a ordem em que a decisão acontece na mesa: **primeiro o que impede**
 * (avisos deste paciente, contraindicações), depois a dose, depois o resto. Bula que abre pela
 * apresentação e esconde a contraindicação três blocos abaixo é bula que ninguém rola até o fim.
 *
 * A tabela de doses lista todas as espécies do bulário, com a do paciente aberto em destaque —
 * ver a dose felina ao lado da canina é o que impede a conta errada, e escondê-la exigiria
 * confiar que ninguém nunca abre a ficha sem paciente.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * - **Cabeça**: o nome grande, a apresentação embaixo, a classe e o controle especial em selos.
 * - **Avisos do paciente** numa faixa de risco (ou de atenção, quando é só cautela), cada um com a
 *   frase inteira.
 * - **Dose para o peso** (só com `comDoseDoPeso`, na tela do bulário aberta com paciente): a faixa
 *   da espécie multiplicada pelo peso do cadastro, pela mesma conta da receita (`calcularDose`).
 *   Números grandes — mg por administração, quanto da apresentação, intervalo e duração — e a
 *   conta escrita embaixo, para ninguém confiar num número sem saber de onde ele veio. No
 *   seletor da receita ela fica de fora: lá o peso que vale é o aferido na consulta, e o
 *   prontuário faz a conta com ele.
 * - **Dose por espécie** numa tabela legível: a faixa em algarismos de mesma largura, o
 *   intervalo, a duração. A espécie em que o princípio é contraindicado vira linha de risco, com
 *   a palavra e a nota do porquê.
 * - Vias em selos; indicações, contraindicações, efeitos adversos e interações em blocos com o
 *   ícone e a cor do que são; a observação; e o aviso legal discreto no pé.
 */
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, isLocale, DEFAULT_LOCALE } from '@/i18n/locales'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Medication, Pet } from '../../data/types'
import { avisosDoMedicamento, doseDaEspecie } from '../../domain/bulario'
import { calcularDose } from '../../domain/dose'

const props = withDefaults(
  defineProps<{
    medicamento: Medication
    pet?: Pet | null
    /**
     * Mostra a dose calculada para o peso do cadastro do paciente. Só a tela do bulário liga:
     * no seletor da receita o peso que vale é o da consulta, e quem calcula é o prontuário.
     */
    comDoseDoPeso?: boolean
  }>(),
  { pet: null, comDoseDoPeso: false },
)

const { t, locale } = useI18n()
const formato = useClinicFormat()
const idDoses = useId()

const avisos = computed(() => avisosDoMedicamento(props.medicamento, props.pet, new Date()))

function ehGrave(kind: string) {
  return kind === 'especie-proibida' || kind === 'alergia'
}

const avisoGrave = computed(() => avisos.value.some((aviso) => ehGrave(aviso.kind)))

const doses = computed(() =>
  props.medicamento.doses.map((dose) => ({
    ...dose,
    doPaciente: props.pet?.especie === dose.especie,
  })),
)

const blocos = computed(() =>
  [
    {
      id: 'indicacoes',
      itens: props.medicamento.indicacoes,
      tom: 'neutro',
      icone: 'ph ph-check-circle',
    },
    {
      id: 'contraindicacoes',
      itens: props.medicamento.contraindicacoes,
      tom: 'risco',
      icone: 'ph ph-prohibit',
    },
    {
      id: 'efeitosAdversos',
      itens: props.medicamento.efeitosAdversos,
      tom: 'atencao',
      icone: 'ph ph-warning',
    },
    {
      id: 'interacoes',
      itens: props.medicamento.interacoes,
      tom: 'neutro',
      icone: 'ph ph-arrows-left-right',
    },
  ].filter((bloco) => bloco.itens.length > 0),
)

function textoDoAviso(kind: string, cuidado: string | null, detalhe: string) {
  if (kind === 'cuidado' && cuidado) {
    return t(`clinico.bulario.cuidado.${cuidado}`, { detalhe })
  }

  return t(`clinico.bulario.aviso.${kind}`, { detalhe })
}

/**
 * Número de bula: até duas casas, sem zeros à direita. "12,5–25" se lê; "12,50–25,00" faz o olho
 * contar casas que não dizem nada.
 */
function num(valor: number) {
  const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

  return new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(valor)
}

function faixa(minimo: number, maximo: number) {
  return minimo === maximo ? num(minimo) : `${num(minimo)}–${num(maximo)}`
}

/**
 * A dose para o peso do paciente: a faixa da espécie nas duas pontas, pela mesma conta da
 * receita. Nada aqui é novo — `calcularDose` é o que o prontuário usa; só se chama duas vezes,
 * uma com o mínimo e outra com o máximo da faixa.
 */
const doseDoPeso = computed(() => {
  const pet = props.pet

  if (!props.comDoseDoPeso || !pet) {
    return null
  }

  const daEspecie = doseDaEspecie(props.medicamento, pet.especie)

  /* Contraindicada ou sem faixa da espécie: não há dose a calcular, e os avisos já dizem por quê. */
  if (!daEspecie || daEspecie.proibido) {
    return null
  }

  if (pet.pesoKg === null || pet.pesoKg <= 0) {
    return { semPeso: true as const }
  }

  const base = {
    medicamento: props.medicamento,
    pesoKg: pet.pesoKg,
    frequenciaHoras: daEspecie.frequenciaHoras,
    duracaoDias: Math.max(1, daEspecie.duracaoUsualDias),
  }
  const minimo = calcularDose({ ...base, mgPorKg: daEspecie.mgPorKg.min })
  const maximo = calcularDose({ ...base, mgPorKg: daEspecie.mgPorKg.max })

  if (!minimo || !maximo) {
    return null
  }

  return {
    semPeso: false as const,
    pesoKg: pet.pesoKg,
    mg: faixa(minimo.mgPorAdministracao, maximo.mgPorAdministracao),
    quantidade:
      maximo.quantidadeApresentacao > 0
        ? faixa(minimo.quantidadeApresentacao, maximo.quantidadeApresentacao)
        : null,
    unidade: t(
      `clinico.prontuario.conduta.unidade.${props.medicamento.unidadeApresentacao}`,
      maximo.quantidadeApresentacao > 1 ? 2 : 1,
    ),
    frequenciaHoras: daEspecie.frequenciaHoras,
    duracaoDias: daEspecie.duracaoUsualDias,
    faixaMgKg: faixa(daEspecie.mgPorKg.min, daEspecie.mgPorKg.max),
  }
})
</script>

<template>
  <article class="ficha">
    <header class="ficha__topo">
      <h2 class="ficha__nome">{{ medicamento.nome }}</h2>
      <p class="ficha__apresentacao">{{ medicamento.apresentacao }}</p>

      <div class="ficha__selos">
        <span class="ui-selo ui-selo--clinica">
          <i class="ph ph-pill" aria-hidden="true" />
          {{ t(`clinico.bulario.classe.${medicamento.classe}`) }}
        </span>
        <span v-if="medicamento.controlado" class="ui-selo ui-selo--atencao">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('clinico.bulario.controlado') }}
        </span>
      </div>
    </header>

    <!-- O que impede vem primeiro, antes de qualquer número. -->
    <section
      v-if="avisos.length > 0"
      class="avisos"
      :class="avisoGrave ? 'avisos--risco' : 'avisos--atencao'"
      role="note"
    >
      <h3 class="avisos__titulo">
        <i :class="avisoGrave ? 'ph ph-warning-octagon' : 'ph ph-warning'" aria-hidden="true" />
        {{ t('clinico.bulario.avisosDoPaciente', { nome: pet?.nome ?? '' }) }}
      </h3>

      <ul class="avisos__lista">
        <li
          v-for="(aviso, indice) in avisos"
          :key="`${aviso.kind}-${aviso.cuidado ?? indice}`"
          class="aviso"
          :class="{ 'aviso--risco': ehGrave(aviso.kind) }"
        >
          {{ textoDoAviso(aviso.kind, aviso.cuidado, aviso.detalhe) }}
        </li>
      </ul>
    </section>

    <!-- A dose para o peso do paciente: a conta da receita, com a faixa da espécie. -->
    <section
      v-if="doseDoPeso && pet"
      class="calculo"
      :aria-label="
        doseDoPeso.semPeso
          ? undefined
          : t('clinico.bulario.dosePeso.titulo', { pet: pet.nome, peso: formato.peso(doseDoPeso.pesoKg) })
      "
    >
      <p v-if="doseDoPeso.semPeso" class="calculo__sem">
        <i class="ph ph-scales" aria-hidden="true" />
        {{ t('clinico.prontuario.conduta.semPeso') }}
      </p>

      <template v-else>
        <h3 class="calculo__titulo">
          <i class="ph ph-calculator" aria-hidden="true" />
          {{
            t('clinico.bulario.dosePeso.titulo', {
              pet: pet.nome,
              peso: formato.peso(doseDoPeso.pesoKg),
            })
          }}
        </h3>

        <dl class="calculo__numeros">
          <div class="calculo__numero calculo__numero--principal">
            <dt>{{ t('clinico.bulario.dosePeso.porAdministracao') }}</dt>
            <dd>
              <strong class="ui-num">{{ doseDoPeso.mg }}</strong>
              <span class="calculo__unidade">mg</span>
            </dd>
          </div>

          <div v-if="doseDoPeso.quantidade" class="calculo__numero">
            <dt>{{ t('clinico.bulario.dosePeso.daApresentacao') }}</dt>
            <dd>
              <strong class="ui-num">{{ doseDoPeso.quantidade }}</strong>
              <span class="calculo__unidade">{{ doseDoPeso.unidade }}</span>
            </dd>
          </div>

          <div class="calculo__numero">
            <dt>{{ t('clinico.bulario.doseIntervalo') }}</dt>
            <dd>
              <strong class="ui-num">{{ doseDoPeso.frequenciaHoras }}</strong>
              <span class="calculo__unidade">{{ t('clinico.bulario.dosePeso.horas') }}</span>
            </dd>
          </div>

          <div class="calculo__numero">
            <dt>{{ t('clinico.bulario.doseDuracao') }}</dt>
            <dd>
              <strong class="ui-num">{{ doseDoPeso.duracaoDias }}</strong>
              <span class="calculo__unidade">
                {{ t('clinico.bulario.dosePeso.dias', doseDoPeso.duracaoDias) }}
              </span>
            </dd>
          </div>
        </dl>

        <p class="calculo__conta">
          {{
            t('clinico.bulario.dosePeso.conta', {
              faixa: doseDoPeso.faixaMgKg,
              peso: formato.peso(doseDoPeso.pesoKg),
            })
          }}
        </p>
      </template>
    </section>

    <section class="doses" :aria-labelledby="idDoses">
      <h3 :id="idDoses" class="ficha__secao">
        {{ t('clinico.bulario.doseTitulo') }}
      </h3>

      <table class="doses__tabela">
        <thead>
          <tr>
            <th scope="col">{{ t('clinico.bulario.doseEspecie') }}</th>
            <th scope="col">{{ t('clinico.bulario.doseFaixa') }}</th>
            <th scope="col">{{ t('clinico.bulario.doseIntervalo') }}</th>
            <th scope="col">{{ t('clinico.bulario.doseDuracao') }}</th>
          </tr>
        </thead>
        <tbody v-for="dose in doses" :key="dose.especie" class="doses__grupo">
          <tr
            class="doses__linha"
            :class="{
              'doses__linha--paciente': dose.doPaciente,
              'doses__linha--proibida': dose.proibido,
            }"
          >
            <th scope="row" class="doses__especie">
              <span>{{ formato.especie(dose.especie) }}</span>
              <span v-if="dose.doPaciente" class="ui-selo ui-selo--lugar doses__deste">
                {{ t('clinico.bulario.destePaciente') }}
              </span>
            </th>
            <td v-if="dose.proibido" class="doses__proibido" colspan="3">
              <span class="ui-selo ui-selo--risco">
                <i class="ph ph-prohibit" aria-hidden="true" />
                {{ t('clinico.bulario.doseProibida') }}
              </span>
            </td>
            <template v-else>
              <td :data-rotulo="t('clinico.bulario.doseFaixa')">
                <span class="doses__faixa ui-num">{{ faixa(dose.mgPorKg.min, dose.mgPorKg.max) }}</span>
                <span class="doses__unidade">mg/kg</span>
              </td>
              <td class="ui-num" :data-rotulo="t('clinico.bulario.doseIntervalo')">
                {{ t('clinico.bulario.cadaHoras', { horas: dose.frequenciaHoras }) }}
              </td>
              <td class="ui-num" :data-rotulo="t('clinico.bulario.doseDuracao')">
                {{ t('clinico.formato.dias', { valor: dose.duracaoUsualDias }, dose.duracaoUsualDias) }}
              </td>
            </template>
          </tr>
          <tr v-if="dose.nota" class="doses__nota" :class="{ 'doses__nota--proibida': dose.proibido }">
            <td colspan="4">{{ dose.nota }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="vias">
      <h3 class="ficha__secao">{{ t('clinico.bulario.vias') }}</h3>
      <ul class="vias__lista">
        <li v-for="via in medicamento.viasPermitidas" :key="via" class="ui-selo ui-selo--contorno">
          {{ t(`clinico.prontuario.conduta.via_.${via}`) }}
        </li>
      </ul>
    </section>

    <div class="blocos">
      <section v-for="bloco in blocos" :key="bloco.id" class="bloco" :class="`bloco--${bloco.tom}`">
        <h3 class="ficha__secao bloco__titulo">
          <i :class="bloco.icone" aria-hidden="true" />
          {{ t(`clinico.bulario.${bloco.id}`) }}
        </h3>
        <ul class="bloco__lista">
          <li v-for="item in bloco.itens" :key="item">{{ item }}</li>
        </ul>
      </section>
    </div>

    <p v-if="medicamento.observacao" class="ficha__observacao">
      <i class="ph ph-chat-circle-text" aria-hidden="true" />
      <span>{{ medicamento.observacao }}</span>
    </p>

    <footer class="ficha__isencao">
      <i class="ph ph-info" aria-hidden="true" />
      <span>{{ t('clinico.bulario.isencao') }}</span>
    </footer>
  </article>
</template>

<style scoped>
.ficha {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
  color: var(--tinta);
  container-type: inline-size;
}

/* -------------------------------------------------------------------------------- a cabeça */

.ficha__topo {
  display: grid;
  gap: 4px;
}

.ficha__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.25;
}

.ficha__apresentacao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.45;
}

.ficha__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.ficha__secao {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

/* --------------------------------------------------------------------------- os avisos */

.avisos {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 14px 16px 14px 20px;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.avisos::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 0;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--atencao);
  content: '';
}

.avisos--atencao {
  border-color: color-mix(in oklab, var(--atencao) 35%, var(--linha));
  background: var(--atencao-fundo);
}

.avisos--risco {
  border-color: color-mix(in oklab, var(--risco) 35%, var(--linha));
  background: var(--risco-fundo);
}

.avisos--risco::before {
  background: var(--risco);
}

.avisos__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.avisos--atencao .avisos__titulo {
  color: var(--atencao-tinta);
}

.avisos--risco .avisos__titulo {
  color: var(--risco-tinta);
}

.avisos__titulo i {
  font-size: 18px;
}

.avisos__lista {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0 0 0 26px;
  list-style: disc;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.aviso::marker {
  color: var(--atencao-tinta);
}

.aviso--risco {
  font-weight: 600;
}

.aviso--risco::marker {
  color: var(--risco-tinta);
}

/* ---------------------------------------------------------------------- a dose para o peso */

.calculo {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid color-mix(in oklab, var(--pj-lugar, var(--clinica)) 30%, var(--linha));
  border-radius: 12px;
  background: color-mix(in oklab, var(--pj-lugar-fundo, var(--clinica-fundo)) 60%, var(--superficie));
}

.calculo__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.calculo__titulo i {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 18px;
}

.calculo__numeros {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 32px;
  margin: 0;
}

/* O número grande em cima, a legenda pequena embaixo — como o "46 min esperando" do Hoje. */
.calculo__numero {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-end;
  gap: 2px;
}

.calculo__numero dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.calculo__numero dd {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 0;
  white-space: nowrap;
}

.calculo__numero strong {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.calculo__numero--principal strong {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 26px;
}

.calculo__unidade {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 550;
}

.calculo__conta {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid color-mix(in oklab, var(--pj-lugar, var(--clinica)) 18%, var(--linha));
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.calculo__sem {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.calculo__sem i {
  color: var(--tinta-3);
  font-size: 18px;
}

/* --------------------------------------------------------------------- a dose por espécie */

.doses {
  display: grid;
  gap: 10px;
}

.doses__tabela {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}

.doses__tabela thead th {
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  text-align: start;
  white-space: nowrap;
}

.doses__linha > th,
.doses__linha > td {
  height: 48px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--linha);
  text-align: start;
  vertical-align: middle;
  white-space: nowrap;
}

/* Linha com nota embaixo: a divisória passa para baixo da nota. */
.doses__grupo:has(.doses__nota) .doses__linha > * {
  border-bottom: 0;
}

.doses__especie {
  font-weight: 600;
}

.doses__especie > span:first-child {
  margin-inline-end: 8px;
}

.doses__deste {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
  vertical-align: 1px;
}

.doses__faixa {
  font-size: 15px;
  font-weight: 650;
}

.doses__unidade {
  margin-inline-start: 4px;
  color: var(--tinta-2);
  font-size: 13px;
}

.doses__linha--paciente > * {
  background: color-mix(in oklab, var(--pj-lugar-fundo, var(--clinica-fundo)) 65%, var(--superficie));
}

.doses__linha--paciente > :first-child {
  box-shadow: inset 4px 0 0 var(--pj-lugar, var(--clinica));
}

/* A espécie em que o princípio é contraindicado: linha de risco, com a palavra e o porquê. */
.doses__linha--proibida > *,
.doses__nota--proibida > td {
  background: var(--risco-fundo);
}

.doses__linha--proibida > :first-child,
.doses__nota--proibida > td {
  box-shadow: inset 4px 0 0 var(--risco);
}

.doses__linha--proibida .doses__especie {
  color: var(--risco-tinta);
}

.doses__nota > td {
  padding: 0 12px 10px;
  border-bottom: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.doses__nota--proibida > td {
  color: var(--risco-tinta);
}

/* -------------------------------------------------------------------------------- vias */

.vias {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.vias__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vias__lista .ui-selo {
  color: var(--tinta);
}

/* ------------------------------------------------------------------------------ os blocos */

.blocos {
  display: grid;
  gap: 22px 28px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.bloco {
  display: grid;
  align-content: start;
  gap: 8px;
}

.bloco__titulo i {
  font-size: 18px;
}

.bloco--neutro .bloco__titulo i {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
}

.bloco--risco .bloco__titulo {
  color: var(--risco-tinta);
}

.bloco--atencao .bloco__titulo i {
  color: var(--atencao-tinta);
}

.bloco__lista {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0 0 0 20px;
  list-style: disc;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.bloco__lista li::marker {
  color: var(--tinta-3);
}

.bloco--risco .bloco__lista li::marker {
  color: var(--risco-tinta);
}

.bloco--atencao .bloco__lista li::marker {
  color: var(--atencao-tinta);
}

/* ------------------------------------------------------------------------- observação e pé */

.ficha__observacao {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.ficha__observacao i {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 17px;
}

.ficha__isencao {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.5;
}

.ficha__isencao i {
  margin-top: 2px;
  font-size: 14px;
}

/*
 * Coluna estreita (celular, o seletor em tela pequena): a tabela vira uma lista — cada espécie
 * com a faixa, o intervalo e a duração embaixo, com o rótulo de cada número escrito antes dele.
 */
@container (max-width: 520px) {
  .doses__tabela thead {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .doses__tabela,
  .doses__grupo,
  .doses__linha,
  .doses__nota,
  .doses__nota > td {
    display: block;
  }

  .doses__grupo {
    border-bottom: 1px solid var(--linha);
  }

  .doses__grupo:first-of-type {
    border-top: 1px solid var(--linha);
  }

  .doses__linha {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 10px;
  }

  .doses__tabela .doses__linha > th,
  .doses__tabela .doses__linha > td {
    display: block;
    height: auto;
    padding: 0;
    border-bottom: 0;
    background: none;
    box-shadow: none;
  }

  .doses__tabela .doses__linha > th {
    flex-basis: 100%;
    margin-bottom: 2px;
    white-space: normal;
  }

  .doses__linha > td[data-rotulo]::before {
    display: block;
    color: var(--tinta-2);
    content: attr(data-rotulo);
    font-family: var(--font-texto);
    font-size: 12px;
    font-weight: 500;
  }

  .doses__proibido {
    flex-basis: 100%;
  }

  .doses__linha--paciente {
    background: color-mix(in oklab, var(--pj-lugar-fundo, var(--clinica-fundo)) 65%, var(--superficie));
    box-shadow: inset 4px 0 0 var(--pj-lugar, var(--clinica));
  }

  .doses__linha--proibida {
    background: var(--risco-fundo);
    box-shadow: inset 4px 0 0 var(--risco);
  }

  .doses__nota > td {
    padding: 0 10px 10px;
    border-bottom: 0;
    box-shadow: none;
  }

  .doses__grupo:has(.doses__linha--proibida) .doses__nota > td {
    background: var(--risco-fundo);
    box-shadow: inset 4px 0 0 var(--risco);
  }

  .doses__grupo:has(.doses__linha--paciente) .doses__nota > td {
    background: color-mix(in oklab, var(--pj-lugar-fundo, var(--clinica-fundo)) 65%, var(--superficie));
    box-shadow: inset 4px 0 0 var(--pj-lugar, var(--clinica));
  }
}
</style>
