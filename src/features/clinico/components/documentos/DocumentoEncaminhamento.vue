<script setup lang="ts">
/**
 * Encaminhamento ao especialista — A4.
 *
 * Carta de referência entre colegas. Hoje isso é feito reescrevendo o caso à mão ou mandando
 * foto do prontuário no WhatsApp — e o especialista recebe ou de menos (uma linha) ou de mais
 * (quatro páginas com tudo, inclusive o que não interessa).
 *
 * O que um colega precisa, nesta ordem: **o que já foi feito**, **o que se encontrou** e **o que
 * se quer dele**. O histórico completo continua disponível se ele pedir; a carta é o recorte.
 *
 * O campo de especialidade fica em branco de propósito no protótipo — quem encaminha escolhe
 * na hora, e uma lista fechada de especialidades exigiria um cadastro que a clínica ainda não
 * tem.
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

const VITAIS: VitalKey[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'pressaoSistolica',
]

/** Só o que foi aferido. Vital em branco numa carta de referência é ruído. */
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

/** Sistemas alterados — é o achado que motiva o encaminhamento, não a lista dos oito. */
const alterados = computed(() =>
  Object.entries(props.encounter.exameFisico.sistemas)
    .filter(([, achado]) => achado.status === 'alterado')
    .map(([sistema, achado]) => ({
      sistema,
      rotulo: t(`clinico.prontuario.exameFisico.sistema.${sistema}`),
      nota: achado.nota,
    })),
)

const diagnosticos = computed(() =>
  props.encounter.diagnosticos.map((item) => ({
    id: item.id,
    texto: clinico.descricaoDoDiagnostico(item),
    kind: t(`clinico.prontuario.diagnostico.tipo.${item.kind}`),
  })),
)

const medicacoes = computed(() =>
  props.encounter.conduta.prescricoes
    .map((prescricao) => clinico.medicamento(prescricao.calculo.medicamentoId)?.nome)
    .filter(Boolean),
)
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.encaminhamento.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
  >
    <!-- Destinatário em branco: quem encaminha escreve o nome do colega à mão ou digita antes. -->
    <section class="bloco">
      <h2>{{ t('clinico.documentos.encaminhamento.para') }}</h2>
      <p class="linha-vazia" aria-hidden="true" />
      <p class="dica">{{ t('clinico.documentos.encaminhamento.paraDica') }}</p>
    </section>

    <section class="bloco">
      <h2>{{ t('clinico.documentos.encaminhamento.motivo') }}</h2>
      <p>{{ encounter.anamnese.queixaPrincipal || '—' }}</p>
      <p v-if="encounter.anamnese.duracaoSintomas">
        {{ t('clinico.prontuario.anamnese.duracaoSintomas') }}:
        {{ encounter.anamnese.duracaoSintomas }}
        <template v-if="encounter.anamnese.evolucao">
          ·
          {{ t(`clinico.prontuario.anamnese.evolucaoOpcoes.${encounter.anamnese.evolucao}`) }}
        </template>
      </p>
    </section>

    <section v-if="encounter.anamnese.antecedentes.length > 0" class="bloco">
      <h2>{{ t('clinico.prontuario.anamnese.antecedentes') }}</h2>
      <ul class="lista">
        <li v-for="ant in encounter.anamnese.antecedentes" :key="ant.id">
          {{ t(`clinico.prontuario.anamnese.antecedenteKind.${ant.kind}`) }}:
          {{ ant.descricao }}
          <template v-if="ant.quando"> ({{ ant.quando }})</template>
        </li>
      </ul>
    </section>

    <section v-if="vitais.length > 0 || alterados.length > 0" class="bloco">
      <h2>{{ t('clinico.documentos.encaminhamento.achados') }}</h2>

      <p v-if="vitais.length > 0" class="vitais">
        <span v-for="item in vitais" :key="item.vital">
          {{ item.rotulo }}: <strong>{{ item.valor }}</strong>
        </span>
      </p>

      <ul v-if="alterados.length > 0" class="lista">
        <li v-for="item in alterados" :key="item.sistema">
          <strong>{{ item.rotulo }}</strong>
          <template v-if="item.nota"> — {{ item.nota }}</template>
        </li>
      </ul>
    </section>

    <section v-if="diagnosticos.length > 0" class="bloco">
      <h2>{{ t('clinico.prontuario.diagnostico.titulo') }}</h2>
      <ul class="lista">
        <li v-for="item in diagnosticos" :key="item.id">
          {{ item.texto }} <span class="kind">{{ item.kind }}</span>
        </li>
      </ul>
    </section>

    <section v-if="medicacoes.length > 0" class="bloco">
      <h2>{{ t('clinico.documentos.encaminhamento.emUso') }}</h2>
      <p>{{ medicacoes.join(' · ') }}</p>
    </section>

    <!--
      O pedido explícito fecha a carta. Sem ele, o especialista recebe um caso e não sabe se
      quem encaminha quer uma opinião, um exame ou que ele assuma o paciente.
    -->
    <section class="bloco">
      <h2>{{ t('clinico.documentos.encaminhamento.solicito') }}</h2>
      <p class="linha-vazia" aria-hidden="true" />
      <p class="linha-vazia" aria-hidden="true" />
    </section>

    <template #antes-da-assinatura>
      <p class="disponivel">{{ t('clinico.documentos.encaminhamento.disponivel') }}</p>
    </template>
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
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bloco p {
  margin: 0 0 1mm;
  font-size: 10pt;
  line-height: 1.5;
}

.lista {
  margin: 0;
  padding-inline-start: 5mm;
  font-size: 10pt;
  line-height: 1.6;
}

.vitais span:not(:last-child)::after {
  content: ' · ';
}

.kind {
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Linha para preencher à caneta: o destinatário e o pedido mudam a cada encaminhamento. */
.linha-vazia {
  height: 5mm;
  border-bottom: 0.3mm solid #000;
}

.dica {
  font-size: 8.5pt;
  font-style: italic;
}

.disponivel {
  margin: 0 0 4mm;
  font-size: 9.5pt;
  font-style: italic;
}
</style>
