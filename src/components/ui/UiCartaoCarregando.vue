<script setup lang="ts">
/**
 * Um cartão inteiro enquanto a primeira leitura não volta: o cabeçalho (ladrilho, título e
 * descrição) e as linhas, em cinza pulsando, na mesma caixa de véu das seções. Para as telas que
 * só desenham o cartão depois dos dados (Metas e Análise do estoque): sem ele, a tela ficava em
 * branco e os cartões apareciam de uma vez.
 */
import Skeleton from 'primevue/skeleton'

import UiLinhasCarregando from '@/components/ui/UiLinhasCarregando.vue'

withDefaults(defineProps<{ linhas?: number; comAcao?: boolean }>(), {
  linhas: 3,
  comAcao: false,
})
</script>

<template>
  <section class="ui-folha ui-cartao" aria-busy="true">
    <header class="ui-cartao__cabeca ui-cartao-carregando__cabeca">
      <Skeleton width="2.25rem" height="2.25rem" border-radius="11px" />
      <span class="ui-cartao__titulos ui-cartao-carregando__titulos">
        <Skeleton width="9rem" height="1.05rem" />
        <Skeleton width="18rem" height="0.8rem" />
      </span>
    </header>
    <UiLinhasCarregando :linhas="linhas" :com-acao="comAcao" />
  </section>
</template>

<style scoped>
.ui-cartao-carregando__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ui-cartao-carregando__titulos {
  display: grid;
  gap: 7px;
}
</style>
