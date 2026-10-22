<script setup lang="ts">
/**
 * Relatório para plano de saúde pet — A4.
 *
 * Mercado que cresceu rápido e trouxe uma burocracia nova para a clínica: a operadora só
 * reembolsa mediante justificativa clínica, e recusa relatório genérico. Hoje o vet reescreve
 * o caso num formulário da operadora, a partir do prontuário que ele acabou de preencher.
 *
 * O que a operadora exige, e que o prontuário completo não organiza nessa ordem: **queixa**,
 * **achados objetivos**, **diagnóstico** e **a justificativa de cada item cobrado**. A última é
 * a que decide o reembolso — "hemograma" é recusado; "hemograma para investigar anemia em
 * paciente com mucosas pálidas" não é.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, Tutor, VitalKey } from '../../data/types'
import { medicaoPreenchida } from '../../domain/ranges'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

const VITAIS: VitalKey[] = ['peso', 'temperatura', 'frequenciaCardiaca', 'frequenciaRespiratoria']

const vitais = computed(() =>
  VITAIS.filter((vital) => medicaoPreenchida(props.encounter.exameFisico.vitais[vital])).map(
    (vital) => ({
      vital,
      rotulo: t(`clinico.prontuario.exameFisico.${vital}`),
      valor: formato.medicao(
        props.encounter.exameFisico.vitais[vital],
        clinico.faixaDoPaciente(vital, props.pet),
      ),
    }),
  ),
)

const diagnosticos = computed(() =>
  props.encounter.diagnosticos.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    texto: clinico.descricaoDoDiagnostico(item),
  })),
)

/**
 * Cada item cobrável com a linha de justificativa ao lado.
 *
 * A justificativa fica em branco de propósito: ela é escrita caso a caso, e um texto genérico
 * gerado automaticamente é exatamente o que a operadora recusa.
 */
const itens = computed(() => {
  const lista: Array<{ id: string; descricao: string }> = []

  for (const id of props.encounter.conduta.examesSolicitados) {
    const exame = clinico.exames.find((item) => item.id === id)

    if (exame) {
      lista.push({ id: `exame-${exame.id}`, descricao: exame.nome })
    }
  }

  for (const prescricao of props.encounter.conduta.prescricoes) {
    const medicamento = clinico.medicamento(prescricao.calculo.medicamentoId)

    if (medicamento) {
      lista.push({ id: `med-${prescricao.id}`, descricao: medicamento.nome })
    }
  }

  return lista
})
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.relatorioPlano.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    mostrar-endereco
  >
    <!-- Operadora e número da apólice em branco: o módulo não guarda plano do paciente. -->
    <section class="bloco">
      <div class="campos">
        <span class="campo">
          <span class="campo__rotulo">{{ t('clinico.documentos.relatorioPlano.operadora') }}</span>
          <span class="campo__linha" aria-hidden="true" />
        </span>
        <span class="campo">
          <span class="campo__rotulo">{{ t('clinico.documentos.relatorioPlano.apolice') }}</span>
          <span class="campo__linha" aria-hidden="true" />
        </span>
      </div>
    </section>

    <section class="bloco">
      <h2>{{ t('clinico.documentos.relatorioPlano.quadro') }}</h2>
      <p>{{ encounter.anamnese.queixaPrincipal || '-' }}</p>
      <p v-if="encounter.anamnese.duracaoSintomas">
        {{ t('clinico.prontuario.anamnese.duracaoSintomas') }}:
        {{ encounter.anamnese.duracaoSintomas }}
      </p>
    </section>

    <section v-if="vitais.length > 0" class="bloco">
      <h2>{{ t('clinico.documentos.relatorioPlano.achados') }}</h2>
      <p class="vitais">
        <span v-for="item in vitais" :key="item.vital">
          {{ item.rotulo }}: <strong>{{ item.valor }}</strong>
        </span>
      </p>
    </section>

    <section v-if="diagnosticos.length > 0" class="bloco">
      <h2>{{ t('clinico.prontuario.diagnostico.titulo') }}</h2>
      <ul class="lista">
        <li v-for="item in diagnosticos" :key="item.id">
          <strong>{{ item.codigo }}:</strong> {{ item.texto }}
        </li>
      </ul>
    </section>

    <section v-if="itens.length > 0" class="bloco">
      <h2>{{ t('clinico.documentos.relatorioPlano.itens') }}</h2>
      <table class="tabela">
        <thead>
          <tr>
            <th>{{ t('clinico.documentos.orcamento.item') }}</th>
            <th>{{ t('clinico.documentos.relatorioPlano.justificativa') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in itens" :key="item.id">
            <td>{{ item.descricao }}</td>
            <!-- Justificativa é escrita caso a caso: texto automático é o que a operadora recusa. -->
            <td class="vazia" />
          </tr>
        </tbody>
      </table>
    </section>
  </DocumentoFolha>
</template>

<style scoped>
.bloco {
  margin-bottom: 5mm;
}

.bloco h2 {
  margin: 0 0 1.5mm;
  font-size: 9.5pt;
  font-weight: 700;
}

.bloco p {
  margin: 0 0 1mm;
  font-size: 10pt;
  line-height: 1.5;
}

.campos {
  display: flex;
  gap: 8mm;
}

.campo {
  flex: 1;
}

.campo__rotulo {
  display: block;
  font-size: 8.5pt;
  font-weight: 600;
}

.campo__linha {
  display: block;
  height: 5mm;
  border-bottom: 0.3mm solid #000;
}

.vitais span:not(:last-child)::after {
  content: ' · ';
}

.lista {
  margin: 0;
  padding-inline-start: 5mm;
  font-size: 10pt;
  line-height: 1.6;
}

.tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
}

.tabela th,
.tabela td {
  padding: 2mm;
  border: 0.25mm solid #000;
  text-align: start;
}

.tabela th {
  font-size: 8.5pt;
  font-weight: 700;
}

.vazia {
  height: 9mm;
}
</style>
