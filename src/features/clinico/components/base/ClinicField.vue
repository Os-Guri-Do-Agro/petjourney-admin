<script setup lang="ts">
/**
 * Campo de formulário clínico: rótulo, controle, dica e erro.
 *
 * O controle vem por slot para que a tela use o componente PrimeVue que fizer sentido. O que
 * este componente garante é o que não pode variar: rótulo associado ao controle, dica lida
 * por leitor de tela, erro com `role="alert"` e o mesmo ritmo vertical em todo o módulo.
 *
 * O rótulo é frase (13 px, peso 550, tinta cheia), lido antes de digitar; a dica fica embaixo em
 * tinta secundária; o erro troca a dica pelo motivo, com o ícone e a cor de risco — cor e palavra.
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
    <p v-if="erro" :id="idErro" class="campo__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>
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
  gap: 7px;
}

.campo--largo {
  grid-column: 1 / -1;
}

/* `.campo .campo__rotulo` vence a regra global antiga de `.hc-tema .campo__rotulo`. */
.campo .campo__rotulo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 550;
  letter-spacing: 0;
  line-height: 1.35;
  text-transform: none;
}

.campo__obrigatorio {
  color: var(--risco-tinta);
  font-weight: 600;
}

/* A tecla que salta para o campo no modo teclado: uma tecla desenhada, discreta, na ponta. */
.campo__atalho {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  margin-inline-start: auto;
  padding: 0 5px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 6px;
  background: var(--superficie-2);
  box-shadow: inset 0 -1px 0 var(--linha);
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
}

.campo__controle {
  min-width: 0;
}

.campo__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.campo__erro {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--risco-tinta);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.45;
}

.campo__erro i {
  flex: none;
  margin-top: 1px;
  font-size: 15px;
}

/* O controle com erro ganha a borda de risco: o olho acha o campo antes de ler o motivo. */
.campo--erro .campo__controle :deep(.p-inputtext),
.campo--erro .campo__controle :deep(.p-textarea),
.campo--erro .campo__controle :deep(.p-select),
.campo--erro .campo__controle :deep(.p-multiselect),
.campo--erro .campo__controle :deep(.p-inputnumber-input),
.campo--erro .campo__controle :deep(.p-datepicker-input) {
  border-color: var(--risco);
}
</style>
