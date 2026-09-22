<script setup lang="ts">
/**
 * Hóspedes na casa.
 *
 * Era uma tabela, e tabela era a forma errada. Esta tela não é um inventário para varrer por
 * coluna: é a pergunta **"como está cada um dos meus cinco?"** — e a resposta é um rosto, um
 * estado e o que falta fazer. Era também a terceira tela seguida do módulo com a mesma silhueta
 * de fileira-de-números-mais-lista, que foi a crítica que derrubou a primeira versão.
 *
 * Agora é uma grade de cartões, ordenada por quem cobra ação. Quem quer a lista fria — nome,
 * acomodação, noites — tem o mapa de ocupação, que é a tela feita para isso.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HospedeCard from '@/features/hotel/components/hospedes/HospedeCard.vue'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const router = useRouter()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

/**
 * Três recortes, e não uma barra de filtros.
 *
 * Cinco a vinte hóspedes não pedem busca nem facetas: pedem "me mostre só os que precisam de
 * mim". Uma barra de filtros aqui seria a mesma peça de interface das outras telas — de novo — e
 * resolveria um problema que esta lista não tem.
 */
type Recorte = 'todos' | 'precisam' | 'saem'

const recorte = ref<Recorte>('todos')

onMounted(async () => {
  await hospedagem.carregarHospedes()
})

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarHospedes(),
)

function precisaDeAlguem(hospede: (typeof hospedagem.hospedes)[number]) {
  return (
    hospede.ocorrenciaTravada ||
    hospede.boletimRetido ||
    hospede.atrasadas > 0 ||
    (hospede.saiHoje && hospede.hospedagem.pesoSaidaKg === null)
  )
}

const visiveis = computed(() => {
  if (recorte.value === 'precisam') {
    return hospedagem.hospedes.filter(precisaDeAlguem)
  }

  if (recorte.value === 'saem') {
    return hospedagem.hospedes.filter((hospede) => hospede.saiHoje)
  }

  return hospedagem.hospedes
})

const quantosPrecisam = computed(() => hospedagem.hospedes.filter(precisaDeAlguem).length)
const quantosSaem = computed(() => hospedagem.hospedes.filter((item) => item.saiHoje).length)

const opcoes = computed(() => [
  {
    valor: 'todos' as const,
    rotulo: t('hotel.hospedes.recorte.todos', { total: hospedagem.hospedes.length }),
  },
  {
    valor: 'precisam' as const,
    rotulo: t('hotel.hospedes.recorte.precisam', { total: quantosPrecisam.value }),
  },
  {
    valor: 'saem' as const,
    rotulo: t('hotel.hospedes.recorte.saem', { total: quantosSaem.value }),
  },
])

const vazio = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.hospedes.length === 0,
)
/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.hospedes.pergunta.titulo'),
    texto: t('hotel.tour.hospedes.pergunta.texto'),
  },
  {
    alvo: '.barra',
    titulo: t('hotel.tour.hospedes.recortes.titulo'),
    texto: t('hotel.tour.hospedes.recortes.texto'),
  },
  {
    alvo: '.grade > *',
    titulo: t('hotel.tour.hospedes.cartao.titulo'),
    texto: t('hotel.tour.hospedes.cartao.texto'),
  },
  {
    alvo: '.grade > *',
    titulo: t('hotel.tour.hospedes.linhas.titulo'),
    texto: t('hotel.tour.hospedes.linhas.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.hospedes.titulo')"
    :subtitle="t('hotel.hospedes.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.hospedes.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.hospedes.vazioTitulo')"
    :empty-description="t('hotel.hospedes.vazioDescricao')"
    @retry="hospedagem.carregarHospedes()"
  >
    <div class="hospedes clinic-scope">
      <div class="barra">
        <SelectButton
          v-model="recorte"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.hospedes.recorteRotulo')"
        />

        <Button
          :label="t('hotel.hospedes.irParaRotina')"
          icon="pi pi-list-check"
          severity="secondary"
          outlined
          size="small"
          @click="router.push('/hotel/rotina')"
        />
      </div>

      <p v-if="visiveis.length === 0" class="nada">
        {{
          recorte === 'precisam'
            ? t('hotel.hospedes.ninguemPrecisa')
            : t('hotel.hospedes.ninguemSai')
        }}
      </p>

      <section v-else class="grade">
        <HospedeCard
          v-for="hospede in visiveis"
          :key="hospede.hospedagem.id"
          :hospede="hospede"
          @abrir="(id) => router.push(`/hotel/hospedagem/${id}`)"
        />
      </section>
    </div>

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.hospedes {
  display: grid;
  gap: var(--clinic-space-4);
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.nada {
  margin: 0;
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  color: var(--clinic-muted);
  text-align: center;
}

.grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
}
</style>
