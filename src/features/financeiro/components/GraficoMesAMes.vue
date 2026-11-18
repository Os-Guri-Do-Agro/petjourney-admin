<script setup lang="ts">
/**
 * Mês a mês (protótipo): o que entrou e o que saiu, em colunas lado a lado, com o valor escrito em
 * cima de cada uma e o que sobrou embaixo do mês. Entrou na sálvia dos pets, saiu no barro (a cor
 * do custo no portal). O mês em andamento sai mais claro e diz "até hoje": não é queda, é mês pela
 * metade.
 *
 * **Por que HTML e não ApexCharts:** o Apex 7 deste projeto recebe as funções das opções como
 * objetos (conferido na instância viva: o formatador do eixo chega `undefined` e a cor por função
 * vira `object`), então o eixo saía "150000" em vez de reais. O mesmo caminho que o ranking do
 * portal tomou: em HTML o número sai escrito, o leitor de tela lê uma lista, e os dois temas vêm
 * dos tokens sem código.
 */
import { computed } from 'vue'

import { reais } from '../dados'
import type { PontoDoMes } from '../resultado'

const props = defineProps<{ pontos: PontoDoMes[] }>()

const maior = computed(() => Math.max(1, ...props.pontos.flatMap((p) => [p.entrou, p.saiu])))

function altura(valor: number) {
  return `${Math.max(2, (Math.max(0, valor) / maior.value) * 100)}%`
}

/** "121 mil": em cima da coluna cabe pouco, e o centavo não muda a leitura (a legenda diz "em reais"). */
function mil(centavos: number) {
  const valor = centavos / 100 / 1000
  const texto =
    Math.abs(valor) >= 100 ? Math.round(valor).toString() : valor.toFixed(1).replace('.', ',')
  return `${texto} mil`
}
</script>

<template>
  <div class="mm">
    <ol class="mm__meses">
      <li
        v-for="p in pontos"
        :key="p.mes"
        class="mm__mes"
        :class="{ 'mm__mes--parcial': p.parcial }"
      >
        <div class="mm__barras">
          <span class="mm__coluna">
            <span class="mm__valor ui-num">{{ mil(p.entrou) }}</span>
            <span
              class="mm__barra mm__barra--entrou"
              :style="{ height: altura(p.entrou) }"
              :title="`Entrou ${reais(p.entrou)}`"
            />
          </span>
          <span class="mm__coluna">
            <span class="mm__valor ui-num">{{ mil(p.saiu) }}</span>
            <span
              class="mm__barra mm__barra--saiu"
              :style="{ height: altura(p.saiu) }"
              :title="`Saiu ${reais(p.saiu)}`"
            />
          </span>
        </div>
        <span class="mm__rotulo">{{ p.rotulo }}<small v-if="p.parcial"> até hoje</small></span>
        <span class="mm__sobra ui-num" :class="{ 'mm__sobra--neg': p.resultado < 0 }">
          {{ p.resultado < 0 ? 'faltou' : 'sobrou' }} R$ {{ mil(Math.abs(p.resultado)) }}
        </span>
        <span class="sr-only">
          {{ p.rotulo }}: entrou {{ reais(p.entrou) }}, saiu {{ reais(p.saiu) }}, resultado
          {{ reais(p.resultado) }}.
        </span>
      </li>
    </ol>
    <p class="mm__legenda" aria-hidden="true">
      <span><i class="mm__ponto mm__ponto--entrou" /> Entrou</span>
      <span
        ><i class="mm__ponto mm__ponto--saiu" /> Saiu (repasses, equipe, custos, impostos,
        taxas)</span
      >
      <span>Valores em reais</span>
    </p>
  </div>
</template>

<style scoped>
.mm {
  display: grid;
  gap: 14px;
  padding: 8px 8px 0;
}

.mm__meses {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mm__mes {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.mm__barras {
  display: flex;
  width: 100%;
  height: 220px;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  border-bottom: 1px solid var(--linha);
}

.mm__coluna {
  display: flex;
  width: min(46%, 3.4rem);
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.mm__valor {
  color: var(--tinta-2);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.mm__barra {
  display: block;
  width: 100%;
  border-radius: 8px 8px 2px 2px;
}

.mm__barra--entrou {
  background: var(--pets);
}

.mm__barra--saiu {
  background: var(--dado-barro);
}

.mm__mes--parcial .mm__barra--entrou {
  background: color-mix(in oklab, var(--pets) 50%, var(--superficie));
}

.mm__mes--parcial .mm__barra--saiu {
  background: color-mix(in oklab, var(--dado-barro) 50%, var(--superficie));
}

.mm__rotulo {
  color: var(--tinta);
  font-size: 13px;
  font-weight: 650;
}

.mm__rotulo small {
  color: var(--tinta-2);
  font-weight: 500;
}

.mm__sobra {
  color: var(--ok-tinta);
  font-size: 12.5px;
  font-weight: 650;
}

.mm__sobra--neg {
  color: var(--risco-tinta);
}

.mm__legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.mm__legenda span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mm__ponto {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.mm__ponto--entrou {
  background: var(--pets);
}

.mm__ponto--saiu {
  background: var(--dado-barro);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
