<script setup lang="ts">
/**
 * Hoje — a primeira tela da Clínica.
 *
 * Quem abre o portal às oito não pergunta "que horas tenho livre"; pergunta **o que é agora e o
 * que não pode esperar**. Os dados que respondem isso moram em `useMeuDia`; o desenho está em
 * avaliação, com três versões novas, cada uma com layout, design e moldura (barra lateral e
 * cabeçalho) próprios, e a de antes, lado a lado (`MeuDiaVersoes`):
 *
 * - **App** — o design do app PetJourney, perfil de parceiro, com a barra lateral de sempre
 *   vestida como o menu do app: o paciente da vez no destaque, a fila numa lista lisa.
 * - **Cartões e salas** — quem está na sala, quem espera e o que pede ação em três cartões, e as
 *   salas ao longo do dia embaixo; trilho de ícones flutuante no lugar da barra.
 * - **Três números e uma lista** — na sala, esperando e urgentes, que filtram o dia numa lista só.
 * - **Atual** — o painel de abertura, as três colunas do caminho e a pauta embaixo.
 *
 * A avaliação abre numa manhã de movimento (`relogio-da-avaliacao.ts`): fora do expediente, ou no
 * fim de semana, a tela real fica vazia e não dá para comparar layout nenhum.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usarMoldura, type Moldura } from '@/components/layout/moldura'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import MeuDiaAtual from '@/features/clinico/components/meu-dia/MeuDiaAtual.vue'
import MeuDiaCartoes from '@/features/clinico/components/meu-dia/MeuDiaCartoes.vue'
import MeuDiaFoco from '@/features/clinico/components/meu-dia/MeuDiaFoco.vue'
import MeuDiaLista from '@/features/clinico/components/meu-dia/MeuDiaLista.vue'
import MeuDiaVersoes, {
  type VersaoDoMeuDia,
} from '@/features/clinico/components/meu-dia/MeuDiaVersoes.vue'
import {
  ajustarRelogio,
  type RelogioDaAvaliacao,
} from '@/features/clinico/components/meu-dia/relogio-da-avaliacao'
import { useMeuDia } from '@/features/clinico/composables/useMeuDia'

const route = useRoute()
const router = useRouter()

const relogio = computed<RelogioDaAvaliacao>({
  get: () => (route.query.relogio === 'real' ? 'real' : 'movimento'),
  set: (valor) => {
    const query = { ...route.query }

    if (valor === 'real') {
      query.relogio = 'real'
    } else {
      delete query.relogio
    }

    void router.replace({ query })
  },
})

/* Antes do `useMeuDia`: a primeira carga já sai no horário pedido. */
ajustarRelogio(relogio.value)

const dia = useMeuDia()

watch(relogio, (pedido) => {
  if (ajustarRelogio(pedido)) {
    void dia.carregar()
  }
})

const LAYOUTS = {
  foco: MeuDiaFoco,
  cartoes: MeuDiaCartoes,
  lista: MeuDiaLista,
  atual: MeuDiaAtual,
} as const

/** A moldura de cada versão: a do app; o trilho dos cartões; o topo da lista; a atual, a do portal. */
const MOLDURAS: Record<VersaoDoMeuDia, Moldura> = {
  foco: 'app',
  cartoes: 'cartoes',
  lista: 'lista',
  atual: 'portal',
}

const versao = computed<VersaoDoMeuDia>({
  get: () => {
    const pedida = route.query.versao

    return typeof pedida === 'string' && pedida in LAYOUTS ? (pedida as VersaoDoMeuDia) : 'foco'
  },
  set: (valor) => {
    void router.replace({ query: { ...route.query, versao: valor } })
  },
})

usarMoldura(() => MOLDURAS[versao.value])
</script>

<template>
  <component :is="LAYOUTS[versao]" :dia="dia">
    <template #sempre>
      <MeuDiaVersoes v-model="versao" v-model:relogio="relogio" />
      <ClinicDevPanel />
    </template>
  </component>
</template>
