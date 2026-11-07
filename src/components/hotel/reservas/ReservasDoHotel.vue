<script setup lang="ts">
/**
 * As reservas do hotel pela API (E7-02, PJ-28JU4U): a lista (o que está vendido), a grade (a
 * ocupação de 14 dias) e a lista de espera, num controle logo abaixo do título (`?vista=`; a lista
 * é o endereço limpo). "Nova reserva" abre a gaveta; a reserva criada abre o detalhe.
 *
 * A casa (`GET /catalogos`) é lida uma vez: dela vêm os corredores do mapa, os serviços ativos, a
 * política (as horas padrão) e os tipos da lista de espera.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerCasa, type CasaDoHotel } from '@/service/parceiro/hotel-casa-service'
import type { Espera, Reserva } from '@/service/parceiro/hotel-reservas-service'

import EsperaDoHotel from './EsperaDoHotel.vue'
import GradeDeReservas from './GradeDeReservas.vue'
import ListaDeReservas from './ListaDeReservas.vue'
import NovaReservaGaveta, { type InicioDaReserva } from './NovaReservaGaveta.vue'

const VISTAS = ['lista', 'grade', 'espera'] as const
type Vista = (typeof VISTAS)[number]

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()

const reserva = computed(
  () => Boolean(store.modulo('HOTEL')?.podeEscrever) && store.temPermissao('hotel.reserva'),
)

const vista = computed<Vista>({
  get: () => {
    const pedida = route.query.vista
    return typeof pedida === 'string' && (VISTAS as readonly string[]).includes(pedida)
      ? (pedida as Vista)
      : 'lista'
  },
  set: (nova) => {
    const query = { ...route.query }
    if (nova === 'lista') delete query.vista
    else query.vista = nova
    void router.replace({ query })
  },
})
const opcoes = computed(() =>
  VISTAS.map((valor) => ({ valor, rotulo: t(`reservasDoHotel.vistas.${valor}`) })),
)

const casa = ref<CasaDoHotel | null>(null)
onMounted(async () => {
  casa.value = await lerCasa(parceiroQuery()).catch(() => null)
})

const novaAberta = ref(false)
const inicio = ref<InicioDaReserva | null>(null)

function nova(espera: Espera | null = null) {
  inicio.value = espera
    ? {
        esperaId: espera.id,
        paciente: { id: espera.pacienteId, nome: espera.pacienteNome },
        entrada: espera.entradaDesejada,
        saida: espera.saidaDesejada,
      }
    : null
  novaAberta.value = true
}

function criada(r: Reserva) {
  void router.push(`/hotel/reserva/${r.id}`)
}
</script>

<template>
  <UiPagina :titulo="t('reservasDoHotel.titulo')" icone="ph ph-calendar-blank">
    <div class="rh">
      <div class="rh__topo">
        <SelectButton
          v-model="vista"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('reservasDoHotel.vistas.rotulo')"
        />
        <Button
          v-if="reserva"
          type="button"
          icon="ph ph-plus"
          :label="t('reservasDoHotel.nova.titulo')"
          :disabled="!casa"
          @click="nova()"
        />
      </div>

      <ListaDeReservas v-if="vista === 'lista'" />
      <GradeDeReservas v-else-if="vista === 'grade'" />
      <EsperaDoHotel
        v-else
        :tipos="casa?.tipos ?? []"
        :pode-reservar="reserva && Boolean(casa)"
        @reservar="nova"
      />
    </div>

    <NovaReservaGaveta
      v-if="casa && reserva"
      v-model:visible="novaAberta"
      :casa="casa"
      :inicio="inicio"
      @criada="criada"
    />
  </UiPagina>
</template>

<style scoped>
.rh {
  display: grid;
  gap: 20px;
}

.rh__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
