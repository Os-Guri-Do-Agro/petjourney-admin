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
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Medication, Pet } from '../../data/types'
import { avisosDoMedicamento } from '../../domain/bulario'

const props = withDefaults(
  defineProps<{
    medicamento: Medication
    pet?: Pet | null
  }>(),
  { pet: null },
)

const { t } = useI18n()
const formato = useClinicFormat()

const avisos = computed(() => avisosDoMedicamento(props.medicamento, props.pet, new Date()))

const doses = computed(() =>
  props.medicamento.doses.map((dose) => ({
    ...dose,
    doPaciente: props.pet?.especie === dose.especie,
  })),
)

const blocos = computed(() =>
  [
    { id: 'indicacoes', itens: props.medicamento.indicacoes, tom: 'neutro' },
    { id: 'contraindicacoes', itens: props.medicamento.contraindicacoes, tom: 'risco' },
    { id: 'efeitosAdversos', itens: props.medicamento.efeitosAdversos, tom: 'atencao' },
    { id: 'interacoes', itens: props.medicamento.interacoes, tom: 'neutro' },
  ].filter((bloco) => bloco.itens.length > 0),
)

function textoDoAviso(kind: string, cuidado: string | null, detalhe: string) {
  if (kind === 'cuidado' && cuidado) {
    return t(`clinico.bulario.cuidado.${cuidado}`, { detalhe })
  }

  return t(`clinico.bulario.aviso.${kind}`, { detalhe })
}

function faixa(minimo: number, maximo: number) {
  return minimo === maximo
    ? formato.numero(minimo, 2)
    : `${formato.numero(minimo, 2)}–${formato.numero(maximo, 2)}`
}
</script>

<template>
  <article class="ficha clinic-scope">
    <header class="ficha__topo">
      <div class="ficha__identidade">
        <h2>{{ medicamento.nome }}</h2>
        <p>{{ medicamento.apresentacao }}</p>
      </div>

      <div class="ficha__marcas">
        <span class="marca">{{ t(`clinico.bulario.classe.${medicamento.classe}`) }}</span>
        <span v-if="medicamento.controlado" class="marca marca--controle">
          <i class="pi pi-lock" aria-hidden="true" />
          {{ t('clinico.bulario.controlado') }}
        </span>
      </div>
    </header>

    <!-- O que impede vem primeiro, antes de qualquer número. -->
    <section v-if="avisos.length > 0" class="avisos">
      <h3 class="clinic-label">
        {{ t('clinico.bulario.avisosDoPaciente', { nome: pet?.nome ?? '' }) }}
      </h3>

      <p
        v-for="(aviso, indice) in avisos"
        :key="`${aviso.kind}-${aviso.cuidado ?? indice}`"
        class="aviso"
        :class="{
          'aviso--risco': aviso.kind === 'especie-proibida' || aviso.kind === 'alergia',
        }"
      >
        <i
          :class="
            aviso.kind === 'especie-proibida' || aviso.kind === 'alergia'
              ? 'pi pi-exclamation-triangle'
              : 'pi pi-info-circle'
          "
          aria-hidden="true"
        />
        <span>{{ textoDoAviso(aviso.kind, aviso.cuidado, aviso.detalhe) }}</span>
      </p>
    </section>

    <section class="doses">
      <h3 class="clinic-label">{{ t('clinico.bulario.doseTitulo') }}</h3>

      <table class="doses__tabela">
        <thead>
          <tr>
            <th scope="col">{{ t('clinico.bulario.doseEspecie') }}</th>
            <th scope="col">{{ t('clinico.bulario.doseFaixa') }}</th>
            <th scope="col">{{ t('clinico.bulario.doseIntervalo') }}</th>
            <th scope="col">{{ t('clinico.bulario.doseDuracao') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dose in doses" :key="dose.especie">
            <tr :class="{ 'doses__linha--paciente': dose.doPaciente }">
              <th scope="row">
                {{ formato.especie(dose.especie) }}
                <span v-if="dose.doPaciente" class="doses__marca">
                  {{ t('clinico.bulario.destePaciente') }}
                </span>
              </th>
              <td v-if="dose.proibido" class="doses__proibido" colspan="3">
                {{ t('clinico.bulario.doseProibida') }}
              </td>
              <template v-else>
                <td class="clinic-value">{{ faixa(dose.mgPorKg.min, dose.mgPorKg.max) }} mg/kg</td>
                <td class="clinic-value">
                  {{ t('clinico.bulario.cadaHoras', { horas: dose.frequenciaHoras }) }}
                </td>
                <td class="clinic-value">
                  {{ t('clinico.formato.dias', { valor: dose.duracaoUsualDias }, dose.duracaoUsualDias) }}
                </td>
              </template>
            </tr>
            <tr v-if="dose.nota" class="doses__nota">
              <td colspan="4">{{ dose.nota }}</td>
            </tr>
          </template>
        </tbody>
      </table>

      <p class="doses__vias">
        <span class="clinic-label">{{ t('clinico.bulario.vias') }}</span>
        {{ medicamento.viasPermitidas.map((via) => t(`clinico.prontuario.conduta.via_.${via}`)).join(' · ') }}
      </p>
    </section>

    <section v-for="bloco in blocos" :key="bloco.id" class="bloco">
      <h3 class="clinic-label">{{ t(`clinico.bulario.${bloco.id}`) }}</h3>
      <ul :class="`bloco__lista bloco__lista--${bloco.tom}`">
        <li v-for="item in bloco.itens" :key="item">{{ item }}</li>
      </ul>
    </section>

    <p v-if="medicamento.observacao" class="ficha__observacao">
      <i class="pi pi-comment" aria-hidden="true" />
      {{ medicamento.observacao }}
    </p>

    <p class="ficha__isencao">{{ t('clinico.bulario.isencao') }}</p>
  </article>
</template>

<style scoped>
.ficha {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-4);
}

.ficha__topo {
  display: grid;
  gap: var(--clinic-space-2);
}

.ficha__identidade h2 {
  margin: 0;
  color: var(--clinic-text);
  font-size: 1.15rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.ficha__identidade p {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.ficha__marcas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.marca {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.55rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.marca--controle {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.marca i {
  font-size: 0.62rem;
}

.avisos {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-text);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-attention-bg);
}

.aviso {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
  line-height: 1.45;
}

.aviso--risco {
  color: var(--clinic-risk-text);
}

.aviso i {
  margin-top: 0.12rem;
  font-size: 0.75rem;
}

.doses {
  display: grid;
  gap: var(--clinic-space-2);
}

.doses__tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--clinic-font-label);
}

.doses__tabela th,
.doses__tabela td {
  padding: 0.38rem 0.5rem;
  border-bottom: 1px solid var(--clinic-line-soft);
  text-align: start;
}

.doses__tabela thead th {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.doses__tabela tbody th {
  color: var(--clinic-text);
  font-weight: 700;
  white-space: nowrap;
}

.doses__linha--paciente {
  background: var(--clinic-accent-tint);
}

.doses__marca {
  margin-inline-start: 0.35rem;
  padding: 0 0.35rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
  font-size: 0.62rem;
  font-weight: 800;
}

.doses__proibido {
  color: var(--clinic-risk-text);
  font-weight: 750;
}

.doses__nota td {
  padding-top: 0;
  border-bottom: 1px solid var(--clinic-line-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

.doses__vias {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-2);
}

.bloco__lista {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bloco__lista li {
  padding-inline-start: 1rem;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
  text-indent: -1rem;
}

.bloco__lista li::before {
  margin-inline-end: 0.5rem;
  content: '•';
}

.bloco__lista--risco li::before {
  color: var(--clinic-risk-text);
}

.bloco__lista--atencao li::before {
  color: var(--clinic-attention-text);
}

.bloco__lista--neutro li::before {
  color: var(--clinic-accent-strong);
}

.ficha__observacao {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  padding: var(--clinic-space-3);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.ficha__observacao i {
  margin-top: 0.12rem;
  font-size: 0.75rem;
}

.ficha__isencao {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}
</style>
