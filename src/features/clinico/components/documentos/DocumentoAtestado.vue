<script setup lang="ts">
/**
 * Atestado veterinário — A4.
 *
 * Dois documentos com a mesma moldura e finalidades diferentes:
 *
 * - **Atestado de saúde** — declara que o animal foi examinado na data e descreve o achado.
 *   Vale para viagem, hospedagem, creche, exposição, adoção.
 * - **Atestado de comparecimento** — declara que o responsável esteve na clínica acompanhando o
 *   animal, com hora de entrada e de saída. É o papel que justifica a ausência no trabalho.
 *
 * O texto do atestado de saúde **não inventa "clinicamente saudável"**. Ele afirma o que está no
 * prontuário: se há diagnóstico registrado, o diagnóstico entra; se o exame não encontrou
 * alteração, é isso que sai escrito. Atestar sanidade que ninguém registrou é o tipo de frase que
 * volta como problema no CRMV.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, Tutor } from '../../data/types'
import { clinicClock } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
  tipo: 'saude' | 'comparecimento'
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

const titulo = computed(() => t(`clinico.documentos.atestado.${props.tipo}.titulo`))

/**
 * Só diagnóstico **definitivo ou presuntivo** entra no atestado.
 *
 * Diferencial é hipótese em investigação — o que o profissional ainda está descartando. Atestar
 * "constatei displasia coxofemoral" quando a displasia é um diferencial afirma no papel algo que
 * o prontuário não afirma, e é o tipo de frase que volta como problema no CRMV.
 */
const diagnosticos = computed(() =>
  props.encounter.diagnosticos
    .filter((item) => item.kind !== 'diferencial')
    .map((item) => item.descricao)
    .filter(Boolean),
)

/**
 * A frase muda conforme o que o prontuário sabe — nunca conforme o que seria conveniente.
 */
const declaracao = computed(() => {
  if (props.tipo === 'comparecimento') {
    return t('clinico.documentos.atestado.comparecimento.corpo', {
      responsavel: props.tutor?.nome ?? '',
      paciente: props.pet?.nome ?? '',
      data: formato.dataPorExtenso(dataDoDocumento.value),
      entrada: formato.hora(props.encounter.abertoEm),
      saida: formato.hora(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
    })
  }

  if (diagnosticos.value.length > 0) {
    return t('clinico.documentos.atestado.saude.corpoComDiagnostico', {
      paciente: props.pet?.nome ?? '',
      data: formato.dataPorExtenso(dataDoDocumento.value),
      diagnostico: diagnosticos.value.join('; '),
    })
  }

  return t('clinico.documentos.atestado.saude.corpoSemAchado', {
    paciente: props.pet?.nome ?? '',
    data: formato.dataPorExtenso(dataDoDocumento.value),
  })
})

const observacoes = computed(() => props.encounter.conduta.orientacoes.trim())
</script>

<template>
  <DocumentoFolha
    :titulo="titulo"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    :mostrar-alertas="tipo === 'saude'"
  >
    <section class="corpo">
      <p class="corpo__texto">{{ declaracao }}</p>

      <p v-if="tipo === 'saude' && observacoes" class="corpo__texto">
        <strong>{{ t('clinico.documentos.atestado.saude.recomendacoes') }}</strong>
        {{ observacoes }}
      </p>

      <!--
        A finalidade fica em branco: quem escreve é quem vai usar o papel, e o motivo raramente
        é o mesmo do atendimento. Imprimir "para fins de viagem" sem ninguém ter dito inventaria
        a razão do documento.
      -->
      <p class="corpo__finalidade">
        <span>{{ t('clinico.documentos.atestado.finalidade') }}</span>
        <span class="corpo__linha" aria-hidden="true" />
      </p>
    </section>

    <template #antes-da-assinatura>
      <p class="corpo__valido">{{ t('clinico.documentos.atestado.rodape') }}</p>
    </template>
  </DocumentoFolha>
</template>

<style scoped>
.corpo {
  margin-top: 8mm;
}

.corpo__texto {
  margin: 0 0 5mm;
  font-size: 10.5pt;
  line-height: 1.8;
  text-align: justify;
}

.corpo__finalidade {
  display: flex;
  align-items: flex-end;
  gap: 3mm;
  margin: 10mm 0 0;
  font-size: 9pt;
}

.corpo__linha {
  display: block;
  height: 0;
  flex: 1 1 auto;
  border-bottom: 0.5pt solid #000;
}

.corpo__valido {
  margin: 0;
  font-size: 8pt;
  font-style: italic;
}
</style>
