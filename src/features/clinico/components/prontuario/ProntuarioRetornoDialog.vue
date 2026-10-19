<script setup lang="ts">
/**
 * Escolha do horário do retorno.
 *
 * O botão "Agendar retorno" antes só navegava para a agenda focando o atendimento que acabava
 * de terminar — nada era criado, e o aviso de "retorno pendente" nunca sumia. Esta caixa é o
 * que fecha o ciclo: mostra horários que **existem de verdade** e cria o atendimento.
 *
 * Duas decisões:
 *
 * - **Só horário sem conflito.** Aqui, diferente do encaixe da recepção, não há motivo para
 *   oferecer horário cheio: o retorno é marcado com semanas de folga e sempre há alternativa
 *   um pouco adiante. Oferecer conflito seria criar trabalho para a recepção resolver depois.
 * - **A data pedida é sugestão.** "Retorno em 15 dias" que cai em feriado ou dia lotado vira
 *   16, 17, e a caixa diz em quantos dias cada opção sai — a distância importa clinicamente, e
 *   é ela que o vet confere, não a data.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ProntuarioDialogoTopo from './ProntuarioDialogoTopo.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { ISODate, SlotSugestao } from '../../data/types'
import { diffDays } from '../../domain/clinic-time'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  sugestoes: SlotSugestao[]
  buscando: boolean
  salvando: boolean
  /** Data do atendimento que originou o retorno — base para "em N dias". */
  aPartirDe: ISODate
  emDias: number | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  escolher: [slot: SlotSugestao]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const idTitulo = useId()

const aberto = computed({
  get: () => props.visivel,
  set: (valor: boolean) => emit('update:visivel', valor),
})

const opcoes = computed(() =>
  props.sugestoes.map((slot) => {
    const data = clinicClock.dateOf(slot.inicio)
    const dias = diffDays(props.aPartirDe, data)

    return {
      slot,
      data,
      dias,
      /** Caiu depois do pedido porque não havia vaga antes: vale dizer, não esconder. */
      adiado: props.emDias !== null && dias > props.emDias,
      profissional: clinico.profissional(slot.professionalId)?.nome ?? '',
    }
  }),
)
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(34rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    :dismissable-mask="true"
  >
    <template #header>
      <ProntuarioDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.prontuario.conduta.retornoDialogo.titulo')"
        :subtitulo="
          emDias !== null
            ? t('clinico.prontuario.conduta.retornoDialogo.emDias', { contagem: emDias }, emDias)
            : ''
        "
        icone="ph ph-calendar-plus"
      />
    </template>

    <div class="retorno">
      <p class="retorno__lede">
        {{ t('clinico.prontuario.conduta.retornoDialogo.descricao') }}
      </p>

      <p v-if="buscando" class="retorno__estado" role="status">
        <i class="ph ph-spin ph-circle-notch" aria-hidden="true" />
        {{ t('clinico.tabela.carregando') }}
      </p>

      <p v-else-if="opcoes.length === 0" class="retorno__estado">
        <i class="ph ph-calendar-x" aria-hidden="true" />
        {{ t('clinico.agenda.semana.semAlternativa') }}
      </p>

      <ul v-else class="retorno__lista">
        <li v-for="opcao in opcoes" :key="opcao.slot.inicio">
          <button
            type="button"
            class="opcao"
            :disabled="salvando"
            @click="emit('escolher', opcao.slot)"
          >
            <span class="opcao__data">
              <strong class="ui-num">{{ formato.dataCurta(opcao.data) }}</strong>
              <span>{{ formato.diaDaSemanaCurto(opcao.data) }}</span>
            </span>

            <span class="opcao__hora ui-hora">
              {{ formato.intervalo(opcao.slot.inicio, opcao.slot.fim) }}
            </span>

            <span class="opcao__meta">
              <span>{{ opcao.profissional }}</span>
              <span
                class="opcao__dias ui-num"
                :class="{ 'opcao__dias--adiado': opcao.adiado }"
              >
                {{
                  t(
                    'clinico.prontuario.conduta.retornoDialogo.emDias',
                    { contagem: opcao.dias },
                    opcao.dias,
                  )
                }}
              </span>
            </span>

            <i class="ph ph-caret-right opcao__seta" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('clinico.comum.cancelar')"
        severity="secondary"
        text
        @click="aberto = false"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.retorno {
  display: grid;
  gap: 14px;
}

.retorno__lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.55;
}

.retorno__estado {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 24px;
  border: 1px dashed var(--linha-forte);
  border-radius: 12px;
  color: var(--tinta-2);
  font-size: 14px;
}

.retorno__lista {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.retorno__lista li + li {
  border-top: 1px solid var(--linha);
}

/* Cada horário é uma linha inteira clicável: data, hora, com quem e a quantos dias. */
.opcao {
  display: grid;
  width: 100%;
  min-height: 60px;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border: 0;
  background: none;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  grid-template-columns: 4.5rem auto minmax(0, 1fr) auto;
  text-align: start;
}

.retorno__lista li:first-child .opcao {
  border-radius: 11px 11px 0 0;
}

.retorno__lista li:last-child .opcao {
  border-radius: 0 0 11px 11px;
}

.opcao:hover:not(:disabled) {
  background: var(--superficie-2);
}

.opcao:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: -2px;
}

.opcao:disabled {
  cursor: progress;
  opacity: 0.6;
}

.opcao__data {
  display: grid;
  line-height: 1.2;
}

.opcao__data strong {
  font-size: 16px;
  font-weight: 650;
}

.opcao__data span {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.opcao__meta {
  display: grid;
  min-width: 0;
  justify-items: end;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
  text-align: end;
}

.opcao__dias {
  color: var(--tinta-3);
}

/* Adiado por falta de vaga: o desvio da data pedida é dado, não detalhe. */
.opcao__dias--adiado {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.opcao__seta {
  color: var(--tinta-3);
  font-size: 16px;
}

[dir='rtl'] .opcao__seta {
  scale: -1 1;
}
</style>
