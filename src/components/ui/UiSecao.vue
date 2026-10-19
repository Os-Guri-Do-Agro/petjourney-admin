<script setup lang="ts">
/**
 * Uma seção da tela: título com contagem, uma frase opcional e as ações dela à direita; embaixo,
 * o conteúdo. O título fica no fundo, fora da folha — a folha é do conteúdo.
 */
defineProps<{
  titulo: string
  contagem?: number | null
  descricao?: string
  /** Ícone Phosphor antes do título (`ph ph-…`). */
  icone?: string
  /** Põe o conteúdo numa folha (superfície com borda). */
  folha?: boolean
  id?: string
}>()
</script>

<template>
  <section class="secao" :aria-labelledby="id ? `${id}-titulo` : undefined">
    <header class="secao__cabeca">
      <div class="secao__titulos">
        <h2 :id="id ? `${id}-titulo` : undefined" class="secao__titulo">
          <i v-if="icone" :class="icone" class="secao__icone" aria-hidden="true" />
          {{ titulo }}
          <span v-if="contagem != null" class="ui-contagem">{{ contagem }}</span>
        </h2>
        <p v-if="descricao" class="secao__descricao">{{ descricao }}</p>
      </div>
      <div v-if="$slots.acoes" class="secao__acoes">
        <slot name="acoes" />
      </div>
    </header>

    <div :class="{ 'ui-folha': folha }" class="secao__corpo">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.secao {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 12px;
}

.secao__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
  min-height: 28px;
}

.secao__titulos {
  display: grid;
  gap: 2px;
}

.secao__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.secao__icone {
  color: var(--pj-lugar, var(--tinta-2));
  font-size: 19px;
}

.secao__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.secao__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.secao__corpo {
  min-width: 0;
}
</style>
