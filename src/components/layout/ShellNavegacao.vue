<script setup lang="ts">
/**
 * O mapa na lateral: Início, e cada espaço com os seus destinos.
 *
 * O espaço aberto é o da tela atual; os outros ficam fechados numa linha só, com o total de
 * pendências deles — ninguém precisa abrir o Hotel para saber que lá há sete coisas paradas.
 * No modo "lista" (Configurações), todos ficam abertos.
 *
 * Os destinos penduram numa linha vertical na cor do espaço — a trilha —, e o destino atual é o
 * ponto aceso nela.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import type { Espaco, Localizacao } from '@/navegacao/espacos'

const props = defineProps<{
  espacos: Espaco[]
  aqui: Localizacao
  recolhida: boolean
  todosAbertos: boolean
}>()

const emit = defineEmits<{ navegou: [] }>()

const { t } = useI18n()
const route = useRoute()

const noInicio = computed(() => route.path === '/inicio')

function aberto(espaco: Espaco) {
  return props.todosAbertos || props.aqui.espaco?.id === espaco.id
}

function destinoAtivo(id: string, espaco: Espaco) {
  return props.aqui.espaco?.id === espaco.id && props.aqui.destino?.id === id
}
</script>

<template>
  <nav class="mapa" :class="{ 'mapa--recolhida': recolhida }" :aria-label="t('shell.barra.navegacao')">
    <RouterLink
      class="mapa__inicio"
      :class="{ 'mapa__inicio--ativo': noInicio }"
      to="/inicio"
      :aria-current="noInicio ? 'page' : undefined"
      :title="recolhida ? t('shell.barra.inicio') : undefined"
      @click="emit('navegou')"
    >
      <i class="ph ph-house-simple" aria-hidden="true" />
      <span class="mapa__rotulo">{{ t('shell.barra.inicio') }}</span>
    </RouterLink>

    <section
      v-for="espaco in espacos"
      :key="espaco.id"
      class="espaco"
      :class="[`pj-lugar--${espaco.lugar}`, { 'espaco--aberto': aberto(espaco) }]"
    >
      <RouterLink
        class="espaco__cabeca"
        :to="espaco.to"
        :aria-expanded="aberto(espaco)"
        :title="recolhida ? espaco.rotulo : undefined"
        @click="emit('navegou')"
      >
        <span class="espaco__icone" aria-hidden="true"><i :class="espaco.icone" /></span>
        <span class="mapa__rotulo espaco__nome">{{ espaco.rotulo }}</span>
        <span
          v-if="espaco.selo && !aberto(espaco)"
          class="mapa__selo"
          :class="`mapa__selo--${espaco.tom ?? 'neutro'}`"
        >
          {{ espaco.selo }}
        </span>
        <i
          v-if="!recolhida && !todosAbertos"
          class="ph ph-caret-right espaco__seta"
          aria-hidden="true"
        />
      </RouterLink>

      <ul v-if="aberto(espaco)" class="espaco__destinos">
        <li v-for="destino in espaco.destinos" :key="destino.id">
          <RouterLink
            class="destino"
            :class="{
              'destino--ativo': destinoAtivo(destino.id, espaco),
              'destino--bloqueado': destino.bloqueado,
            }"
            :to="destino.to"
            active-class=""
            exact-active-class=""
            :aria-current="destinoAtivo(destino.id, espaco) ? 'page' : undefined"
            :title="recolhida ? destino.rotulo : (destino.tituloDoSelo ?? undefined)"
            @click="emit('navegou')"
          >
            <i class="destino__icone" :class="destino.icone" aria-hidden="true" />
            <span class="mapa__rotulo">{{ destino.rotulo }}</span>
            <i v-if="destino.bloqueado" class="ph ph-lock-simple destino__cadeado" aria-hidden="true" />
            <span
              v-else-if="destino.selo"
              class="mapa__selo"
              :class="`mapa__selo--${destino.tom ?? 'neutro'}`"
              :aria-label="destino.tituloDoSelo"
            >
              {{ destino.selo }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </nav>
</template>

<style scoped>
.mapa {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 4px 12px 12px;
}

.mapa__inicio,
.espaco__cabeca,
.destino {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 0 10px;
  border-radius: 10px;
  color: var(--sobre-rail-2);
  font-size: 14px;
  font-weight: 450;
  text-decoration: none;
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.mapa__inicio:hover,
.espaco__cabeca:hover,
.destino:hover {
  background: rgb(255 255 255 / 6%);
  color: var(--sobre-rail);
}

.mapa__inicio:focus-visible,
.espaco__cabeca:focus-visible,
.destino:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: -2px;
}

.mapa__inicio {
  margin-bottom: 10px;
}

.mapa__inicio i {
  width: 28px;
  font-size: 19px;
  text-align: center;
}

.mapa__inicio--ativo {
  background: var(--rail-ativo);
  color: var(--sobre-rail);
  font-weight: 600;
}

.mapa__rotulo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* O espaço: o ícone mora num disco da cor do lugar, que é a cor que a tela inteira vai usar. */
.espaco {
  --lugar-na-barra: var(--pj-lugar-claro);
}

.espaco + .espaco {
  margin-top: 6px;
}

.espaco__cabeca {
  color: var(--sobre-rail);
  font-weight: 550;
}

.espaco__icone {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  background: color-mix(in oklab, var(--lugar-na-barra) 22%, transparent);
  color: var(--lugar-na-barra);
  font-size: 16px;
}

.espaco--aberto .espaco__icone {
  background: var(--lugar-na-barra);
  color: var(--rail);
}

.espaco__seta {
  color: var(--sobre-rail-2);
  font-size: 12px;
  transition: transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.espaco--aberto .espaco__seta {
  transform: rotate(90deg);
}

/*
 * A trilha: os destinos penduram numa linha na cor do espaço, alinhada ao centro do disco. O
 * destino atual é o ponto aceso nela.
 */
.espaco__destinos {
  position: relative;
  display: grid;
  gap: 1px;
  margin: 2px 0 4px;
  padding: 0 0 0 26px;
  list-style: none;
}

.espaco__destinos::before {
  position: absolute;
  top: 0;
  bottom: 14px;
  left: 23px;
  width: 2px;
  border-radius: 2px;
  background: color-mix(in oklab, var(--lugar-na-barra) 30%, transparent);
  content: '';
}

.destino {
  min-height: 36px;
  padding-left: 14px;
  font-size: 13.5px;
}

.destino::before {
  position: absolute;
  top: 50%;
  left: -5.5px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--rail);
  border-radius: 50%;
  background: transparent;
  content: '';
  transform: translateY(-50%) scale(0.4);
  transition:
    transform var(--pj-tempo-medio) var(--pj-curva-chega),
    background-color var(--pj-tempo-medio) var(--pj-curva-chega);
}

.destino--ativo {
  background: var(--rail-ativo);
  color: var(--sobre-rail);
  font-weight: 600;
}

.destino--ativo::before {
  background: var(--lugar-na-barra);
  transform: translateY(-50%) scale(1);
}

.destino__icone {
  flex: none;
  font-size: 17px;
  opacity: 0.85;
}

.destino--ativo .destino__icone {
  color: var(--lugar-na-barra);
  opacity: 1;
}

.destino--bloqueado {
  opacity: 0.7;
}

.destino__cadeado {
  font-size: 13px;
}

/*
 * Os selos da barra têm cor própria: os tons de estado foram feitos para a folha clara, e sobre
 * o verde-floresta da barra precisam ser mais claros para continuar lidos como o mesmo aviso.
 */
.mapa__selo {
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
  line-height: 1;
}

.mapa__selo--neutro {
  background: rgb(255 255 255 / 14%);
  color: var(--sobre-rail);
}

.mapa__selo--atencao {
  background: #f0b77c;
  color: #2b1703;
}

.mapa__selo--risco {
  background: #f39b90;
  color: #3a0d09;
}

/* Recolhida: só os ícones; o destino atual continua aceso. */
.mapa--recolhida {
  padding-inline: 10px;
}

.mapa--recolhida .mapa__rotulo,
.mapa--recolhida .espaco__seta {
  display: none;
}

.mapa--recolhida .mapa__inicio,
.mapa--recolhida .espaco__cabeca,
.mapa--recolhida .destino {
  justify-content: center;
  padding: 0;
}

.mapa--recolhida .espaco__destinos {
  padding-left: 0;
}

.mapa--recolhida .espaco__destinos::before,
.mapa--recolhida .destino::before {
  display: none;
}

.mapa--recolhida .mapa__selo {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .mapa__inicio,
  .espaco__cabeca,
  .destino,
  .destino::before,
  .espaco__seta {
    transition: none;
  }
}
</style>
