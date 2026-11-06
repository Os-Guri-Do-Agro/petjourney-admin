<script setup lang="ts">
/**
 * Hoje — a primeira tela da Clínica.
 *
 * Quem abre o portal às oito não pergunta "que horas tenho livre"; pergunta **o que é agora e o
 * que não pode esperar**. O desenho é o do app PetJourney (`MeuDiaFoco`), escolhido em 26/10 e
 * levado depois ao portal inteiro. Os dados vêm da rota `meu-dia` (E3-08, PJ-W2RB1D) e, no modo
 * demonstração, dos dados locais (`useMeuDia`).
 */
import { useMeuDiaDaClinica } from '@/components/meu-dia/useMeuDiaDaClinica'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import MeuDiaFoco from '@/features/clinico/components/meu-dia/MeuDiaFoco.vue'
import { useMeuDia } from '@/features/clinico/composables/useMeuDia'

const { ativo: demonstracao } = useModoDemonstracao()

/* O modo não muda com a tela aberta (trocar recarrega o portal): escolher uma vez basta. */
const dia = demonstracao.value ? useMeuDia() : useMeuDiaDaClinica()
</script>

<template>
  <MeuDiaFoco :dia="dia">
    <template v-if="demonstracao" #sempre>
      <ClinicDevPanel />
    </template>
  </MeuDiaFoco>
</template>
