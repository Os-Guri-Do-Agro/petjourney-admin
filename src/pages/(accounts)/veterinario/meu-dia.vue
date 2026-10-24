<script setup lang="ts">
/**
 * Hoje — a primeira tela da Clínica.
 *
 * Quem abre o portal às oito não pergunta "que horas tenho livre"; pergunta **o que é agora e o
 * que não pode esperar**. Os dados que respondem isso moram em `useMeuDia`; o desenho está em
 * avaliação, com três versões novas (cada uma com layout e design próprios) e a de antes lado a
 * lado (`MeuDiaVersoes`):
 *
 * - **Foco**, no design do app (perfil de parceiro) — o paciente da vez em destaque, a fila numa
 *   lista só, as pendências na coluna.
 * - **Linha do dia**, no design planilha — o dia inteiro numa tabela por horário, com o agora
 *   marcado nela.
 * - **Mesa**, no design ferramenta — filas, lista e ficha lado a lado, como uma caixa de entrada.
 * - **Atual** — o painel de abertura, as três colunas do caminho e a pauta embaixo.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import MeuDiaAtual from '@/features/clinico/components/meu-dia/MeuDiaAtual.vue'
import MeuDiaFoco from '@/features/clinico/components/meu-dia/MeuDiaFoco.vue'
import MeuDiaLinhaDoDia from '@/features/clinico/components/meu-dia/MeuDiaLinhaDoDia.vue'
import MeuDiaMesa from '@/features/clinico/components/meu-dia/MeuDiaMesa.vue'
import MeuDiaVersoes, {
  type VersaoDoMeuDia,
} from '@/features/clinico/components/meu-dia/MeuDiaVersoes.vue'
import { useMeuDia } from '@/features/clinico/composables/useMeuDia'

const route = useRoute()
const router = useRouter()
const dia = useMeuDia()

const LAYOUTS = {
  foco: MeuDiaFoco,
  linha: MeuDiaLinhaDoDia,
  mesa: MeuDiaMesa,
  atual: MeuDiaAtual,
} as const

const versao = computed<VersaoDoMeuDia>({
  get: () => {
    const pedida = route.query.versao

    return typeof pedida === 'string' && pedida in LAYOUTS ? (pedida as VersaoDoMeuDia) : 'foco'
  },
  set: (valor) => {
    void router.replace({ query: { ...route.query, versao: valor } })
  },
})
</script>

<template>
  <component :is="LAYOUTS[versao]" :dia="dia">
    <template #sempre>
      <MeuDiaVersoes v-model="versao" />
      <ClinicDevPanel />
    </template>
  </component>
</template>
