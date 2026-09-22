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
 * `fotoUrl` é o caminho do retrato quando ele existe. A camada mocada **não tem fotos**, e inventar
 * uma imagem por hóspede seria povoar o repositório de retratos falsos que alguém acabaria
 * confundindo com dado real. Então o componente já fala a língua da API futura e, enquanto ela não
 * chega, desenha o que dá para desenhar com o que existe no cadastro:
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
    /** `xs` cabe numa barra do mapa; `lg` encabeça a tela da estadia. */
    tamanho?: 'xs' | 'sm' | 'md' | 'lg'
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

/* A silhueta não cabe no tamanho da barra do mapa: vira borrão e suja a letra. */
.avatar--xs .avatar__especie {
  display: none;
}

/*
 * Os seis tons.
 *
 * Todos com contraste suficiente para texto branco, e todos dentro da paleta do portal — um avatar
 * roxo ou laranja ao lado de um selo âmbar diria "isto é um estado", e não é.
 */
.avatar--tom-0 {
  --avatar-fundo: #456a60;
  --avatar-tinta: #f4f9f8;
}

.avatar--tom-1 {
  --avatar-fundo: #3d6f8f;
  --avatar-tinta: #f2f8fb;
}

.avatar--tom-2 {
  --avatar-fundo: #6b6a8f;
  --avatar-tinta: #f6f5fb;
}

.avatar--tom-3 {
  --avatar-fundo: #7a6a4a;
  --avatar-tinta: #faf7f0;
}

.avatar--tom-4 {
  --avatar-fundo: #5f7a52;
  --avatar-tinta: #f5faf2;
}

.avatar--tom-5 {
  --avatar-fundo: #8a5f57;
  --avatar-tinta: #fbf4f2;
}
</style>
