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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
    class="clinic-dialog"
    :style="{ width: 'min(32rem, 94vw)' }"
    :header="t('clinico.prontuario.conduta.retornoDialogo.titulo')"
    :dismissable-mask="true"
  >
    <div class="retorno clinic-scope">
      <p class="retorno__lede">
        {{ t('clinico.prontuario.conduta.retornoDialogo.descricao') }}
      </p>

      <p v-if="buscando" class="retorno__estado" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        {{ t('clinico.tabela.carregando') }}
      </p>

      <p v-else-if="opcoes.length === 0" class="retorno__estado retorno__estado--vazio">
        <i class="pi pi-calendar-times" aria-hidden="true" />
        {{ t('clinico.agenda.semana.semAlternativa') }}
      </p>

      <ul v-else class="retorno__lista">
        <li v-for="opcao in opcoes" :key="opcao.slot.inicio">
          <Button
            type="button"
            class="opcao"
            severity="secondary"
            outlined
            fluid
            :disabled="salvando"
            @click="emit('escolher', opcao.slot)"
          >
            <span class="opcao__data">
              <strong class="clinic-value">{{ formato.dataCurta(opcao.data) }}</strong>
              <span class="opcao__semana">{{ formato.diaDaSemanaCurto(opcao.data) }}</span>
            </span>

            <span class="opcao__hora clinic-value">
              {{ formato.intervalo(opcao.slot.inicio, opcao.slot.fim) }}
            </span>

            <span class="opcao__meta">
              <span>{{ opcao.profissional }}</span>
              <span class="opcao__dias" :class="{ 'opcao__dias--adiado': opcao.adiado }">
                {{
                  t(
                    'clinico.prontuario.conduta.retornoDialogo.emDias',
                    { contagem: opcao.dias },
                    opcao.dias,
                  )
                }}
              </span>
            </span>
          </Button>
        </li>
      </ul>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.agenda.mover.cancelar')"
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
  gap: var(--clinic-space-3);
}

.retorno__lede {
  margin: 0;
  color: var(--clinic-muted);
  line-height: 1.5;
}

.retorno__estado {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  color: var(--clinic-muted);
}

.retorno__estado--vazio {
  color: var(--clinic-faint);
}

.retorno__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Opção de horário: botão contornado com layout em grade (data, hora, quem e quando). A
 * especificidade passa a regra global da clínica para botão secundário contornado, que trocaria
 * a moldura suave pela forte e o hover sálvia pelo cinza.
 */
.opcao.p-button {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  font: inherit;
  text-align: start;
}

.opcao.p-button.p-button-secondary.p-button-outlined {
  border-color: var(--clinic-line);
  background: var(--clinic-surface);
  color: inherit;
}

.opcao.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: inherit;
}

.opcao.p-button:disabled {
  border-color: var(--clinic-line);
  background: var(--clinic-surface);
  color: inherit;
  cursor: progress;
  opacity: 0.6;
}

.opcao__data {
  display: grid;
  gap: 0.05rem;
}

.opcao__data strong {
  font-size: 1rem;
  font-weight: 800;
}

.opcao__semana {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.opcao__hora {
  font-weight: 750;
}

.opcao__meta {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
  justify-items: end;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  text-align: end;
}

.opcao__dias {
  color: var(--clinic-faint);
}

/* Adiado por falta de vaga: o desvio da data pedida é dado, não detalhe. */
.opcao__dias--adiado {
  color: var(--clinic-attention-text);
  font-weight: 700;
}
</style>
