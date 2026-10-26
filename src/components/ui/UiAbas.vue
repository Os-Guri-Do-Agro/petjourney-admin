<script setup lang="ts">
/**
 * As abas de um destino: as telas irmãs, lado a lado, com o que está parado em cada uma.
 *
 * Cada aba é um link de verdade (a URL da tela), então abrir em outra guia, voltar e favoritar
 * funcionam como em qualquer link.
 *
 * `vidro`: dentro do cabeçalho do app, as abas são pílulas de vidro com texto branco, e a aberta é
 * papel branco com a tinta escura (o filtro do app: a escolhida cheia, as outras em véu, sem borda).
 */
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Aba } from '@/navegacao/espacos'

withDefaults(
  defineProps<{ abas: Aba[]; atual: string | null; rotulo: string; vidro?: boolean }>(),
  {
    vidro: false,
  },
)

const { t } = useI18n()
</script>

<template>
  <nav
    class="abas"
    :class="{ 'abas--vidro': vidro }"
    :aria-label="t('espacos.abasAria', { destino: rotulo })"
  >
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
      <i class="abas__icone" :class="aba.icone" aria-hidden="true" />
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
  gap: 6px;
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
  height: 46px;
  padding: 0 12px;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abas__aba:first-child {
  padding-left: 4px;
}

.abas__icone {
  color: var(--tinta-3);
  font-size: 17px;
  transition: color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abas__aba:hover {
  color: var(--tinta);
}

.abas__aba:hover::after {
  position: absolute;
  right: 12px;
  bottom: -1px;
  left: 12px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--linha-media);
  content: '';
}

.abas__aba:first-child:hover::after {
  left: 4px;
}

.abas__aba:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -4px;
}

.abas__aba--atual,
.abas__aba--atual:hover {
  color: var(--tinta);
  font-weight: 650;
}

.abas__aba--atual .abas__icone {
  color: var(--pj-lugar-tinta, var(--musgo));
}

.abas__aba--atual::after,
.abas__aba--atual:hover::after {
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
  left: 4px;
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

/* ----------------------------------------------------------- pílulas de vidro (cabeçalho) */

.abas--vidro {
  gap: 8px;
  border-bottom: 0;
}

.abas--vidro .abas__aba,
.abas--vidro .abas__aba:first-child {
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--app-vidro);
  color: #fff;
  font-weight: 600;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.abas--vidro .abas__icone {
  color: #fff;
}

.abas--vidro .abas__aba:hover {
  background: var(--app-vidro-forte);
  color: #fff;
}

.abas--vidro .abas__aba::after,
.abas--vidro .abas__aba:hover::after {
  display: none;
}

.abas--vidro .abas__aba:focus-visible {
  border-radius: 999px;
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.abas--vidro .abas__aba.abas__aba--atual,
.abas--vidro .abas__aba.abas__aba--atual:hover {
  background: #fff;
  color: #2c4741;
  font-weight: 700;
}

.abas--vidro .abas__aba--atual .abas__icone {
  color: #2c4741;
}

.app-dark .abas--vidro .abas__aba.abas__aba--atual,
.app-dark .abas--vidro .abas__aba.abas__aba--atual:hover {
  background: var(--app-cartao);
  color: var(--app-tinta);
}

.app-dark .abas--vidro .abas__aba--atual .abas__icone {
  color: var(--app-tinta);
}
</style>
