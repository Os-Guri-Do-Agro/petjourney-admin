<script setup lang="ts">
/**
 * As linhas da pauta: assunto, gravidade e onde se resolve.
 *
 * Nasceu dentro de `HomePauta` (o "My Tasks" do Prodify, na paleta da casa) e saiu quando "Hoje na
 * clínica" passou a responder a mesma pergunta — o que pede ação — para o dia do veterinário. Uma
 * forma só nas duas telas: quem aprendeu a ler a pauta da Visão geral lê esta sem reaprender.
 *
 * Cada linha é um link inteiro até a tela onde o trabalho está. O quadradinho leva a cor de quem
 * contém a tabela (`--grupo-cor`), o selo leva a gravidade e, no urgente, o destino também.
 */
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import type { LinhaDaTabela } from './pauta-tabela'

defineProps<{ linhas: LinhaDaTabela[] }>()

const { t } = useI18n()

/** O selo de prioridade: coral para urgente, pêssego para atenção, cinza para o normal. */
const COR_DO_TOM = { risco: 'coral', atencao: 'pessego', neutro: 'cinza' } as const
</script>

<template>
  <div class="tabela">
    <div class="tabela__cabeca" aria-hidden="true">
      <span>{{ t('inicio.pauta.coluna.assunto') }}</span>
      <span>{{ t('inicio.pauta.coluna.gravidade') }}</span>
      <span class="tabela__onde">{{ t('inicio.pauta.coluna.onde') }}</span>
    </div>

    <TransitionGroup tag="ul" name="linha" class="tabela__linhas">
      <li v-for="item in linhas" :key="item.id" class="tabela__item">
        <RouterLink class="linha" :to="item.to">
          <span class="linha__assunto">
            <PetAvatar
              v-if="item.pet"
              class="linha__avatar"
              :nome="item.pet.nome"
              :iniciais="item.pet.iniciais"
              :especie="item.pet.especie ?? null"
              :foto-url="item.pet.fotoUrl ?? ''"
              tamanho="sm"
            />
            <span v-else class="linha__ponto" aria-hidden="true" />
            <Transition name="frase" mode="out-in">
              <span :key="`${item.frase}|${item.detalhe ?? ''}`" class="linha__texto">
                <span class="linha__frase">{{ item.frase }}</span>
                <span v-if="item.detalhe" class="linha__detalhe">{{ item.detalhe }}</span>
              </span>
            </Transition>
          </span>
          <span class="hc-selo linha__selo" :class="`hc--${COR_DO_TOM[item.tom]}`">
            {{ t(`inicio.pauta.gravidade.${item.tom}`) }}
          </span>
          <span class="linha__onde" :class="{ 'linha__onde--urgente': item.tom === 'risco' }">
            {{ item.onde }}
          </span>
        </RouterLink>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/*
 * As colunas do "My Tasks": o nome solto à esquerda, prioridade e prazo em colunas estreitas à
 * direita. Aqui, Gravidade e Onde.
 */
.tabela {
  --colunas: minmax(0, 1fr) 6.25rem 6.75rem;

  container-type: inline-size;
}

.tabela__cabeca {
  display: grid;
  grid-template-columns: var(--colunas);
  gap: 0.75rem;
  padding: 0.35rem 0.5rem 0.45rem 1.6rem;
  border-block-end: 1px solid var(--hc-linha);
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  font-weight: 500;
}

.tabela__onde {
  text-align: end;
}

.tabela__linhas {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tabela__item + .tabela__item {
  border-block-start: 1px solid var(--hc-linha);
}

.linha {
  display: grid;
  grid-template-columns: var(--colunas);
  align-items: center;
  gap: 0.75rem;
  min-height: 3rem;
  padding: 0.6rem 0.5rem;
  border-radius: 0.5rem;
  color: var(--hc-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.linha:hover {
  background: var(--hc-fundo);
}

.linha:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

.linha__assunto {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  min-width: 0;
}

.linha__avatar {
  flex-shrink: 0;
  align-self: center;
}

/* O quadradinho do Prodify, na cor de quem contém a tabela. */
.linha__ponto {
  flex-shrink: 0;
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border-radius: 2px;
  background: var(--grupo-cor, var(--hc-ciano-tinta));
  translate: 0 -0.1rem;
}

.linha__texto {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.linha__frase {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 500;
}

.linha__detalhe {
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  line-height: 1.4;
}

.linha__selo {
  justify-self: start;
}

.linha__onde {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-align: end;
  white-space: nowrap;
}

/* Como o "Today" do Prodify: o que é urgente ganha a cor também no prazo. */
.linha__onde--urgente {
  color: var(--hc-coral-tinta);
  font-weight: 600;
}

/*
 * Estreita (celular, ou a tabela numa coluna lateral), as duas colunas de 6 rem deixariam o
 * assunto com uma palavra por linha. O assunto passa a ocupar a linha inteira; gravidade e onde
 * descem para baixo dele, o selo alinhado ao texto (quadradinho + respiro = 1,2 rem).
 */
@container (max-width: 26rem) {
  .tabela__cabeca {
    display: none;
  }

  .linha {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: 0.4rem;
  }

  .linha__assunto {
    grid-column: 1 / -1;
  }

  .linha__selo {
    margin-inline-start: 1.2rem;
  }
}

/* ------------------------------------------------------------------ movimento
 * Só o que explica mudança de estado: a linha que entra ou sai da pauta, e a frase que troca.
 */
.linha-enter-active,
.linha-leave-active {
  transition:
    opacity 180ms ease-out,
    translate 180ms ease-out;
}

.linha-enter-from,
.linha-leave-to {
  opacity: 0;
  translate: 0 -0.35rem;
}

.frase-enter-active,
.frase-leave-active {
  transition: opacity 150ms ease-out;
}

.frase-enter-from,
.frase-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .linha,
  .linha-enter-active,
  .linha-leave-active,
  .frase-enter-active,
  .frase-leave-active {
    transition: none;
  }
}
</style>
