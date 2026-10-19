<script setup lang="ts">
/**
 * Bloco de formulário clínico.
 *
 * Uma seção com título, descrição opcional e grade de campos. Serve de âncora de navegação
 * por teclado: cada seção tem `id`, e o modo teclado do prontuário salta entre elas.
 *
 * É uma folha do Trilha (formulário é o que se lê junto): fio fino, raio 16, sem sombra, e
 * espaço confortável entre os campos — o prontuário é preenchido com pressa, e campo apertado é
 * onde o dedo erra.
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
      <i class="ph ph-lock-simple" aria-hidden="true" />
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
  gap: 18px;
  padding: 22px 24px 24px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  color: var(--tinta);
}

/* Somente leitura: a folha afunda um degrau. Continua legível — é para ler, não para mexer. */
.bloco--leitura {
  background: var(--superficie-2);
}

.bloco__cabecalho {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.bloco__titulos {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.bloco__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.005em;
  line-height: 1.3;
}

.bloco__descricao {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.bloco__acoes {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.bloco__leitura {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.45;
}

.bloco__leitura i {
  flex: none;
  font-size: 16px;
}

.bloco__grade {
  display: grid;
  grid-template-columns: repeat(var(--grade-colunas), minmax(0, 1fr));
  gap: 18px 20px;
}

@media (max-width: 900px) {
  .bloco {
    padding: 18px 16px 20px;
  }

  .bloco__grade {
    grid-template-columns: 1fr;
  }
}
</style>
