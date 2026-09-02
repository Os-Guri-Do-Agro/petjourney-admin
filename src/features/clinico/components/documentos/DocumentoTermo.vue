<script setup lang="ts">
/**
 * Termos assinados pelo responsável — A4.
 *
 * Três documentos numa estrutura só, porque a estrutura é a mesma e é ela que dá valor ao
 * papel: **texto declaratório, o que está em jogo, e duas assinaturas**. O que muda é a
 * gravidade do texto.
 *
 * - **Consentimento** — autoriza procedimento, anestesia ou cirurgia. É o documento que a
 *   clínica mais precisa ter arquivado e mais esquece de colher.
 * - **Recusa** — o responsável não autoriza o que foi indicado. Sem ele, a recusa vira palavra
 *   contra palavra numa reclamação no CRMV.
 * - **Eutanásia** — o mais delicado. Exige identificação inequívoca do animal e declaração de
 *   que a decisão foi tomada com esclarecimento.
 *
 * **A assinatura do responsável é a que importa aqui**, e por isso ela vem primeiro no rodapé —
 * ao contrário de todos os outros documentos do módulo, onde quem assina é o profissional. Um
 * termo com só a assinatura do vet não é um termo: é uma declaração dele sobre o que a outra
 * pessoa teria dito.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import type { TermoKind } from './documento-types'
import type { Encounter, Pet, Tutor } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
  kind: TermoKind
}>()

const { t } = useI18n()
const clinico = useClinicoStore()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

const titulo = computed(() => t(`clinico.documentos.termo.${props.kind}.titulo`))

/**
 * O que está sendo autorizado ou recusado.
 *
 * Sai do diagnóstico quando há um, e da queixa quando não há. Deixar em branco produziria um
 * termo genérico — e termo genérico não protege ninguém, porque não diz a que se refere.
 */
const objeto = computed(() => {
  const diagnosticos = props.encounter.diagnosticos
    .filter((item) => item.kind !== 'diferencial')
    .map((item) => clinico.descricaoDoDiagnostico(item))

  return diagnosticos.length > 0
    ? diagnosticos.join(' · ')
    : props.encounter.anamnese.queixaPrincipal
})

/** Os riscos que o texto obriga a declarar. Lista curta e por extenso, nunca "etc". */
const itens = computed<string[]>(() => {
  const chave = `clinico.documentos.termo.${props.kind}.itens`
  const lista = t(chave)

  /* A tradução guarda os itens separados por `|`: um array por idioma seria pior de manter. */
  return lista === chave ? [] : lista.split('|')
})
</script>

<template>
  <DocumentoFolha
    :titulo="titulo"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    :carimbo="kind === 'eutanasia' ? t('clinico.documentos.termo.eutanasia.carimbo') : ''"
  >
    <section class="bloco">
      <p class="declaracao">
        {{
          t(`clinico.documentos.termo.${kind}.declaracao`, {
            responsavel: tutor?.nome ?? '',
            paciente: pet?.nome ?? '',
            objeto: objeto || t('clinico.documentos.termo.objetoIndefinido'),
          })
        }}
      </p>
    </section>

    <section v-if="itens.length > 0" class="bloco">
      <h2>{{ t(`clinico.documentos.termo.${kind}.itensTitulo`) }}</h2>
      <ol class="itens">
        <li v-for="(item, indice) in itens" :key="indice">{{ item }}</li>
      </ol>
    </section>

    <!--
      Espaço em branco para o profissional detalhar o procedimento específico. Um termo de
      consentimento que não nomeia o que será feito vale menos que nenhum.
    -->
    <section class="bloco">
      <h2>{{ t('clinico.documentos.termo.detalhamento') }}</h2>
      <p class="linha-vazia" aria-hidden="true" />
      <p class="linha-vazia" aria-hidden="true" />
      <p class="linha-vazia" aria-hidden="true" />
    </section>

    <section class="bloco">
      <p class="ciencia">{{ t(`clinico.documentos.termo.${kind}.ciencia`) }}</p>
    </section>

    <template #antes-da-assinatura>
      <!--
        A assinatura do responsável vem **antes** da do profissional, e é a única razão de este
        documento existir. Nos outros papéis do módulo quem assina é o vet; aqui ele é
        testemunha do que a outra pessoa decidiu.
      -->
      <div class="responsavel">
        <span class="responsavel__linha" aria-hidden="true" />
        <p class="responsavel__nome">{{ tutor?.nome }}</p>
        <p class="responsavel__papel">
          {{ t('clinico.paciente.responsavel') }}
          <template v-if="tutor?.documento">
            · {{ t('clinico.prontuario.impressao.documento') }} {{ tutor.documento }}
          </template>
        </p>
      </div>
    </template>
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

.declaracao {
  margin: 0;
  font-size: 11pt;
  line-height: 1.7;
  text-align: justify;
}

.itens {
  margin: 0;
  padding-left: 6mm;
  font-size: 10pt;
  line-height: 1.7;
}

.ciencia {
  margin: 0;
  padding: 3mm 4mm;
  border: 0.4mm solid #000;
  font-size: 10pt;
  font-weight: 700;
  line-height: 1.5;
}

.linha-vazia {
  height: 6mm;
  margin: 0 0 1mm;
  border-bottom: 0.3mm solid #000;
}

/* Assinatura do responsável: mesmo peso visual da do profissional, e acima dela. */
.responsavel {
  margin-bottom: 8mm;
  text-align: center;
}

.responsavel__linha {
  display: block;
  width: 70mm;
  margin: 12mm auto 1.5mm;
  border-bottom: 0.3mm solid #000;
}

.responsavel__nome {
  margin: 0;
  font-size: 10pt;
  font-weight: 700;
}

.responsavel__papel {
  margin: 0.5mm 0 0;
  font-size: 9pt;
}
</style>
