<script setup lang="ts">
/**
 * Declaração de óbito — A4.
 *
 * Necessária para cremação e sepultamento, e às vezes para condomínio e seguro. É o documento
 * emitido no pior momento possível, e por isso é o que menos pode dar trabalho: hoje costuma
 * ser escrito à mão numa folha timbrada enquanto o responsável espera na recepção chorando.
 *
 * Duas exigências que o papel precisa cumprir e que a pressa faz esquecer:
 *
 * - **Identificação inequívoca do animal.** A crematória precisa saber que o corpo que recebeu
 *   é o do documento. Espécie, raça, sexo, pelagem e microchip quando houver — e agora eles saem
 *   do cadastro, em vez de virarem sempre linha em branco para preencher à mão.
 * - **Causa declarada, não presumida.** Sem necropsia, a causa é *provável* — e o documento
 *   precisa dizer isso com todas as letras. Afirmar causa que ninguém confirmou é o tipo de
 *   frase que volta como problema.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, Tutor } from '../../data/types'
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

/** Causa provável: sai do diagnóstico registrado, e o texto diz que é provável. */
const causa = computed(() => {
  const diagnosticos = props.encounter.diagnosticos
    .filter((item) => item.kind !== 'diferencial')
    .map((item) => clinico.descricaoDoDiagnostico(item))

  return diagnosticos.join(' · ')
})
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.obito.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    :mostrar-alertas="false"
    mostrar-endereco
  >
    <section class="bloco">
      <p class="declaracao">
        {{
          t('clinico.documentos.obito.declaracao', {
            paciente: pet?.nome ?? '',
            especie: pet ? formato.especie(pet.especie) : '',
            raca: pet?.raca ?? '',
            sexo: pet ? t(`clinico.sexo.${pet.sexo}`) : '',
            idade: pet ? formato.idade(pet.nascimento) : '',
            responsavel: tutor?.nome ?? '',
          })
        }}
      </p>
    </section>

    <!--
      Data e hora do óbito ficam em branco: o atendimento pode ter terminado antes, e datar por
      ele produziria um documento que contradiz o horário real.
    -->
    <section class="bloco">
      <h2>{{ t('clinico.documentos.obito.quando') }}</h2>
      <div class="campos">
        <span class="campo">
          <span class="campo__rotulo">{{ t('clinico.documentos.data') }}</span>
          <span class="campo__linha" aria-hidden="true" />
        </span>
        <span class="campo">
          <span class="campo__rotulo">{{ t('clinico.documentos.obito.hora') }}</span>
          <span class="campo__linha" aria-hidden="true" />
        </span>
      </div>
    </section>

    <section class="bloco">
      <h2>{{ t('clinico.documentos.obito.causa') }}</h2>
      <p v-if="causa">{{ causa }}</p>
      <p v-else class="campo__linha campo__linha--larga" aria-hidden="true" />
      <p class="ressalva">{{ t('clinico.documentos.obito.semNecropsia') }}</p>
    </section>

    <!--
      Microchip e pelagem saem do cadastro quando ele os tem, e viram linha em branco quando não.

      A linha em branco não é preguiça: é o documento admitindo que o dado não existe, para quem
      assina preencher à mão em vez de assinar um campo que alguém deduziu. O que mudou é que a
      linha deixou de ser o caso normal — até agora ela era o único caso, porque o cadastro não
      perguntava o número do transponder.
    -->
    <section class="bloco">
      <h2>{{ t('clinico.documentos.obito.identificacao') }}</h2>
      <div class="campos">
        <span class="campo">
          <span class="campo__rotulo">{{ t('clinico.documentos.obito.microchip') }}</span>
          <span v-if="pet?.microchip" class="campo__valor">{{ pet.microchip }}</span>
          <span v-else class="campo__linha" aria-hidden="true" />
        </span>
        <span class="campo">
          <span class="campo__rotulo">{{ t('clinico.documentos.obito.pelagem') }}</span>
          <span v-if="pet?.pelagem" class="campo__valor">{{ pet.pelagem }}</span>
          <span v-else class="campo__linha" aria-hidden="true" />
        </span>
      </div>
    </section>

    <section class="bloco">
      <h2>{{ t('clinico.documentos.obito.destinacao') }}</h2>
      <ul class="opcoes">
        <li v-for="chave in ['cremacao-individual', 'cremacao-coletiva', 'sepultamento', 'retirado']" :key="chave">
          <span class="marca" aria-hidden="true" />
          {{ t(`clinico.documentos.obito.destino.${chave}`) }}
        </li>
      </ul>
    </section>
  </DocumentoFolha>
</template>

<style scoped>
.bloco {
  margin-bottom: 5mm;
}

.bloco h2 {
  margin: 0 0 2mm;
  font-size: 9.5pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bloco p {
  margin: 0 0 1.5mm;
  font-size: 10.5pt;
  line-height: 1.6;
}

.declaracao {
  font-size: 11pt;
  line-height: 1.8;
  text-align: justify;
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
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.campo__linha {
  display: block;
  height: 5mm;
  border-bottom: 0.3mm solid #000;
}

/* Mesma altura da linha em branco: os dois campos se alinham preenchido ou não. */
.campo__valor {
  display: block;
  height: 5mm;
  font-size: 10pt;
  line-height: 5mm;
}

.campo__linha--larga {
  width: 100%;
}

.ressalva {
  font-size: 9pt;
  font-style: italic;
}

.opcoes {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 10pt;
  line-height: 1.8;
}

.opcoes li {
  display: flex;
  align-items: center;
  gap: 3mm;
}

.marca {
  width: 4mm;
  height: 4mm;
  border: 0.4mm solid #000;
}
</style>
