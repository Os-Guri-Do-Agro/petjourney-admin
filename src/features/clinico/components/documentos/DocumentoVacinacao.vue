<script setup lang="ts">
/**
 * Comprovante de vacinação — A4.
 *
 * **Este documento é o mais incompleto do lote, e é honesto que seja.** O módulo registra
 * vacina como *tipo de atendimento* e como evento da linha do tempo, mas não guarda **lote,
 * fabricante nem validade** — e sem esses três o papel não serve para viagem nem para
 * condomínio, que são justamente as duas situações em que ele é pedido.
 *
 * O protótipo mostra a folha certa com os campos em branco, em vez de inventar números de lote.
 * Um comprovante com lote fictício é pior que um com lacuna: a lacuna se vê, o número inventado
 * não.
 *
 * Para fechar de verdade, falta modelar o registro de vacina — o que também destrava atestado
 * de viagem e o controle de reforço.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, TimelineEvent, Tutor } from '../../data/types'
import { clinicClock } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
  /** Eventos de vacina do paciente, da linha do tempo. */
  eventos: TimelineEvent[]
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

/** Da mais recente para a mais antiga: é a última dose que decide se está em dia. */
const vacinas = computed(() =>
  props.eventos
    .filter((evento) => evento.kind === 'vacina')
    .sort((a, b) => b.em.localeCompare(a.em)),
)
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.vacinacao.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    :mostrar-alertas="false"
    mostrar-endereco
  >
    <section class="bloco">
      <p>{{ t('clinico.documentos.vacinacao.declaracao', { paciente: pet?.nome ?? '' }) }}</p>
    </section>

    <table class="tabela">
      <thead>
        <tr>
          <th>{{ t('clinico.documentos.data') }}</th>
          <th>{{ t('clinico.documentos.vacinacao.vacina') }}</th>
          <th>{{ t('clinico.documentos.vacinacao.lote') }}</th>
          <th>{{ t('clinico.documentos.vacinacao.fabricante') }}</th>
          <th>{{ t('clinico.documentos.vacinacao.proxima') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="vacina in vacinas" :key="vacina.id">
          <td>{{ formato.dataCurta(clinicClock.dateOf(vacina.em)) }}</td>
          <td>{{ vacina.titulo || t('clinico.prontuario.timeline.kind.vacina') }}</td>
          <!--
            Lote, fabricante e reforço saem em branco: o módulo não guarda esses campos, e
            preenchê-los com algo plausível transformaria uma lacuna visível num erro invisível.
          -->
          <td class="vazia" />
          <td class="vazia" />
          <td class="vazia" />
        </tr>

        <!-- Linhas em branco para a clínica completar à mão enquanto o registro não existe. -->
        <tr v-for="n in Math.max(0, 6 - vacinas.length)" :key="`vazia-${n}`">
          <td class="vazia" />
          <td class="vazia" />
          <td class="vazia" />
          <td class="vazia" />
          <td class="vazia" />
        </tr>
      </tbody>
    </table>

    <p class="ressalva">{{ t('clinico.documentos.vacinacao.ressalva') }}</p>
  </DocumentoFolha>
</template>

<style scoped>
.bloco {
  margin-bottom: 4mm;
}

.bloco p {
  margin: 0;
  font-size: 10.5pt;
  line-height: 1.6;
}

.tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
}

.tabela th,
.tabela td {
  padding: 2mm 2mm;
  border: 0.25mm solid #000;
  text-align: left;
}

.tabela th {
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Célula sem dado tem altura de escrita à mão, não altura de texto. */
.vazia {
  height: 7mm;
}

.ressalva {
  margin: 3mm 0 0;
  font-size: 9pt;
  font-style: italic;
  line-height: 1.5;
}
</style>
