<script setup lang="ts">
/**
 * Orçamento — A4.
 *
 * O único documento do lote que nasce **antes** do procedimento, não depois. Está aqui porque é
 * emitido do mesmo prontuário e pela mesma pessoa, mas o momento é outro: o responsável leva
 * para decidir, e volta (ou não) com ele.
 *
 * **O módulo não tem tabela de preços.** Os valores saem em branco, para a clínica preencher —
 * inventar preço num protótipo produziria a única coisa pior que um orçamento vazio, que é um
 * orçamento errado que alguém acredita.
 *
 * O que o documento **sabe** é o que está sendo orçado: os exames pedidos e os medicamentos
 * prescritos já estão no prontuário, e é exatamente essa lista que a recepção reescreveria à
 * mão.
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

/**
 * Os itens que o prontuário já conhece: consulta, exames pedidos e medicamentos prescritos.
 *
 * A consulta entra sempre, porque ela é o item que ninguém lembra de listar e todo orçamento
 * tem.
 */
const itens = computed(() => {
  const lista: Array<{ id: string; descricao: string; grupo: string }> = [
    {
      id: 'consulta',
      descricao: clinico.tipo('tipo-consulta')?.nome ?? t('clinico.documentos.orcamento.consulta'),
      grupo: t('clinico.documentos.orcamento.grupo.atendimento'),
    },
  ]

  for (const id of props.encounter.conduta.examesSolicitados) {
    const exame = clinico.exames.find((item) => item.id === id)

    if (exame) {
      lista.push({
        id: `exame-${exame.id}`,
        descricao: exame.nome,
        grupo: t('clinico.documentos.orcamento.grupo.exame'),
      })
    }
  }

  for (const prescricao of props.encounter.conduta.prescricoes) {
    const medicamento = clinico.medicamento(prescricao.calculo.medicamentoId)

    if (medicamento) {
      lista.push({
        id: `med-${prescricao.id}`,
        descricao: medicamento.nome,
        grupo: t('clinico.documentos.orcamento.grupo.medicamento'),
      })
    }
  }

  return lista
})
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.orcamento.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    :mostrar-alertas="false"
    :carimbo="t('clinico.documentos.orcamento.carimbo')"
  >
    <table class="tabela">
      <thead>
        <tr>
          <th>{{ t('clinico.documentos.orcamento.item') }}</th>
          <th class="estreita">{{ t('clinico.documentos.orcamento.grupoColuna') }}</th>
          <th class="estreita numero">{{ t('clinico.documentos.orcamento.valor') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in itens" :key="item.id">
          <td>{{ item.descricao }}</td>
          <td class="estreita">{{ item.grupo }}</td>
          <!-- Valor em branco: o módulo não tem tabela de preços, e chutar seria pior. -->
          <td class="estreita vazia" />
        </tr>

        <tr v-for="n in 3" :key="`extra-${n}`">
          <td class="vazia" />
          <td class="estreita vazia" />
          <td class="estreita vazia" />
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="total">{{ t('clinico.documentos.orcamento.total') }}</td>
          <td class="estreita vazia" />
        </tr>
      </tfoot>
    </table>

    <!--
      Validade e forma de pagamento: as duas perguntas que o responsável faz ao voltar, e as
      duas que fazem o orçamento virar discussão quando não estão escritas.
    -->
    <section class="bloco">
      <p>{{ t('clinico.documentos.orcamento.validade') }}</p>
      <p>{{ t('clinico.documentos.orcamento.ressalva') }}</p>
    </section>
  </DocumentoFolha>
</template>

<style scoped>
.tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
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
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.estreita {
  width: 30mm;
}

.numero {
  text-align: end;
}

.vazia {
  height: 7mm;
}

.total {
  font-weight: 700;
  text-align: end;
  text-transform: uppercase;
}

.bloco {
  margin-top: 4mm;
}

.bloco p {
  margin: 0 0 1mm;
  font-size: 9pt;
  line-height: 1.5;
}
</style>
