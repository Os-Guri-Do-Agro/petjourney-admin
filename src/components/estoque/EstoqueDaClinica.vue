<script setup lang="ts">
/**
 * O estoque de vacinas pela API (E6, PJ-RFFOKT): a geladeira (o trabalho de todo dia), os
 * movimentos (a conferência) e a análise (os gráficos, que não pedem ação), num controle logo
 * abaixo do título. A aba vive na URL (`?aba=movimentos|analise`; a geladeira é o endereço limpo).
 */
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'

import AnaliseDoEstoque from './AnaliseDoEstoque.vue'
import GeladeiraDoEstoque from './GeladeiraDoEstoque.vue'
import MovimentosDoEstoque from './MovimentosDoEstoque.vue'

const ABAS = ['geladeira', 'movimentos', 'analise'] as const
type AbaDoEstoque = (typeof ABAS)[number]

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const aba = computed<AbaDoEstoque>({
  get: () => {
    const pedida = route.query.aba
    return typeof pedida === 'string' && (ABAS as readonly string[]).includes(pedida)
      ? (pedida as AbaDoEstoque)
      : 'geladeira'
  },
  set: (nova) => {
    const query = { ...route.query }
    if (nova === 'geladeira') delete query.aba
    else query.aba = nova
    void router.replace({ query })
  },
})

const opcoes = computed(() => ABAS.map((valor) => ({ valor, rotulo: t(`estoque.abas.${valor}`) })))

/** O resumo vem da geladeira (o que há, o que falta, o que vence). */
const resumo = ref('')
</script>

<template>
  <UiPagina
    :titulo="t('estoque.titulo')"
    :resumo="aba === 'geladeira' ? resumo : ''"
    icone="ph ph-snowflake"
  >
    <div class="ec">
      <SelectButton
        v-model="aba"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('estoque.abas.rotulo')"
        class="ec__abas"
      />
      <GeladeiraDoEstoque v-if="aba === 'geladeira'" @resumo="(texto) => (resumo = texto)" />
      <MovimentosDoEstoque v-else-if="aba === 'movimentos'" />
      <AnaliseDoEstoque v-else />
    </div>
  </UiPagina>
</template>

<style scoped>
.ec {
  display: grid;
  gap: 20px;
}

.ec__abas {
  justify-self: start;
}
</style>
