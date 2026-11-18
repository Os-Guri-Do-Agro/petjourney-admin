<script setup lang="ts">
/**
 * Cadastrar paciente. Desde 17/11/2026 o cadastro é uma gaveta em passos na lista de Pacientes:
 * este endereço só leva até ela (`/clinica/pacientes?novo=1`), para os links e favoritos de antes
 * continuarem funcionando.
 */
import { useRouter } from 'vue-router'

const router = useRouter()

void router.replace({ path: '/clinica/pacientes', query: { novo: '1' } })
</script>

<template>
  <span hidden />
</template>
