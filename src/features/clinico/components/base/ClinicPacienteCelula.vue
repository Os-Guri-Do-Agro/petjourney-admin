<script setup lang="ts">
/**
 * O paciente numa linha de lista: o rosto, o nome e a linha de apoio.
 *
 * As listas do módulo mostravam o paciente só por escrito — "Luna · Canina" —, e uma clínica cheia
 * tem duas Lunas e três Thors. O avatar é o mesmo do mapa de internação e da ficha
 * (`PetAvatar`): a foto quando existe, e quando não existe, as iniciais numa cor fixa por animal e a
 * silhueta da espécie. Quem trabalha no balcão reconhece o bicho antes de ler o nome.
 *
 * O slot padrão é a linha de baixo (espécie, responsável, tipo); o slot `selo` fica ao lado do
 * nome (prioridade da fila, reincidência).
 */
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import type { Pet } from '../../data/types'

const props = withDefaults(
  defineProps<{
    pet: Pet | null
    /** Nome quando o pet não está no catálogo carregado (listas que trazem só o nome). */
    nome?: string
    tamanho?: 'sm' | 'md'
  }>(),
  { nome: '', tamanho: 'md' },
)

function iniciaisDe(nome: string) {
  return nome.trim().slice(0, 2).toLocaleUpperCase()
}
</script>

<template>
  <span class="paciente">
    <PetAvatar
      :nome="props.pet?.nome ?? nome"
      :iniciais="props.pet?.iniciais ?? iniciaisDe(nome)"
      :especie="props.pet?.especie ?? null"
      :foto-url="props.pet?.fotoUrl ?? ''"
      :tamanho="tamanho"
    />
    <span class="paciente__texto">
      <span class="paciente__linha">
        <strong class="paciente__nome">{{ props.pet?.nome ?? nome }}</strong>
        <slot name="selo" />
      </span>
      <span v-if="$slots.default" class="paciente__meta"><slot /></span>
    </span>
  </span>
</template>

<style scoped>
/* A linha de lista do kit (`ui-linha`), em miniatura: rosto, nome em 600 e a meta em tinta 2. */
.paciente {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.paciente__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

/*
 * Sem lugar para os dois, o selo desce para baixo do nome em vez de passar por cima da coluna ao
 * lado: "Maximiliano Bartholomeu…" com "Reincidente" encostava no número de faltas.
 */
.paciente__linha {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
}

/* O nome é o último a ceder: o selo ao lado encolhe antes de "Amora" virar "Am…". */
.paciente__nome {
  max-width: 100%;
  flex-shrink: 0;
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paciente__meta {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
