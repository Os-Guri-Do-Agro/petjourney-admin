<script setup lang="ts">
/**
 * Bloco de formulário clínico.
 *
 * Uma seção com título, descrição opcional e grade de campos. Serve de âncora de navegação
 * por teclado: cada seção tem `id`, e o modo teclado do prontuário salta entre elas.
 */
withDefaults(
  defineProps<{
    titulo: string
    descricao?: string
    /** Colunas da grade em tela larga. Uma coluna quando o conteúdo é texto corrido. */
    colunas?: 1 | 2 | 3
    ancora?: string
    /** Somente leitura: o quarto estado, que é do prontuário e não da página. */
    somenteLeitura?: boolean
    motivoSomenteLeitura?: string
  }>(),
  { descricao: '', colunas: 2, ancora: '', somenteLeitura: false, motivoSomenteLeitura: '' },
)
</script>

<template>
  <section
    class="bloco"
    :id="ancora || undefined"
    :class="{ 'bloco--leitura': somenteLeitura }"
    :aria-readonly="somenteLeitura || undefined"
  >
    <header class="bloco__cabecalho">
      <div class="bloco__titulos">
        <h3 class="bloco__titulo">{{ titulo }}</h3>
        <p v-if="descricao" class="bloco__descricao">{{ descricao }}</p>
      </div>
      <div v-if="$slots.acoes" class="bloco__acoes">
        <slot name="acoes" />
      </div>
    </header>

    <p v-if="somenteLeitura && motivoSomenteLeitura" class="bloco__leitura" role="status">
      <i class="pi pi-lock" aria-hidden="true" />
      <span>{{ motivoSomenteLeitura }}</span>
    </p>

    <div class="bloco__grade" :style="{ '--grade-colunas': colunas }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.bloco {
  display: grid;
  gap: var(--clinic-space-4);
  padding: var(--clinic-space-5);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.bloco--leitura {
  background: var(--clinic-surface-soft);
}

.bloco__cabecalho {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.bloco__titulos {
  min-width: 0;
}

.bloco__titulo {
  margin: 0;
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.bloco__descricao {
  margin: 0.2rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
  line-height: 1.5;
}

.bloco__acoes {
  display: flex;
  flex: 0 0 auto;
  gap: var(--clinic-space-2);
}

.bloco__leitura {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-base);
  font-weight: 650;
}

.bloco__grade {
  display: grid;
  grid-template-columns: repeat(var(--grade-colunas), minmax(0, 1fr));
  gap: var(--clinic-space-4);
}

@media (max-width: 900px) {
  .bloco__grade {
    grid-template-columns: 1fr;
  }
}
</style>
