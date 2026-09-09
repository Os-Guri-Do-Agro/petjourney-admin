<script setup lang="ts">
/**
 * Uma linha do menu lateral.
 *
 * Saiu de dentro do `AppShell` quando a seção clínica passou a ter blocos rotulados: a mesma
 * linha precisava nascer em dois lugares — dentro de um bloco e solta num grupo sem blocos — e
 * duplicar trinta linhas de marcação é como um selo aparece num caminho e some no outro.
 *
 * O selo de pendência é a novidade da linha. Ele diz **quanto trabalho está parado** atrás
 * daquela tela, e existe porque o menu clínico tem dez destinos que, até aqui, pareciam todos
 * igualmente vazios — descobrir onde havia trabalho custava abrir os dez.
 */
import { RouterLink } from 'vue-router'

import type { AppNavigationItem } from '@/composables/useAppNavigation'

withDefaults(
  defineProps<{
    item: AppNavigationItem
    ativo: boolean
    /** Rótulo do cadeado de cadastro suspenso — o shell é quem tem o `t`. */
    rotuloBloqueado: string
    /** Texto do selo "em breve". */
    rotuloEmBreve: string
    /** Variante da visão geral: destacada do resto da lista por um respiro abaixo. */
    destaque?: boolean
  }>(),
  { destaque: false },
)

defineEmits<{ (evento: 'clique', payload: MouseEvent): void }>()
</script>

<template>
  <RouterLink
    class="page-nav__link"
    :class="{
      'router-link-active': ativo,
      'page-nav__link--overview': destaque,
      'page-nav__link--soon': item.comingSoon,
      'page-nav__link--locked': item.locked,
    }"
    :aria-current="ativo ? 'page' : undefined"
    :to="item.to"
    active-class=""
    @click="$emit('clique', $event as MouseEvent)"
  >
    <span class="page-nav__icon" aria-hidden="true">
      <i :class="item.icon" />
    </span>
    <span class="page-nav__label">{{ item.label }}</span>

    <!--
      O selo vem antes do cadeado e do "em breve" na ordem de leitura, mas os três nunca
      convivem: um item bloqueado não tem pendência para mostrar.

      O número não fica sozinho para o leitor de tela. "3" ao lado de "Internação" não diz nada
      a quem não vê a cor; `badgeTitulo` é a frase que diz o que os três são.
    -->
    <span
      v-if="item.badge"
      class="page-nav__badge"
      :class="`page-nav__badge--${item.badgeTom ?? 'neutro'}`"
      :title="item.badgeTitulo"
    >
      <span aria-hidden="true">{{ item.badge > 99 ? '99+' : item.badge }}</span>
      <span class="page-nav__badge-sr">{{ item.badgeTitulo }}</span>
    </span>

    <span v-if="item.comingSoon" class="page-nav__soon">{{ rotuloEmBreve }}</span>
    <span
      v-else-if="item.locked"
      class="page-nav__lock"
      :title="rotuloBloqueado"
      aria-hidden="true"
    >
      <i class="pi pi-lock" />
    </span>
  </RouterLink>
</template>

<style scoped>
/*
 * O estilo da linha mora aqui, e não no `AppShell`.
 *
 * O estilo do shell é `scoped`: só o elemento-raiz de um componente filho herda o atributo de
 * escopo do pai, e nunca os filhos dele. Deixar `.page-nav__icon` e `.page-nav__label` lá
 * deixaria a linha sem ícone e sem peso no instante em que ela virou componente — marcação
 * certa e estilo mudo, que é o defeito mais difícil de enxergar num diff.
 */

.page-nav__link {
  position: relative;
  display: flex;
  min-height: var(--nav-row-height);
  align-items: center;
  justify-content: flex-start;
  gap: 0.6rem;
  padding: 0 0.6rem;
  border: 1px solid transparent;
  border-radius: 0.6rem;
  color: var(--shell-muted);
  font-size: 0.83rem;
  font-weight: 600;
  text-decoration: none;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.page-nav__link--overview {
  flex-shrink: 0;
  margin-bottom: 0.55rem;
}

.page-nav__label {
  min-width: 0;
  flex: 1 1 auto;
}

.page-nav__soon {
  flex-shrink: 0;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-accent) 16%, transparent);
  color: var(--shell-accent-strong);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
}

.page-nav__lock {
  display: grid;
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-muted) 14%, transparent);
  color: var(--shell-muted);
  font-size: 0.68rem;
}

.page-nav__link--locked {
  opacity: 0.78;
}

.page-nav__link--soon:hover,
.page-nav__link--soon:focus-visible {
  border-color: color-mix(in srgb, var(--shell-accent) 18%, var(--shell-line));
  background: color-mix(in srgb, var(--shell-accent-soft) 30%, var(--shell-surface));
  color: var(--shell-accent-strong);
}

/**
 * O ladrilho do ícone é **marca de estado**, não decoração.
 *
 * Antes cada item carregava um quadrado com fundo próprio: treze quadrados iguais numa coluna
 * viram textura, o olho conta caixas em vez de ler nomes. Aqui o ladrilho nasce transparente e
 * só ganha fundo no item sob o cursor e no item aberto — quem se destaca é um, não todos.
 */
.page-nav__icon {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--shell-muted);
  transition:
    background 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.page-nav__icon i {
  font-size: 0.88rem;
  line-height: 1;
}

/** Hover é convite; ativo é estado — pesos visuais distintos de propósito. */
.page-nav__link:hover {
  background: color-mix(in srgb, var(--shell-accent) 7%, var(--shell-surface));
  color: var(--shell-text);
}

.page-nav__link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 2px;
}

.page-nav__link.router-link-active {
  border-color: color-mix(in srgb, var(--shell-accent) 30%, transparent);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--shell-accent-soft) 46%, var(--shell-surface)),
    color-mix(in srgb, var(--shell-accent-soft) 26%, var(--shell-surface))
  );
  color: var(--shell-nav-active-text);
  font-weight: 750;
}

.page-nav__link:hover .page-nav__icon {
  background: color-mix(in srgb, var(--shell-accent) 12%, var(--shell-surface));
  color: var(--shell-accent-strong);
}

/*
 * O ladrilho aberto usa o teal profundo da marca, não `accent-strong`: aquele é um sage
 * acinzentado pensado para texto, e cheio de fundo lê como grafite no meio da paleta verde.
 */
.page-nav__link.router-link-active .page-nav__icon {
  background: var(--shell-accent-deep);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--shell-accent-deep) 45%, transparent);
  color: #ffffff;
}

/* ---------------------------------------------------------------- selo de pendência */

.page-nav__badge {
  display: inline-flex;
  min-width: 1.35rem;
  align-items: center;
  justify-content: center;
  padding: 0.05rem 0.32rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

/*
 * Três tons e três pesos de moldura, e não três cores só: em escala de cinza — ou para quem não
 * distingue vermelho de âmbar — a diferença entre "há gente na fila" e "há um boletim retido"
 * precisa continuar de pé.
 */
.page-nav__badge--neutro {
  background: color-mix(in srgb, var(--shell-muted) 16%, transparent);
  color: var(--shell-muted);
}

.page-nav__badge--atencao {
  border-color: color-mix(in srgb, var(--shell-attention-line) 55%, transparent);
  background: var(--shell-attention-bg);
  color: var(--shell-attention);
}

.page-nav__badge--risco {
  border-color: color-mix(in srgb, var(--danger-soft) 55%, transparent);
  background: color-mix(in srgb, var(--danger-soft) 20%, transparent);
  color: var(--danger-soft);
  font-weight: 900;
}

/* No item ativo o fundo já é forte; o selo sobe de contraste para não sumir dentro dele. */
.page-nav__link.router-link-active .page-nav__badge--neutro {
  background: color-mix(in srgb, currentcolor 18%, transparent);
  color: inherit;
}

.page-nav__badge-sr {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
