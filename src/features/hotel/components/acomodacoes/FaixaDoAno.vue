<script setup lang="ts">
/**
 * O ano inteiro numa régua, com a temporada acesa em cima dele.
 *
 * ## Por que existe
 *
 * A lista de temporadas dizia "20/12 → 05/01" e mais nada. Duas datas em texto não respondem as
 * perguntas que quem cadastra preço realmente faz: **quando no ano isso cai**, **quanto tempo
 * dura** e **encosta na outra?**. Ler isso de `01/07 → 31/07` contra `20/12 → 05/01` exige montar
 * o calendário de cabeça, e é exatamente o tipo de conta que a pessoa erra na hora de dar desconto.
 *
 * Na régua as três respostas são imediatas: a posição diz quando, a largura diz quanto tempo, e
 * duas réguas empilhadas mostram sobreposição sem ninguém precisar comparar número.
 *
 * ## A virada do ano
 *
 * Uma temporada cujo fim é menor que o início atravessa dezembro. Ela sai em **dois** pedaços — a
 * ponta que fecha o ano e a que abre o seguinte —, que é como o cálculo de preço já a materializa.
 * Desenhá-la como um bloco só, do meio de dezembro ao começo de janeiro, seria desenhar uma faixa
 * andando para trás.
 */
import { computed } from 'vue'

const props = defineProps<{
  /** `MM-DD`. */
  inicio: string
  /** `MM-DD`. Menor que o início significa que a faixa atravessa a virada do ano. */
  fim: string
}>()

/* Dias acumulados até o primeiro de cada mês, em ano comum. Fevereiro com 28: a régua é leitura, e
   um dia de erro a cada quatro anos não muda onde o olho acha o Natal. */
const ACUMULADO = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]

function fracao(mesDia: string) {
  const [mes, dia] = mesDia.split('-').map(Number)

  if (!mes || !dia) {
    return 0
  }

  return (ACUMULADO[Math.min(11, Math.max(0, mes - 1))]! + (dia - 1)) / 365
}

const pedacos = computed(() => {
  const de = fracao(props.inicio)
  const ate = fracao(props.fim)

  if (ate >= de) {
    return [{ de, largura: Math.max(0.004, ate - de) }]
  }

  return [
    { de, largura: Math.max(0.004, 1 - de) },
    { de: 0, largura: Math.max(0.004, ate) },
  ]
})

const pct = (valor: number) => `${(valor * 100).toFixed(2)}%`
</script>

<template>
  <span class="regua" aria-hidden="true">
    <!-- Os traços dos meses: quatro marcas, nos trimestres, para não virar grade. -->
    <span v-for="marca in [0.25, 0.5, 0.75]" :key="marca" class="regua__marca" :style="{ insetInlineStart: pct(marca) }" />

    <span
      v-for="(pedaco, indice) in pedacos"
      :key="indice"
      class="regua__faixa"
      :style="{ insetInlineStart: pct(pedaco.de), inlineSize: pct(pedaco.largura) }"
    />
  </span>
</template>

<style scoped>
.regua {
  position: relative;
  display: block;
  overflow: hidden;
  block-size: 6px;
  border-radius: 999px;
  background: var(--superficie-3);
}

/*
 * As marcas de trimestre ficam **atrás** da faixa, e não por cima: por cima, elas cortariam a
 * temporada em pedaços e sugeririam uma divisão que não existe no preço.
 */
.regua__marca {
  position: absolute;
  inset-block: 0;
  inline-size: 2px;
  background: var(--superficie);
}

.regua__faixa {
  position: absolute;
  inset-block: 0;
  border-radius: 999px;
  background: var(--hotel);
}
</style>
