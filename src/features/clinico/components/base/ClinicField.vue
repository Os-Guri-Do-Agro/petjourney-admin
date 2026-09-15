<script setup lang="ts">
/**
 * Campo de formulário clínico: rótulo, controle, dica e erro.
 *
 * O controle vem por slot para que a tela use o componente PrimeVue que fizer sentido. O que
 * este componente garante é o que não pode variar: rótulo associado ao controle, dica lida
 * por leitor de tela, erro com `role="alert"` e o mesmo ritmo vertical em todo o módulo.
 */
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    rotulo: string
    dica?: string
    erro?: string
    obrigatorio?: boolean
    /** Ocupa duas colunas na grade do formulário. */
    largo?: boolean
    /** Tecla que salta para este campo no modo teclado, mostrada como pista. */
    atalho?: string
  }>(),
  { dica: '', erro: '', obrigatorio: false, largo: false, atalho: '' },
)

const idBase = useId()
const idControle = computed(() => `campo-${idBase}`)
const idDica = computed(() => `dica-${idBase}`)
const idErro = computed(() => `erro-${idBase}`)

const descrito = computed(() =>
  [props.dica ? idDica.value : '', props.erro ? idErro.value : ''].filter(Boolean).join(' '),
)
</script>

<template>
  <div class="campo" :class="{ 'campo--largo': largo, 'campo--erro': Boolean(erro) }">
    <label class="campo__rotulo" :for="idControle">
      <span>{{ rotulo }}</span>
      <span v-if="obrigatorio" class="campo__obrigatorio" aria-hidden="true">*</span>
      <kbd v-if="atalho" class="campo__atalho">{{ atalho }}</kbd>
    </label>

    <div class="campo__controle">
      <slot :id="idControle" :descrito="descrito || undefined" />
    </div>

    <p v-if="dica && !erro" :id="idDica" class="campo__dica">{{ dica }}</p>
    <p v-if="erro" :id="idErro" class="campo__erro" role="alert">{{ erro }}</p>
  </div>
</template>

<style scoped>
/*
 * As linhas do campo ficam **coladas no topo**, aconteça o que acontecer com a altura da caixa.
 *
 * Sem isto, um campo esticado por um vizinho mais alto — o que tem dica, ou aquele cujo rótulo
 * quebrou em duas linhas — distribuía a sobra entre rótulo, controle e dica (`align-content` de
 * grade é `stretch` por padrão). O efeito é o controle descer alguns pixels em relação ao do
 * lado: numa fileira de dois campos, um com dica e outro sem, os dois inputs saem desalinhados
 * sem que nada na folha de estilo peça isso.
 */
.campo {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 0.25rem;
}

.campo--largo {
  grid-column: 1 / -1;
}

.campo__rotulo {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.campo__obrigatorio {
  color: var(--clinic-risk-text);
}

.campo__atalho {
  margin-left: auto;
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: 0.35rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-faint);
  font-family: inherit;
  font-size: 0.62rem;
  letter-spacing: 0;
  text-transform: none;
}

.campo__controle {
  min-width: 0;
}

.campo__dica {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

.campo__erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  line-height: 1.4;
}
</style>
