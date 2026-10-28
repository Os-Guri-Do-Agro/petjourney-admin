<script setup lang="ts">
/**
 * Mudar as datas ou a acomodação de uma reserva.
 *
 * A operação que mais acontece no balcão ("o voo atrasou", "pode ser de sexta a segunda?") não
 * tinha tela: o repositório sabia prorrogar e mover, a interface não oferecia. Quem precisava
 * mudar a data cancelava e vendia de novo, e perdia o sinal pelo caminho.
 *
 * Mesma régua da reserva nova: a vaga e a conta respondem **enquanto** as datas mudam, com a
 * própria reserva fora da conta (ela não conflita consigo mesma). Para quem já está na casa, só a
 * saída muda: a entrada aconteceu.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputMask from 'primevue/inputmask'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import { reservaRepository } from '../../data/repositories'
import { HOTEL_UTC_OFFSET } from '../../data/fixtures'
import type { ClockTime, ISODate, ISODateTime, Reserva } from '../../data/types'
import { dataDe, horaDe, instante } from '../../domain/hotel-time'
import { useHotelStore } from '../../stores/hotel'
import { useReservasStore } from '../../stores/reservas'

const props = defineProps<{
  aberta: boolean
  reserva: Reserva | null
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  salvar: [payload: { inicio: ISODateTime; fim: ISODateTime; acomodacaoId: string }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()
const idCampo = useId()

/** Já na casa: a entrada aconteceu, e só a saída pode mudar. */
const soSaida = computed(() => props.reserva?.status === 'hospedado')

const datas = ref<Date[] | Date | null>(null)
const horaEntrada = ref('08:00')
const horaSaida = ref('12:00')
const acomodacaoId = ref('')

function paraDate(iso: ISODate) {
  return new Date(`${iso}T12:00:00`)
}

function paraIso(data: Date): ISODate {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

watch(
  () => [props.aberta, props.reserva?.id],
  () => {
    const atual = props.reserva

    if (!props.aberta || !atual) {
      return
    }

    const entrada = paraDate(dataDe(atual.entradaPrevista))
    const saida = paraDate(dataDe(atual.saidaPrevista))

    datas.value = soSaida.value ? saida : [entrada, saida]
    horaEntrada.value = horaDe(atual.entradaPrevista)
    horaSaida.value = horaDe(atual.saidaPrevista)
    acomodacaoId.value = atual.acomodacaoId
  },
  { immediate: true },
)

const hora = (valor: string, reserva: string) =>
  (/^\d{2}:\d{2}$/.test(valor) ? valor : reserva) as ClockTime

/** O período escolhido, em instantes; `null` enquanto falta a segunda data. */
const periodo = computed(() => {
  const atual = props.reserva

  if (!atual) {
    return null
  }

  let inicioData: ISODate
  let fimData: ISODate

  if (soSaida.value) {
    if (!(datas.value instanceof Date)) {
      return null
    }

    inicioData = dataDe(atual.entradaPrevista)
    fimData = paraIso(datas.value)
  } else {
    const [de, ate] = Array.isArray(datas.value) ? datas.value : []

    if (!de || !ate) {
      return null
    }

    inicioData = paraIso(de)
    fimData = paraIso(ate)
  }

  return {
    inicio: soSaida.value
      ? atual.entradaPrevista
      : instante(
          inicioData,
          hora(horaEntrada.value, horaDe(atual.entradaPrevista)),
          HOTEL_UTC_OFFSET,
        ),
    fim: instante(fimData, hora(horaSaida.value, horaDe(atual.saidaPrevista)), HOTEL_UTC_OFFSET),
  }
})

const periodoValido = computed(
  () => periodo.value !== null && Date.parse(periodo.value.fim) > Date.parse(periodo.value.inicio),
)

/** Onde a reserva cabe no período novo, sem contar a si mesma. */
const avaliacao = computed(() =>
  props.reserva && periodo.value && periodoValido.value
    ? reservaRepository.vagasParaMover({
        reservaId: props.reserva.id,
        inicio: periodo.value.inicio,
        fim: periodo.value.fim,
      })
    : null,
)

const opcoes = computed(() =>
  (avaliacao.value?.vagas ?? [])
    .filter((vaga) => vaga.impedimentos.length === 0)
    .map((vaga) => ({
      valor: vaga.acomodacao.id,
      rotulo: `${vaga.acomodacao.nome} · ${hotelStore.tipoDeAcomodacao(vaga.acomodacao.tipoId)?.nome ?? ''}`,
    })),
)

/** A acomodação escolhida não serve mais no período novo: a tela diz qual é o motivo. */
const motivoDaEscolhida = computed(() => {
  const vaga = avaliacao.value?.vagas.find((item) => item.acomodacao.id === acomodacaoId.value)

  return vaga && vaga.impedimentos.length > 0
    ? vaga.impedimentos.map((item) => t(`hotel.erros.vaga.${item}`)).join(' ')
    : ''
})

const animalJaReservado = computed(() => {
  const outra = avaliacao.value?.animal

  return outra
    ? t('hotel.reserva.animalJaReservado', {
        pet: hotelStore.pet(outra.petId)?.nome ?? '',
        periodo: formato.periodo(outra.entradaPrevista, outra.saidaPrevista),
        acomodacao: hotelStore.acomodacao(outra.acomodacaoId)?.nome ?? '',
      })
    : ''
})

/** A conta nova, pelo mesmo repositório que grava. */
const novoTotal = computed(() => {
  const atual = props.reserva

  if (!atual || !periodo.value || !periodoValido.value || !acomodacaoId.value) {
    return null
  }

  return (
    reservas.simular({
      acomodacaoId: acomodacaoId.value,
      petId: atual.petId,
      acompanhantePetId: atual.acompanhantePetId,
      inicio: periodo.value.inicio,
      fim: periodo.value.fim,
      servicos: atual.servicos,
    })?.totalCentavos ?? null
  )
})

const mudou = computed(
  () =>
    props.reserva !== null &&
    periodo.value !== null &&
    (periodo.value.inicio !== props.reserva.entradaPrevista ||
      periodo.value.fim !== props.reserva.saidaPrevista ||
      acomodacaoId.value !== props.reserva.acomodacaoId),
)

const podeSalvar = computed(
  () =>
    mudou.value &&
    periodoValido.value &&
    acomodacaoId.value !== '' &&
    !motivoDaEscolhida.value &&
    !animalJaReservado.value,
)

function salvar() {
  if (!podeSalvar.value || !periodo.value) {
    return
  }

  emit('salvar', { ...periodo.value, acomodacaoId: acomodacaoId.value })
}
</script>

<template>
  <Drawer
    :visible="aberta"
    position="right"
    class="clinic-overlay pj-lugar--hotel alterar"
    :style="{ width: 'min(30rem, 96vw)' }"
    :header="t('hotel.reserva.alterar.titulo')"
    @update:visible="(valor: boolean) => !valor && emit('fechar')"
  >
    <div v-if="reserva" class="alterar__corpo">
      <p class="alterar__agora ui-num">
        <i class="ph ph-calendar-blank" aria-hidden="true" />
        {{
          t('hotel.reserva.alterar.agora', {
            periodo: formato.periodo(reserva.entradaPrevista, reserva.saidaPrevista),
            acomodacao: hotelStore.acomodacao(reserva.acomodacaoId)?.nome ?? '',
          })
        }}
      </p>

      <div class="campo">
        <span :id="`${idCampo}-datas`" class="campo__rotulo">
          {{ soSaida ? t('hotel.reserva.alterar.novaSaida') : t('hotel.reserva.alterar.datas') }}
        </span>
        <DatePicker
          v-model="datas"
          inline
          :selection-mode="soSaida ? 'single' : 'range'"
          :min-date="soSaida ? paraDate(dataDe(reserva.entradaPrevista)) : undefined"
          :aria-labelledby="`${idCampo}-datas`"
          class="alterar__calendario"
        />
      </div>

      <div class="alterar__horas">
        <div v-if="!soSaida" class="campo">
          <label :for="`${idCampo}-entrada`">{{ t('hotel.reserva.chegaAs') }}</label>
          <InputMask :id="`${idCampo}-entrada`" v-model="horaEntrada" mask="99:99" fluid />
        </div>
        <div class="campo">
          <label :for="`${idCampo}-saida`">{{ t('hotel.reserva.saiAs') }}</label>
          <InputMask :id="`${idCampo}-saida`" v-model="horaSaida" mask="99:99" fluid />
        </div>
      </div>

      <div v-if="!soSaida" class="campo">
        <label :for="`${idCampo}-acomodacao`">{{ t('hotel.reservas.coluna.acomodacao') }}</label>
        <Select
          v-model="acomodacaoId"
          :input-id="`${idCampo}-acomodacao`"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :placeholder="t('hotel.reserva.alterar.escolha')"
          :empty-message="t('hotel.reserva.alterar.semVaga')"
          fluid
        />
      </div>

      <Message v-if="periodo && !periodoValido" severity="error" :closable="false">
        {{ t('hotel.erros.vaga.periodo-invalido') }}
      </Message>
      <Message v-else-if="motivoDaEscolhida" severity="error" :closable="false">
        {{ t('hotel.reserva.semVaga', { motivo: motivoDaEscolhida }) }}
      </Message>
      <Message v-if="animalJaReservado" severity="error" :closable="false">
        {{ animalJaReservado }}
      </Message>

      <p v-if="novoTotal !== null && mudou" class="alterar__conta ui-num">
        {{
          t('hotel.reserva.alterar.conta', {
            novo: formato.moeda(novoTotal),
            antes: formato.moeda(reserva.orcamento.totalCentavos),
          })
        }}
      </p>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <div class="alterar__rodape">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('hotel.comum.cancelar')"
          @click="emit('fechar')"
        />
        <Button
          type="button"
          icon="ph ph-check"
          :label="t('hotel.reserva.alterar.salvar')"
          :loading="salvando"
          :disabled="!podeSalvar"
          @click="salvar"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.alterar__corpo {
  display: grid;
  gap: 18px;
}

.alterar__agora {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.campo {
  display: grid;
  align-content: start;
  gap: 6px;
}

.campo label,
.campo__rotulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.alterar__calendario {
  width: 100%;
}

.alterar__horas {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.alterar__conta {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.alterar__rodape {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
