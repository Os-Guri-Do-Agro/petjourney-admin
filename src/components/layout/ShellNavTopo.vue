<script setup lang="ts">
/**
 * A navegação no topo, para as molduras sem barra lateral.
 *
 * Da esquerda para a direita: a marca (leva ao Início); a pílula do espaço aberto, com o ícone
 * dele e cada destino como uma aba, o aberto em sálvia e a contagem de quem pede atenção; os outros
 * espaços (Hotel, Portal) como botões de ícone; e, no fim, a busca e a conta.
 *
 * Os dados são os mesmos da barra lateral (`espacos`, `aqui`): muda só a forma.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import ShellConta from '@/components/layout/ShellConta.vue'
import type { Espaco, Localizacao } from '@/navegacao/espacos'

const props = defineProps<{
  espacos: Espaco[]
  aqui: Localizacao
  busca: boolean
  atalho: string
}>()

const emit = defineEmits<{ buscar: [] }>()

const { t } = useI18n()

const espacoAberto = computed(() => props.aqui.espaco ?? props.espacos[0] ?? null)
const outros = computed(() =>
  props.espacos.filter((espaco) => espaco.id !== espacoAberto.value?.id),
)
function ativo(id: string) {
  return props.aqui.espaco?.id === espacoAberto.value?.id && props.aqui.destino?.id === id
}

const destinos = computed(() =>
  (espacoAberto.value?.destinos ?? []).filter((destino) => !destino.bloqueado),
)
</script>

<template>
  <header class="nav-topo">
    <RouterLink class="nav-topo__marca" to="/inicio" :title="t('shell.barra.inicio')">
      <span class="nav-topo__pata" aria-hidden="true">
        <img src="/pata-escura.png" alt="" width="20" height="20" />
      </span>
      <span class="nav-topo__nome">PetJourney</span>
    </RouterLink>

    <nav v-if="espacoAberto" class="nav-topo__trilho" :aria-label="t('shell.barra.navegacao')">
      <span class="nav-topo__espaco" aria-hidden="true"><i :class="espacoAberto.icone" /></span>
      <RouterLink
        v-for="destino in destinos"
        :key="destino.id"
        class="nav-topo__destino"
        :class="{ 'nav-topo__destino--ativo': ativo(destino.id) }"
        :to="destino.to"
        active-class=""
        exact-active-class=""
        :aria-current="ativo(destino.id) ? 'page' : undefined"
        :title="destino.tituloDoSelo ?? undefined"
      >
        <i v-if="ativo(destino.id)" :class="destino.icone" aria-hidden="true" />
        {{ destino.rotulo }}
        <span
          v-if="destino.selo"
          class="nav-topo__selo"
          :class="`nav-topo__selo--${destino.tom ?? 'neutro'}`"
          :aria-label="destino.tituloDoSelo"
        >
          {{ destino.selo }}
        </span>
      </RouterLink>
    </nav>

    <nav
      v-if="outros.length"
      class="nav-topo__espacos"
      :aria-label="t('shell.barra.outrosEspacos')"
    >
      <RouterLink
        v-for="espaco in outros"
        :key="espaco.id"
        class="nav-topo__icone"
        :to="espaco.to"
        :title="espaco.rotulo"
        :aria-label="espaco.rotulo"
      >
        <i :class="espaco.icone" aria-hidden="true" />
        <span v-if="espaco.selo" class="nav-topo__ponto" aria-hidden="true" />
      </RouterLink>
    </nav>

    <div class="nav-topo__fim">
      <Button
        v-if="busca"
        type="button"
        class="nav-topo__busca"
        icon="ph ph-magnifying-glass"
        :aria-label="t('clinico.busca.abrir')"
        :title="`${t('clinico.busca.abrir')} (${atalho})`"
        @click="emit('buscar')"
      />
      <ShellConta class="nav-topo__conta" :recolhida="true" />
    </div>
  </header>
</template>

<style scoped>
.nav-topo {
  position: relative;
  z-index: 30;
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
}

.nav-topo__marca {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 10px;
  color: var(--ls-tinta);
  font-family: var(--ls-display);
  font-size: 17px;
  font-weight: 650;
  text-decoration: none;
}

.nav-topo__marca:focus-visible,
.nav-topo__destino:focus-visible,
.nav-topo__icone:focus-visible {
  outline: 2px solid var(--ls-marca);
  outline-offset: 2px;
}

.nav-topo__pata {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: var(--ls-cartao-2);
}

/* A pílula do espaço aberto: os destinos como abas, o aberto em sálvia. */
.nav-topo__trilho {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  padding: 4px;
  border-radius: 999px;
  background: var(--ls-cartao);
  box-shadow: inset 0 0 0 1px var(--ls-linha);
  scrollbar-width: none;
}

.nav-topo__trilho::-webkit-scrollbar {
  display: none;
}

.nav-topo__espaco {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--ls-linha-forte);
  color: var(--ls-tinta);
  font-size: 17px;
}

.nav-topo__destino {
  display: inline-flex;
  min-height: 36px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border-radius: 999px;
  color: var(--ls-tinta);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 150ms ease-out;
}

.nav-topo__destino:hover {
  background: var(--ls-cartao-2);
}

.nav-topo__destino--ativo,
.nav-topo__destino--ativo:hover {
  background: var(--ls-marca);
  color: var(--ls-sobre-marca);
  font-weight: 650;
}

.nav-topo__selo {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  background: var(--ls-cartao-2);
  color: var(--ls-tinta-2);
  font-size: 11.5px;
  font-weight: 700;
}

.nav-topo__selo--risco,
.nav-topo__selo--atencao {
  background: var(--ls-coral);
  color: #fff;
}

.nav-topo__espacos {
  display: flex;
  flex: none;
  gap: 8px;
}

.nav-topo__icone {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: var(--ls-cartao);
  box-shadow: inset 0 0 0 1px var(--ls-linha);
  color: var(--ls-tinta);
  font-size: 19px;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.nav-topo__icone:hover {
  background: var(--ls-cartao-2);
}

.nav-topo__ponto {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ls-coral);
}

.nav-topo__fim {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  margin-inline-start: auto;
}

.nav-topo__busca.p-button {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--ls-cartao);
  background-image: none;
  box-shadow: inset 0 0 0 1px var(--ls-linha) !important;
  color: var(--ls-tinta);
  font-size: 18px;
}

.nav-topo__busca.p-button:hover {
  background: var(--ls-cartao-2);
}

/* Em tela média a marca fica só com a pata e as abas apertam, para todas caberem. */
@media (max-width: 1200px) {
  .nav-topo {
    gap: 10px;
    padding-inline: 16px;
  }

  .nav-topo__nome {
    display: none;
  }

  .nav-topo__destino {
    padding: 0 10px;
  }
}

/* A conta só com o rosto, num círculo como os outros botões do topo. */
.nav-topo__conta :deep(.shell-rotulo) {
  display: none;
}

.nav-topo__conta :deep(.conta__botao) {
  width: auto;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: transparent;
}

.nav-topo__conta :deep(.conta__avatar) {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: none;
}
</style>
