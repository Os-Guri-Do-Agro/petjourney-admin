<script setup lang="ts">
/**
 * O rosto do hóspede, em todo lugar onde o nome dele aparece.
 *
 * Um hotel cheio tem três Meis e dois Thors, e quem trabalha no canil reconhece o animal antes de
 * ler o nome. Uma lista de texto puro obriga a ler — e a ler outra vez, porque "Mel · Baia A3" e
 * "Mel · Gatil G2" só se distinguem na terceira palavra.
 *
 * ## A foto e o que entra no lugar dela
 *
 * `fotoUrl` é o caminho do retrato quando ele existe. Na camada mocada, só os pets do roteiro de
 * demonstração têm foto (retratos de licença livre em `public/demo/pacientes/`, com os créditos
 * ao lado); inventar uma imagem para cada animal seria povoar o repositório de retratos que alguém
 * acabaria confundindo com dado real. Para todos os outros, o componente desenha o que dá para
 * desenhar com o que existe no cadastro:
 *
 * - **as iniciais**, que separam Mel de Thor;
 * - **uma cor fixa por animal**, tirada do nome, que é o que separa as duas Meis sem ler nada;
 * - **a silhueta da espécie**, que separa o gato do cachorro à distância.
 *
 * A cor é derivada e não sorteada: a mesma Mel tem a mesma cor na lista, no mapa, na prancheta e no
 * boletim. Cor que muda entre telas é pior que cor nenhuma, porque ensina a não confiar nela.
 */
import { PhCat, PhDog } from '@phosphor-icons/vue'
import { computed } from 'vue'

import type { PetSpecies } from '../../data/types'

const props = withDefaults(
  defineProps<{
    nome: string
    iniciais: string
    especie?: PetSpecies | null
    /** O retrato, quando a API o tiver. Vazio cai no avatar desenhado. */
    fotoUrl?: string
    /**
     * `xs` cabe numa barra do mapa; `lg` encabeça a tela da estadia; `xl` fica ao lado do nome
     * grande da ficha do paciente, na clínica.
     */
    tamanho?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { especie: null, fotoUrl: '', tamanho: 'sm' },
)

/**
 * Seis tons, escolhidos pelo nome.
 *
 * Seis e não vinte: a cor aqui serve para **distinguir vizinhos numa lista**, não para identificar
 * globalmente. Vinte tons produziriam pares indistinguíveis e a falsa promessa de que a cor é um
 * identificador.
 */
const TONS = 6

const tom = computed(() => {
  let hash = 0

  for (const caractere of props.nome) {
    hash = (hash * 31 + caractere.codePointAt(0)!) % 100_000
  }

  return hash % TONS
})

/**
 * A silhueta da espécie, do conjunto do Phosphor.
 *
 * Eram dois caminhos SVG escritos à mão aqui — uma cabeça de gato e uma de cão tateadas até
 * parecerem certas. Ícone é ofício de quem desenha ícones: as duas silhuetas de agora vêm do
 * mesmo conjunto que os serviços usam, então o gato do avatar e a pata do passeio saíram da mesma
 * mão e a tela para de parecer uma colagem.
 *
 * **Só cão e gato, e nada para o resto.** A tentação é pôr uma pata genérica em quem não é nem
 * um nem outro, e ela é errada duas vezes: não distingue nada — que é a única função da silhueta
 * — e mente sobre a ave, que não tem pata de almofadinha. O comentário anterior aqui prometia
 * essa pata e o código nunca a desenhou; agora os dois dizem a mesma coisa, e há teste.
 */
const icone = computed(() => {
  if (props.especie === 'felina') return PhCat
  if (props.especie === 'canina') return PhDog

  return null
})
</script>

<template>
  <span class="avatar" :class="[`avatar--${tamanho}`, `avatar--tom-${tom}`]" aria-hidden="true">
    <!--
      `aria-hidden` porque o nome do animal está sempre ao lado: sem ele, cada linha da lista seria
      anunciada como "Mel, Mel". E o comentário mora **dentro** da raiz — um comentário acima dela
      transformaria o componente em fragmento, e fragmento não repassa o `class` que o pai manda.
    -->
    <img v-if="fotoUrl" class="avatar__foto" :src="fotoUrl" :alt="''" loading="lazy" />

    <template v-else>
      <component :is="icone" v-if="icone" class="avatar__especie" weight="fill" />

      <span class="avatar__iniciais">{{ iniciais }}</span>
    </template>
  </span>
</template>

<style scoped>
.avatar {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  overflow: hidden;
  place-items: center;
  border-radius: 50%;
  background: var(--avatar-fundo);
  color: var(--avatar-tinta);
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 1;
}

.avatar__foto {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/*
 * A silhueta fica atrás das iniciais, quase apagada.
 * Cheia, ela competiria com as letras; ausente, cão e gato ficam idênticos de longe.
 */
.avatar__especie {
  position: absolute;
  width: 78%;
  height: 78%;
  fill: currentColor;
  opacity: 0.22;
}

.avatar__iniciais {
  position: relative;
}

.avatar--xs {
  width: 1.1rem;
  height: 1.1rem;
  font-size: 0.5rem;
}

.avatar--sm {
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.62rem;
}

.avatar--md {
  width: 2.4rem;
  height: 2.4rem;
  font-size: 0.8rem;
}

.avatar--lg {
  width: 3.25rem;
  height: 3.25rem;
  font-size: 1.05rem;
}

.avatar--xl {
  width: 4.5rem;
  height: 4.5rem;
  font-size: 1.4rem;
}

/* A silhueta não cabe no tamanho da barra do mapa: vira borrão e suja a letra. */
.avatar--xs .avatar__especie {
  display: none;
}

/*
 * Os seis tons.
 *
 * Pastel, como toda cor do portal: o fundo claro da família com a tinta escura dela por cima
 * (7,3:1 ou mais), e no escuro o inverso (8,3:1 ou mais). Eram cores cheias com letra branca, e
 * seis discos fortes numa lista gritavam mais que os selos de estado ao lado.
 *
 * Os matizes são os de antes (sálvia, azul, lavanda, areia, musgo, barro), para a Mel não mudar de
 * cor; a saturação fica abaixo da dos selos (oklch 0,045 contra 0,055 a 0,075), para o avatar não
 * passar por "isto é um estado".
 */
.avatar--tom-0 {
  --avatar-fundo: #bbe3d8;
  --avatar-tinta: #004b3e;
}

.avatar--tom-1 {
  --avatar-fundo: #bfdef4;
  --avatar-tinta: #144460;
}

.avatar--tom-2 {
  --avatar-fundo: #d6d6f6;
  --avatar-tinta: #3c3a63;
}

.avatar--tom-3 {
  --avatar-fundo: #e7d7b8;
  --avatar-tinta: #513c09;
}

.avatar--tom-4 {
  --avatar-fundo: #cce0c3;
  --avatar-tinta: #2e4821;
}

.avatar--tom-5 {
  --avatar-fundo: #f6cfc7;
  --avatar-tinta: #5f3028;
}

.app-dark .avatar--tom-0 {
  --avatar-fundo: #1e4239;
  --avatar-tinta: #bce9dc;
}

.app-dark .avatar--tom-1 {
  --avatar-fundo: #233e4f;
  --avatar-tinta: #c0e4fc;
}

.app-dark .avatar--tom-2 {
  --avatar-fundo: #383751;
  --avatar-tinta: #dadaff;
}

.app-dark .avatar--tom-3 {
  --avatar-fundo: #46391e;
  --avatar-tinta: #eedcb9;
}

.app-dark .avatar--tom-4 {
  --avatar-fundo: #304028;
  --avatar-tinta: #d0e6c5;
}

.app-dark .avatar--tom-5 {
  --avatar-fundo: #4f322c;
  --avatar-tinta: #fed3ca;
}
</style>
