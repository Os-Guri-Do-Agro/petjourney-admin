<script setup lang="ts">
/**
 * O ícone de cada serviço do hotel.
 *
 * ## Por que existe um mapa, e por que ele mora num lugar só
 *
 * O mapa `TarefaKind → ícone` estava **copiado em dois componentes** — a linha da prancheta e o
 * cabeçalho da ronda —, e cópia de mapa é cópia que diverge: bastava alguém acrescentar um
 * serviço novo num lugar para o outro passar a desenhar `undefined`. Aqui ele existe uma vez.
 *
 * ## Por que estes ícones, e não os que já estavam
 *
 * A versão anterior pegava emprestado o que o conjunto genérico do framework tinha, e o resultado
 * dizia coisas erradas: **sacola de compras** para refeição, **nuvem** para água, **sol** para
 * banho, **gráfico de barras** para pesagem. Não era só frieza — um ícone que mostra uma sacola
 * onde há uma tigela ensina a não olhar para os ícones, e a partir daí a coluna inteira vira
 * enfeite. Quem trabalha no canil varre a prancheta pelo desenho antes de ler a palavra; se o
 * desenho mente, a varredura morre.
 *
 * O Phosphor foi escolhido porque tem o vocabulário deste domínio pronto e desenhado por quem
 * desenha ícones: tigela de comida, gota, cápsula, pata, bolinha, vassoura, banheira, tesoura,
 * ossinho e balança. Cada serviço passou a ter a forma da coisa.
 *
 * ## Por que o peso `duotone`
 *
 * É o peso que dá simpatia sem infantilizar: a silhueta preenchida em transparência por baixo do
 * contorno deixa o ícone cheio e macio a 14 px — que é o tamanho dele dentro do disco —, onde um
 * contorno fino vira risco ilegível. E usa **uma cor só**, herdada do disco, então continua
 * obedecendo a regra da casa de que o estado mora no disco e o ícone só acompanha.
 */
import {
  PhBathtub,
  PhBone,
  PhBowlFood,
  PhBroom,
  PhDrop,
  PhPawPrint,
  PhPill,
  PhScales,
  PhScissors,
  PhTennisBall,
} from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'

import type { TarefaKind } from '../../data/types'

const props = defineProps<{ kind: TarefaKind }>()

/**
 * O mapa é `Record<TarefaKind, …>` de propósito: acrescentar um serviço ao domínio sem dar ícone
 * a ele passa a ser erro de compilação, e não um quadrado vazio descoberto em produção.
 */
const ICONES: Record<TarefaKind, Component> = {
  refeicao: PhBowlFood,
  agua: PhDrop,
  medicacao: PhPill,
  /* Passeio é o que o animal faz com as patas; a pata lê em 14 px, a coleira não. */
  passeio: PhPawPrint,
  recreacao: PhTennisBall,
  /* Vassoura, e não sabonete: `higiene` no domínio é a limpeza da acomodação, não do animal. */
  higiene: PhBroom,
  banho: PhBathtub,
  tosa: PhScissors,
  /* O ossinho é o prêmio, que é com o que se adestra. */
  adestramento: PhBone,
  pesagem: PhScales,
}

const icone = computed(() => ICONES[props.kind])
</script>

<template>
  <component :is="icone" class="icone" weight="duotone" aria-hidden="true" />
</template>

<style scoped>
/*
 * O tamanho vem do `font-size` do disco que envolve o ícone — era assim que o ícone de fonte
 * anterior se dimensionava, então nenhuma caixa da tela precisou mudar de medida junto com o
 * desenho.
 */
.icone {
  width: 1.45em;
  height: 1.45em;
  flex: 0 0 auto;
}
</style>
