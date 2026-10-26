<script setup lang="ts">
/**
 * O portal em miniatura, para as opções de Aparência — no desenho do app (26/10/2026): a barra
 * branca com o topo em sálvia, a busca, o Início e os espaços (Clínica, Hotel, Portal) no
 * quadradinho pastel de cada um; à direita, a faixa sálvia do alto com o título e as abas, e a
 * página branca com uma lista.
 *
 * Cada escolha da navegação muda a peça do jeito que muda o portal: a barra larga ou só de ícones,
 * todos os espaços abertos ou só o da tela, linhas confortáveis ou baixas, e o aviso de pendência
 * em número ou em ponto. As medidas são em `em` e a raiz define o `font-size` pela largura da
 * própria miniatura, então a peça inteira escala junto com o lugar onde está.
 */

withDefaults(
  defineProps<{
    /**
     * `claro` e `escuro` têm cor fixa: a prévia do claro precisa ser clara mesmo com o portal no
     * escuro, senão não prevê coisa nenhuma. `atual` acompanha o tema em uso.
     */
    tema?: 'claro' | 'escuro' | 'atual'
    /** A barra com ícone e nome, ou só a coluna dos ícones. */
    largura?: 'larga' | 'icones'
    /** Todos os espaços abertos, e não só o da tela atual (a Clínica). */
    todos?: boolean
    /** Linhas mais baixas na barra (densidade compacta). */
    densa?: boolean
    /** O aviso de pendência no espaço fechado e no destino: número ou ponto. */
    selo?: 'numero' | 'ponto'
  }>(),
  { tema: 'atual', largura: 'larga', todos: true, densa: false, selo: 'numero' },
)

/** Os três espaços, quantos destinos cada um mostra aberto e o aviso de quando está fechado. */
const ESPACOS = [
  { id: 'clinica', destinos: 4, selo: '6' },
  { id: 'hotel', destinos: 3, selo: '10' },
  { id: 'portal', destinos: 2, selo: '' },
] as const
</script>

<template>
  <span
    class="maquete"
    :class="[
      `maquete--${tema}`,
      `maquete--${largura}`,
      `maquete--selo-${selo}`,
      { 'maquete--densa': densa },
    ]"
    aria-hidden="true"
  >
    <span class="maquete__barra">
      <span class="maquete__topo">
        <span class="maquete__pata" />
        <span class="maquete__traco maquete__traco--claro maquete__rotulo" />
      </span>

      <span class="maquete__ferramentas">
        <span class="maquete__busca" />
        <span class="maquete__mais" />
      </span>

      <span class="maquete__linha">
        <span class="maquete__ladrilho" />
        <span class="maquete__traco maquete__rotulo" />
      </span>

      <template v-for="(espaco, indice) in ESPACOS" :key="espaco.id">
        <span class="maquete__linha maquete__espaco">
          <span class="maquete__ladrilho" :class="`maquete__ladrilho--${espaco.id}`" />
          <span class="maquete__traco maquete__traco--forte maquete__rotulo" />
          <span
            v-if="espaco.selo && !(todos || indice === 0)"
            class="maquete__selo"
            :class="{ 'maquete__selo--atencao': espaco.id === 'hotel' }"
          >
            {{ selo === 'numero' ? espaco.selo : '' }}
          </span>
        </span>

        <span v-if="todos || indice === 0" class="maquete__destinos">
          <span
            v-for="n in espaco.destinos"
            :key="n"
            class="maquete__linha maquete__destino"
            :class="{ 'maquete__destino--ativo': indice === 0 && n === 2 }"
          >
            <span class="maquete__icone" />
            <span class="maquete__traco maquete__rotulo" />
            <span v-if="indice === 0 && n === 3" class="maquete__selo maquete__selo--leve">
              {{ selo === 'numero' ? '2' : '' }}
            </span>
          </span>
        </span>
      </template>
    </span>

    <span class="maquete__tela">
      <span class="maquete__faixa">
        <span class="maquete__titulo" />
        <span class="maquete__resumo" />
        <span class="maquete__abas">
          <span class="maquete__aba maquete__aba--atual" />
          <span class="maquete__aba" />
          <span class="maquete__aba" />
        </span>
      </span>
      <span class="maquete__lista">
        <span v-for="n in 5" :key="n" class="maquete__item">
          <span class="maquete__rosto" />
          <span class="maquete__traco maquete__traco--item" />
          <span class="maquete__chip" />
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
/*
 * As cores são as do app nos dois temas, fixas: a prévia do claro continua clara com o portal no
 * escuro, e vice-versa. `atual` acompanha a classe do tema na raiz.
 */
.maquete {
  --m-pagina: #fff;
  --m-barra: #fff;
  --m-regua: #e3eae7;
  --m-destaque: #76938d;
  --m-veu: #eef3f1;
  --m-traco: #d3dcd9;
  --m-traco-forte: #a7b6b2;
  --m-tinta: #1d3557;
  --m-clinica: #d5eaf7;
  --m-hotel: #e5e0f7;
  --m-portal: #f6e7cd;
  --m-risco: #f2c6c1;
  --m-risco-ponto: #e58f86;
  --m-atencao: #f8dcbd;
  --m-atencao-ponto: #e7a865;
  --m-chip: #e8efed;

  position: relative;
  display: grid;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--m-regua);
  border-radius: 12px;
  background: var(--m-pagina);
  container-type: inline-size;
  grid-template-columns: 27% minmax(0, 1fr);
  transition: grid-template-columns var(--pj-tempo-curto) var(--pj-curva-chega);
}

.maquete--escuro,
.app-dark .maquete--atual {
  --m-pagina: #121917;
  --m-barra: #151d1a;
  --m-regua: #26312d;
  --m-destaque: #56736c;
  --m-veu: #1e2925;
  --m-traco: #33403c;
  --m-traco-forte: #5b6b66;
  --m-tinta: #e6edeb;
  --m-clinica: #1e3746;
  --m-hotel: #2c2944;
  --m-portal: #3f3420;
  --m-risco: #4a2723;
  --m-risco-ponto: #f4908a;
  --m-atencao: #4a3520;
  --m-atencao-ponto: #f2bd88;
  --m-chip: #1e2925;
}

/* Só ícones: a barra encolhe até a coluna dos quadradinhos. */
.maquete--icones {
  grid-template-columns: 9% minmax(0, 1fr);
}

/* A escala vem da largura da própria miniatura: a peça inteira cresce e encolhe junto. */
.maquete__barra,
.maquete__tela {
  font-size: clamp(4px, 2.4cqi, 13px);
}

/* ------------------------------------------------------------------ a barra */

.maquete__barra {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25em;
  overflow: hidden;
  padding: 0 0.7em 0.8em;
  border-inline-end: 1px solid var(--m-regua);
  background: var(--m-barra);
}

.maquete__topo {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin: 0 -0.7em 0.5em;
  padding: 0.9em 0.9em 1em;
  border-radius: 0 0 1.2em 1.2em;
  background: var(--m-destaque);
}

.maquete__pata {
  width: 1.7em;
  height: 1.7em;
  flex: none;
  border-radius: 0.5em;
  background: #fff;
}

.maquete__ferramentas {
  display: flex;
  gap: 0.4em;
  margin-bottom: 0.4em;
}

.maquete__busca {
  height: 1.8em;
  flex: 1;
  border-radius: 0.7em;
  background: var(--m-veu);
}

.maquete__mais {
  width: 1.8em;
  height: 1.8em;
  flex: none;
  border-radius: 0.7em;
  background: var(--m-destaque);
}

.maquete__linha {
  display: flex;
  min-height: 2.5em;
  align-items: center;
  gap: 0.6em;
  padding-inline: 0.25em;
  border-radius: 0.8em;
}

.maquete__ladrilho {
  width: 1.75em;
  height: 1.75em;
  flex: none;
  border-radius: 0.6em;
  background: var(--m-veu);
}

.maquete__ladrilho--clinica {
  background: var(--m-clinica);
}

.maquete__ladrilho--hotel {
  background: var(--m-hotel);
}

.maquete__ladrilho--portal {
  background: var(--m-portal);
}

/* Os destinos um degrau para dentro, na guia fina que nasce do ícone do espaço. */
.maquete__destinos {
  display: grid;
  gap: 0.1em;
  margin-inline-start: 0.95em;
  padding-inline-start: 0.5em;
  border-inline-start: 0.12em solid var(--m-regua);
}

.maquete__destino {
  min-height: 2.1em;
}

.maquete__icone {
  width: 1.3em;
  height: 1.3em;
  flex: none;
  border-radius: 0.45em;
  background: var(--m-veu);
}

.maquete__destino--ativo {
  background: var(--m-destaque);
}

.maquete__destino--ativo .maquete__icone {
  background: rgb(255 255 255 / 30%);
}

.maquete__destino--ativo .maquete__traco {
  background: rgb(255 255 255 / 85%);
}

.maquete__traco {
  height: 0.5em;
  flex: 1;
  max-width: 6em;
  border-radius: 99px;
  background: var(--m-traco);
}

.maquete__traco--forte {
  background: var(--m-traco-forte);
}

.maquete__traco--claro {
  background: rgb(255 255 255 / 75%);
}

.maquete__selo {
  display: grid;
  min-width: 1.5em;
  height: 1.25em;
  flex: none;
  place-items: center;
  margin-inline-start: auto;
  padding: 0 0.35em;
  border-radius: 99px;
  background: var(--m-risco);
  color: var(--m-tinta);
  font-size: 0.75em;
  font-weight: 700;
  line-height: 1;
}

.maquete__selo--atencao {
  background: var(--m-atencao);
}

.maquete__selo--leve {
  background: var(--m-atencao);
}

/* Aviso em ponto: o mesmo lugar, encolhido para um ponto na cor do estado. */
.maquete--selo-ponto .maquete__selo {
  width: 0.65em;
  min-width: 0;
  height: 0.65em;
  padding: 0;
  font-size: 1em;
  background: var(--m-risco-ponto);
}

.maquete--selo-ponto .maquete__selo--atencao,
.maquete--selo-ponto .maquete__selo--leve {
  background: var(--m-atencao-ponto);
}

/* Linhas baixas: mais destinos à vista na mesma altura. */
.maquete--densa .maquete__linha {
  min-height: 1.95em;
}

.maquete--densa .maquete__destino {
  min-height: 1.7em;
}

.maquete--densa .maquete__ladrilho {
  width: 1.35em;
  height: 1.35em;
  border-radius: 0.45em;
}

/* Só ícones: os nomes e a guia somem, os avisos vão para o canto do ícone. */
.maquete--icones .maquete__barra {
  align-items: center;
  padding-inline: 0.4em;
}

.maquete--icones .maquete__topo {
  justify-content: center;
  margin-inline: -0.4em;
  padding-inline: 0;
}

.maquete--icones .maquete__rotulo,
.maquete--icones .maquete__busca {
  display: none;
}

.maquete--icones .maquete__ferramentas {
  justify-content: center;
}

.maquete--icones .maquete__linha {
  position: relative;
  justify-content: center;
  padding-inline: 0.2em;
}

.maquete--icones .maquete__destinos {
  margin-inline-start: 0;
  padding-inline-start: 0;
  border: 0;
}

.maquete--icones .maquete__selo {
  position: absolute;
  top: 0.1em;
  inset-inline-end: -0.1em;
  min-width: 1.1em;
  height: 1em;
  font-size: 0.6em;
}

.maquete--icones.maquete--selo-ponto .maquete__selo {
  width: 0.6em;
  min-width: 0;
  height: 0.6em;
  font-size: 1em;
}

/* ------------------------------------------------------------------ a tela */

.maquete__tela {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 1em;
}

.maquete__faixa {
  display: grid;
  gap: 0.55em;
  padding: 1.3em 1.4em 1.1em;
  border-radius: 0 0 1.4em 1.4em;
  background: var(--m-destaque);
}

.maquete__titulo {
  width: 32%;
  height: 0.95em;
  border-radius: 99px;
  background: #fff;
}

.maquete__resumo {
  width: 58%;
  height: 0.5em;
  border-radius: 99px;
  background: rgb(255 255 255 / 70%);
}

.maquete__abas {
  display: flex;
  gap: 0.4em;
  margin-top: 0.3em;
}

.maquete__aba {
  width: 4.2em;
  height: 1.35em;
  border-radius: 99px;
  background: rgb(0 0 0 / 13%);
}

.maquete__aba--atual {
  background: #fff;
}

.maquete__lista {
  display: grid;
  padding-inline: 1.4em;
}

.maquete__item {
  display: flex;
  align-items: center;
  gap: 0.7em;
  padding-block: 0.6em;
}

.maquete__item + .maquete__item {
  border-top: 1px solid var(--m-regua);
}

.maquete__rosto {
  width: 1.5em;
  height: 1.5em;
  flex: none;
  border-radius: 50%;
  background: var(--m-veu);
}

.maquete__traco--item {
  max-width: 11em;
}

.maquete__chip {
  width: 3.2em;
  height: 1.1em;
  flex: none;
  margin-inline-start: auto;
  border-radius: 99px;
  background: var(--m-chip);
}

@media (prefers-reduced-motion: reduce) {
  .maquete {
    transition: none;
  }
}
</style>
