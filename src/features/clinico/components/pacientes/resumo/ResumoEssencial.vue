<script setup lang="ts">
/**
 * O essencial do histórico, em três linhas: condições ativas, medicação em uso e a última
 * consulta.
 *
 * Lista de definição, não três cartões: são respostas curtas a perguntas fixas, e o olho precisa
 * varrer a coluna de rótulos sem atravessar bordas. Linha vazia **diz** que está vazia ("nenhuma
 * registrada") — sumir com ela faria a ausência parecer esquecimento da tela.
 *
 * Os alertas do cadastro (alergia, manejo, gestação...) saíram daqui no redesenho de 19/10/2026:
 * moram na capa do paciente, como selo, em todas as vistas da ficha.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import '../ficha/ficha.css'
import { useClinicFormat } from '../../../composables/useClinicFormat'
import type { ResumoDoPaciente } from '../../../domain/resumo-do-paciente'
import { clinicClock, useClinicoStore } from '../../../stores/clinico'

const props = defineProps<{
  resumo: ResumoDoPaciente
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const medicacoes = computed(() =>
  props.resumo.medicacoes.map((item) =>
    item.origem === 'continua'
      ? {
          id: item.id,
          nome: item.descricao,
          quando: t('clinico.resumoDoPaciente.essencial.usoContinuo'),
        }
      : {
          id: item.id,
          nome: clinico.medicamento(item.medicamentoId)?.nome ?? item.medicamentoId,
          quando: item.ate
            ? t('clinico.resumoDoPaciente.essencial.ate', {
                data: formato.dataCurta(clinicClock.dateOf(item.ate)),
              })
            : t('clinico.resumoDoPaciente.essencial.usoContinuo'),
        },
  ),
)

const ultima = computed(() => {
  const consulta = props.resumo.ultimaConsulta

  if (!consulta) {
    return null
  }

  return {
    encounterId: consulta.encounterId,
    data: formato.dataCurta(clinicClock.dateOf(consulta.em)),
    quando: formato.relativo(consulta.em),
    tipo: clinico.tipo(consulta.typeId)?.nome ?? '',
    diagnostico: consulta.diagnosticos[0]?.descricao ?? '',
    profissional: clinico.profissional(consulta.professionalId)?.nome ?? '',
  }
})
</script>

<template>
  <section class="ficha-cartao ui-folha" aria-labelledby="resumo-essencial-titulo">
    <header class="ficha-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clipboard-text" /></span>
      <div class="ficha-cartao__titulos">
        <h2 id="resumo-essencial-titulo" class="ficha-cartao__titulo">
          {{ t('clinico.resumoDoPaciente.essencial.titulo') }}
        </h2>
      </div>
    </header>

    <dl class="essencial">
      <div class="essencial__linha">
        <dt>
          <i class="ph ph-heartbeat" aria-hidden="true" />
          {{ t('clinico.resumoDoPaciente.essencial.condicoes') }}
        </dt>
        <dd>
          <ul v-if="resumo.condicoes.length > 0" class="essencial__itens">
            <li v-for="condicao in resumo.condicoes" :key="condicao">{{ condicao }}</li>
          </ul>
          <span v-else class="essencial__vazio">
            {{ t('clinico.resumoDoPaciente.essencial.nenhuma') }}
          </span>
        </dd>
      </div>

      <div class="essencial__linha">
        <dt>
          <i class="ph ph-pill" aria-hidden="true" />
          {{ t('clinico.resumoDoPaciente.essencial.medicacao') }}
        </dt>
        <dd>
          <ul v-if="medicacoes.length > 0" class="essencial__itens">
            <li v-for="item in medicacoes" :key="item.id">
              <span>{{ item.nome }}</span>
              <span class="essencial__meta">{{ item.quando }}</span>
            </li>
          </ul>
          <span v-else class="essencial__vazio">
            {{ t('clinico.resumoDoPaciente.essencial.nenhuma') }}
          </span>
        </dd>
      </div>

      <div class="essencial__linha">
        <dt>
          <i class="ph ph-stethoscope" aria-hidden="true" />
          {{ t('clinico.resumoDoPaciente.essencial.ultimaConsulta') }}
        </dt>
        <dd>
          <template v-if="ultima">
            <span class="essencial__quando">
              <strong class="ui-num">{{ ultima.data }}</strong>
              <span class="essencial__meta">{{ ultima.quando }}</span>
            </span>
            <span class="essencial__consulta">
              {{ ultima.tipo
              }}<template v-if="ultima.diagnostico">: {{ ultima.diagnostico }}</template>
            </span>
            <span class="essencial__meta">{{ ultima.profissional }}</span>
          </template>
          <span v-else class="essencial__vazio">
            {{ t('clinico.resumoDoPaciente.essencial.primeiraVez') }}
          </span>
        </dd>
      </div>
    </dl>

    <footer v-if="ultima" class="ficha-cartao__pe">
      <RouterLink class="ui-mais" :to="`/veterinario/atendimento/${ultima.encounterId}`">
        {{ t('clinico.resumoDoPaciente.essencial.abrirProntuario') }}
        <i class="ph ph-arrow-right" aria-hidden="true" />
      </RouterLink>
    </footer>
  </section>
</template>

<style scoped>
.essencial {
  display: grid;
  margin: 0;
  padding: 4px 20px 6px;
}

.essencial__linha {
  display: grid;
  gap: 7px;
  padding-block: 14px;
  border-top: 1px solid var(--linha-suave);
}

.essencial__linha:first-child {
  border-top: 0;
}

.essencial__linha dt {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.essencial__linha dt .ph {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 15px;
}

.essencial__linha dd {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 3px;
  margin: 0;
  padding-inline-start: 22px;
}

.essencial__itens {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.essencial__itens li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.essencial__meta {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 400;
}

.essencial__quando {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.essencial__quando strong {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.essencial__consulta {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.essencial__vazio {
  color: var(--tinta-3);
  font-size: 14px;
}
</style>
