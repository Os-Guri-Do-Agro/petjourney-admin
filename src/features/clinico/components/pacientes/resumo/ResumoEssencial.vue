<script setup lang="ts">
/**
 * O essencial do histórico, em quatro linhas: alertas, condições ativas, medicação em uso e a
 * última consulta.
 *
 * Lista de definição, não quatro cartões: são respostas curtas a quatro perguntas fixas, e o
 * olho precisa varrer a coluna de rótulos sem atravessar quatro bordas. Linha vazia **diz** que
 * está vazia ("nenhuma registrada") — sumir com ela faria a ausência parecer esquecimento da
 * tela.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import ClinicAlertChip from '../../base/ClinicAlertChip.vue'
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
  <section class="essencial" :aria-labelledby="'essencial-titulo'">
    <h2 id="essencial-titulo" class="clinic-label essencial__titulo">
      {{ t('clinico.resumoDoPaciente.essencial.titulo') }}
    </h2>

    <dl class="essencial__lista">
      <div class="essencial__linha">
        <dt>{{ t('clinico.resumoDoPaciente.essencial.alertas') }}</dt>
        <dd>
          <ul v-if="resumo.alertas.length > 0" class="essencial__chips">
            <li v-for="alerta in resumo.alertas" :key="alerta.id">
              <ClinicAlertChip
                :severidade="alerta.severidade"
                :rotulo="formato.alerta(alerta.kind)"
                :detalhe="alerta.detalhe"
              />
            </li>
          </ul>
          <span v-else class="essencial__vazio">
            {{ t('clinico.resumoDoPaciente.essencial.nenhum') }}
          </span>
        </dd>
      </div>

      <div class="essencial__linha">
        <dt>{{ t('clinico.resumoDoPaciente.essencial.condicoes') }}</dt>
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
        <dt>{{ t('clinico.resumoDoPaciente.essencial.medicacao') }}</dt>
        <dd>
          <ul v-if="medicacoes.length > 0" class="essencial__itens">
            <li v-for="item in medicacoes" :key="item.id">
              {{ item.nome }}
              <span class="essencial__meta">{{ item.quando }}</span>
            </li>
          </ul>
          <span v-else class="essencial__vazio">
            {{ t('clinico.resumoDoPaciente.essencial.nenhuma') }}
          </span>
        </dd>
      </div>

      <div class="essencial__linha">
        <dt>{{ t('clinico.resumoDoPaciente.essencial.ultimaConsulta') }}</dt>
        <dd>
          <template v-if="ultima">
            <span class="essencial__data clinic-value">{{ ultima.data }}</span>
            <span class="essencial__meta">{{ ultima.quando }}</span>
            <span class="essencial__consulta">
              {{ ultima.tipo
              }}<template v-if="ultima.diagnostico"> · {{ ultima.diagnostico }}</template>
            </span>
            <span class="essencial__meta">{{ ultima.profissional }}</span>
            <RouterLink
              class="essencial__link clinic-focusable"
              :to="`/veterinario/atendimento/${ultima.encounterId}`"
            >
              {{ t('clinico.resumoDoPaciente.essencial.abrirProntuario') }}
              <i class="pi pi-arrow-right" aria-hidden="true" />
            </RouterLink>
          </template>
          <span v-else class="essencial__vazio">
            {{ t('clinico.resumoDoPaciente.essencial.primeiraVez') }}
          </span>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.essencial {
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.essencial__titulo {
  margin: 0 0 var(--clinic-space-2);
}

.essencial__lista {
  display: grid;
  margin: 0;
}

.essencial__linha {
  display: grid;
  gap: var(--clinic-space-1);
  padding-block: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.essencial__linha:first-child {
  padding-top: 0;
  border-top: 0;
}

.essencial__linha dt {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.essencial__linha dd {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin: 0;
  min-width: 0;
}

.essencial__chips,
.essencial__itens {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-1);
  list-style: none;
}

.essencial__itens li {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.essencial__meta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 500;
}

.essencial__itens .essencial__meta {
  margin-inline-start: var(--clinic-space-1);
}

.essencial__data {
  font-weight: 700;
}

.essencial__consulta {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.essencial__vazio {
  color: var(--clinic-faint);
}

.essencial__link {
  display: inline-flex;
  align-items: center;
  margin-top: var(--clinic-space-1);
  gap: var(--clinic-space-1);
  border-radius: var(--clinic-radius-control);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-decoration: none;
}

.essencial__link:hover {
  text-decoration: underline;
}
</style>
