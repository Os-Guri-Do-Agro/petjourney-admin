<script setup lang="ts">
/**
 * O mínimo de uma vacina — o número abaixo do qual a clínica compra.
 *
 * O piso vinha de fábrica e não mudava. Quem decide o piso é o giro, e o giro muda: a antirrábica
 * dobra na campanha de agosto, a FeLV some no inverno. O diálogo mostra o giro do lado do campo
 * porque é a única referência honesta para o número — um mês de saída é o piso que aguenta o
 * atraso de uma entrega sem cancelar consulta.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoEstoque } from '../../composables/useRotulosDoEstoque'
import { estoqueRepository, EstoqueRecusadoError, LIMITE_DE_DOSES } from '../../data/repositories'
import type { SaldoDaVacina } from '../../domain/estoque-vacinas'

const props = defineProps<{
  visivel: boolean
  saldo: SaldoDaVacina | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  ajustado: []
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoEstoque()

const minimo = ref<number | null>(null)
const salvando = ref(false)
const erro = ref('')

watch(
  () => [props.visivel, props.saldo?.vacinaId] as const,
  ([visivel]) => {
    if (visivel && props.saldo) {
      minimo.value = props.saldo.minimo
      erro.value = ''
    }
  },
  { immediate: true },
)

/** Um mês de giro, arredondado para cima: a sugestão que o texto de apoio cita. */
const umMesDeGiro = computed(() => Math.ceil(props.saldo?.consumoMensal ?? 0))

const mudou = computed(() => minimo.value !== null && minimo.value !== props.saldo?.minimo)

async function salvar() {
  if (!props.saldo || minimo.value === null || !mudou.value) {
    return
  }

  salvando.value = true
  erro.value = ''

  try {
    await estoqueRepository.ajustarMinimo(props.saldo.vacinaId, minimo.value)
    emit('ajustado')
    emit('update:visivel', false)
  } catch (falha) {
    erro.value =
      falha instanceof EstoqueRecusadoError
        ? t(`clinico.estoque.recusa.${falha.kind}`)
        : t('clinico.estoque.erroAoSalvar')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(28rem, 94vw)' }"
    :dismissable-mask="!salvando"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="ph ph-sliders-horizontal" /></span>
        {{ t('clinico.estoque.minimo.titulo', { vacina: saldo?.nome ?? '' }) }}
      </h2>
    </template>

    <form v-if="saldo" class="minimo clinic-scope" @submit.prevent="salvar">
      <ul class="minimo__fatos">
        <li>
          {{ t('clinico.estoque.minimo.saldoHoje') }}
          <strong>{{ saldo.saldo }}</strong>
        </li>
        <li>
          {{ t('clinico.estoque.minimo.giro') }}
          <strong>{{ formato.numero(saldo.consumoMensal, 1) }}</strong>
        </li>
      </ul>

      <ClinicField
        :rotulo="t('clinico.estoque.minimo.campo')"
        :dica="
          umMesDeGiro > 0
            ? t('clinico.estoque.minimo.dica', { doses: rotulos.doses(umMesDeGiro) })
            : t('clinico.estoque.minimo.dicaSemGiro')
        "
      >
        <template #default="{ id, descrito }">
          <InputNumber
            v-model="minimo"
            :input-id="id"
            :min="0"
            :max="LIMITE_DE_DOSES"
            fluid
            :aria-describedby="descrito"
          />
        </template>
      </ClinicField>

      <Message v-if="erro" severity="error" :closable="false">{{ erro }}</Message>
    </form>

    <template #footer>
      <Button
        :label="t('clinico.comum.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="emit('update:visivel', false)"
      />
      <Button
        :label="t('clinico.estoque.minimo.salvar')"
        icon="ph ph-check"
        class="clinic-acao-principal"
        :loading="salvando"
        :disabled="!mudou"
        @click="salvar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.minimo {
  display: grid;
  gap: var(--clinic-space-3);
}

.minimo__fatos {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: 0.35rem 1.5rem;
  color: var(--clinic-muted);
  font-size: 13px;
  list-style: none;
}

.minimo__fatos strong {
  margin-inline-start: 0.25rem;
  color: var(--clinic-text);
  font-variant-numeric: tabular-nums;
}
</style>
