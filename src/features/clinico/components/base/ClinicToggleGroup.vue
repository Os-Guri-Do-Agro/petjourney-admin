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
import { computed, nextTick, ref } from 'vue'

export type TomDaOpcao = 'neutro' | 'ok' | 'atencao' | 'risco' | 'acento'

const props = defineProps<{
  modelValue: T
  opcoes: Array<{ valor: T; rotulo: string; icone?: string; tom?: TomDaOpcao }>
  rotulo: string
  desabilitado?: boolean
  /** Permite desmarcar clicando na opção já escolhida. */
  limpavel?: boolean
  /** Valor devolvido ao limpar. */
  vazio?: T
}>()

const emit = defineEmits<{ 'update:modelValue': [valor: T] }>()

const grupo = ref<HTMLElement | null>(null)

const indiceAtivo = computed(() => {
  const encontrado = props.opcoes.findIndex((opcao) => opcao.valor === props.modelValue)

  /* Nada escolhido: a primeira opção carrega o foco, para o grupo ter uma porta de entrada. */
  return encontrado >= 0 ? encontrado : 0
})

function focarOpcao(indice: number) {
  const alvo = grupo.value?.querySelectorAll<HTMLElement>('[role="radio"]')?.[indice]

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

function escolher(valor: T) {
  if (props.desabilitado) {
    return
  }

  if (props.limpavel && valor === props.modelValue) {
    emit('update:modelValue', (props.vazio ?? null) as T)

    return
  }

  emit('update:modelValue', valor)
}
</script>

<template>
  <div ref="grupo" class="grupo" role="radiogroup" :aria-label="rotulo" @keydown="aoTeclar">
    <button
      v-for="(opcao, indice) in opcoes"
      :key="String(opcao.valor)"
      type="button"
      class="grupo__opcao clinic-focusable"
      :class="[
        `grupo__opcao--${opcao.tom ?? 'acento'}`,
        { 'grupo__opcao--ativa': opcao.valor === modelValue },
      ]"
      role="radio"
      :aria-checked="opcao.valor === modelValue"
      :disabled="desabilitado"
      :tabindex="indice === indiceAtivo ? 0 : -1"
      :title="`${opcao.rotulo} (${indice + 1})`"
      @click="escolher(opcao.valor)"
    >
      <i v-if="opcao.icone" :class="opcao.icone" aria-hidden="true" />
      <span>{{ opcao.rotulo }}</span>
    </button>
  </div>
</template>

<style scoped>
.grupo {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-sunken);
}

.grupo__opcao {
  display: inline-flex;
  min-height: calc(var(--clinic-hit-target) - 4px);
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0 var(--clinic-space-3);
  border: none;
  border-radius: calc(var(--clinic-radius-control) - 3px);
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-base);
  font-weight: 600;
  white-space: nowrap;
}

.grupo__opcao:hover:not(:disabled):not(.grupo__opcao--ativa) {
  background: color-mix(in srgb, var(--clinic-muted) 10%, transparent);
  color: var(--clinic-text);
}

/*
 * Três sinais somados, para que a marcação sobreviva a qualquer um deles faltar: anel
 * (forma), peso 800 (tipografia) e fundo (cor). Em escala de cinza o anel e o peso bastam.
 */
.grupo__opcao--ativa {
  background: var(--clinic-surface);
  box-shadow: inset 0 0 0 1.5px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.grupo__opcao--ok.grupo__opcao--ativa {
  background: var(--clinic-ok-bg);
  box-shadow: inset 0 0 0 1.5px var(--clinic-ok-text);
  color: var(--clinic-ok-text);
}

.grupo__opcao--atencao.grupo__opcao--ativa {
  background: var(--clinic-attention-bg);
  box-shadow: inset 0 0 0 1.5px var(--clinic-attention-text);
  color: var(--clinic-attention-text);
}

.grupo__opcao--risco.grupo__opcao--ativa {
  background: var(--clinic-risk-bg);
  box-shadow: inset 0 0 0 1.5px var(--clinic-risk-text);
  color: var(--clinic-risk-text);
}

/* Neutro é a escolha que não afirma nada — "não avaliado", "sem preferência". */
.grupo__opcao--neutro.grupo__opcao--ativa {
  background: var(--clinic-neutral-bg);
  box-shadow: inset 0 0 0 1.5px var(--clinic-neutral-text);
  color: var(--clinic-neutral-text);
}

.grupo__opcao:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.grupo__opcao i {
  font-size: 0.7rem;
}
</style>
