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
 * É um `radiogroup` de verdade: setas navegam, `Espaço` escolhe.
 */
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
  <div class="grupo" role="radiogroup" :aria-label="rotulo">
    <button
      v-for="opcao in opcoes"
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
