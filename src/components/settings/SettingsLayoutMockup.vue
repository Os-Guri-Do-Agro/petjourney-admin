<script setup lang="ts">
/**
 * Maquete do painel usada nas opções de aparência.
 *
 * Um PetJourney em miniatura — barra do topo, trilho, coluna do menu e área de conteúdo. Todas
 * as opções montam a mesma peça e ligam ou desligam o que as define: tema fixo, trilho, rótulos
 * de grupo, número e altura das linhas.
 *
 * As medidas são em `em` e a raiz define o `font-size`, então a maquete inteira escala de uma
 * vez quando o cartão muda de largura — nada de acertar dez valores à mão.
 */

/**
 * `claro` e `escuro` têm cor fixa: herdando o tema em uso, a prévia do claro aparecia escura e
 * não previa coisa nenhuma. `atual` acompanha o tema, que é o certo para as demais opções.
 */
withDefaults(
  defineProps<{
    tema?: 'claro' | 'escuro' | 'atual'
    trilho?: boolean
    /** Rótulos de grupo entre as linhas, como no modo lista. */
    grupos?: boolean
    linhas?: number
    densa?: boolean
  }>(),
  { tema: 'atual', trilho: true, grupos: false, linhas: 5, densa: false },
)
</script>

<template>
  <span class="maquete" :class="[`maquete--${tema}`, { 'maquete--densa': densa }]" aria-hidden="true">
    <span class="maquete__barra">
      <span class="maquete__pastilha" />
      <span class="maquete__pastilha maquete__pastilha--curta" />
    </span>

    <span class="maquete__corpo">
      <span v-if="trilho" class="maquete__trilho">
        <span
          v-for="n in 4"
          :key="n"
          class="maquete__icone"
          :class="{ 'maquete__icone--ativo': n === 2 }"
        />
      </span>

      <span class="maquete__painel">
        <span class="maquete__titulo" />
        <template v-for="n in linhas" :key="n">
          <span v-if="grupos && n % 3 === 1 && n > 1" class="maquete__grupo" />
          <span class="maquete__linha" :class="{ 'maquete__linha--ativa': n === 2 }" />
        </template>
      </span>

      <span class="maquete__conteudo">
        <span class="maquete__bloco" />
        <span class="maquete__bloco maquete__bloco--baixo" />
      </span>
    </span>
  </span>
</template>

<style scoped>
.maquete {
  --maquete-fundo: var(--partner-bg);
  --maquete-superficie: var(--partner-card);
  --maquete-linha: var(--partner-line);
  --maquete-traco: color-mix(in srgb, var(--partner-muted) 34%, transparent);
  --maquete-trilho: var(--partner-primary);
  --maquete-acento: var(--partner-primary-strong);
  --maquete-acento-suave: color-mix(in srgb, var(--partner-primary) 26%, var(--partner-card));

  display: grid;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--maquete-linha);
  border-radius: 0.6rem;
  background: var(--maquete-fundo);
  font-size: 9px;
  grid-template-rows: 1.9em minmax(0, 1fr);
}

.maquete--claro {
  --maquete-fundo: #e6edea;
  --maquete-superficie: #fbfcfb;
  --maquete-linha: #dfeae6;
  --maquete-traco: #c9d6d1;
  --maquete-trilho: #84c1b4;
  --maquete-acento: #3c7b6d;
  --maquete-acento-suave: #d8ebe5;
}

.maquete--escuro {
  --maquete-fundo: #101a17;
  --maquete-superficie: #17231f;
  --maquete-linha: #2b3a36;
  --maquete-traco: #3c4f49;
  --maquete-trilho: #24332e;
  --maquete-acento: #7fc0b1;
  --maquete-acento-suave: #24413a;
}

.maquete__barra {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0 0.7em;
  border-bottom: 1px solid var(--maquete-linha);
  background: var(--maquete-superficie);
}

.maquete__pastilha {
  width: 3.4em;
  height: 0.55em;
  border-radius: 999px;
  background: var(--maquete-traco);
}

.maquete__pastilha--curta {
  width: 1.7em;
  margin-inline-start: auto;
}

.maquete__corpo {
  display: flex;
  min-height: 0;
}

.maquete__trilho {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 0.5em;
  padding: 0.6em 0.4em;
  background: var(--maquete-trilho);
}

.maquete__icone {
  width: 0.85em;
  height: 0.85em;
  border-radius: 0.25em;
  background: color-mix(in srgb, #ffffff 45%, transparent);
}

.maquete__icone--ativo {
  width: 1.5em;
  border-radius: 0.3em;
  background: #ffffff;
}

.maquete__painel {
  display: grid;
  width: 6.6em;
  align-content: start;
  gap: 0.42em;
  padding: 0.6em 0.5em;
  border-inline-end: 1px solid var(--maquete-linha);
  background: var(--maquete-superficie);
}

/* Com trilho, a coluna do menu é mais estreita — é o que acontece no painel de verdade. */
.maquete__trilho + .maquete__painel {
  width: 5.2em;
}

.maquete__titulo {
  width: 3.2em;
  height: 0.7em;
  border-radius: 0.2em;
  background: var(--maquete-acento);
}

.maquete__grupo {
  width: 1.9em;
  height: 0.3em;
  margin-top: 0.3em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--maquete-traco) 70%, transparent);
}

.maquete__linha {
  height: 0.62em;
  border-radius: 0.18em;
  background: var(--maquete-traco);
}

.maquete__linha--ativa {
  background: var(--maquete-acento-suave);
  box-shadow: inset 0 0 0 1px var(--maquete-acento);
}

/* Compacta é o mesmo painel com mais linhas no mesmo espaço. */
.maquete--densa .maquete__painel {
  gap: 0.24em;
}

.maquete--densa .maquete__linha {
  height: 0.46em;
}

.maquete__conteudo {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  align-content: start;
  gap: 0.5em;
  padding: 0.7em;
}

.maquete__bloco {
  height: 2.1em;
  border: 1px solid var(--maquete-linha);
  border-radius: 0.3em;
  background: var(--maquete-superficie);
}

.maquete__bloco--baixo {
  height: 1.2em;
}
</style>
