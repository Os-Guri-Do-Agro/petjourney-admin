<script setup lang="ts">
/**
 * As abas de um destino: as telas irmãs, lado a lado, com o que está parado em cada uma.
 *
 * Cada aba é um link de verdade (a URL da tela), então abrir em outra guia, voltar e favoritar
 * funcionam como em qualquer link.
 */
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Aba } from '@/navegacao/espacos'

defineProps<{ abas: Aba[]; atual: string | null; rotulo: string }>()

const { t } = useI18n()
</script>

<template>
  <nav class="abas" :aria-label="t('espacos.abasAria', { destino: rotulo })">
    <RouterLink
      v-for="aba in abas"
      :key="aba.to"
      class="abas__aba"
      :class="{ 'abas__aba--atual': aba.to === atual }"
      :to="aba.to"
      active-class=""
      exact-active-class=""
      :aria-current="aba.to === atual ? 'page' : undefined"
      :title="aba.tituloDoSelo"
    >
      <span>{{ aba.rotulo }}</span>
      <i v-if="aba.bloqueado" class="ph ph-lock-simple" aria-hidden="true" />
      <span v-else-if="aba.selo" class="abas__selo" :class="`abas__selo--${aba.tom ?? 'neutro'}`">
        {{ aba.selo }}
      </span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.abas {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid var(--linha);
  scrollbar-width: none;
}

.abas::-webkit-scrollbar {
  display: none;
}

.abas__aba {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.abas__aba:first-child {
  padding-left: 2px;
}

.abas__aba:hover {
  color: var(--tinta);
}

.abas__aba:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -4px;
}

.abas__aba--atual {
  color: var(--tinta);
  font-weight: 600;
}

.abas__aba--atual::after {
  position: absolute;
  right: 12px;
  bottom: -1px;
  left: 12px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.abas__aba--atual:first-child::after {
  left: 2px;
}

.abas__selo {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.abas__selo--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.abas__selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.abas__selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}
</style>
