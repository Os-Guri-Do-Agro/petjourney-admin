<script setup lang="ts">
/**
 * A moldura das páginas públicas — agendamento da clínica (`/agendar/:clinica`) e reserva do hotel
 * (`/reservar/:hotel`).
 *
 * A tela se divide como num checkout: a metade da casa, em teal com a pata da marca no canto, tem
 * o nome, o estado de agora, a promessa, os passos do pedido com o que já foi escolhido e, no pé,
 * quem atende ou as regras, o contato e a assinatura; a metade do pedido, clara com a grade das
 * telas do portal, tem o fluxo no meio dela (o slot). Abaixo de 1024 px vira uma coluna: a casa no
 * topo, o fluxo, e o pé no fim, já sobre o claro; os passos saem e o "Passo 2 de 5" acima do título
 * conta o caminho.
 *
 * Mora aqui, e não em cada página, para as duas serem a mesma por construção: a primeira cópia da
 * clínica tinha deixado o hotel na coluna antiga. As páginas só dizem o quê — os textos chegam
 * prontos, cada uma no seu `t()`.
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
  <div class="publica hc-tema" :class="{ 'publica--demo': demo }">
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
      <!-- O teal da metade da casa, com a pata da marca no canto. Só fundo. -->
      <div class="publica__fundo" aria-hidden="true" />

      <header class="publica__casa">
        <span class="publica__icone" aria-hidden="true"><i class="ph" :class="icone" /></span>

        <template v-if="nome">
          <h1>{{ nome }}</h1>
          <p v-if="endereco" class="publica__endereco">{{ endereco }}</p>
          <p v-if="estado" class="publica__estado" :class="`publica__estado--${estado.tom}`">
            <i v-if="estado.tom === 'neutro'" class="ph ph-clock" aria-hidden="true" />
            <span v-else class="publica__ponto" aria-hidden="true" />
            {{ estado.texto }}
          </p>
          <p v-if="promessa" class="publica__promessa">{{ promessa }}</p>
        </template>
      </header>

      <!-- Em que passo o pedido está e o que já foi escolhido. -->
      <section v-if="passos" class="publica__passos">
        <h2 class="publica__rotulo">{{ tituloDosPassos }}</h2>
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

        <p v-if="assinatura" class="publica__assinatura">{{ assinatura }}</p>
      </footer>

      <!--
        `clinic-scope`: os campos, selects e marcas pintados com os tokens da casa, como no celular
        do portal. Sem ele, o PrimeVue fazia o campo nascer claro no escuro — a caixa de texto e a
        marca vazia saíam brancas no meio da página escura.
      -->
      <main class="publica__fluxo clinic-scope">
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

      <LanguageSwitcher class="publica__idioma" variant="auth" tone="surface" />
    </div>
  </div>
</template>

<style scoped>
/*
 * A metade da casa tem o teal da pílula cheia e da moldura do portal. Contrastes sobre #1F6457:
 * texto 6,9:1, apagado 5:1, coral 4,6:1. No escuro, o mesmo teal bem fundo.
 */
.publica {
  --faixa: #1f6457;
  --faixa-funda: #1a574c;
  --faixa-tinta: #f4fbf8;
  --faixa-apagada: #c8e0d9;
  --faixa-menta: #8fd9c8;
  --faixa-coral: #ffc4c4;
  --faixa-fio: rgb(255 255 255 / 16%);
  --lado-largura: 31rem;
  --fluxo-largura: 38rem;
  --respiro: 3.5rem;

  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--hc-fundo);
  color: var(--hc-tinta);
}

.app-dark .publica {
  --faixa: #143c34;
  --faixa-funda: #10302a;
}

/*
 * O escuro em sálvia pastel. A menta saturada da casa em todo lugar — borda do cartão escolhido,
 * ícone, rótulo, botão com brilho verde — lia como letreiro de neon; trocada por branco, a tela
 * ficou chapada. O meio-termo é a mesma família, sem saturação: sálvia pastel no acento (9,8:1
 * sobre o cartão), um véu sálvia no escolhido, e o botão em degradê pastel com a tinta escura
 * (9,2:1). Título e texto seguem brancos; cor fora da sálvia só com significado (aberta, fechada,
 * urgência). Os tokens trocam na raiz da página e o fluxo inteiro segue sozinho; o portal escuro
 * não muda. Onde a tinta era branca fixa sobre o acento, ela vira a escura.
 */
.app-dark .publica {
  --hc-marca: #9cc6b8;
  --hc-marca-forte: #cfe5dd;
  --hc-marca-clara: rgb(156 198 184 / 16%);
  --hc-degrade-botao: linear-gradient(120deg, #bcdcd1 0%, #a6cbbf 100%);
  --faixa-menta: #b9d8cd;

  /* O botão principal: o degradê pastel, com a tinta escura. */
  --p-button-primary-background: var(--hc-degrade-botao);
  --p-button-primary-hover-background: linear-gradient(120deg, #c8e4da 0%, #b2d4c8 100%);
  --p-button-primary-active-background: linear-gradient(120deg, #aed0c4 0%, #98bfb2 100%);
  --p-button-primary-color: #10241f;
  --p-button-primary-hover-color: #10241f;
  --p-button-primary-active-color: #10241f;
}

/*
 * O dia escolhido no calendário: disco sálvia pastel, número escuro; o período, um véu sálvia. No
 * painel, e não na raiz: o `hc-tema.css` redefine estes tokens no próprio
 * `.p-datepicker-panel.hc-tema`, com o número em branco fixo.
 */
.app-dark .publica :deep(.p-datepicker-panel.hc-tema) {
  --p-datepicker-date-selected-background: #b3d3c8;
  --p-datepicker-date-selected-color: #10241f;
  --p-datepicker-date-range-selected-background: rgb(169 205 193 / 14%);
  --p-datepicker-date-range-selected-color: var(--hc-tinta);
}

/* Sem o brilho verde embaixo do botão: no escuro ele é só uma sombra. */
.app-dark
  .publica
  :deep(.p-button:not(.p-button-secondary, .p-button-outlined, .p-button-text, .p-button-link)),
.app-dark
  .publica
  :deep(
    .p-button:not(.p-button-secondary, .p-button-outlined, .p-button-text, .p-button-link):not(
        :disabled
      ):hover
  ) {
  --hc-botao-sombra: 0 6px 18px -10px rgb(169 205 193 / 45%);
}

/* "Passo 2 de 5" na sálvia, e não no quase branco do texto: é rótulo, não título. */
.app-dark .publica__contagem,
.app-dark .publica__fluxo :deep(.publica__contagem) {
  color: var(--hc-marca);
}

.app-dark .publica :deep(.enviado__selo) {
  box-shadow: 0 0 0 6px rgb(169 205 193 / 12%);
  color: #10241f;
}

.app-dark .publica :deep(.fx-dia--escolhido.p-button),
.app-dark .publica :deep(.fx-dia--escolhido.p-button:not(:disabled):hover) {
  color: #10241f;
}

.app-dark .publica :deep(.p-datepicker-day-selected .cal__ponto) {
  background: #10241f;
}

.publica__demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px dashed var(--hc-borda);
  gap: 0.5rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.publica__demo > span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

/* ------------------------------------------------------------------ a grade */

/*
 * Duas metades, como um checkout: a casa à esquerda, o pedido à direita. O conteúdo de cada uma
 * fica no meio da sua metade; o que sobra em volta é fundo — a pata de um lado, a grade do outro.
 */
.publica__palco {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  grid-template-areas:
    'casa fluxo'
    'passos fluxo'
    'pe fluxo';
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  grid-template-rows: auto auto 1fr;
  isolation: isolate;
  /* Os dois brilhos e a grade fina das telas do portal, só na metade do pedido. */
  background:
    radial-gradient(44rem 22rem at 70% -6rem, rgb(120 196 178 / 22%), transparent 70%),
    radial-gradient(36rem 20rem at 104% -4rem, rgb(96 178 196 / 18%), transparent 70%),
    var(--hc-fundo);
}

.publica__palco::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image:
    linear-gradient(var(--hc-grade) 1px, transparent 1px),
    linear-gradient(90deg, var(--hc-grade) 1px, transparent 1px);
  background-size: 28px 28px;
  content: '';
  mask-image: linear-gradient(to bottom, #000 0, rgb(0 0 0 / 60%) 16rem, transparent 34rem);
  pointer-events: none;
}

.publica--demo .publica__palco {
  min-height: calc(100dvh - 3.3rem);
}

/* No escuro, a névoa vira um sopro sálvia, bem baixo: dá profundidade ao topo sem acender. */
.app-dark .publica__palco {
  background:
    radial-gradient(46rem 24rem at 72% -8rem, rgb(169 205 193 / 7%), transparent 70%),
    var(--hc-fundo);
}

/* ------------------------------------------------------------------ a metade da casa */

.publica__fundo {
  position: relative;
  z-index: -1;
  overflow: hidden;
  grid-column: 1;
  grid-row: 1 / -1;
  background: linear-gradient(180deg, var(--faixa) 0%, var(--faixa-funda) 100%);
}

/* A pata da marca, grande e quase sumida, no canto que sobra em tela larga. */
.publica__fundo::after {
  position: absolute;
  bottom: -5rem;
  width: 28rem;
  aspect-ratio: 4835 / 4476;
  inset-inline-start: -6rem;
  background: url('/pata-clara.png') center / contain no-repeat;
  content: '';
  opacity: 0.055;
}

.publica__casa,
.publica__passos,
.publica__pe {
  width: min(100%, var(--lado-largura));
  justify-self: center;
  padding-inline: var(--respiro);
  color: var(--faixa-tinta);
}

.publica__casa {
  display: grid;
  grid-area: casa;
  justify-items: start;
  padding-top: 2.75rem;
  gap: 0.4rem;
}

/* O ladrilho inverte sobre o teal: claro, com o ícone no teal. */
.publica__icone {
  display: grid;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  place-items: center;
  border-radius: 0.9rem;
  background: var(--faixa-tinta);
  box-shadow: 0 8px 24px -12px rgb(0 0 0 / 45%);
  color: var(--faixa);
  font-size: 1.45rem;
}

.publica__casa h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.1;
  text-wrap: balance;
}

.publica__casa p {
  margin: 0;
}

.publica__endereco {
  color: var(--faixa-apagada);
  font-size: 0.9375rem;
  line-height: 1.45;
}

/* Aberta ou fechada: o ponto é o sinal, a frase diz até quando. Sem estado de agora, o relógio. */
.publica__estado {
  display: inline-flex;
  align-items: center;
  margin-top: 0.6rem !important;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  gap: 0.45rem;
  background: rgb(255 255 255 / 12%);
  font-size: 0.8125rem;
  font-weight: 650;
}

.publica__estado .ph {
  color: var(--faixa-menta);
  font-size: 0.95rem;
}

.publica__ponto {
  width: 0.5rem;
  height: 0.5rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #93e2b3;
  box-shadow: 0 0 0 3px rgb(147 226 179 / 22%);
}

.publica__estado--fechado .publica__ponto {
  background: #ffc39f;
  box-shadow: 0 0 0 3px rgb(255 195 159 / 22%);
}

.publica__promessa {
  max-width: 24rem;
  margin-top: 0.9rem !important;
  color: var(--faixa-apagada);
  font-size: 0.9375rem;
  line-height: 1.55;
}

.publica__rotulo {
  margin: 0 0 1rem;
  color: var(--faixa-apagada);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Os passos: o feito em menta, o de agora em branco com halo, os seguintes só no contorno. */
.publica__passos {
  grid-area: passos;
  padding-top: 2.25rem;
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
  grid-template-columns: 1.85rem minmax(0, 1fr);
  padding-bottom: 1.15rem;
  column-gap: 0.85rem;
}

.passo:last-child {
  padding-bottom: 0;
}

/* O traço que liga um passo ao seguinte. */
/* O traço apagado embaixo e, por cima, o aceso que desce quando o passo fica feito. */
.passo:not(:last-child)::before,
.passo:not(:last-child)::after {
  position: absolute;
  width: 2px;
  inset-block: 2.1rem 0.25rem;
  inset-inline-start: calc(0.925rem - 1px);
  border-radius: 1px;
  background: var(--faixa-fio);
  content: '';
}

/*
 * O progresso corre de cima para baixo, em ordem: o passo feito assenta (0 ms), o traço desce até
 * o próximo (80–440 ms), e só então o próximo acende como "agora" (360 ms). Ao voltar, o traço
 * recolhe sem espera.
 */
.passo:not(:last-child)::after {
  background: var(--faixa-menta);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 260ms var(--hc-mov-sai);
}

.passo--feito:not(:last-child)::after {
  transition: transform 360ms var(--hc-mov-chega) 80ms;
}

.passo--feito:not(:last-child)::after {
  transform: scaleY(1);
}

.passo__marca {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  place-items: center;
  border: 1.5px solid rgb(255 255 255 / 30%);
  border-radius: 999px;
  color: var(--faixa-apagada);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  transition:
    background-color 200ms var(--hc-mov-chega),
    border-color 200ms var(--hc-mov-chega),
    box-shadow 200ms var(--hc-mov-chega),
    color 200ms var(--hc-mov-chega);
}

.passo--feito .passo__marca {
  border-color: transparent;
  background: var(--faixa-menta);
  color: var(--faixa);
  font-size: 0.875rem;
}

/* O "agora" acende quando o traço chega, e não junto com ele. */
.passo--atual .passo__marca {
  border-color: transparent;
  background: var(--faixa-tinta);
  box-shadow: 0 0 0 5px rgb(255 255 255 / 14%);
  color: var(--faixa);
  transition-delay: 360ms;
}

.passo--atual .passo__texto strong {
  transition-delay: 360ms;
}

.passo__texto {
  display: grid;
  min-width: 0;
  padding-top: 0.25rem;
  gap: 0.15rem;
}

.passo__texto strong {
  color: var(--faixa-apagada);
  font-size: 0.9375rem;
  font-weight: 600;
  transition: color 200ms var(--hc-mov-chega);
}

.passo--feito .passo__texto strong,
.passo--atual .passo__texto strong {
  color: var(--faixa-tinta);
}

.passo--atual .passo__texto strong {
  font-weight: 750;
}

.passo__valor {
  color: var(--faixa-apagada);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.passo__valor--desvio {
  color: var(--faixa-coral);
  font-weight: 650;
}

/* O pé da metade: quem atende ou as regras, o contato e a assinatura, encostados embaixo. */
.publica__pe {
  display: grid;
  align-self: end;
  grid-area: pe;
  padding-block: 2rem 1.75rem;
  gap: 1.25rem;
}

.publica__pe > :first-child {
  padding-top: 1.5rem;
  border-top: 1px solid var(--faixa-fio);
}

.equipe .publica__rotulo,
.regras .publica__rotulo {
  margin-bottom: 0.75rem;
}

.equipe__linha {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.equipe__rostos {
  display: flex;
  flex: 0 0 auto;
}

.equipe__rosto {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  overflow: hidden;
  place-items: center;
  border-radius: 999px;
  background: #e7f4f0;
  box-shadow: 0 0 0 2px var(--faixa-funda);
  color: #1f6457;
  font-size: 0.6875rem;
  font-weight: 750;
}

.equipe__rosto + .equipe__rosto {
  margin-inline-start: -0.3rem;
}

.equipe__rosto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.equipe__texto {
  display: grid;
  min-width: 0;
  line-height: 1.35;
}

.equipe__texto strong {
  font-size: 0.875rem;
  font-weight: 650;
}

.equipe__texto span {
  color: var(--faixa-apagada);
  font-size: 0.8125rem;
}

/* As regras da casa: uma linha cada, com o ícone na menta. */
.regras__lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.5rem;
  list-style: none;
}

.regras__lista li {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  color: var(--faixa-apagada);
  font-size: 0.875rem;
  line-height: 1.45;
}

.regras__lista .ph {
  flex: 0 0 auto;
  color: var(--faixa-menta);
  font-size: 1rem;
  transform: translateY(0.12rem);
}

.contatos {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: 0.5rem 1.25rem;
  list-style: none;
}

.contatos li {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.contatos .ph {
  color: var(--faixa-menta);
  font-size: 1.05rem;
}

.publica__assinatura {
  margin: 0;
  color: var(--faixa-apagada);
  font-size: 0.75rem;
}

/* ------------------------------------------------------------------ a metade do pedido */

.publica__fluxo {
  display: flex;
  width: min(100%, calc(var(--fluxo-largura) + 2 * var(--respiro)));
  flex-direction: column;
  grid-area: fluxo;
  justify-self: center;
  padding: 4.5rem var(--respiro) 3rem;
}

.publica__contagem,
.publica__fluxo :deep(.publica__contagem) {
  margin: 0 0 0.25rem;
  color: var(--hc-marca-forte);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* O título da etapa na escala da página, e não na do celular. */
.publica__fluxo :deep(.fx-topo__titulo),
.publica__fluxo :deep(h2) {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

/*
 * No celular o fluxo ocupa a tela e a ação fica presa no pé. Na página ele tem a altura do que
 * mostra: a ação vem logo depois do conteúdo, e não no fim da metade.
 */
.publica__fluxo :deep(.fx) {
  flex: 0 0 auto;
  gap: 1.1rem;
}

.publica__fluxo :deep(.fx-corpo) {
  flex: 0 0 auto;
  overflow: visible;
}

.publica__fluxo :deep(.fx-rodape) {
  padding-top: 1rem;
}

.publica__idioma {
  z-index: 1;
  align-self: start;
  justify-self: end;
  grid-area: fluxo;
  margin: 1.25rem 1.5rem 0;
}

/* O que as páginas põem no lugar do fluxo: casa não encontrada e acompanhamento do pedido. */
.publica__fluxo :deep(.publica__vazio),
.publica__fluxo :deep(.publica__acompanhar) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.publica__fluxo :deep(.publica__vazio > i) {
  color: var(--hc-tinta-3);
  font-size: 1.6rem;
}

.publica__fluxo :deep(.publica__vazio p),
.publica__fluxo :deep(.publica__acompanhar p) {
  margin: 0;
}

.publica__fluxo :deep(.publica__situacao) {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
}

.publica__fluxo :deep(.publica__situacao--ACEITO) {
  color: var(--hc-marca-forte);
}

.publica__fluxo :deep(.publica__situacao--RECUSADO),
.publica__fluxo :deep(.publica__situacao--EXPIRADO) {
  color: var(--clinic-attention-text);
}

.publica__fluxo :deep(.publica__marcado) {
  font-size: 1rem;
  font-weight: 700;
}

.publica__fluxo :deep(.publica__mensagem) {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 0.7rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  line-height: 1.5;
}

.publica__fluxo :deep(.publica__acoes) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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
 * Abaixo de 1024 px as metades não cabem lado a lado: a casa vira o topo, o fluxo vem logo abaixo
 * e o pé desce para o fim, já sobre o claro. Os passos saem — o "Passo 2 de 5" acima do título
 * conta o caminho.
 */
@media (max-width: 1023px) {
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
  }

  .publica__fundo::after {
    width: 16rem;
    inset-inline: auto -4rem;
    bottom: -6rem;
  }

  .publica__casa,
  .publica__pe,
  .publica__fluxo {
    width: min(100%, 44rem);
    justify-self: center;
    padding-inline: 1.5rem;
  }

  .publica__casa {
    padding-block: 1.5rem 2rem;
  }

  .publica__casa h1 {
    font-size: 1.6rem;
  }

  .publica__passos {
    display: none;
  }

  .publica__idioma {
    grid-area: casa;
  }

  .publica__fluxo {
    padding-block: 2rem 1rem;
  }

  .publica__fluxo :deep(.fx-topo__titulo),
  .publica__fluxo :deep(h2) {
    font-size: 1.35rem;
  }

  /* Embaixo, o pé já está sobre o claro: as tintas da faixa viram as da página. */
  .publica__pe {
    --faixa-tinta: var(--hc-tinta);
    --faixa-apagada: var(--hc-tinta-2);
    --faixa-menta: var(--hc-marca-forte);
    --faixa-fio: color-mix(in srgb, var(--hc-tinta) 11%, transparent);
    --faixa-funda: var(--hc-fundo);

    align-self: start;
    padding-block: 1rem 2rem;
  }
}

/* ------------------------------------------------------------------ movimento
 * A página de quem marca, e não a ferramenta da recepção: aqui o movimento acolhe e mostra o
 * caminho andando. Três camadas — a chegada (a casa e os passos entram em sequência, uma vez), o
 * progresso (os gomos se enchem, o passo feito assenta, o traço desce e só então o próximo acende)
 * e o toque (cartão que levanta, seta que avança, dia que cresce).
 *
 * O que separa natural de enfeitado, e vale para tudo abaixo:
 *  - três curvas da casa (`hc-tokens.css`): o que chega desacelera, o que sai acelera, o que
 *    confirma assenta — passa 3% do lugar e volta. Nada de mola de brinquedo, nada de giro;
 *  - sair é mais rápido que chegar, e o hover responde em 160 ms;
 *  - um eixo por gesto: a etapa desliza para os lados (para a frente ou para trás), e o que está
 *    dentro dela só aparece, sem subir junto;
 *  - distâncias curtas: 6 a 8 px, nunca uma mudança de lugar;
 *  - o que não para é só o que está vivo de verdade: o ponto de aberta e a pata, bem devagar. O
 *    anel do passo de agora respira duas vezes ao acender e descansa.
 * Com movimento reduzido, nada disso — o fim do arquivo desliga tudo.
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

@keyframes publica-surge {
  from {
    opacity: 0;
    transform: scale(0.88);
  }
}

/* O assentar: um sopro acima do tamanho e de volta — sentido, não visto. */
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

@keyframes publica-respira {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }

  75%,
  100% {
    opacity: 0;
    transform: scale(1.45);
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

@keyframes publica-flutua {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-10px) rotate(-2deg);
  }
}

/* A chegada: a casa entra peça por peça, 50 ms entre elas; os passos em fila logo atrás. */
.publica__casa > * {
  animation: publica-sobe 440ms var(--hc-mov-chega) both;
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

.publica__casa > :nth-child(5) {
  animation-delay: 200ms;
}

.publica__casa > .publica__icone {
  animation: publica-surge 480ms var(--hc-mov-assenta) both;
}

.publica__rotulo {
  animation: publica-aparece 400ms var(--hc-mov-chega) 180ms both;
}

.passo {
  animation: publica-sobe 400ms var(--hc-mov-chega) both;
  animation-delay: calc(200ms + var(--i, 0) * 45ms);
}

.publica__pe {
  animation: publica-aparece 500ms var(--hc-mov-chega) 420ms both;
}

.publica__fluxo {
  animation: publica-sobe 480ms var(--hc-mov-chega) 100ms both;
}

/* A pata da marca respira no canto, devagar: 18 s por volta. */
.publica__fundo::after {
  animation: publica-flutua 18s ease-in-out infinite;
}

/* Aberta agora: o ponto pinga, como um "ao vivo". */
.publica__ponto {
  position: relative;
}

.publica__estado--aberto .publica__ponto::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: inherit;
  content: '';
  animation: publica-pinga 2.8s var(--hc-mov-chega) infinite;
}

/* Os passos: o feito assenta ao virar feito; o de agora respira duas vezes ao acender. */
.passo--feito .passo__marca {
  animation: publica-assenta 360ms var(--hc-mov-chega);
}

.passo--atual .passo__marca {
  position: relative;
}

.passo--atual .passo__marca::after {
  position: absolute;
  inset: -2px;
  border: 1.5px solid var(--faixa-tinta);
  border-radius: 999px;
  content: '';
  opacity: 0;
  animation: publica-respira 2.2s var(--hc-mov-chega) 600ms 2;
}

/* O que foi escolhido entra no passo, descendo um pouco — o valor "cai" no lugar. */
.passo-valor-enter-active {
  transition:
    opacity 300ms var(--hc-mov-chega) 120ms,
    transform 340ms var(--hc-mov-chega) 120ms;
}

.passo-valor-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

/* Os gomos do progresso: o feito cheio, o de agora pela metade, enchendo um depois do outro. */
.publica__progresso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.3rem;
  gap: 0.4rem 0.9rem;
}

.publica__progresso .publica__contagem {
  margin: 0;
}

.progresso {
  display: inline-flex;
  gap: 4px;
}

.progresso__gomo {
  position: relative;
  overflow: hidden;
  width: 1.6rem;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--hc-tinta) 12%, transparent);
}

.progresso__gomo::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--hc-marca);
  content: '';
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 420ms var(--hc-mov-chega);
}

[dir='rtl'] .progresso__gomo::after {
  transform-origin: right;
}

.progresso__gomo--feito::after {
  transform: scaleX(1);
}

/* O gomo de agora começa a encher quando o anterior termina. */
.progresso__gomo--atual::after {
  transform: scaleX(0.5);
  transition-delay: 220ms;
}

/* ------------------------------------------------------------------ o toque, dentro do fluxo */

/* A etapa anda mais que no celular: a página tem espaço para o gesto (a direção vem do fluxo). */
.publica__fluxo :deep(.fx) {
  --fx-passo: 1.25rem;
}

/*
 * O conteúdo de cada etapa aparece em fila: o bloco, as linhas da lista, o botão. Só opacidade —
 * a etapa já está deslizando para o lado, e um segundo eixo viraria tremor. Anima quando o
 * elemento nasce, e não pela classe da transição — ela sai antes de a fila terminar. O enviado tem
 * a sua própria chegada (`fluxo.css`).
 */
.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-corpo > *),
.publica__fluxo :deep(.fx-etapa:not(.enviado) .fx-lista > li),
.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-rodape) {
  animation: publica-aparece 320ms var(--hc-mov-chega) both;
}

.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-corpo > :nth-child(2)),
.publica__fluxo :deep(.fx-etapa:not(.enviado) .fx-lista > li:nth-child(2)) {
  animation-delay: 40ms;
}

.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-corpo > :nth-child(3)),
.publica__fluxo :deep(.fx-etapa:not(.enviado) .fx-lista > li:nth-child(3)) {
  animation-delay: 80ms;
}

.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-corpo > :nth-child(4)),
.publica__fluxo :deep(.fx-etapa:not(.enviado) .fx-lista > li:nth-child(4)) {
  animation-delay: 120ms;
}

.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-corpo > :nth-child(n + 5)),
.publica__fluxo :deep(.fx-etapa:not(.enviado) .fx-lista > li:nth-child(n + 5)) {
  animation-delay: 160ms;
}

.publica__fluxo :deep(.fx-etapa:not(.enviado) > .fx-rodape) {
  animation-delay: 120ms;
}

/* Cartão de escolha: levanta no hover, afunda no toque, e o ícone do escolhido assenta. */
.publica {
  --publica-levanta: 0 10px 22px -14px rgb(20 32 28 / 32%);
}

.app-dark .publica {
  --publica-levanta: 0 10px 22px -14px rgb(0 0 0 / 70%);
}

.publica__fluxo :deep(.fx-escolhas .p-togglebutton) {
  transition:
    background-color 160ms var(--hc-mov-chega),
    border-color 160ms var(--hc-mov-chega),
    transform 200ms var(--hc-mov-chega),
    box-shadow 200ms var(--hc-mov-chega);
}

.publica__fluxo :deep(.fx-escolhas .p-togglebutton:not(:disabled):hover) {
  box-shadow: var(--publica-levanta);
  transform: translateY(-2px);
}

.publica__fluxo :deep(.fx-escolhas .p-togglebutton:not(:disabled):active) {
  box-shadow: none;
  transform: translateY(0) scale(0.98);
  transition-duration: 80ms;
}

.publica__fluxo :deep(.fx-escolhas .p-togglebutton-checked .fx-escolha svg) {
  animation: publica-assenta 320ms var(--hc-mov-chega);
}

/* Linha de opção: o ladrilho cresce um pouco e a seta avança. */
.publica__fluxo :deep(.fx-opcao__icone),
.publica__fluxo :deep(.fx-opcao__fim) {
  transition: transform 200ms var(--hc-mov-chega);
}

.publica__fluxo :deep(.fx-opcao:not(:disabled):hover .fx-opcao__icone) {
  transform: scale(1.06);
}

.publica__fluxo :deep(.fx-opcao:not(:disabled):hover .fx-opcao__fim) {
  transform: translateX(3px);
}

[dir='rtl'] .publica__fluxo :deep(.fx-opcao:not(:disabled):hover .fx-opcao__fim) {
  transform: translateX(-3px);
}

/* Horário e dia: sobem um pouco no hover. */
.publica__fluxo :deep(.fx-horario.p-button),
.publica__fluxo :deep(.fx-dia.p-button) {
  transition:
    background-color 160ms var(--hc-mov-chega),
    border-color 160ms var(--hc-mov-chega),
    transform 200ms var(--hc-mov-chega);
}

.publica__fluxo :deep(.fx-horario.p-button:not(:disabled):hover),
.publica__fluxo :deep(.fx-dia.p-button:not(:disabled):hover) {
  transform: translateY(-2px);
}

/* O calendário: o dia cresce de leve no hover, e o escolhido assenta ao ser marcado. */
.publica__fluxo :deep(.p-datepicker-day:not(.p-disabled)) {
  transition:
    background-color 160ms var(--hc-mov-chega),
    transform 200ms var(--hc-mov-chega);
}

.publica__fluxo :deep(.p-datepicker-day:not(.p-disabled):not(.p-datepicker-day-selected):hover) {
  transform: scale(1.06);
}

.publica__fluxo :deep(.p-datepicker-day-selected) {
  animation: publica-assenta 320ms var(--hc-mov-chega);
}

/* O botão principal: sobe no hover, afunda no toque, e o ícone vai para onde o pedido vai. */
.publica__fluxo :deep(.fx-rodape .p-button) {
  transition:
    background 160ms var(--hc-mov-chega),
    box-shadow 200ms var(--hc-mov-chega),
    transform 200ms var(--hc-mov-chega);
}

.publica__fluxo :deep(.fx-rodape .p-button:not(:disabled):hover) {
  transform: translateY(-1px);
}

.publica__fluxo :deep(.fx-rodape .p-button:not(:disabled):active) {
  transform: translateY(0) scale(0.985);
  transition-duration: 80ms;
}

.publica__fluxo :deep(.p-button .ph-arrow-right),
.publica__fluxo :deep(.p-button .ph-paper-plane-tilt) {
  transition: transform 220ms var(--hc-mov-chega);
}

.publica__fluxo :deep(.p-button:not(:disabled):hover .ph-arrow-right) {
  transform: translateX(3px);
}

[dir='rtl'] .publica__fluxo :deep(.p-button:not(:disabled):hover .ph-arrow-right) {
  transform: translateX(-3px);
}

.publica__fluxo :deep(.p-button:not(:disabled):hover .ph-paper-plane-tilt) {
  transform: translate(2px, -2px);
}

/* Com movimento reduzido: nada anda. A página fica como estava antes de tudo isto. */
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
