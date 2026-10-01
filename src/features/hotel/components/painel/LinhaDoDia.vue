<script setup lang="ts">
/**
 * O dia, desenhado como um dia.
 *
 * A primeira versão do painel abria com quatro cartões — "2 chegam", "1 sai" — e isso não é o
 * dia: é o resumo do dia, que é uma coisa que só serve a quem já sabe como o dia é. Quem abre o
 * portal às oito da manhã precisa ver **quando** as coisas acontecem, porque é assim que se
 * decide o que fazer primeiro.
 *
 * Chegadas em cima, saídas embaixo, e o agora no meio. Chegada e saída são movimentos opostos,
 * feitos por pessoas diferentes; um trilho único obrigaria a ler o ícone de cada marca para saber
 * de que lado o carro está indo.
 *
 * ## O que mudou depois de a tela ser chamada de agressiva e confusa
 *
 * **A marca perdeu o nome.** Ela mostra hora e rosto; o nome vive na lista logo abaixo. Antes a
 * mesma frase aparecia duas vezes na mesma tela — "09:30 Sushi" no trilho e "09:30 Sushi · Gatil
 * G2" na lista —, e duas renderizações do mesmo fato leem como duas informações. Agora o trilho
 * responde **quando**, a lista responde **quem e o quê**. O avatar dá a identidade sem repetir a
 * frase, e é o que permite a marca caber quando o dia tem quinze movimentos em vez de três.
 *
 * **O agora deixou de ser vermelho.** Ele era uma linha grossa com um selo vermelho, do mesmo tom
 * dos avisos que travam a operação — e vermelho que marca "são 12h20" ensina a ignorar o vermelho
 * que marca "ligue para o responsável". O que passou fica sombreado; o instante é um fio fino.
 *
 * **A hora é rotulada de duas em duas.** Dezessete rótulos numa régua produzem uma cerca; o risco
 * de cada hora continua lá, que é o que dá a escala.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { ISODateTime } from '../../data/types'
import type { MarcaDoDia } from './dia-types'

const props = withDefaults(
  defineProps<{
    marcas: MarcaDoDia[]
    /** Instante de agora, para o fio vertical e para o sombreado do que passou. */
    agora: ISODateTime
    /** Janela desenhada, em horas da parede. */
    abre?: number
    fecha?: number
  }>(),
  { abre: 6, fecha: 22 },
)

const emit = defineEmits<{ abrir: [rota: string] }>()

const { t } = useI18n()
const formato = useHotelFormat()

const horas = computed(() =>
  Array.from({ length: props.fecha - props.abre + 1 }, (_, indice) => props.abre + indice),
)

/** Posição de um instante no trilho, em percentual. Fora da janela, gruda na ponta. */
function posicao(iso: ISODateTime): number {
  const minutos = Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16))
  const inicio = props.abre * 60
  const total = (props.fecha - props.abre) * 60

  return Math.min(100, Math.max(0, ((minutos - inicio) / total) * 100))
}

const chegadas = computed(() => props.marcas.filter((marca) => marca.tipo === 'chegada'))
const saidas = computed(() => props.marcas.filter((marca) => marca.tipo === 'saida'))

const posicaoDeAgora = computed(() => posicao(props.agora))

const dentroDaJanela = computed(() => {
  const hora = Number(props.agora.slice(11, 13))

  return hora >= props.abre && hora <= props.fecha
})

/**
 * Já passou?
 *
 * A marca do que passou perde o peso: às 14h o olho procura as três chegadas da tarde, não relê
 * as duas da manhã.
 */
function passou(marca: MarcaDoDia): boolean {
  return marca.quando < props.agora
}
</script>

<template>
  <section class="dia" :aria-label="t('hotel.linhaDoDia.rotulo')">
    <!-- O cabeçalho do dia: o slot recebe a frase-resumo, que antes flutuava fora do cartão. -->
    <header v-if="$slots.resumo" class="dia__topo">
      <slot name="resumo" />
    </header>

    <div class="dia__grade">
      <!--
        O que já passou fica sombreado, de ponta a ponta.
        É o que dá ao trilho um "antes" e um "depois" sem precisar de linha gritante — o olho lê a
        divisão como sombra, que é como ele lê o tempo em qualquer calendário.
      -->
      <span
        v-if="dentroDaJanela"
        class="passado"
        :style="{ width: `${posicaoDeAgora}%` }"
        aria-hidden="true"
      />

      <!-- Chegadas: acima do trilho. -->
      <div class="pista pista--chegadas">
        <button
          v-for="marca in chegadas"
          :key="marca.id"
          type="button"
          class="marca marca--chegada"
          :class="{ 'marca--passou': passou(marca), 'marca--travada': marca.travado }"
          :style="{ insetInlineStart: `${posicao(marca.quando)}%` }"
          :title="`${marca.petNome} · ${formato.hora(marca.quando)} · ${marca.detalhe}`"
          @click="emit('abrir', marca.rota)"
        >
          <span class="marca__corpo">
            <span class="marca__hora clinic-value">{{ formato.hora(marca.quando) }}</span>
            <PetAvatar
              :nome="marca.petNome"
              :iniciais="marca.petIniciais"
              :especie="marca.petEspecie"
              :foto-url="marca.petFotoUrl"
              tamanho="xs"
            />
            <i v-if="marca.travado" class="pi pi-exclamation-triangle" aria-hidden="true" />
          </span>
          <span class="marca__haste" aria-hidden="true" />
        </button>
      </div>

      <!-- O trilho de horas. -->
      <div class="trilho">
        <span
          v-for="hora in horas"
          :key="hora"
          class="trilho__hora"
          :style="{ insetInlineStart: `${((hora - abre) / (fecha - abre)) * 100}%` }"
        >
          <span class="trilho__risco" aria-hidden="true" />
          <!-- De duas em duas: dezessete rótulos seguidos viram cerca, não escala. -->
          <span v-if="hora % 2 === 0" class="trilho__rotulo">
            {{ String(hora).padStart(2, '0') }}h
          </span>
        </span>

        <span
          v-if="dentroDaJanela"
          class="agora"
          :style="{ insetInlineStart: `${posicaoDeAgora}%` }"
        >
          <span class="agora__fio" aria-hidden="true" />
          <span class="agora__ponto" aria-hidden="true" />
          <span class="agora__rotulo">{{ formato.hora(agora) }}</span>
        </span>
      </div>

      <!-- Saídas: abaixo do trilho. -->
      <div class="pista pista--saidas">
        <button
          v-for="marca in saidas"
          :key="marca.id"
          type="button"
          class="marca marca--saida"
          :class="{ 'marca--passou': passou(marca), 'marca--travada': marca.travado }"
          :style="{ insetInlineStart: `${posicao(marca.quando)}%` }"
          :title="`${marca.petNome} · ${formato.hora(marca.quando)} · ${marca.detalhe}`"
          @click="emit('abrir', marca.rota)"
        >
          <span class="marca__haste" aria-hidden="true" />
          <span class="marca__corpo">
            <span class="marca__hora clinic-value">{{ formato.hora(marca.quando) }}</span>
            <PetAvatar
              :nome="marca.petNome"
              :iniciais="marca.petIniciais"
              :especie="marca.petEspecie"
              :foto-url="marca.petFotoUrl"
              tamanho="xs"
            />
            <i v-if="marca.travado" class="pi pi-exclamation-triangle" aria-hidden="true" />
          </span>
        </button>
      </div>

      <p v-if="marcas.length === 0" class="dia__vazio">{{ t('hotel.linhaDoDia.semMovimento') }}</p>
    </div>
  </section>
</template>

<style scoped>
/* O cartão do dia é da família dos outros da tela: a mesma borda, o mesmo raio e a mesma sombra. */
.dia {
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.dia__topo {
  padding: 1.1rem 1.35rem 0.85rem;
  border-block-end: 1px solid var(--clinic-line-soft);
}

.dia__grade {
  position: relative;
  padding: var(--clinic-space-3) var(--clinic-space-4) var(--clinic-space-2);
}

/* O sombreado cobre as duas pistas e o trilho, e fica atrás de tudo o que se clica. */
.passado {
  position: absolute;
  z-index: 0;
  border-start-start-radius: var(--clinic-radius-card);
  border-end-start-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-soft);
  inset-block: 0;
  inset-inline-start: 0;
  pointer-events: none;
}

.pista {
  position: relative;
  z-index: 1;
  height: 2.6rem;
}

.trilho {
  position: relative;
  z-index: 1;
  height: 1.5rem;
  border-top: 1px solid var(--clinic-line-strong);
}

.trilho__hora {
  position: absolute;
  transform: translateX(-50%);
}

.trilho__risco {
  display: block;
  width: 1px;
  height: 0.28rem;
  margin-inline: auto;
  background: var(--clinic-line);
}

.trilho__rotulo {
  display: block;
  color: var(--clinic-faint);
  font-size: 0.6rem;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ agora */

/*
 * O instante é um fio de um pixel na cor de acento — não uma barra vermelha.
 * Vermelho nesta tela quer dizer "alguém precisa agir"; gastá-lo para dizer que horas são faz o
 * vermelho que importa valer menos.
 */
.agora {
  position: absolute;
  z-index: 3;
  inset-block: -2.6rem 0;
  transform: translateX(-50%);
}

.agora__fio {
  position: absolute;
  width: 1px;
  background: var(--clinic-accent-strong);
  inset-block: -2.6rem 1.5rem;
  inset-inline-start: 0;
  opacity: 0.7;
}

.agora__ponto {
  position: absolute;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--clinic-accent-strong);
  inset-block-start: -0.2rem;
  inset-inline-start: 0;
  transform: translateX(-50%);
}

.agora__rotulo {
  position: absolute;
  color: var(--clinic-accent-strong);
  font-size: 0.58rem;
  font-weight: 800;
  inset-block-start: -3.35rem;
  letter-spacing: 0.02em;
  transform: translateX(-50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ marcas */

.marca {
  position: absolute;
  z-index: 2;
  display: grid;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  transform: translateX(-50%);
}

.marca--chegada {
  inset-block-end: 0;
  grid-template-rows: 1fr auto;
}

.marca--saida {
  inset-block-start: 0;
  grid-template-rows: auto 1fr;
}

/*
 * A marca mostra hora e rosto, e não o nome.
 * O nome está na lista logo abaixo; repeti-lo aqui fazia a tela dizer a mesma coisa duas vezes —
 * e era a queixa de "confusa". O avatar carrega a identidade em 18 px.
 */
.marca__corpo {
  display: flex;
  align-items: center;
  padding: 0.18rem 0.35rem;
  border: 1px solid var(--clinic-accent-soft);
  border-radius: 999rem;
  gap: 0.28rem;
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
  box-shadow: 0 1px 2px rgb(31 47 43 / 0.06);
  white-space: nowrap;
}

.marca--saida .marca__corpo {
  border-color: var(--clinic-line);
  color: var(--clinic-muted);
}

.marca--travada .marca__corpo {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.marca--passou .marca__corpo {
  opacity: 0.6;
  box-shadow: none;
}

.marca:hover .marca__corpo,
.marca:focus-visible .marca__corpo {
  border-color: var(--clinic-accent-strong);
  outline: none;
  transform: translateY(-1px);
}

.marca__corpo {
  transition:
    transform 120ms ease,
    border-color 120ms ease;
}

.marca__hora {
  font-size: 0.66rem;
  font-weight: 800;
}

.marca__corpo i {
  font-size: 0.58rem;
}

/*
 * A haste liga a marca ao trilho, e precisa ser vista.
 * Quase invisível, ela deixava as pastilhas boiando acima de uma régua — e o desenho parava de
 * dizer "isto aconteceu às 9h30" para dizer apenas "isto existe".
 */
.marca__haste {
  width: 1px;
  height: 0.85rem;
  margin-inline: auto;
  background: var(--clinic-line-strong);
}

.marca--travada .marca__haste {
  background: var(--clinic-attention-line);
}

.marca--passou .marca__haste {
  opacity: 0.5;
}

.dia__vazio {
  position: absolute;
  z-index: 2;
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  inset-block-start: 1.4rem;
  inset-inline: 0;
  text-align: center;
}

/*
 * No estreito o trilho vira lista: um dia inteiro em 340 px de largura sobrepõe todas as marcas,
 * e uma linha do tempo ilegível é pior que uma lista honesta. O cabeçalho do dia sobrevive, porque
 * a frase-resumo continua valendo em qualquer largura.
 */
@media (max-width: 760px) {
  .dia__grade {
    display: none;
  }
}
</style>
