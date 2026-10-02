<script setup lang="ts" generic="T extends string | number | boolean | null">
/**
 * Escolha entre poucas opções, em linha.
 *
 * Um `Select` para responder "sim ou não" custa dois cliques e esconde a resposta atrás de um
 * campo fechado. Com três opções ou menos, mostrar todas de uma vez é mais rápido de ler e de
 * responder — e o formulário deixa de parecer uma coluna de caixas iguais.
 *
 * **A marcação precisa saltar.** A primeira versão distinguia o escolhido só por um fundo
 * `surface` sobre `surface-soft` — diferença de dois por cento de luminância, que some numa
 * lista de oito linhas. Agora o escolhido ganha anel, peso e fundo próprios: três sinais, e
 * nenhum deles depende de enxergar cor, o que mantém a régua da escala de cinza.
 *
 * O `tom` é opcional e carrega **significado**, não enfeite: numa lista de sistemas, ver de
 * relance quais estão normais, quais alterados e quais nem foram avaliados é o motivo de a
 * lista existir.
 *
 * É um `radiogroup` de verdade — e agora com o teclado que a função exige.
 *
 * **A afirmação estava no comentário e não no código.** Cada opção era um `button` solto: o Tab
 * percorria todas (oito sistemas × três opções = vinte e quatro paradas para atravessar um
 * formulário) e as setas não faziam nada.
 *
 * Agora vale o padrão de `radiogroup`:
 *
 * - **Uma parada de Tab por grupo** (tabindex móvel). O grupo é uma pergunta, não três.
 * - **Setas navegam e escolhem.** Num radiogroup, mover é escolher — é o que o leitor de tela
 *   anuncia e o que o dedo espera.
 * - **Número escolhe direto.** É a tecla que faz o prontuário andar: com o grupo em foco, `2`
 *   marca a segunda opção sem passar pela primeira. Oito sistemas viram oito toques.
 */
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, ref } from 'vue'

export type TomDaOpcao = 'neutro' | 'ok' | 'atencao' | 'risco' | 'acento'

/**
 * `contagem` desenha o número num selo de 6 px ao lado do rótulo, na cor do tom da opção — o
 * "Checklist · 1" escrito no texto virava parte do nome e não se lia como número.
 */
type Opcao = { valor: T; rotulo: string; icone?: string; tom?: TomDaOpcao; contagem?: number }

const props = defineProps<{
  modelValue: T
  opcoes: Opcao[]
  rotulo: string
  desabilitado?: boolean
  /** Permite desmarcar clicando na opção já escolhida. */
  limpavel?: boolean
  /** Valor devolvido ao limpar. */
  vazio?: T
}>()

const emit = defineEmits<{ 'update:modelValue': [valor: T] }>()

const grupo = ref<{ $el: HTMLElement } | null>(null)

const indiceAtivo = computed(() => {
  const encontrado = props.opcoes.findIndex((opcao) => opcao.valor === props.modelValue)

  /* Nada escolhido: a primeira opção carrega o foco, para o grupo ter uma porta de entrada. */
  return encontrado >= 0 ? encontrado : 0
})

/**
 * O `SelectButton` desenha as opções, mas a semântica continua sendo a de `radiogroup`.
 *
 * Ele nasce como `group` de botões com `aria-pressed` e uma parada de Tab por opção — o oposto
 * do que este componente promete. O passthrough de cada `ToggleButton` devolve o papel de
 * `radio`, o `aria-checked`, o tabindex móvel e o tom da opção.
 *
 * O botão só conhece o próprio rótulo (`onLabel`), então é por ele que se acha o índice.
 */
const indicePorRotulo = computed(
  () => new Map(props.opcoes.map((opcao, indice) => [opcao.rotulo, indice])),
)

const passthrough = computed(() => ({
  pcToggleButton: {
    root: ({ props: botao }: { props: { onLabel?: string } }) => {
      const indice = indicePorRotulo.value.get(botao.onLabel ?? '') ?? -1
      const opcao = props.opcoes[indice]

      return {
        class: ['grupo__opcao', `grupo__opcao--${opcao?.tom ?? 'acento'}`],
        role: 'radio',
        'aria-checked': opcao !== undefined && opcao.valor === props.modelValue,
        'aria-pressed': undefined,
        tabindex: indice === indiceAtivo.value ? 0 : -1,
        title: opcao ? `${opcao.rotulo} (${indice + 1})` : undefined,
      }
    },
  },
}))

function focarOpcao(indice: number) {
  const alvo = grupo.value?.$el?.querySelectorAll<HTMLElement>('[role="radio"]')?.[indice]

  alvo?.focus()
}

/**
 * Move e escolhe ao mesmo tempo.
 *
 * Em `radiogroup`, navegar **é** selecionar — separar as duas coisas obrigaria a apertar
 * espaço depois de cada seta, e é o que faz teclado parecer mais lento que mouse.
 *
 * Circular: da última volta para a primeira. Um grupo de três opções não tem por que ter parede.
 */
function mover(passo: number) {
  if (props.desabilitado) {
    return
  }

  const total = props.opcoes.length
  const proximo = (indiceAtivo.value + passo + total) % total
  const opcao = props.opcoes[proximo]

  if (opcao) {
    emit('update:modelValue', opcao.valor)
    nextTick(() => focarOpcao(proximo))
  }
}

function aoTeclar(evento: KeyboardEvent) {
  if (props.desabilitado) {
    return
  }

  const teclas: Record<string, () => void> = {
    ArrowRight: () => mover(1),
    ArrowDown: () => mover(1),
    ArrowLeft: () => mover(-1),
    ArrowUp: () => mover(-1),
    Home: () => mover(-indiceAtivo.value),
    End: () => mover(props.opcoes.length - 1 - indiceAtivo.value),
  }

  const acao = teclas[evento.key]

  if (acao) {
    evento.preventDefault()
    acao()

    return
  }

  /*
   * Número escolhe direto. É o atalho que faz o exame físico andar: com o grupo em foco,
   * "1 2 1 1 3" preenche cinco sistemas sem tirar a mão do teclado.
   */
  const numero = Number(evento.key)

  if (Number.isInteger(numero) && numero >= 1 && numero <= props.opcoes.length) {
    evento.preventDefault()
    mover(numero - 1 - indiceAtivo.value)
  }
}

/**
 * Clique numa opção.
 *
 * Com `limpavel`, o `SelectButton` devolve `null` ao desmarcar; aqui ele vira o `vazio` que
 * quem usa o grupo combinou. Sem `limpavel`, a opção já escolhida nem chega a emitir.
 */
function escolher(valor: T | null) {
  if (props.desabilitado) {
    return
  }

  if (valor === null && props.limpavel) {
    emit('update:modelValue', (props.vazio ?? null) as T)

    return
  }

  emit('update:modelValue', valor as T)
}
</script>

<template>
  <SelectButton
    ref="grupo"
    class="grupo"
    :model-value="modelValue"
    :options="opcoes"
    option-label="rotulo"
    option-value="valor"
    :disabled="desabilitado"
    :allow-empty="Boolean(limpavel)"
    role="radiogroup"
    :aria-label="rotulo"
    :pt="passthrough"
    @update:model-value="escolher"
    @keydown="aoTeclar"
  >
    <template #option="{ option }">
      <i v-if="option.icone" :class="option.icone" aria-hidden="true" />
      <span>{{ option.rotulo }}</span>
      <span v-if="option.contagem !== undefined" class="grupo__contagem">
        {{ option.contagem }}
      </span>
    </template>
  </SelectButton>
</template>

<style scoped>
/*
 * Pílulas, como as ações da Visão geral (redesenho de 30/09/2026).
 *
 * O trilho é uma pílula branca de fio fino, e a opção escolhida, uma pílula de fundo dentro dele:
 * verde-clara com a tinta da marca, ou o par do tom dela (ok, atenção, risco, neutro). Três sinais
 * somados — forma (a pílula de fundo), peso e cor —, e em escala de cinza a forma e o peso bastam.
 * A primeira versão marcava com um anel de 1,5 px numa caixa rebaixada, que lia como campo de
 * formulário até quando o grupo era um filtro.
 *
 * `.grupo.p-selectbutton` mais `:deep` porque os botões são filhos do `SelectButton` e não
 * recebem o atributo de escopo — e a especificidade precisa passar a do tema e a da camada
 * global da clínica (`.clinic-scope .p-togglebutton`).
 */
.grupo.p-selectbutton {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--clinic-line);
  /*
   * Meia altura de uma linha (alvo + 3 px de respiro + 1 px de fio, dos dois lados), e não 999 px:
   * numa linha é a mesma pílula; quebrado em duas no estreito, vira retângulo arredondado em vez
   * de uma bolha.
   */
  border-radius: calc(var(--clinic-hit-target) / 2 + 1px);
  background: var(--clinic-surface);
}

/*
 * `1 1 auto`, e **não** `1`.
 *
 * `flex: 1` é `1 1 0%`: a base de cada opção vira zero e todas terminam com a mesma largura,
 * a do rótulo médio. Quem tem rótulo mais longo que a média perde o que sobra — e perde em
 * silêncio, porque o `ToggleButton` do tema corta com `overflow: hidden` e sem reticências.
 * Com a base no conteúdo, nenhuma opção encolhe abaixo do próprio texto, e quando a linha
 * acaba o `flex-wrap` do trilho desce a opção inteira para a linha de baixo.
 */
.grupo.p-selectbutton :deep(.p-togglebutton) {
  min-height: calc(var(--clinic-hit-target) - 6px);
  flex: 1 1 auto;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
  font-weight: 600;
  white-space: nowrap;
}

.grupo.p-selectbutton :deep(.p-togglebutton-content) {
  gap: 0.4rem;
  padding: 0 0.85rem;
  border-radius: inherit;
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out;
}

.grupo.p-selectbutton :deep(.p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover) {
  background: transparent;
  color: var(--clinic-text);
}

.grupo.p-selectbutton
  :deep(.p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover .p-togglebutton-content) {
  background: var(--clinic-surface-sunken);
}

.grupo.p-selectbutton :deep(.p-togglebutton-checked) {
  background: transparent;
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.grupo.p-selectbutton :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--clinic-accent-tint);
  box-shadow: none;
}

.grupo.p-selectbutton :deep(.grupo__opcao--ok.p-togglebutton-checked) {
  color: var(--clinic-ok-text);
}

.grupo.p-selectbutton :deep(.grupo__opcao--ok.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--clinic-ok-bg);
}

.grupo.p-selectbutton :deep(.grupo__opcao--atencao.p-togglebutton-checked) {
  color: var(--clinic-attention-text);
}

.grupo.p-selectbutton :deep(.grupo__opcao--atencao.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--clinic-attention-bg);
}

.grupo.p-selectbutton :deep(.grupo__opcao--risco.p-togglebutton-checked) {
  color: var(--clinic-risk-text);
}

.grupo.p-selectbutton :deep(.grupo__opcao--risco.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--clinic-risk-bg);
}

/* Neutro é a escolha que não afirma nada — "não avaliado", "sem preferência". */
.grupo.p-selectbutton :deep(.grupo__opcao--neutro.p-togglebutton-checked) {
  color: var(--clinic-neutral-text);
}

.grupo.p-selectbutton :deep(.grupo__opcao--neutro.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--clinic-neutral-bg);
}

.grupo.p-selectbutton :deep(.p-togglebutton:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}

.grupo.p-selectbutton :deep(.p-togglebutton-content i) {
  font-size: 0.7rem;
}

/* ------------------------------------------------------------------ contagem
 * O selo de 6 px, no par do tom da opção: o número que faz alguém abrir aquele recorte.
 */
.grupo__contagem {
  display: inline-grid;
  min-width: 1.25rem;
  padding: 0.05rem 0.35rem;
  border-radius: 6px;
  background: var(--clinic-neutral-bg);
  color: var(--clinic-neutral-text);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.3;
  place-items: center;
}

:deep(.grupo__opcao--atencao) .grupo__contagem {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

:deep(.grupo__opcao--risco) .grupo__contagem {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

:deep(.grupo__opcao--ok) .grupo__contagem {
  background: var(--clinic-ok-bg);
  color: var(--clinic-ok-text);
}

/* Dentro da pílula já tingida, o selo vira branco para não sumir no mesmo tom. */
:deep(.p-togglebutton-checked) .grupo__contagem {
  background: var(--clinic-surface);
}

@media (prefers-reduced-motion: reduce) {
  .grupo.p-selectbutton :deep(.p-togglebutton-content) {
    transition: none;
  }
}
</style>
