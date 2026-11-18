<script setup lang="ts">
/**
 * As linhas de uma lista enquanto a primeira leitura não volta: o mesmo desenho da linha (título,
 * linha de apoio e, se a lista tiver, o botão à direita), em cinza pulsando. Assim a tela não
 * aparece vazia e depois "do nada" cheia (pedido do Luís, 17/11/2026, no Estoque das vacinas).
 *
 * Só na primeira leitura: recarregar com dados na tela mantém os dados.
 */
import Skeleton from 'primevue/skeleton'

withDefaults(defineProps<{ linhas?: number; comAcao?: boolean; rotulo?: string }>(), {
  linhas: 3,
  comAcao: false,
  rotulo: '',
})
</script>

<template>
  <ul class="ui-lista ui-linhas-carregando" aria-busy="true" :aria-label="rotulo || undefined">
    <li v-for="n in linhas" :key="n" class="ui-linha ui-linhas-carregando__linha">
      <span class="ui-linha__texto">
        <Skeleton :width="n % 2 ? '11rem' : '8.5rem'" height="0.95rem" />
        <Skeleton :width="n % 2 ? '16rem' : '13rem'" height="0.8rem" />
      </span>
      <span v-if="comAcao" class="ui-linha__fim">
        <Skeleton width="7.5rem" height="2rem" border-radius="999px" />
      </span>
    </li>
  </ul>
</template>

<style scoped>
.ui-linhas-carregando__linha {
  pointer-events: none;
}

.ui-linhas-carregando__linha .ui-linha__texto {
  gap: 7px;
}
</style>
