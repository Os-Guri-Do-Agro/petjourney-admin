<script setup lang="ts">
/**
 * Hoje — a primeira tela da Clínica.
 *
 * Quem abre o portal às oito não pergunta "que horas tenho livre"; pergunta **o que é agora e o
 * que não pode esperar**. Os dados que respondem isso moram em `useMeuDia`; o desenho, no design
 * do app PetJourney (`MeuDiaFoco`), escolhido em 26/10 entre as versões que estavam em avaliação e
 * levado depois ao portal inteiro.
 */
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import MeuDiaFoco from '@/features/clinico/components/meu-dia/MeuDiaFoco.vue'
import { useMeuDia } from '@/features/clinico/composables/useMeuDia'

const dia = useMeuDia()
</script>

<template>
  <MeuDiaFoco :dia="dia">
    <template #sempre>
      <ClinicDevPanel />
    </template>
  </MeuDiaFoco>
</template>
