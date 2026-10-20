<script setup lang="ts">
/**
 * O trilho dos passos do atendimento.
 *
 * A consulta tem cinco momentos — anamnese, exame, diagnóstico, conduta e o resumo que fecha — e
 * eles acontecem em ordem, com o paciente na mesa. A tela mostra **um momento por vez**; o trilho
 * é o mapa dos cinco, e responde de relance as três perguntas de quem volta ao computador depois
 * de examinar o animal: o que já foi feito, onde estou, o que falta.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Um trilho de verdade, lido da esquerda para a direita: um disco por passo, ligados por um fio
 * que se preenche à medida que os passos ficam prontos. Embaixo do disco, o nome do passo e o
 * **resumo do que já está nele** ("Claudicação há 3 dias", "4 de 7 aferidos") — é o que dispensa
 * abrir a etapa só para lembrar o que tem lá. Sem nada registrado, o lugar do resumo diz o estado
 * em palavra ("A fazer").
 *
 * - **Feito**: disco cheio em musgo com o visto.
 * - **Atual**: anel na cor do lugar, nome em tinta cheia, e o passo inteiro numa placa tingida
 *   na cor do lugar (acabamento de 20/10/2026) — o trilho mora num cartão, e a placa acesa é o
 *   "você está aqui" que se acha de longe.
 * - **A fazer**: o número no disco vazio.
 * - **Em andamento**: o número sobre o fundo do lugar.
 * - **Pede atenção**: o aviso em risco, e o resumo do passo diz o quê.
 *
 * O estado nunca vai só na cor: o ícone muda, e o leitor de tela ouve a palavra.
 *
 * A variante `mini` é a mesma navegação em cinco discos, para a barra que acompanha a rolagem.
 *
 * Cada passo é um botão: `Tab` percorre, `Enter` entra, `Alt + →` e `Alt + ←` andam (a página
 * escuta). Não é o `Stepper` do PrimeVue de propósito: ele seria dono dos painéis e do valor
 * ativo, e aqui quem troca a etapa é a página (rodapé, atalho, URL).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { EstadoDaEtapa } from '../../domain/encounter-progress'
import type { PassoProntuario } from './step-types'

const props = withDefaults(
  defineProps<{
    passos: PassoProntuario[]
    ativo: string
    /** Cinco discos sem texto, para a barra fixa no alto. */
    mini?: boolean
  }>(),
  { mini: false },
)

const emit = defineEmits<{ ir: [id: string] }>()

const { t } = useI18n()

const ICONE: Partial<Record<EstadoDaEtapa, string>> = {
  completo: 'ph ph-check',
  alerta: 'ph ph-warning',
}

const indiceAtivo = computed(() => props.passos.findIndex((passo) => passo.id === props.ativo))

function estadoEmPalavra(estado: EstadoDaEtapa) {
  return t(`clinico.prontuario.nova.passos.estado.${estado}`)
}

/** O que o leitor de tela ouve no botão: "Etapa 2 de 5, Exame físico, em andamento". */
function rotuloAcessivel(passo: PassoProntuario, indice: number) {
  return [
    t('clinico.prontuario.nova.passos.numero', {
      numero: indice + 1,
      total: props.passos.length,
    }),
    passo.rotulo,
    estadoEmPalavra(passo.estado),
  ].join(', ')
}
</script>

<template>
  <nav
    class="trilho"
    :class="{ 'trilho--mini': mini }"
    :aria-label="t('clinico.prontuario.passos.aria')"
  >
    <ol class="trilho__lista">
      <li
        v-for="(passo, indice) in passos"
        :key="passo.id"
        class="passo"
        :class="[
          `passo--${passo.estado}`,
          {
            'passo--atual': passo.id === ativo,
            'passo--antes': indice < indiceAtivo,
          },
        ]"
      >
        <button
          type="button"
          class="passo__botao"
          :aria-current="passo.id === ativo ? 'step' : undefined"
          :aria-label="mini ? rotuloAcessivel(passo, indice) : undefined"
          :title="mini ? passo.rotulo : undefined"
          @click="emit('ir', passo.id)"
        >
          <span class="passo__linha">
            <span class="passo__disco" aria-hidden="true">
              <i v-if="ICONE[passo.estado]" :class="ICONE[passo.estado]" />
              <span v-else class="ui-num">{{ indice + 1 }}</span>
            </span>
            <!-- O fio até o próximo disco: cheio quando este passo está pronto. -->
            <span v-if="indice < passos.length - 1" class="passo__fio" aria-hidden="true" />
          </span>

          <span v-if="!mini" class="passo__textos">
            <span class="passo__rotulo">{{ passo.rotulo }}</span>
            <span class="passo__resumo" :class="{ 'passo__resumo--estado': !passo.resumo }">
              {{ passo.resumo || estadoEmPalavra(passo.estado) }}
            </span>
            <span class="sr-only">{{ estadoEmPalavra(passo.estado) }}</span>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.trilho {
  min-width: 0;
}

.trilho__lista {
  display: grid;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  list-style: none;
}

.passo {
  position: relative;
  min-width: 0;
}

/*
 * Cada passo é uma placa clicável: o passo atual acende numa placa tingida na cor do lugar, os
 * outros ganham o poço no hover. O fio atravessa o respiro da placa até perto do próximo disco.
 */
.passo__botao {
  display: grid;
  width: 100%;
  min-width: 0;
  align-content: start;
  gap: 10px;
  padding: 12px 14px 14px;
  border: 0;
  border-radius: var(--raio-cartao-pequeno);
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.passo__botao:hover {
  background: var(--superficie-2);
}

.passo--atual .passo__botao,
.passo--atual .passo__botao:hover {
  background: color-mix(in oklab, var(--pj-lugar-fundo, var(--musgo-fundo)) 62%, var(--superficie));
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--pj-lugar, var(--musgo)) 22%, transparent);
}

.passo__botao:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

/* O disco e o fio que leva ao próximo, na mesma linha. */
.passo__linha {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.passo__disco {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 1.5px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 650;
  transition:
    background var(--pj-tempo-curto) ease,
    border-color var(--pj-tempo-curto) ease,
    box-shadow var(--pj-tempo-curto) ease;
}

.passo__disco i {
  font-size: 16px;
  font-weight: 700;
}

.passo__fio {
  position: relative;
  z-index: 1;
  height: 2px;
  flex: 1;
  margin-inline-end: -18px;
  border-radius: 2px;
  background: var(--linha-media);
}

/* Feito: disco cheio, e o fio até o próximo também. */
.passo--completo .passo__disco {
  border-color: var(--musgo);
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.passo--completo .passo__fio {
  background: var(--musgo);
}

.passo--parcial .passo__disco {
  border-color: color-mix(in oklab, var(--pj-lugar, var(--musgo)) 55%, transparent);
  background: var(--pj-lugar-fundo, var(--musgo-fundo));
  color: var(--pj-lugar-tinta, var(--musgo));
}

.passo--alerta .passo__disco {
  border-color: var(--risco);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* Atual: o anel na cor do lugar, por fora do disco, sem mexer no tamanho. */
.passo--atual .passo__disco {
  box-shadow:
    0 0 0 3px var(--superficie),
    0 0 0 5px var(--pj-lugar, var(--musgo));
}

.passo--atual.passo--vazio .passo__disco {
  border-color: var(--pj-lugar, var(--musgo));
  color: var(--pj-lugar-tinta, var(--musgo));
}

.passo__textos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.passo__rotulo {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 15px;
  font-weight: 550;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.passo--atual .passo__rotulo {
  color: var(--tinta);
  font-weight: 650;
}

.passo__resumo {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.passo__resumo--estado {
  color: var(--tinta-3);
}

.passo--alerta .passo__resumo {
  color: var(--risco-tinta);
  font-weight: 550;
}

.passo__botao:hover .passo__rotulo {
  color: var(--tinta);
}

.passo__botao:hover .passo__disco {
  border-color: var(--tinta-3);
}

.passo--completo .passo__botao:hover .passo__disco {
  border-color: var(--musgo);
}

/* ------------------------------------------------------------------ mini */

.trilho--mini .trilho__lista {
  display: flex;
  gap: 0;
}

.trilho--mini .passo__botao {
  width: auto;
  padding: 4px;
  border-radius: 999px;
}

.trilho--mini .passo__linha {
  gap: 0;
}

.trilho--mini .passo__disco {
  width: 26px;
  height: 26px;
  font-size: 12px;
}

.trilho--mini .passo__disco i {
  font-size: 13px;
}

.trilho--mini .passo__fio {
  width: 10px;
  flex: none;
  margin: 0 0 0 4px;
}

.trilho--mini .passo--atual .passo__disco {
  box-shadow:
    0 0 0 2px var(--superficie),
    0 0 0 4px var(--pj-lugar, var(--musgo));
}

.trilho--mini .passo__botao,
.trilho--mini .passo__botao:hover,
.trilho--mini .passo--atual .passo__botao,
.trilho--mini .passo--atual .passo__botao:hover {
  background: none;
  box-shadow: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Tablet: o resumo cabe em uma linha só. Celular: só o nome do passo atual aparece. */
@media (max-width: 1100px) {
  .passo__resumo {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
}

@media (max-width: 720px) {
  .trilho__lista {
    position: relative;
  }

  .passo {
    position: static;
  }

  .passo__botao {
    padding: 8px;
  }

  .passo__fio {
    margin-inline-end: -12px;
  }

  .passo__textos {
    display: none;
  }

  .passo--atual .passo__textos {
    position: absolute;
    top: 58px;
    left: 8px;
    display: grid;
    width: max-content;
    max-width: calc(100vw - 48px);
  }

  .passo--atual .passo__resumo {
    display: none;
  }

  .trilho:not(.trilho--mini) .trilho__lista {
    padding-bottom: 26px;
  }

  .passo__disco {
    width: 30px;
    height: 30px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .passo__disco,
  .passo__botao {
    transition: none;
  }
}
</style>
