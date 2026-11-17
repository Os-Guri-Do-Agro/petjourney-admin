<script setup lang="ts">
/** `/saude-publica` abre o Painel do protótipo (as abas moram em subcaminhos, ver `espacos.ts`). */
import { useRouter } from 'vue-router'

const router = useRouter()

void router.replace('/saude-publica/painel')
</script>

<template>
  <span />
</template>
