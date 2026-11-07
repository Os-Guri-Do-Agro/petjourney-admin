<script setup lang="ts">
/**
 * Cancelar a reserva (E7-02a, guia e7 16): só pendente e confirmada, com o motivo. O instante é do
 * servidor. A resposta diz se o sinal é reembolsável pelo prazo prometido na venda; é só indicador
 * (o reembolso é do balcão), e o detalhe mostra depois.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  cancelarReserva,
  MOTIVOS_DO_CANCELAMENTO,
  type MotivoDoCancelamento,
  type ReservaDetalhe,
} from '@/service/parceiro/hotel-reservas-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'

const props = defineProps<{ reserva: ReservaDetalhe }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ cancelada: [recado: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const motivo = ref<MotivoDoCancelamento | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = null
  tentou.value = false
  erro.value = ''
})

const opcoes = computed(() =>
  MOTIVOS_DO_CANCELAMENTO.map((valor) => ({ valor, rotulo: rotulos.motivo(valor) })),
)

async function cancelar() {
  tentou.value = true
  erro.value = ''
  if (!motivo.value) return
  salvando.value = true
  try {
    const feita = await cancelarReserva(props.reserva.id, motivo.value, parceiroQuery())
    aberta.value = false
    emit(
      'cancelada',
      typeof feita.sinalReembolsavel === 'boolean'
        ? feita.sinalReembolsavel
          ? t(
              'reservasDoHotel.cancelar.reembolsavel',
              { n: feita.diasParaAEntrada },
              feita.diasParaAEntrada,
            )
          : t(
              'reservasDoHotel.cancelar.naoReembolsavel',
              { n: feita.diasParaAEntrada },
              feita.diasParaAEntrada,
            )
        : t('reservasDoHotel.cancelar.feito'),
    )
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('reservasDoHotel.cancelar.titulo')"
    icone="ph ph-calendar-x"
  >
    <form id="cancelar-reserva" class="eg" novalidate @submit.prevent="cancelar">
      <p v-if="typeof reserva.politica.cancelamentoSemCustoDias === 'number'" class="eg__dica">
        {{
          t(
            'reservasDoHotel.cancelar.prazo',
            { n: reserva.politica.cancelamentoSemCustoDias },
            reserva.politica.cancelamentoSemCustoDias,
          )
        }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="cr-motivo">{{ t('reservasDoHotel.cancelar.motivo') }}</label>
        <Select
          v-model="motivo"
          input-id="cr-motivo"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !motivo"
          :disabled="salvando"
        />
      </section>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('reservasDoHotel.cancelar.voltar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="cancelar-reserva"
        icon="ph ph-calendar-x"
        :label="t('reservasDoHotel.cancelar.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
