<script setup lang="ts">
/**
 * O portal em miniatura, para as opções de Aparência: a barra verde-floresta à esquerda, com a
 * marca, a busca, o Início e os espaços (Clínica, Hotel, Portal) nos discos da cor de cada um, e
 * a tela à direita — título, frase, abas e uma folha com linhas.
 *
 * Cada opção liga ou desliga o que a define: o tema fixo, todos os espaços abertos (o modo
 * "lista") e as linhas mais baixas da barra (densidade compacta). As medidas são em `em` e a raiz
 * define o `font-size`, então a peça inteira escala junto com o cartão.
 */

withDefaults(
  defineProps<{
    /**
     * `claro` e `escuro` têm cor fixa: a prévia do claro precisa ser clara mesmo com o portal no
     * escuro, senão não prevê coisa nenhuma. `atual` acompanha o tema em uso.
     */
    tema?: 'claro' | 'escuro' | 'atual'
    /** Todos os espaços abertos na barra (modo lista), e não só o da tela atual. */
    todos?: boolean
    /** Linhas mais baixas na barra (densidade compacta). */
    densa?: boolean
  }>(),
  { tema: 'atual', todos: false, densa: false },
)

/** Os três espaços, com quantos destinos cada um mostra quando está aberto. */
const ESPACOS = [
  { id: 'clinica', destinos: 4 },
  { id: 'hotel', destinos: 3 },
  { id: 'portal', destinos: 3 },
] as const
</script>

<template>
  <span
    class="maquete"
    :class="[`maquete--${tema}`, { 'maquete--densa': densa }]"
    aria-hidden="true"
  >
    <span class="maquete__barra">
      <span class="maquete__marca">
        <span class="maquete__pata" />
        <span class="maquete__traco maquete__traco--nome" />
      </span>
      <span class="maquete__busca" />

      <span class="maquete__linha maquete__linha--inicio">
        <span class="maquete__icone" />
        <span class="maquete__traco" />
      </span>

      <template v-for="(espaco, indice) in ESPACOS" :key="espaco.id">
        <span class="maquete__linha maquete__espaco" :class="`maquete__espaco--${espaco.id}`">
          <span
            class="maquete__disco"
            :class="{ 'maquete__disco--aberto': todos || indice === 0 }"
          />
          <span class="maquete__traco maquete__traco--forte" />
        </span>
        <span v-if="todos || indice === 0" class="maquete__destinos">
          <span
            v-for="n in espaco.destinos"
            :key="n"
            class="maquete__linha maquete__destino"
            :class="{ 'maquete__destino--ativo': indice === 0 && n === 2 }"
          >
            <span class="maquete__traco" />
          </span>
        </span>
      </template>
    </span>

    <span class="maquete__tela">
      <span class="maquete__titulo" />
      <span class="maquete__resumo" />
      <span class="maquete__abas">
        <span class="maquete__aba maquete__aba--atual" />
        <span class="maquete__aba" />
        <span class="maquete__aba" />
      </span>
      <span class="maquete__folha">
        <span v-for="n in 4" :key="n" class="maquete__item">
          <span class="maquete__rosto" />
          <span class="maquete__traco maquete__traco--item" />
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
/*
 * As cores da prévia vêm dos tokens do Trilha. As duas prévias de tema fixo (claro e escuro)
 * copiam os valores dos tokens de cada tema (`trilha-tokens.css`): é o único jeito de a prévia do
 * claro continuar clara com o portal no escuro, e vice-versa.
 */
.maquete {
  --m-fundo: var(--fundo);
  --m-folha: var(--superficie);
  --m-linha: var(--linha);
  --m-tinta: var(--tinta);
  --m-traco: color-mix(in oklab, var(--tinta-3) 45%, transparent);
  --m-rail: var(--rail);
  --m-rail-ativo: var(--rail-ativo);
  --m-sobre-rail: var(--sobre-rail);
  --m-sobre-rail-2: color-mix(in oklab, var(--sobre-rail-2) 55%, transparent);
  --m-musgo: var(--musgo);
  --m-clinica: var(--clinica-claro);
  --m-hotel: var(--hotel-claro);
  --m-portal: var(--portal-claro);

  display: grid;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--linha);
  border-radius: 10px;
  background: var(--m-fundo);
  font-size: clamp(7px, 3cqi, 12px);
  grid-template-columns: 31% minmax(0, 1fr);
}

.maquete--claro {
  --m-fundo: #e7f0ed;
  --m-folha: #fbfbf8;
  --m-linha: #d5dfdb;
  --m-tinta: #142721;
  --m-traco: #c3cfca;
  --m-rail: #16312a;
  --m-rail-ativo: #25443b;
  --m-sobre-rail: #f6f4ee;
  --m-sobre-rail-2: #5f7a71;
  --m-musgo: #2b5f51;
}

.maquete--escuro {
  --m-fundo: #0d1412;
  --m-folha: #161e1c;
  --m-linha: #2e3834;
  --m-tinta: #ebf2ef;
  --m-traco: #3a4642;
  --m-rail: #060d0a;
  --m-rail-ativo: #15211d;
  --m-sobre-rail: #f6f4ee;
  --m-sobre-rail-2: #4d5c57;
  --m-musgo: #96dbc7;
}

/* ------------------------------------------------------------------ a barra */

.maquete__barra {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35em;
  padding: 0.9em 0.7em;
  background: var(--m-rail);
}

.maquete__marca {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.25em;
}

.maquete__pata {
  width: 1.6em;
  height: 1.6em;
  flex: none;
  border-radius: 0.45em;
  background: var(--m-sobre-rail);
}

.maquete__busca {
  height: 1.5em;
  margin-bottom: 0.45em;
  border: 1px solid color-mix(in oklab, var(--m-sobre-rail) 14%, transparent);
  border-radius: 0.4em;
}

.maquete__linha {
  display: flex;
  height: 1.55em;
  flex: none;
  align-items: center;
  gap: 0.45em;
  padding-inline: 0.35em;
  border-radius: 0.35em;
}

.maquete__linha--inicio {
  margin-bottom: 0.3em;
}

.maquete__icone {
  width: 0.9em;
  height: 0.9em;
  flex: none;
  border-radius: 0.25em;
  background: var(--m-sobre-rail-2);
}

.maquete__traco {
  height: 0.45em;
  flex: 1;
  border-radius: 999px;
  background: var(--m-sobre-rail-2);
}

.maquete__traco--nome {
  max-width: 65%;
  height: 0.6em;
  background: var(--m-sobre-rail);
}

.maquete__traco--forte {
  max-width: 70%;
  background: color-mix(in oklab, var(--m-sobre-rail) 70%, transparent);
}

.maquete__espaco {
  --m-cor: var(--m-clinica);
}

.maquete__espaco--hotel {
  --m-cor: var(--m-hotel);
}

.maquete__espaco--portal {
  --m-cor: var(--m-portal);
}

.maquete__disco {
  width: 1.15em;
  height: 1.15em;
  flex: none;
  border-radius: 0.32em;
  background: color-mix(in oklab, var(--m-cor) 28%, transparent);
}

.maquete__disco--aberto {
  background: var(--m-cor);
}

/* Os destinos penduram na trilha, como na barra de verdade. */
.maquete__destinos {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  margin: 0.05em 0 0.2em;
  padding-inline-start: 1.05em;
}

.maquete__destinos::before {
  position: absolute;
  top: 0;
  bottom: 0.6em;
  width: 1px;
  inset-inline-start: 0.9em;
  background: color-mix(in oklab, var(--m-sobre-rail) 22%, transparent);
  content: '';
}

.maquete__destino {
  height: 1.35em;
}

.maquete__destino .maquete__traco {
  max-width: 60%;
}

.maquete__destino--ativo {
  background: var(--m-rail-ativo);
}

.maquete__destino--ativo .maquete__traco {
  background: var(--m-sobre-rail);
}

/* Compacta: as mesmas linhas, mais baixas — cabe mais barra na mesma altura. */
.maquete--densa .maquete__barra {
  gap: 0.15em;
}

.maquete--densa .maquete__linha {
  height: 1.2em;
}

.maquete--densa .maquete__destino {
  height: 1em;
}

.maquete--densa .maquete__destinos {
  gap: 0.05em;
}

.maquete--densa .maquete__disco {
  width: 0.95em;
  height: 0.95em;
}

/* ------------------------------------------------------------------ a tela */

.maquete__tela {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.55em;
  padding: 1.3em 1.4em;
}

.maquete__titulo {
  width: 45%;
  height: 1em;
  border-radius: 0.3em;
  background: var(--m-tinta);
}

.maquete__resumo {
  width: 70%;
  height: 0.45em;
  border-radius: 999px;
  background: var(--m-traco);
}

.maquete__abas {
  display: flex;
  gap: 0.6em;
  margin-top: 0.3em;
  padding-bottom: 0.35em;
  border-bottom: 1px solid var(--m-linha);
}

.maquete__aba {
  width: 2.6em;
  height: 0.45em;
  border-radius: 999px;
  background: var(--m-traco);
}

.maquete__aba--atual {
  position: relative;
  background: var(--m-tinta);
}

.maquete__aba--atual::after {
  position: absolute;
  right: 0;
  bottom: -0.45em;
  left: 0;
  height: 0.2em;
  border-radius: 0.2em;
  background: var(--m-musgo);
  content: '';
}

.maquete__folha {
  display: flex;
  flex-direction: column;
  margin-top: 0.3em;
  overflow: hidden;
  border: 1px solid var(--m-linha);
  border-radius: 0.55em;
  background: var(--m-folha);
}

.maquete__item {
  display: flex;
  height: 2em;
  align-items: center;
  gap: 0.55em;
  padding-inline: 0.7em;
}

.maquete__item + .maquete__item {
  border-top: 1px solid var(--m-linha);
}

.maquete__rosto {
  width: 1.1em;
  height: 1.1em;
  flex: none;
  border-radius: 999px;
  background: var(--m-traco);
}

.maquete__traco--item {
  max-width: 55%;
  background: var(--m-traco);
}
</style>
