<script setup lang="ts">
/**
 * O que a tela mostra a quem não vê aquela parte do financeiro (no "Ver como"): a recepção só cuida
 * do caixa; o veterinário vê só os próprios repasses. Diz o porquê e leva aonde a pessoa trabalha,
 * em vez de uma tela vazia que parece quebrada.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'

import { profissional } from '../dados'
import { useFinanceiro } from '../estado'

const { perfil } = useFinanceiro()
const router = useRouter()

const texto = computed(() =>
  perfil.value.tipo === 'veterinario'
    ? `${profissional(perfil.value.id).curto} vê só o que tem a receber: o extrato dos atendimentos, a regra combinada e os pagamentos. Os números da clínica ficam com a gestão.`
    : 'A recepção cuida do caixa e das notas fiscais: receber, emitir a nota, abrir e fechar o dia. Contas, repasses e o resultado ficam com a dona, a gestão e o financeiro.',
)

const destino = computed(() =>
  perfil.value.tipo === 'veterinario'
    ? { rotulo: 'Ver meus repasses', to: '/clinica/financeiro/repasses', icone: 'ph ph-hand-coins' }
    : { rotulo: 'Ir para o caixa', to: '/clinica/financeiro', icone: 'ph ph-cash-register' },
)
</script>

<template>
  <UiVazioIlustrado icone="ph ph-lock-key" titulo="Esta parte é da gestão" :texto="texto">
    <template #acao>
      <Button
        type="button"
        :icon="destino.icone"
        :label="destino.rotulo"
        @click="router.push(destino.to)"
      />
    </template>
  </UiVazioIlustrado>
</template>
