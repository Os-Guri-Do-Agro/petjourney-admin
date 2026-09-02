<script setup lang="ts">
/**
 * Comprovante de vacinação — A4.
 *
 * Passou a ler o **registro de vacinação de verdade**: lote, fabricante, dose da série e a data
 * do reforço saem da aplicação gravada, não de campos em branco. É o que faz este papel valer
 * para viagem e condomínio, que são as duas situações em que ele é pedido.
 *
 * As linhas em branco ao final continuam existindo de propósito: clínica que migra de sistema
 * traz carteira de papel, e a folha precisa aceitar o histórico anterior escrito à mão.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { vacinaRepository } from '../../data/repositories'
import type { AplicacaoVacina, Encounter, Pet, Tutor } from '../../data/types'
import { clinicClock } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
  /** Aplicações registradas do paciente. */
  aplicacoes: AplicacaoVacina[]
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

const catalogo = vacinaRepository.catalogo()

/** Da mais recente para a mais antiga: é a última dose que decide se está em dia. */
const vacinas = computed(() =>
  [...props.aplicacoes]
    .sort((a, b) => b.aplicadaEm.localeCompare(a.aplicadaEm))
    .map((aplicacao) => {
      const vacina = catalogo.find((item) => item.id === aplicacao.vacinaId)

      return {
        id: aplicacao.id,
        data: clinicClock.dateOf(aplicacao.aplicadaEm),
        nome: vacina?.nome ?? aplicacao.vacinaId,
        fabricante: vacina?.fabricante ?? '',
        lote: aplicacao.lote,
        proxima: aplicacao.proximaDoseEm,
      }
    }),
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
          <td>{{ formato.dataCurta(vacina.data) }}</td>
          <td>{{ vacina.nome }}</td>
          <td>{{ vacina.lote }}</td>
          <td>{{ vacina.fabricante }}</td>
          <td>{{ formato.dataCurta(vacina.proxima) }}</td>
        </tr>

        <!--
          Linhas em branco para o histórico anterior à migração: clínica que troca de sistema
          traz carteira de papel, e a folha precisa aceitá-la escrita à mão.
        -->
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
