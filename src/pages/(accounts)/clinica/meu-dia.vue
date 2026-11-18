<script setup lang="ts">
/**
 * Hoje — a primeira tela da Clínica.
 *
 * Quem abre o portal às oito não pergunta "que horas tenho livre"; pergunta **o que é agora e o
 * que não pode esperar**. O desenho é o do app PetJourney (`MeuDiaFoco`), escolhido em 26/10 e
 * levado depois ao portal inteiro. Os dados vêm da rota `meu-dia` (E3-08, PJ-W2RB1D).
 */
import { useMeuDiaDaClinica } from '@/components/meu-dia/useMeuDiaDaClinica'
import MeuDiaFoco from '@/features/clinico/components/meu-dia/MeuDiaFoco.vue'

const dia = useMeuDiaDaClinica()
</script>

<template>
  <MeuDiaFoco :dia="dia" />
</template>
