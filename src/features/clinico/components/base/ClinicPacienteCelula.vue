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
.paciente {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.paciente__texto {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.paciente__linha {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

/* O nome é o último a ceder: o selo ao lado encolhe antes de "Amora" virar "Am…". */
.paciente__nome {
  flex-shrink: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paciente__meta {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
