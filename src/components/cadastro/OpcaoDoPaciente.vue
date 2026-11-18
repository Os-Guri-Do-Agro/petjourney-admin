<script setup lang="ts">
/**
 * A opção de paciente nos seletores das gavetas (marcar horário, internar, fila, reserva, cópia do
 * prontuário, escolher paciente): o rosto do pet ao lado do texto da opção. Quem reconhece o animal
 * pela foto acha o certo antes de ler o nome do responsável.
 *
 * A foto é a da lista de pacientes (`fotoUrl`): a da clínica ou a miniatura do app. Sem ela, ou
 * quando ela não carrega, as iniciais com a silhueta da espécie.
 */
import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

defineProps<{
  paciente: { nome: string; especie?: string | null; fotoUrl?: string | null }
}>()
</script>

<template>
  <span class="opcao-do-paciente">
    <PetAvatar
      :nome="paciente.nome"
      :iniciais="iniciais(paciente.nome)"
      :especie="paciente.especie ? (ESPECIE_DO_AVATAR[paciente.especie] ?? null) : null"
      :foto-url="paciente.fotoUrl"
      tamanho="sm"
    />
    <span class="opcao-do-paciente__texto"><slot /></span>
  </span>
</template>

<style scoped>
.opcao-do-paciente {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.opcao-do-paciente__texto {
  min-width: 0;
}
</style>
