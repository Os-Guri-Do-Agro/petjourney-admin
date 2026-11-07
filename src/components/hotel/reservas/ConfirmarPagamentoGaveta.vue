<script setup lang="ts">
/**
 * Registrar pagamento (E7-02a, guia e7 16): manda o **total pago até agora**, não o valor desta vez
 * (pagou 105,00 de sinal e depois mais 50,00: o total é 155,00). A reserva só confirma com o pago
 * cobrindo o sinal (`CONFIRMACAO_SEM_SINAL`). Baixar o total pede motivo; depois de confirmada,
 * baixar não desconfirma (a reserva avisa que ficou abaixo do sinal). Só `hotel.valores`.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  confirmarReserva,
  MOTIVO_MAX,
  MOTIVO_MIN,
  type ReservaDetalhe,
} from '@/service/parceiro/hotel-reservas-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'

const props = defineProps<{ reserva: ReservaDetalhe }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrado: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const total = ref<number | null>(null)
const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const pagoAntes = computed(() => props.reserva.pagoCentavos ?? 0)

watch(aberta, (agora) => {
  if (!agora) return
  total.value = pagoAntes.value / 100
  motivo.value = ''
  tentou.value = false
  erro.value = ''
})

const novoTotal = computed(() => (total.value === null ? null : Math.round(total.value * 100)))
const baixando = computed(() => novoTotal.value !== null && novoTotal.value < pagoAntes.value)
const motivoValido = computed(() => {
  const n = motivo.value.trim().length
  return !baixando.value || (n >= MOTIVO_MIN && n <= MOTIVO_MAX)
})

async function registrar() {
  tentou.value = true
  erro.value = ''
  if (novoTotal.value === null || !motivoValido.value) return
  salvando.value = true
  try {
    await confirmarReserva(
      props.reserva.id,
      {
        pagoCentavos: novoTotal.value,
        versao: props.reserva.versao,
        ...(baixando.value ? { motivo: motivo.value.trim() } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('registrado')
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
    :titulo="t('reservasDoHotel.pagamento.titulo')"
    icone="ph ph-money"
  >
    <form id="pagamento-da-reserva" class="eg" novalidate @submit.prevent="registrar">
      <p v-if="reserva.orcamento" class="eg__dica">
        {{
          t('reservasDoHotel.pagamento.contexto', {
            total: rotulos.dinheiro(reserva.orcamento.totalCentavos),
            sinal: rotulos.dinheiro(reserva.orcamento.sinalCentavos),
            pago: rotulos.dinheiro(pagoAntes),
          })
        }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="pg-total">{{
          t('reservasDoHotel.pagamento.totalPago')
        }}</label>
        <InputNumber
          v-model="total"
          input-id="pg-total"
          mode="currency"
          currency="BRL"
          :locale="rotulos.intl()"
          :min="0"
          :invalid="tentou && total === null"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('reservasDoHotel.pagamento.totalDica') }}</small>
      </section>
      <section v-if="baixando" class="eg__secao">
        <label class="eg__rotulo" for="pg-motivo">{{
          t('reservasDoHotel.pagamento.motivo')
        }}</label>
        <Textarea
          id="pg-motivo"
          v-model="motivo"
          rows="2"
          auto-resize
          :maxlength="MOTIVO_MAX"
          :invalid="tentou && !motivoValido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('reservasDoHotel.pagamento.motivoDica', { min: MOTIVO_MIN })
        }}</small>
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
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="pagamento-da-reserva"
        icon="ph ph-check"
        :label="t('reservasDoHotel.pagamento.registrar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
