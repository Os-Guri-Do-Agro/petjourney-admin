<script setup lang="ts">
/**
 * Hóspedes na casa.
 *
 * Era uma tabela, e tabela era a forma errada. Esta tela não é um inventário para varrer por
 * coluna: é a pergunta **"como está cada um dos meus cinco?"** — e a resposta é um rosto, um
 * estado e o que falta fazer. Quem quer a lista fria — nome, acomodação, noites — tem o mapa de
 * ocupação, que é a tela feita para isso.
 *
 * ## Por que bandas, e não uma grade uniforme
 *
 * A grade anterior dava o mesmo cartão para quem tinha quatro tarefas atrasadas e para quem estava
 * dormindo, e deixava metade da tela em branco embaixo. Uma tela onde tudo tem o mesmo peso obriga
 * a ler tudo para descobrir o que importa — e, com cinco hóspedes numa tela larga, a grade ainda
 * saía 4 + 1, com uma fileira órfã.
 *
 * Agora a página tem três respirações, e cada hóspede cai em **exatamente uma**: quem cobra ação,
 * quem sai hoje, e quem está em dia. Quem sai hoje **e** cobra ação fica na primeira — e não perde
 * a informação da saída, porque ela está no pé de todo cartão.
 *
 * A banda fria é recolhível, e **nasce aberta quando a primeira tem dois hóspedes ou menos**: é
 * exatamente o caso em que a página ficaria curta, e é o conteúdo de verdade que preenche o espaço
 * em vez de um enfeite inventado para ocupar viewport.
 *
 * ## Por que os recortes continuam
 *
 * Os três recortes são uma decisão anterior aprovada, e bandas e recortes respondem a perguntas
 * diferentes: o recorte é quem eu quero ver, a banda é em que ordem. As bandas aparecem em
 * "Todos"; nos outros dois recortes a lista já está filtrada e uma banda só repetiria o título do
 * filtro.
 */
import { PhDoorOpen, PhMoon, PhWarningCircle, PhListChecks } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HospedeCard from '@/features/hotel/components/hospedes/HospedeCard.vue'
import HospedeFileira from '@/features/hotel/components/hospedes/HospedeFileira.vue'
import type { HospedeNaCasa } from '@/features/hotel/data/repositories'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const router = useRouter()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

/**
 * Três recortes, e não uma barra de filtros.
 *
 * Cinco a vinte hóspedes não pedem busca nem facetas: pedem "me mostre só os que precisam de
 * mim". Uma barra de filtros aqui seria a mesma peça de interface das outras telas — de novo — e
 * resolveria um problema que esta lista não tem.
 */
type Recorte = 'todos' | 'precisam' | 'saem'

const recorte = ref<Recorte>('todos')

/** A banda fria começa fechada; o `onMounted` decide pela ocupação real assim que ela chega. */
const emDiaAberta = ref(false)

onMounted(async () => {
  await hospedagem.carregarHospedes()
})

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarHospedes(),
)

function precisaDeAlguem(hospede: HospedeNaCasa) {
  return (
    hospede.ocorrenciaTravada ||
    hospede.boletimRetido ||
    hospede.atrasadas > 0 ||
    (hospede.saiHoje && hospede.hospedagem.pesoSaidaKg === null)
  )
}

const visiveis = computed(() => {
  if (recorte.value === 'precisam') {
    return hospedagem.hospedes.filter(precisaDeAlguem)
  }

  if (recorte.value === 'saem') {
    return hospedagem.hospedes.filter((hospede) => hospede.saiHoje)
  }

  return hospedagem.hospedes
})

/*
 * A partição. Primeira banda que aceita vence, e por isso a ordem destes três `computed` é a
 * regra: sem a exclusão, quem sai hoje com tarefa atrasada apareceria duas vezes e a contagem das
 * réguas somaria mais que o total da casa.
 */
const precisam = computed(() => visiveis.value.filter(precisaDeAlguem))

const saem = computed(() =>
  visiveis.value.filter((hospede) => hospede.saiHoje && !precisaDeAlguem(hospede)),
)

const emDia = computed(() =>
  visiveis.value.filter((hospede) => !precisaDeAlguem(hospede) && !hospede.saiHoje),
)

/** As bandas só organizam o "todos": nos outros recortes a lista já vem filtrada. */
const porBandas = computed(() => recorte.value === 'todos')

/*
 * A faixa fria abre sozinha quando a página seria curta.
 *
 * A regra olha as duas faixas quentes somadas, e não só a primeira: com quatro hóspedes cobrando
 * ação e nenhum saindo, a versão anterior mantinha "Em dia" recolhida e deixava metade da tela em
 * branco — recolher para poupar espaço, exatamente onde espaço sobrava.
 */
watch(
  [precisam, saem],
  ([cobram, saindo]) => {
    emDiaAberta.value = cobram.length + saindo.length <= 6
  },
  { immediate: true },
)

const quantosPrecisam = computed(() => hospedagem.hospedes.filter(precisaDeAlguem).length)
const quantosSaem = computed(() => hospedagem.hospedes.filter((item) => item.saiHoje).length)

const resumo = computed(() => {
  const total = hospedagem.hospedes.length

  if (total === 0 || quantosPrecisam.value === 0) {
    return t('hotel.hospedes.resumoEmDia')
  }

  return t(
    'hotel.hospedes.resumo',
    { precisam: quantosPrecisam.value, total },
    quantosPrecisam.value,
  )
})

const opcoes = computed(() => [
  {
    valor: 'todos' as const,
    rotulo: t('hotel.hospedes.recorte.todos', { total: hospedagem.hospedes.length }),
  },
  {
    valor: 'precisam' as const,
    rotulo: t('hotel.hospedes.recorte.precisam', { total: quantosPrecisam.value }),
  },
  {
    valor: 'saem' as const,
    rotulo: t('hotel.hospedes.recorte.saem', { total: quantosSaem.value }),
  },
])

const vazio = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.hospedes.length === 0,
)

/** O corredor de cada hóspede, pelo nome. O `blocoId` já chegava e era jogado fora. */
function blocoNome(hospede: HospedeNaCasa) {
  return hotelStore.blocoPorId.get(hospede.blocoId)?.nome ?? ''
}

function abrir(hospedagemId: string) {
  void router.push(`/hotel/hospedagem/${hospedagemId}`)
}

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar — que
 * é exatamente o que aconteceu quando a grade deixou de se chamar `.grade` e o tour passou a
 * descartar dois passos em silêncio.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.hospedes.pergunta.titulo'),
    texto: t('hotel.tour.hospedes.pergunta.texto'),
  },
  {
    alvo: '.barra',
    titulo: t('hotel.tour.hospedes.recortes.titulo'),
    texto: t('hotel.tour.hospedes.recortes.texto'),
  },
  {
    alvo: '.foco',
    titulo: t('hotel.tour.hospedes.cartao.titulo'),
    texto: t('hotel.tour.hospedes.cartao.texto'),
  },
  {
    alvo: '.banda--emdia',
    titulo: t('hotel.tour.hospedes.linhas.titulo'),
    texto: t('hotel.tour.hospedes.linhas.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.hospedes.titulo')"
    :subtitle="t('hotel.hospedes.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.hospedes.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.hospedes.vazioTitulo')"
    :empty-description="t('hotel.hospedes.vazioDescricao')"
    @retry="hospedagem.carregarHospedes()"
  >
    <div class="hospedes clinic-scope">
      <div class="barra">
        <SelectButton
          v-model="recorte"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.hospedes.recorteRotulo')"
        />

        <p class="barra__resumo">{{ resumo }}</p>
      </div>

      <p v-if="visiveis.length === 0" class="nada">
        <PhMoon class="nada__icone" weight="duotone" aria-hidden="true" />
        {{
          recorte === 'precisam'
            ? t('hotel.hospedes.ninguemPrecisa')
            : t('hotel.hospedes.ninguemSai')
        }}
      </p>

      <!-- O recorte "Todos" ganha as três bandas; os outros já vêm filtrados. -->
      <template v-else-if="porBandas">
        <section v-if="precisam.length > 0" class="banda">
          <h2 class="banda__titulo">
            <PhWarningCircle weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.banda.precisam') }}
            <span class="banda__conta clinic-value">{{ precisam.length }}</span>
          </h2>

          <ul class="pilha">
            <HospedeCard
              v-for="hospede in precisam"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              :agora="hospedagem.agora"
              :bloco-nome="blocoNome(hospede)"
              @abrir="abrir"
            />
          </ul>
        </section>

        <section v-if="saem.length > 0" class="banda">
          <h2 class="banda__titulo">
            <PhDoorOpen weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.banda.saem') }}
            <span class="banda__conta clinic-value">{{ saem.length }}</span>
          </h2>

          <ul class="pilha">
            <HospedeCard
              v-for="hospede in saem"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              :agora="hospedagem.agora"
              :bloco-nome="blocoNome(hospede)"
              @abrir="abrir"
            />
          </ul>
        </section>

        <section v-if="emDia.length > 0" class="banda banda--emdia">
          <button
            type="button"
            class="banda__titulo banda__recolher"
            :aria-expanded="emDiaAberta"
            @click="emDiaAberta = !emDiaAberta"
          >
            <PhMoon weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.banda.emDia') }}
            <span class="banda__conta clinic-value">{{ emDia.length }}</span>
            <i
              class="pi banda__chevron"
              :class="emDiaAberta ? 'pi-chevron-down' : 'pi-chevron-right'"
              aria-hidden="true"
            />
          </button>

          <ul v-if="emDiaAberta" class="grupo">
            <HospedeFileira
              v-for="hospede in emDia"
              :key="hospede.hospedagem.id"
              :hospede="hospede"
              @abrir="abrir"
            />
          </ul>
        </section>
      </template>

      <ul v-else class="pilha">
        <HospedeCard
          v-for="hospede in visiveis"
          :key="hospede.hospedagem.id"
          :hospede="hospede"
          :agora="hospedagem.agora"
          :bloco-nome="blocoNome(hospede)"
          @abrir="abrir"
        />
      </ul>
    </div>

    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <Button
          :label="t('hotel.hospedes.irParaRotina')"
          severity="secondary"
          outlined
          size="small"
          @click="router.push('/hotel/rotina')"
        >
          <template #icon><PhListChecks weight="duotone" aria-hidden="true" /></template>
        </Button>
      </span>
    </template>

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.hospedes {
  display: grid;
  gap: var(--clinic-space-5);
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

/*
 * O resumo é uma frase em peso normal, e não um número grande com barra.
 *
 * A prancheta do turno já abre com número grande + barra, e repetir a peça aqui refaria, no nível
 * da página, a mesma "fileira-de-números-mais-lista" que derrubou a primeira versão desta tela.
 * O que a pessoa precisa saber ao chegar cabe numa linha.
 */
.barra__resumo {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.nada {
  display: grid;
  justify-items: center;
  margin: 0;
  padding: var(--clinic-space-6) var(--clinic-space-5);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  text-align: center;
}

.nada__icone {
  width: 3rem;
  height: 3rem;
  color: var(--clinic-line-strong);
}

/* ------------------------------------------------------------------ bandas */

.banda {
  display: grid;
  gap: var(--clinic-space-3);
}

/*
 * A régua da banda, com o filete correndo até a borda. É o mesmo desenho que separa os tempos na
 * prancheta: quebra a página em respirações sem custar uma caixa.
 */
.banda__titulo {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  gap: var(--clinic-space-2);
  background: transparent;
  color: var(--clinic-faint);
  font-family: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-align: start;
  text-transform: uppercase;
}

.banda__titulo::after {
  height: 1px;
  flex: 1;
  background: var(--clinic-line-soft);
  content: '';
}

.banda__titulo :deep(svg),
.banda__titulo > svg {
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
}

.banda__conta {
  color: var(--clinic-text);
  font-weight: 800;
  letter-spacing: 0;
}

.banda__recolher {
  cursor: pointer;
}

.banda__recolher:hover {
  color: var(--clinic-text);
}

.banda__recolher:focus-visible {
  border-radius: var(--clinic-radius-control);
  box-shadow: var(--clinic-focus-ring);
  outline: none;
}

.banda__chevron {
  order: 1;
  font-size: 0.7rem;
}

/* O chevron de "fechado" é direcional: em árabe ele aponta para o outro lado. */
[dir='rtl'] .pi-chevron-right {
  transform: scaleX(-1);
}

/* ------------------------------------------------------------------- grades */

/*
 * Teto **explícito** de duas colunas, e não `auto-fill`.
 *
 * O `auto-fill` da versão anterior oscilava entre três e quatro colunas com cinco pixels de
 * diferença de janela, e com cinco hóspedes sempre sobrava uma fileira órfã. Duas colunas dão ao
 * cartão a largura que a linha de foco precisa e enchem a página com conteúdo de verdade.
 */
.pilha {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-4);
  grid-template-columns: minmax(0, 1fr);
  list-style: none;
}

@media (min-width: 1200px) {
  .pilha {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* A banda fria: uma moldura para o grupo, irmãs separadas por filete. */
.grupo {
  margin: 0;
  padding: 0;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  list-style: none;
  overflow: hidden;
}

.grupo > li + li {
  border-block-start: 1px solid var(--clinic-line-soft);
}

/* Caixa-alta rastreada não roda em árabe: o `letter-spacing` desconecta as ligaduras. */
[dir='rtl'] .banda__titulo {
  letter-spacing: normal;
  text-transform: none;
}
</style>
