<script setup lang="ts">
/**
 * O mapa na lateral: Início, e cada espaço com os seus destinos.
 *
 * O espaço aberto é o da tela atual; os outros ficam fechados numa linha só, com o total de
 * pendências deles — ninguém precisa abrir o Hotel para saber que lá há sete coisas paradas.
 * No modo "lista" (Configurações), todos ficam abertos.
 *
 * Os destinos do espaço aberto ficam num painel de vidro, e o destino atual acende na cor do
 * espaço. Abrir e fechar um espaço desliza.
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
      <span class="mapa__ladrilho" aria-hidden="true"><i class="ph ph-house-simple" /></span>
      <span class="mapa__rotulo shell-rotulo">{{ t('shell.barra.inicio') }}</span>
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
        <span class="mapa__ladrilho espaco__icone" aria-hidden="true"><i :class="espaco.icone" /></span>
        <span class="mapa__rotulo espaco__nome shell-rotulo">{{ espaco.rotulo }}</span>
        <span
          v-if="espaco.selo && !aberto(espaco)"
          class="mapa__selo"
          :class="`mapa__selo--${espaco.tom ?? 'neutro'}`"
        >
          {{ espaco.selo }}
        </span>
        <i
          v-if="!todosAbertos"
          class="ph ph-caret-right espaco__seta shell-rotulo"
          aria-hidden="true"
        />
      </RouterLink>

      <!--
        A gaveta do espaço fica montada mesmo fechada: assim ela abre e fecha deslizando (a linha
        da grade vai de 0 a 1fr). Fechada, sai da ordem do Tab e do leitor de tela.
      -->
      <div
        class="espaco__gaveta"
        :inert="!aberto(espaco) || undefined"
        :aria-hidden="!aberto(espaco) || undefined"
      >
        <div class="espaco__dobra">
          <ul class="espaco__destinos">
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
                <span class="mapa__rotulo shell-rotulo">{{ destino.rotulo }}</span>
                <i
                  v-if="destino.bloqueado"
                  class="ph ph-lock-simple destino__cadeado shell-rotulo"
                  aria-hidden="true"
                />
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
        </div>
      </div>
    </section>
  </nav>
</template>

<style scoped>
/*
 * A barra no acabamento novo (20/10/2026): cada espaço é uma linha com o ladrilho da cor dele; o
 * espaço aberto mostra os destinos num painel de vidro, como um cartão dentro da moldura verde, e o
 * destino atual acende na cor do espaço. Abrir e fechar desliza, e recolher a barra deixa só os
 * ícones, numa coluna.
 */
/* A coluna não cresce com as palavras: recolhida, elas somem mas ainda ocupariam lugar. */
.mapa {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 4px;
  padding: 4px 12px 14px;
}

.mapa__inicio,
.espaco__cabeca,
.destino {
  position: relative;
  display: flex;
  align-items: center;
  border-radius: 12px;
  color: var(--sobre-rail-2);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.mapa__inicio,
.espaco__cabeca {
  min-height: 46px;
  gap: 12px;
  padding: 0 10px 0 8px;
  font-size: 14.5px;
  font-weight: 550;
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
  margin-bottom: 8px;
}

.mapa__inicio--ativo {
  background: rgb(255 255 255 / 9%);
  color: var(--sobre-rail);
  font-weight: 650;
}

/*
 * O ladrilho: o mesmo quadrado macio das telas, aqui em vidro sobre o verde. Ícone de tamanho par
 * no quadrado par: com 17 px sobrava meio pixel, e o desenho caía para baixo e para a direita.
 */
.mapa__ladrilho {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 7%);
  color: var(--sobre-rail);
  font-size: 18px;
  transition:
    background var(--pj-tempo-medio) var(--pj-curva-chega),
    box-shadow var(--pj-tempo-medio) var(--pj-curva-chega),
    color var(--pj-tempo-medio) var(--pj-curva-chega);
}

.mapa__inicio--ativo .mapa__ladrilho {
  background: linear-gradient(145deg, var(--pets-claro), var(--salvia));
  box-shadow: 0 6px 14px -6px rgb(0 0 0 / 55%);
  color: var(--rail);
}

.mapa__rotulo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ------------------------------------------------------------------------------- espaço */

.espaco {
  --lugar-na-barra: var(--pj-lugar-claro);
}

.espaco__cabeca {
  color: var(--sobre-rail);
}

.espaco__icone {
  background: color-mix(in oklab, var(--lugar-na-barra) 18%, transparent);
  color: var(--lugar-na-barra);
}

.espaco--aberto .espaco__icone {
  background: var(--pj-lugar-degrade);
  box-shadow:
    0 6px 14px -6px rgb(0 0 0 / 60%),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  color: #fff;
}

.espaco--aberto .espaco__cabeca {
  font-weight: 650;
}

.espaco__seta {
  flex: none;
  color: var(--sobre-rail-2);
  font-size: 12px;
  transition: transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.espaco--aberto .espaco__seta {
  transform: rotate(90deg);
}

/* A gaveta desliza: a linha da grade vai de 0 a 1fr, e o miolo corta o que ainda não cabe. */
.espaco__gaveta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 280ms var(--pj-curva-chega),
    opacity 200ms var(--pj-curva-chega);
}

.espaco--aberto .espaco__gaveta {
  grid-template-rows: 1fr;
  opacity: 1;
}

.espaco__dobra {
  min-height: 0;
  overflow: hidden;
}

/* O painel de vidro com os destinos: um cartão dentro da moldura. */
.espaco__destinos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  margin: 4px 0 8px;
  padding: 6px;
  border: 1px solid rgb(255 255 255 / 7%);
  border-radius: 14px;
  background: rgb(255 255 255 / 4%);
  list-style: none;
}

.destino {
  min-height: 38px;
  gap: 11px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 450;
}

.destino__icone {
  flex: none;
  width: 20px;
  font-size: 18px;
  text-align: center;
  opacity: 0.9;
}

.destino--ativo,
.destino--ativo:hover {
  background: color-mix(in oklab, var(--lugar-na-barra) 17%, transparent);
  color: #fff;
  font-weight: 600;
}

.destino--ativo::before {
  position: absolute;
  top: 9px;
  bottom: 9px;
  inset-inline-start: -6px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--lugar-na-barra);
  content: '';
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
  flex: none;
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
  transition:
    transform var(--pj-tempo-medio) var(--pj-curva-chega),
    opacity var(--pj-tempo-curto) ease;
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

/*
 * Recolhida: as palavras somem (a moldura cuida do esmaecer) e sobram os ícones, todos no eixo da
 * coluna de 48 px — os destinos chegam o ícone para o mesmo centro dos ladrilhos. O selo vai para
 * o canto do ícone.
 */
.mapa--recolhida .mapa__selo {
  position: absolute;
  top: 3px;
  inset-inline-start: 30px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
}

.mapa--recolhida .destino {
  padding-inline: 7px;
}

.mapa--recolhida .destino .mapa__selo {
  inset-inline-start: 19px;
}

.mapa--recolhida .destino--ativo::before {
  display: none;
}

/* Densidade compacta (Configurações → Aparência): mais destinos à vista sem rolar a barra. */
.shell--densa .mapa__inicio,
.shell--densa .espaco__cabeca {
  min-height: 38px;
}

.shell--densa .destino {
  min-height: 32px;
  font-size: 13px;
}

.shell--densa .mapa__ladrilho {
  width: 28px;
  height: 28px;
  font-size: 16px;
}

.shell--densa .espaco__destinos {
  margin-block: 2px 6px;
  padding: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .mapa__inicio,
  .espaco__cabeca,
  .destino,
  .espaco__seta,
  .espaco__gaveta,
  .mapa__ladrilho,
  .mapa__selo {
    transition: none;
  }
}
</style>
