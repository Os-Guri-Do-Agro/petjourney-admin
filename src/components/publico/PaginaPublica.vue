<script setup lang="ts">
/**
 * A moldura das páginas públicas — agendamento da clínica (`/agendar/:clinica`) e reserva do hotel
 * (`/reservar/:hotel`), para quem ainda não tem o app.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Quem marca é o tutor, quase sempre no celular, e muitas vezes pela primeira vez. A página diz,
 * nesta ordem: **de quem é** (a casa no topo, no verde-floresta do PetJourney, com o ladrilho na cor
 * do lugar, o nome, o endereço e se está aberta agora), **em que passo o pedido está** ("Passo 2 de
 * 5" e os gomos que se enchem) e **o que fazer agora** (a etapa, com a ação grande presa no pé da
 * tela enquanto se rola). Embaixo, quem atende ou as regras da estadia, o contato e a assinatura.
 *
 * Em tela larga, duas metades, como num checkout: a casa à esquerda, parada, com os passos do
 * pedido e o que já foi escolhido em cada um; o pedido à direita. Abaixo de 1024 px, uma coluna: a
 * faixa da casa no alto, o pedido, e o pé no fim, já sobre o claro.
 *
 * Mora aqui, e não em cada página, para as duas serem a mesma por construção. As páginas só dizem
 * o quê — os textos chegam prontos, cada uma no seu `t()`.
 */
import Button from 'primevue/button'

import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'

export type PassoDaPagina = {
  id: string
  rotulo: string
  /** O que já foi escolhido neste passo. Vazio enquanto não há. */
  valor: string
  /** O valor é um desvio (emergência, urgência): sai em coral. */
  desvio?: boolean
}

export type ContatoDaPagina = { id: string; icone: string; rotulo: string; valor: string }

const props = withDefaults(
  defineProps<{
    /** Ícone da casa no ladrilho, classe do Phosphor (`ph-first-aid-kit`). */
    icone: string
    /** A cor do ladrilho: a do espaço da casa no portal. */
    lugar?: 'clinica' | 'hotel'
    /** `null` enquanto a casa carrega: o ladrilho aparece sozinho. */
    nome: string | null
    endereco?: string
    /** Aberta/fechada leva o ponto; `neutro` leva o relógio (o horário, sem estado de agora). */
    estado?: { texto: string; tom: 'aberto' | 'fechado' | 'neutro' } | null
    promessa?: string
    /** Os passos à esquerda. `null` esconde a seção (acompanhamento, casa não encontrada). */
    passos?: PassoDaPagina[] | null
    passoAtual?: number
    tituloDosPassos?: string
    rotuloDosPassos?: string
    rotuloFeito?: string
    /** "Passo 2 de 5", acima do conteúdo da metade do pedido. */
    contagem?: string
    equipe?: {
      titulo: string
      rostos: Array<{ id: string; nome: string; fotoUrl: string | null; iniciais: string }>
      nomes: string
      detalhe: string
    } | null
    regras?: { titulo: string; linhas: Array<{ icone: string; texto: string }> } | null
    contatos?: ContatoDaPagina[]
    rotuloDosContatos?: string
    assinatura?: string
    /** A faixa de demonstração: só para quem veio do portal. */
    demo?: { texto: string; voltar: string } | null
    /** Mostrar o pé (equipe, regras, contato). Some quando a casa não foi encontrada. */
    comPe?: boolean
  }>(),
  {
    lugar: 'clinica',
    endereco: '',
    estado: null,
    promessa: '',
    passos: null,
    passoAtual: 0,
    tituloDosPassos: '',
    rotuloDosPassos: '',
    rotuloFeito: '',
    contagem: '',
    equipe: null,
    regras: null,
    contatos: () => [],
    rotuloDosContatos: '',
    assinatura: '',
    demo: null,
    comPe: true,
  },
)

defineEmits<{ voltar: [] }>()

/** Feito, o de agora ou ainda por vir. */
function estadoDoPasso(indice: number) {
  if (indice < props.passoAtual) {
    return 'feito'
  }

  return indice === props.passoAtual ? 'atual' : 'depois'
}
</script>

<template>
  <div class="publica" :class="[`pj-lugar--${lugar}`, { 'publica--demo': demo }]">
    <div v-if="demo" class="publica__demo">
      <span>
        <i class="ph ph-flask" aria-hidden="true" />
        {{ demo.texto }}
      </span>
      <Button
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="demo.voltar"
        @click="$emit('voltar')"
      />
    </div>

    <div class="publica__palco">
      <!-- A metade da casa: o verde-floresta, com a pata da marca no canto. Só fundo. -->
      <div class="publica__fundo" aria-hidden="true" />

      <header class="publica__casa">
        <div class="publica__casa-topo">
          <span class="publica__icone" aria-hidden="true"><i class="ph" :class="icone" /></span>
          <LanguageSwitcher class="publica__idioma" variant="auth" tone="brand" />
        </div>

        <template v-if="nome">
          <h1>{{ nome }}</h1>
          <p v-if="endereco" class="publica__endereco">
            <i class="ph ph-map-pin" aria-hidden="true" />
            {{ endereco }}
          </p>
          <p v-if="estado" class="publica__estado" :class="`publica__estado--${estado.tom}`">
            <i v-if="estado.tom === 'neutro'" class="ph ph-clock" aria-hidden="true" />
            <span v-else class="publica__ponto" aria-hidden="true" />
            {{ estado.texto }}
          </p>
          <p v-if="promessa" class="publica__promessa">{{ promessa }}</p>
        </template>
      </header>

      <!-- Em que passo o pedido está e o que já foi escolhido. -->
      <section v-if="passos" class="publica__passos" aria-labelledby="publica-passos-titulo">
        <h2 id="publica-passos-titulo" class="publica__rotulo">{{ tituloDosPassos }}</h2>
        <ol class="passos" :aria-label="rotuloDosPassos">
          <li
            v-for="(passo, indice) in passos"
            :key="passo.id"
            class="passo"
            :class="`passo--${estadoDoPasso(indice)}`"
            :style="{ '--i': indice }"
            :aria-current="estadoDoPasso(indice) === 'atual' ? 'step' : undefined"
          >
            <span class="passo__marca" aria-hidden="true">
              <i v-if="estadoDoPasso(indice) === 'feito'" class="ph ph-check" />
              <template v-else>{{ indice + 1 }}</template>
            </span>
            <span class="passo__texto">
              <strong>{{ passo.rotulo }}</strong>
              <Transition name="passo-valor">
                <span
                  v-if="passo.valor"
                  :key="passo.valor"
                  class="passo__valor"
                  :class="{ 'passo__valor--desvio': passo.desvio }"
                >
                  {{ passo.valor }}
                </span>
              </Transition>
              <span v-if="estadoDoPasso(indice) === 'feito'" class="publica__so-leitor">
                {{ rotuloFeito }}
              </span>
            </span>
          </li>
        </ol>
      </section>

      <footer v-if="comPe && nome" class="publica__pe">
        <div v-if="equipe && equipe.rostos.length > 0" class="equipe">
          <h2 class="publica__rotulo">{{ equipe.titulo }}</h2>
          <div class="equipe__linha">
            <span class="equipe__rostos" aria-hidden="true">
              <span
                v-for="item in equipe.rostos"
                :key="item.id"
                class="equipe__rosto"
                :title="item.nome"
              >
                <img v-if="item.fotoUrl" :src="item.fotoUrl" alt="" />
                <template v-else>{{ item.iniciais }}</template>
              </span>
            </span>
            <span class="equipe__texto">
              <strong>{{ equipe.nomes }}</strong>
              <span v-if="equipe.detalhe">{{ equipe.detalhe }}</span>
            </span>
          </div>
        </div>

        <div v-if="regras && regras.linhas.length > 0" class="regras">
          <h2 class="publica__rotulo">{{ regras.titulo }}</h2>
          <ul class="regras__lista">
            <li v-for="linha in regras.linhas" :key="linha.texto">
              <i class="ph" :class="linha.icone" aria-hidden="true" />
              {{ linha.texto }}
            </li>
          </ul>
        </div>

        <!-- O contato é texto, não botão: "ligar" só existe no desvio da emergência. -->
        <ul v-if="contatos.length > 0" class="contatos" :aria-label="rotuloDosContatos">
          <li v-for="item in contatos" :key="item.id">
            <i class="ph" :class="item.icone" aria-hidden="true" />
            <span class="publica__so-leitor">{{ item.rotulo }}</span>
            <span dir="ltr">{{ item.valor }}</span>
          </li>
        </ul>

        <p v-if="assinatura" class="publica__assinatura">
          <img src="/pata-clara.png" alt="" aria-hidden="true" />
          {{ assinatura }}
        </p>
      </footer>

      <!--
        `clinic-scope`: os campos, selects e marcas pintados com os tokens da casa, como no celular
        do portal. Sem ele, o PrimeVue fazia o campo nascer claro no escuro.
      -->
      <main class="publica__fluxo clinic-scope">
        <LanguageSwitcher class="publica__idioma-largo" variant="auth" tone="surface" />

        <!-- "Passo 2 de 5" e os gomos que se enchem: o caminho andando, também no estreito. -->
        <div v-if="contagem" class="publica__progresso">
          <p class="publica__contagem">{{ contagem }}</p>
          <span v-if="passos" class="progresso" aria-hidden="true">
            <span
              v-for="(passo, indice) in passos"
              :key="passo.id"
              class="progresso__gomo"
              :class="{
                'progresso__gomo--feito': indice < passoAtual,
                'progresso__gomo--atual': indice === passoAtual,
              }"
            />
          </span>
        </div>
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/*
 * Só tokens do Trilha. A casa fica no verde-floresta da barra do portal (`--rail`); no escuro, o
 * `--rail` é quase preto e a casa passa para o musgo fundo, que ainda lê como floresta. A tinta
 * sobre ela é a da barra (`--sobre-rail`), e o acento é a sálvia.
 */
.publica {
  --casa: var(--rail);
  --casa-tinta: var(--sobre-rail);
  --casa-apagada: var(--sobre-rail-2);
  --casa-fio: color-mix(in oklab, var(--sobre-rail) 16%, transparent);
  --casa-acento: var(--salvia);
  --casa-desvio: color-mix(in oklab, var(--risco) 50%, var(--sobre-rail));
  --lado-largura: 30rem;
  --fluxo-largura: 36rem;
  --respiro: 3.25rem;

  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--fundo);
  color: var(--tinta);
  font-family: var(--font-texto);
}

.app-dark .publica {
  --casa: var(--musgo-fundo);
}

.publica__demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13.5px;
}

.publica__demo > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ------------------------------------------------------------------ a grade */

.publica__palco {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  grid-template-areas:
    'casa fluxo'
    'passos fluxo'
    'pe fluxo';
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  grid-template-rows: auto auto 1fr;
  isolation: isolate;
}

.publica--demo .publica__palco {
  min-height: calc(100dvh - 3.2rem);
}

/* ------------------------------------------------------------------ a metade da casa */

.publica__fundo {
  position: relative;
  z-index: -1;
  overflow: hidden;
  grid-column: 1;
  grid-row: 1 / -1;
  background:
    radial-gradient(
      34rem 24rem at 100% 0%,
      color-mix(in oklab, var(--salvia) 22%, transparent),
      transparent 70%
    ),
    var(--casa);
}

/* A pata da marca, grande e quase sumida, no canto que sobra em tela larga. */
.publica__fundo::after {
  position: absolute;
  bottom: -5rem;
  width: 26rem;
  aspect-ratio: 324 / 300;
  inset-inline-start: -6rem;
  background: url('/pata-clara.png') center / contain no-repeat;
  content: '';
  opacity: 0.06;
  transform: rotate(10deg);
}

.publica__casa,
.publica__passos,
.publica__pe {
  width: min(100%, var(--lado-largura));
  justify-self: center;
  padding-inline: var(--respiro);
  color: var(--casa-tinta);
}

.publica__casa {
  display: grid;
  grid-area: casa;
  justify-items: start;
  gap: 8px;
  padding-top: 48px;
}

.publica__casa-topo {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

/* O ladrilho na cor do lugar (azul da clínica, lavanda do hotel), como os discos da barra. */
.publica__icone {
  display: grid;
  width: 52px;
  height: 52px;
  flex: none;
  place-items: center;
  border-radius: 15px;
  background: var(--pj-lugar-claro);
  color: var(--rail);
  font-size: 26px;
}

.publica__idioma {
  display: none;
}

.publica__casa h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.12;
  text-wrap: balance;
}

.publica__casa p {
  margin: 0;
}

.publica__endereco {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--casa-apagada);
  font-size: 15px;
  line-height: 1.45;
}

.publica__endereco i {
  flex: none;
  margin-top: 3px;
}

/* Aberta ou fechada: o ponto é o sinal, a frase diz até quando. Sem estado de agora, o relógio. */
.publica__estado {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px !important;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--sobre-rail) 11%, transparent);
  font-size: 14px;
  font-weight: 550;
}

.publica__estado .ph {
  color: var(--casa-acento);
  font-size: 16px;
}

.publica__ponto {
  position: relative;
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 999px;
  background: var(--pets-claro);
}

.publica__estado--fechado .publica__ponto {
  background: var(--atencao);
}

.publica__promessa {
  max-width: 24rem;
  margin-top: 12px !important;
  color: var(--casa-apagada);
  font-size: 15px;
  line-height: 1.55;
}

.publica__rotulo {
  margin: 0 0 14px;
  color: var(--casa-tinta);
  font-size: 15px;
  font-weight: 600;
}

/* Os passos: o feito na sálvia com o visto, o de agora claro com halo, os seguintes no contorno. */
.publica__passos {
  grid-area: passos;
  padding-top: 36px;
}

.passos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.passo {
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  column-gap: 14px;
  padding-bottom: 18px;
}

.passo:last-child {
  padding-bottom: 0;
}

/* O traço apagado embaixo e, por cima, o aceso que desce quando o passo fica feito. */
.passo:not(:last-child)::before,
.passo:not(:last-child)::after {
  position: absolute;
  width: 2px;
  inset-block: 36px 4px;
  inset-inline-start: 15px;
  border-radius: 1px;
  background: var(--casa-fio);
  content: '';
}

.passo:not(:last-child)::after {
  background: var(--casa-acento);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 260ms var(--pj-curva-sai);
}

.passo--feito:not(:last-child)::after {
  transform: scaleY(1);
  transition: transform 360ms var(--pj-curva-chega) 80ms;
}

.passo__marca {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1.5px solid color-mix(in oklab, var(--sobre-rail) 32%, transparent);
  border-radius: 999px;
  color: var(--casa-apagada);
  font-family: var(--font-dados);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  transition:
    background-color var(--pj-tempo-medio) var(--pj-curva-chega),
    border-color var(--pj-tempo-medio) var(--pj-curva-chega),
    color var(--pj-tempo-medio) var(--pj-curva-chega);
}

.passo--feito .passo__marca {
  border-color: transparent;
  background: var(--casa-acento);
  color: var(--rail);
  font-size: 16px;
}

.passo--atual .passo__marca {
  border-color: transparent;
  background: var(--casa-tinta);
  box-shadow: 0 0 0 5px color-mix(in oklab, var(--sobre-rail) 14%, transparent);
  color: var(--rail);
  transition-delay: 360ms;
}

.passo__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding-top: 5px;
}

.passo__texto strong {
  color: var(--casa-apagada);
  font-size: 15.5px;
  font-weight: 500;
}

.passo--feito .passo__texto strong,
.passo--atual .passo__texto strong {
  color: var(--casa-tinta);
}

.passo--atual .passo__texto strong {
  font-weight: 650;
}

.passo__valor {
  color: var(--casa-apagada);
  font-size: 14px;
  line-height: 1.4;
}

.passo__valor--desvio {
  color: var(--casa-desvio);
  font-weight: 600;
}

/* O pé da metade: quem atende ou as regras, o contato e a assinatura, encostados embaixo. */
.publica__pe {
  display: grid;
  align-self: end;
  grid-area: pe;
  gap: 20px;
  padding-block: 40px 32px;
}

.publica__pe > :first-child {
  padding-top: 24px;
  border-top: 1px solid var(--casa-fio);
}

.equipe .publica__rotulo,
.regras .publica__rotulo {
  margin-bottom: 12px;
}

.equipe__linha {
  display: flex;
  align-items: center;
  gap: 14px;
}

.equipe__rostos {
  display: flex;
  flex: none;
}

.equipe__rosto {
  display: grid;
  width: 38px;
  height: 38px;
  overflow: hidden;
  place-items: center;
  border-radius: 999px;
  background: var(--pj-lugar-claro);
  box-shadow: 0 0 0 2px var(--casa);
  color: var(--rail);
  font-family: var(--font-dados);
  font-size: 12px;
  font-weight: 650;
}

.equipe__rosto + .equipe__rosto {
  margin-inline-start: -6px;
}

.equipe__rosto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.equipe__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  line-height: 1.4;
}

.equipe__texto strong {
  font-size: 15px;
  font-weight: 600;
}

.equipe__texto span {
  color: var(--casa-apagada);
  font-size: 14px;
}

.regras__lista {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.regras__lista li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--casa-apagada);
  font-size: 14.5px;
  line-height: 1.45;
}

.regras__lista .ph {
  flex: none;
  margin-top: 2px;
  color: var(--casa-acento);
  font-size: 18px;
}

.contatos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.contatos li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-dados);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.contatos .ph {
  color: var(--casa-acento);
  font-size: 18px;
}

.publica__assinatura {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--casa-apagada);
  font-size: 13px;
}

.publica__assinatura img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  opacity: 0.8;
}

/* ------------------------------------------------------------------ a metade do pedido */

.publica__fluxo {
  position: relative;
  display: flex;
  width: min(100%, calc(var(--fluxo-largura) + 2 * var(--respiro)));
  flex-direction: column;
  grid-area: fluxo;
  justify-self: center;
  padding: 88px var(--respiro) 40px;
}

.publica__idioma-largo {
  position: absolute;
  top: 20px;
  inset-inline-end: 24px;
}

.publica__progresso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-bottom: 6px;
}

.publica__contagem {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 550;
}

.progresso {
  display: inline-flex;
  gap: 5px;
}

/* Os gomos do progresso: o feito cheio, o de agora pela metade, enchendo um depois do outro. */
.progresso__gomo {
  position: relative;
  overflow: hidden;
  width: 28px;
  height: 6px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.progresso__gomo::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--musgo);
  content: '';
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 420ms var(--pj-curva-chega);
}

[dir='rtl'] .progresso__gomo::after {
  transform-origin: right;
}

.progresso__gomo--feito::after {
  transform: scaleX(1);
}

.progresso__gomo--atual::after {
  transform: scaleX(0.5);
  transition-delay: 220ms;
}

/* O título da etapa na escala da página, e não na do celular do portal. */
.publica__fluxo :deep(.fx-topo__titulo) {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/*
 * No celular do portal o fluxo ocupa a tela e a ação fica presa no pé. Na página ele tem a altura
 * do que mostra, e a ação vem depois do conteúdo — presa ao pé da janela enquanto há o que rolar,
 * para o próximo passo estar sempre à mão.
 */
.publica__fluxo :deep(.fx) {
  --fx-passo: 1.25rem;

  flex: 0 0 auto;
  gap: 18px;
  font-size: 15px;
}

.publica__fluxo :deep(.fx-corpo) {
  flex: 0 0 auto;
  overflow: visible;
}

.publica__fluxo :deep(.fx-rodape) {
  position: sticky;
  z-index: 2;
  bottom: 0;
  margin-inline: -8px;
  padding: 16px 8px calc(16px + env(safe-area-inset-bottom));
  background: linear-gradient(to bottom, transparent, var(--fundo) 18px);
}

/* O que as páginas põem no lugar do fluxo: casa não encontrada e acompanhamento do pedido. */
.publica__fluxo :deep(.publica__vazio) {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 40px 24px;
  border: 1px solid var(--linha);
  border-radius: 20px;
  background: var(--superficie);
  text-align: center;
}

.publica__fluxo :deep(.publica__vazio > i) {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 24px;
}

.publica__fluxo :deep(.publica__vazio h2) {
  margin: 8px 0 0;
  font-size: 20px;
  font-weight: 600;
}

.publica__fluxo :deep(.publica__vazio p) {
  margin: 0;
  color: var(--tinta-2);
  line-height: 1.5;
}

.publica__fluxo :deep(.publica__acompanhar) {
  display: grid;
  gap: 16px;
}

.publica__fluxo :deep(.publica__acompanhar h2) {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.publica__fluxo :deep(.acompanhar) {
  display: grid;
  gap: 12px;
  padding: 20px;
}

.publica__fluxo :deep(.acompanhar p) {
  margin: 0;
}

.publica__fluxo :deep(.acompanhar__situacao) {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 17px;
  font-weight: 600;
}

.publica__fluxo :deep(.acompanhar__disco) {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 22px;
}

.publica__fluxo :deep(.acompanhar__situacao--espera .acompanhar__disco) {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.publica__fluxo :deep(.acompanhar__situacao--ok .acompanhar__disco) {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.publica__fluxo :deep(.acompanhar__situacao--risco .acompanhar__disco) {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.publica__fluxo :deep(.acompanhar__oque) {
  padding-top: 12px;
  border-top: 1px solid var(--linha);
  font-size: 16px;
  font-weight: 600;
}

.publica__fluxo :deep(.acompanhar__linha) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta-2);
  line-height: 1.5;
}

.publica__fluxo :deep(.acompanhar__linha i) {
  flex: none;
  margin-top: 3px;
  color: var(--musgo);
}

.publica__fluxo :deep(.acompanhar__linha--forte) {
  color: var(--tinta);
  font-weight: 600;
}

.publica__fluxo :deep(.acompanhar__mensagem) {
  margin: 0;
  padding: 12px 14px;
  border-inline-start: 3px solid var(--linha-forte);
  border-radius: 8px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  line-height: 1.5;
}

.publica__fluxo :deep(.publica__acoes) {
  display: grid;
  gap: 10px;
}

.publica__fluxo :deep(.publica__acoes .p-button) {
  min-height: 52px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
}

.publica__so-leitor {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ uma coluna */

/*
 * Abaixo de 1024 px as metades não cabem lado a lado: a casa vira a faixa do alto, o pedido vem
 * logo abaixo, e o pé desce para o fim, já sobre o claro. Os passos saem — o "Passo 2 de 5" acima
 * do título conta o caminho.
 */
@media (max-width: 1023px) {
  .publica {
    --respiro: 16px;
  }

  .publica__palco {
    grid-template-areas:
      'casa'
      'fluxo'
      'pe';
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
  }

  .publica__fundo {
    grid-row: 1;
    border-radius: 0 0 24px 24px;
  }

  .publica__fundo::after {
    bottom: -7rem;
    width: 15rem;
    inset-inline: auto -3rem;
  }

  .publica__casa,
  .publica__pe,
  .publica__fluxo {
    width: min(100%, 40rem);
    justify-self: center;
  }

  .publica__casa {
    gap: 6px;
    padding-block: 16px 24px;
  }

  .publica__casa-topo {
    margin-bottom: 6px;
  }

  .publica__icone {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    font-size: 22px;
  }

  .publica__idioma {
    display: block;
  }

  .publica__idioma-largo {
    display: none;
  }

  .publica__casa h1 {
    font-size: 24px;
  }

  .publica__endereco,
  .publica__promessa {
    font-size: 14px;
  }

  .publica__promessa {
    margin-top: 6px !important;
  }

  .publica__passos {
    display: none;
  }

  .publica__fluxo {
    padding-block: 24px 8px;
  }

  .publica__fluxo :deep(.fx-topo__titulo),
  .publica__fluxo :deep(.publica__acompanhar h2) {
    font-size: 22px;
  }

  /* Embaixo, o pé já está sobre o claro: as tintas da casa viram as da página. */
  .publica__pe {
    --casa-tinta: var(--tinta);
    --casa-apagada: var(--tinta-2);
    --casa-acento: var(--musgo);
    --casa-fio: var(--linha);
    --casa: var(--fundo);

    align-self: start;
    padding-block: 16px 32px;
  }
}

/* ------------------------------------------------------------------ movimento
 * A página de quem marca: o movimento acolhe e mostra o caminho andando, sem enfeite. A casa e os
 * passos chegam uma vez, em sequência; o passo feito assenta, o traço desce e só então o próximo
 * acende; a etapa desliza para o lado em que se foi (`fluxo.css`). O ponto de "aberta" pinga, por
 * ser a única coisa viva de verdade. Com movimento reduzido, nada disso.
 */

@keyframes publica-sobe {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes publica-aparece {
  from {
    opacity: 0;
  }
}

@keyframes publica-assenta {
  0% {
    transform: scale(0.86);
  }

  55% {
    transform: scale(1.04);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes publica-pinga {
  0% {
    opacity: 0.55;
    transform: scale(1);
  }

  75%,
  100% {
    opacity: 0;
    transform: scale(2.6);
  }
}

.publica__casa > * {
  animation: publica-sobe 420ms var(--pj-curva-chega) both;
}

.publica__casa > :nth-child(2) {
  animation-delay: 50ms;
}

.publica__casa > :nth-child(3) {
  animation-delay: 100ms;
}

.publica__casa > :nth-child(4) {
  animation-delay: 150ms;
}

.publica__casa > :nth-child(n + 5) {
  animation-delay: 200ms;
}

.passo {
  animation: publica-sobe 400ms var(--pj-curva-chega) both;
  animation-delay: calc(200ms + var(--i, 0) * 45ms);
}

.publica__pe {
  animation: publica-aparece 480ms var(--pj-curva-chega) 380ms both;
}

.publica__fluxo {
  animation: publica-sobe 460ms var(--pj-curva-chega) 80ms both;
}

.publica__estado--aberto .publica__ponto::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: inherit;
  content: '';
  animation: publica-pinga 2.8s var(--pj-curva-chega) infinite;
}

.passo--feito .passo__marca {
  animation: publica-assenta 360ms var(--pj-curva-chega);
}

.passo-valor-enter-active {
  transition:
    opacity 300ms var(--pj-curva-chega) 120ms,
    transform 340ms var(--pj-curva-chega) 120ms;
}

.passo-valor-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .publica,
  .publica :deep(*),
  .publica :deep(*::before),
  .publica :deep(*::after) {
    animation: none !important;
    transition: none !important;
  }
}
</style>
