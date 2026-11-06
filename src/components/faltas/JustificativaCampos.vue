<script setup lang="ts">
/**
 * O que a recepção registra de uma falta (guia e3 3.3): por onde falou (ou que tentou e ninguém
 * atendeu), o motivo, a observação interna e, no óbito, o dia. Sem resposta não tem motivo; o óbito
 * fica no fim da lista e só aparece para quem tem `paciente.escrever` (ele encerra o caso).
 */
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { diaLocal } from '@/service/parceiro/agenda-config-service'
import {
  CANAIS_DA_CLINICA,
  MOTIVOS_DA_FALTA,
  OBSERVACAO_DA_FALTA_MAX,
  type CanalDaJustificativa,
  type MotivoDaFalta,
  type NovaJustificativa,
} from '@/service/parceiro/faltas-service'

const props = defineProps<{
  /** Prefixo dos ids dos campos: duas instâncias não podem repetir. */
  prefixo: string
  podeObito: boolean
  tentou: boolean
  desabilitado: boolean
  /** `AAAA-MM-DD` de hoje na clínica: o óbito nunca depois. */
  hoje: string
}>()

const modelo = defineModel<NovaJustificativa>({ required: true })

const { t } = useI18n()

const opcoesDeCanal = computed(() =>
  CANAIS_DA_CLINICA.map((valor) => ({ valor, rotulo: t(`faltas.canal.${valor}`) })),
)

const opcoesDeMotivo = computed(() =>
  MOTIVOS_DA_FALTA.filter((motivo) => motivo !== 'OBITO' || props.podeObito).map((valor) => ({
    valor,
    rotulo: t(`faltas.motivo.${valor}`),
  })),
)

const semResposta = computed(() => modelo.value.canal === 'SEM_RESPOSTA')

function trocarCanal(canal: CanalDaJustificativa | null) {
  if (!canal) return
  modelo.value = {
    ...modelo.value,
    canal,
    ...(canal === 'SEM_RESPOSTA' ? { motivo: null, obitoEm: undefined } : {}),
  }
}

function trocarMotivo(motivo: MotivoDaFalta | null) {
  modelo.value = {
    ...modelo.value,
    motivo,
    obitoEm: motivo === 'OBITO' ? (modelo.value.obitoEm ?? props.hoje) : undefined,
  }
}

function dataDe(texto: string) {
  const [ano, mes, dia] = texto.split('-').map(Number)
  return new Date(ano!, mes! - 1, dia!)
}

const diaDoObito = computed(() => (modelo.value.obitoEm ? dataDe(modelo.value.obitoEm) : null))
const maximo = computed(() => dataDe(props.hoje))

function trocarDiaDoObito(valor: Date | Date[] | (Date | null)[] | null | undefined) {
  if (valor instanceof Date) modelo.value = { ...modelo.value, obitoEm: diaLocal(valor) }
}

const faltaMotivo = computed(() => props.tentou && !semResposta.value && !modelo.value.motivo)
</script>

<template>
  <div class="jc">
    <section class="eg__secao">
      <span :id="`${prefixo}-canal`" class="eg__rotulo">{{ t('faltas.justificar.canal') }}</span>
      <SelectButton
        :model-value="modelo.canal"
        :options="opcoesDeCanal"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-labelledby="`${prefixo}-canal`"
        :disabled="desabilitado"
        class="jc__canais"
        @update:model-value="trocarCanal"
      />
      <small v-if="semResposta" class="eg__dica">{{
        t('faltas.justificar.semRespostaDica')
      }}</small>
    </section>

    <section v-if="!semResposta" class="eg__secao">
      <label class="eg__rotulo" :for="`${prefixo}-motivo`">{{
        t('faltas.justificar.motivo')
      }}</label>
      <Select
        :model-value="modelo.motivo ?? null"
        :input-id="`${prefixo}-motivo`"
        :options="opcoesDeMotivo"
        option-label="rotulo"
        option-value="valor"
        :placeholder="t('faltas.justificar.escolha')"
        :invalid="faltaMotivo"
        :disabled="desabilitado"
        @update:model-value="trocarMotivo"
      />
      <small v-if="faltaMotivo" class="eg__invalido">{{ t('faltas.justificar.semMotivo') }}</small>
    </section>

    <section v-if="!semResposta && modelo.motivo === 'OBITO'" class="eg__secao jc__obito">
      <p class="jc__aviso" role="note">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('faltas.justificar.obitoAviso') }}</span>
      </p>
      <label class="eg__rotulo" :for="`${prefixo}-obito`">{{
        t('faltas.justificar.obitoEm')
      }}</label>
      <DatePicker
        :model-value="diaDoObito"
        :input-id="`${prefixo}-obito`"
        :max-date="maximo"
        :disabled="desabilitado"
        @update:model-value="trocarDiaDoObito"
      />
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${prefixo}-observacao`">
        {{ t('faltas.justificar.observacao') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <Textarea
        :id="`${prefixo}-observacao`"
        :model-value="modelo.observacao ?? ''"
        rows="2"
        auto-resize
        :maxlength="OBSERVACAO_DA_FALTA_MAX"
        :disabled="desabilitado"
        @update:model-value="(valor: string) => (modelo = { ...modelo, observacao: valor })"
      />
      <small class="eg__dica">{{ t('faltas.justificar.observacaoDica') }}</small>
    </section>
  </div>
</template>

<style scoped>
.jc {
  display: grid;
  gap: 18px;
}

.jc__canais {
  flex-wrap: wrap;
}

.jc__aviso {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.jc__aviso i {
  margin-top: 2px;
  color: var(--risco-tinta);
}
</style>
