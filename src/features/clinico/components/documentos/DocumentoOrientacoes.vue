<script setup lang="ts">
/**
 * Orientações ao responsável — A4.
 *
 * É a folha que vai para a geladeira. As orientações já existiam dentro do prontuário completo,
 * e ali ninguém as lê: quatro páginas de anamnese, vitais e diagnóstico, com a parte que a
 * pessoa precisa executar em casa no meio. Como folha própria, ela é o único papel que o
 * responsável realmente relê no terceiro dia.
 *
 * Por isso esta é a única folha do módulo escrita **para quem não é da área**: sem miligrama por
 * quilo, sem código de diagnóstico, sem a conta. O que dar, quando, e o que observar.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, Tutor } from '../../data/types'
import { fracionar } from '../../domain/receita'
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

/**
 * A medicação em linguagem de quem administra.
 *
 * Mesma fonte da receita, outra leitura: "meio comprimido de 12 em 12 horas" em vez de
 * "6,4 mg/kg". Quem dá o remédio não confere dose — executa instrução.
 */
const medicacoes = computed(() =>
  props.encounter.conduta.prescricoes.map((prescricao) => {
    const medicamento = clinico.medicamento(prescricao.calculo.medicamentoId)
    const fracao = medicamento
      ? fracionar(prescricao.calculo.quantidadeApresentacao, medicamento.unidadeApresentacao)
      : null

    return {
      id: prescricao.id,
      nome: medicamento?.nome ?? '',
      quantidade: fracao
        ? t(`clinico.prontuario.conduta.fracao.${fracao.kind}`, {
            inteiros: fracao.inteiros,
            quantidade: formato.numero(fracao.quantidade, 2),
          })
        : t('clinico.prontuario.conduta.resumoQuantidade', {
            quantidade: formato.numero(prescricao.calculo.quantidadeApresentacao, 2),
            unidade: t(
              `clinico.prontuario.conduta.unidade.${medicamento?.unidadeApresentacao ?? 'comprimido'}`,
              prescricao.calculo.quantidadeApresentacao,
            ),
          }),
      frequencia: t('clinico.prontuario.conduta.aCadaHoras', {
        horas: prescricao.calculo.frequenciaHoras,
      }),
      duracao: prescricao.calculo.duracaoDias,
    }
  }),
)

const retorno = computed(() => props.encounter.conduta.retorno.emDias)
</script>

<template>
  <DocumentoFolha
    :titulo="t('clinico.documentos.orientacoes.titulo')"
    :professional-id="encounter.professionalId"
    :pet="pet"
    :tutor="tutor"
    :data-documento="dataDoDocumento"
    :mostrar-alertas="false"
  >
    <section v-if="encounter.conduta.orientacoes" class="bloco">
      <h2>{{ t('clinico.documentos.orientacoes.cuidados') }}</h2>
      <p class="texto">{{ encounter.conduta.orientacoes }}</p>
    </section>

    <section v-if="medicacoes.length > 0" class="bloco">
      <h2>{{ t('clinico.documentos.orientacoes.medicacao') }}</h2>

      <!--
        Caixa de marcar ao lado de cada item. Parece detalhe e não é: é o que transforma a folha
        num acompanhamento em vez de um aviso — quem cuida risca conforme dá.
      -->
      <ul class="medicacoes">
        <li v-for="item in medicacoes" :key="item.id">
          <span class="marca" aria-hidden="true" />
          <span>
            <strong>{{ item.nome }}</strong> — {{ item.quantidade }}, {{ item.frequencia }}
            <template v-if="item.duracao !== null">
              , {{ t('clinico.prontuario.conduta.porDias', { dias: item.duracao }) }}
            </template>
            <template v-else>
              , {{ t('clinico.documentos.orientacoes.contInuo') }}
            </template>
          </span>
        </li>
      </ul>
    </section>

    <section v-if="retorno !== null" class="bloco">
      <h2>{{ t('clinico.prontuario.conduta.retorno') }}</h2>
      <p>{{ t('clinico.documentos.orientacoes.retornoEm', { dias: retorno }) }}</p>
    </section>

    <!--
      Sinais de alerta fecham a folha, e é o bloco que mais justifica ela existir: o responsável
      precisa saber **quando voltar antes da hora**, e essa frase nunca cabe numa orientação
      dita de viva-voz na porta da clínica.
    -->
    <section class="bloco bloco--alerta">
      <h2>{{ t('clinico.documentos.orientacoes.procureTitulo') }}</h2>
      <p>{{ t('clinico.documentos.orientacoes.procureTexto') }}</p>
      <p class="contato">
        {{ clinico.clinic?.nome }} · {{ clinico.clinic?.telefone }}
      </p>
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
  font-size: 11pt;
  line-height: 1.6;
}

.texto {
  white-space: pre-wrap;
}

.medicacoes {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 11pt;
  line-height: 1.6;
}

.medicacoes li {
  display: flex;
  align-items: flex-start;
  gap: 3mm;
  margin-bottom: 2mm;
}

/* Quadrado vazio para riscar à caneta. Impresso, é o que vira o controle de quem administra. */
.marca {
  flex: 0 0 auto;
  width: 4mm;
  height: 4mm;
  margin-top: 1mm;
  border: 0.4mm solid #000;
}

.bloco--alerta {
  padding: 3mm 4mm;
  border: 0.4mm solid #000;
}

.contato {
  font-weight: 700;
}
</style>
