<script setup lang="ts">
/**
 * Saúde pública › Relatórios (protótipo), em duas abas (`?aba=`):
 *
 * - **Atendimentos por lugar** (17/11/2026, a padrão): os atendimentos do Consultório Móvel e das
 *   campanhas por região, bairro ou CEP, com quantos deram certo e por que o resto não deu. Imprime
 *   e baixa em planilha.
 * - **Relatório de 90 dias** (Ofício 001/2026, item 7): a folha que o ofício promete à Câmara.
 *
 * Cada aba imprime a sua folha: a cópia do papel (no `body`, marcada `clinic-print-root`) só existe
 * com a aba aberta, para a impressão não juntar as duas.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import RelatorioDe90Dias from '@/features/saude-publica/components/RelatorioDe90Dias.vue'
import RelatorioDeAtendimentos from '@/features/saude-publica/components/RelatorioDeAtendimentos.vue'
import type { Aba } from '@/navegacao/espacos'

type AbaDoRelatorio = 'atendimentos' | '90-dias'

const route = useRoute()
const router = useRouter()

const abaAtual = computed<AbaDoRelatorio>(() =>
  route.query.aba === '90-dias' ? '90-dias' : 'atendimentos',
)

function destino(aba: AbaDoRelatorio) {
  const query = { ...route.query }
  if (aba === 'atendimentos') delete query.aba
  else query.aba = aba
  return router.resolve({ path: '/saude-publica/relatorio', query }).fullPath
}

const abas = computed<Aba[]>(() => [
  { rotulo: 'Atendimentos por lugar', icone: 'ph ph-map-pin-area', to: destino('atendimentos') },
  { rotulo: 'Relatório de 90 dias', icone: 'ph ph-file-text', to: destino('90-dias') },
])

const resumo = computed(() =>
  abaAtual.value === 'atendimentos'
    ? 'Os atendimentos do Consultório Móvel e das campanhas por região, bairro ou CEP, para imprimir ou baixar em planilha.'
    : 'O que o ofício promete à Câmara em 90 dias, pronto para imprimir ou salvar em PDF.',
)

const atendimentos = ref<InstanceType<typeof RelatorioDeAtendimentos> | null>(null)

function imprimir() {
  window.print()
}
</script>

<template>
  <UiPagina
    titulo="Relatórios"
    icone="ph ph-file-text"
    :resumo="resumo"
    :abas-da-tela="abas"
    :aba-atual="destino(abaAtual)"
  >
    <template #acoes>
      <template v-if="abaAtual === 'atendimentos'">
        <Button
          type="button"
          icon="ph ph-download-simple"
          label="Baixar planilha"
          @click="atendimentos?.baixarPlanilha()"
        />
        <Button
          type="button"
          icon="ph ph-printer"
          label="Imprimir relatório"
          @click="atendimentos?.imprimir()"
        />
      </template>
      <Button
        v-else
        type="button"
        icon="ph ph-printer"
        label="Imprimir ou salvar PDF"
        @click="imprimir"
      />
    </template>

    <div class="rl">
      <AvisoDoPrototipo />
      <RelatorioDeAtendimentos v-if="abaAtual === 'atendimentos'" ref="atendimentos" />
      <RelatorioDe90Dias v-else />
    </div>

    <Teleport v-if="abaAtual === '90-dias'" to="body">
      <div class="clinic-print-root rl-impressao" aria-hidden="true">
        <RelatorioDe90Dias papel />
      </div>
    </Teleport>
  </UiPagina>
</template>

<style scoped>
.rl {
  display: grid;
  gap: 22px;
}

/* Na tela, a cópia do papel nunca aparece; na impressão, a regra do portal a mostra. */
.rl-impressao {
  display: none;
}
</style>
