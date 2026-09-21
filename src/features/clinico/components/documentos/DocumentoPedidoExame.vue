<script setup lang="ts">
/**
 * Pedido de exame — A4.
 *
 * O dado já estava no prontuário (`conduta.examesSolicitados`) e não saía de lá: o responsável
 * ia ao laboratório sem papel nenhum, ou levava o prontuário inteiro de quatro páginas para um
 * balcão que só precisa de três linhas.
 *
 * O que o laboratório precisa e o prontuário completo não destaca: **quem pediu**, **para qual
 * paciente** e **a suspeita clínica**. A última é a que muda o exame — hemograma pedido para
 * investigar anemia e hemograma pré-cirúrgico são a mesma coleta com leituras diferentes, e sem
 * a indicação o laudo volta genérico.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import type { Encounter, Pet, Tutor } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
}>()

const { t } = useI18n()
const clinico = useClinicoStore()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

const exames = computed(() =>
  props.encounter.conduta.examesSolicitados
    .map((id) => clinico.exames.find((exame) => exame.id === id))
    .filter((exame): exame is NonNullable<typeof exame> => Boolean(exame)),
)

/**
 * A suspeita que justifica o pedido.
 *
 * Diferencial **entra** aqui, ao contrário do atestado: no pedido de exame a hipótese em
 * investigação é exatamente o que se quer confirmar ou descartar, e omiti-la faria o laboratório
 * trabalhar às cegas. No atestado ela não entra porque lá o papel afirma um fato.
 */
const suspeita = computed(() => {
  const diagnosticos = props.encounter.diagnosticos.map((item) =>
    clinico.descricaoDoDiagnostico(item),
  )

  return diagnosticos.length > 0
    ? diagnosticos.join(' · ')
    : props.encounter.anamnese.queixaPrincipal
})

/** Jejum é a pergunta que o balcão sempre faz e que o papel raramente responde. */
const pedeJejum = computed(() =>
  exames.value.some((exame) => exame.grupo === 'laboratorio'),
)
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.pedidoExame.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
  >
    <section class="bloco">
      <h2>{{ t('clinico.documentos.pedidoExame.solicito') }}</h2>

      <ol v-if="exames.length > 0" class="lista">
        <li v-for="exame in exames" :key="exame.id">
          <strong>{{ exame.nome }}</strong>
          <span class="grupo">{{ t(`clinico.documentos.pedidoExame.grupo.${exame.grupo}`) }}</span>
        </li>
      </ol>

      <p v-else class="vazio">{{ t('clinico.documentos.pedidoExame.vazio') }}</p>
    </section>

    <section v-if="suspeita" class="bloco">
      <h2>{{ t('clinico.documentos.pedidoExame.indicacao') }}</h2>
      <p>{{ suspeita }}</p>
    </section>

    <!--
      Peso e espécie no corpo, e não só na identificação: o laboratório usa os dois para escolher
      tubo e volume de coleta, e reler o cabeçalho no meio de uma coleta é o que ninguém faz.
    -->
    <section class="bloco">
      <h2>{{ t('clinico.documentos.pedidoExame.coleta') }}</h2>
      <p v-if="pedeJejum">{{ t('clinico.documentos.pedidoExame.jejum') }}</p>
      <p>{{ t('clinico.documentos.pedidoExame.contato', { telefone: clinico.clinic?.telefone }) }}</p>
    </section>
  </DocumentoFolha>
</template>

<style scoped>
.bloco {
  margin-bottom: 6mm;
}

.bloco h2 {
  margin: 0 0 2mm;
  font-size: 10pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bloco p {
  margin: 0 0 1.5mm;
  font-size: 10pt;
  line-height: 1.5;
}

.lista {
  margin: 0;
  padding-inline-start: 6mm;
  font-size: 11pt;
  line-height: 1.7;
}

.lista strong {
  font-weight: 700;
}

/* O grupo do exame vai entre parênteses, discreto: orienta o balcão sem competir com o nome. */
.grupo {
  margin-inline-start: 2mm;
  font-size: 9pt;
}

.grupo::before {
  content: '(';
}

.grupo::after {
  content: ')';
}

.vazio {
  font-style: italic;
}
</style>
