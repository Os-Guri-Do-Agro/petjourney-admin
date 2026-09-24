<script setup lang="ts">
/**
 * A casa — o cadastro de tudo que cerca uma acomodação.
 *
 * **O sistema não adivinha como o hotel é.** Quem monta a casa é a operação: cria os corredores,
 * cadastra as vagas, dá nome, põe preço e diz quando dezembro fica caro. Esta tela existe para que
 * nada disso dependa de ninguém — nem de um chamado de suporte, nem de um deploy.
 *
 * ## Três cadastros, uma página
 *
 * Corredores e vagas, tabelas de preço, temporadas. Ficam juntos porque **mudam juntos**: quem
 * abre um corredor novo está pondo preço nele, e quem reajusta a diária costuma estar olhando
 * quantas vagas daquele tipo existem. Separar em três telas obrigaria a ir e voltar carregando
 * número na cabeça.
 *
 * ## Por que cada coisa tem desenho próprio
 *
 * A versão anterior era uma grade de vinte caixas iguais, cada uma com três linhas de texto cinza,
 * repetindo "Baia · Gigante · cabem 2" vinte vezes — e a palavra "Baia" saía duas vezes no mesmo
 * cartão, uma como nome e outra como tipo. Um cadastro que se lê varrendo precisa que as coisas
 * pareçam diferentes umas das outras: aqui o tipo virou desenho, o preço virou o número ancorado no
 * pé, e os recursos viraram ícones em vez de sumirem.
 *
 * As temporadas ganharam a régua do ano. "01/07 → 31/07" contra "20/12 → 05/01" obriga a montar o
 * calendário de cabeça para saber quando cai, quanto dura e se encosta na outra — e é o tipo de
 * conta que se erra na hora de dar desconto.
 */
import {
  PhBed,
  PhCalendarStar,
  PhBird,
  PhCat,
  PhDog,
  PhHouseLine,
  PhShieldCheck,
  PhSnowflake,
  PhSun,
  PhTag,
  PhThermometer,
  PhRabbit,
  PhTree,
  PhUsersThree,
  PhVideoCamera,
  PhWrench,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import AcomodacaoDialog from '@/features/hotel/components/acomodacoes/AcomodacaoDialog.vue'
import CorredorDialog from '@/features/hotel/components/acomodacoes/CorredorDialog.vue'
import FaixaDoAno from '@/features/hotel/components/acomodacoes/FaixaDoAno.vue'
import TarifaDialog from '@/features/hotel/components/acomodacoes/TarifaDialog.vue'
import TemporadaDialog from '@/features/hotel/components/acomodacoes/TemporadaDialog.vue'
import TipoDialog from '@/features/hotel/components/acomodacoes/TipoDialog.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { TemporadaSazonal } from '@/features/hotel/data/fixtures'
import {
  acomodacaoRepository,
  CadastroRecusadoError,
  catalogoRepository,
} from '@/features/hotel/data/repositories'
import type {
  Acomodacao,
  IconeDeAcomodacao,
  Bloco,
  PetPorte,
  RecursoDaAcomodacao,
  Tarifa,
  TipoDeAcomodacao,
} from '@/features/hotel/data/types'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']

/*
 * Os três mapas de desenho, todos `Record<…>` fechado: acrescentar um tipo ao domínio sem dar
 * ícone a ele passa a ser erro de compilação, e não um quadrado vazio descoberto em produção.
 */
/*
 * O desenho de cada tipo — e só o desenho.
 *
 * O nome do tipo é cadastro da casa; o que continua nosso é a biblioteca de formas entre as quais
 * ela escolhe. É a divisão que resolve a queixa sem abrir mão do ícone: a palavra é dela, o traço
 * é nosso.
 */
const ICONE_DA_VAGA: Record<IconeDeAcomodacao, Component> = {
  casa: PhHouseLine,
  cama: PhBed,
  gato: PhCat,
  cao: PhDog,
  grupo: PhUsersThree,
  escudo: PhShieldCheck,
  arvore: PhTree,
  passaro: PhBird,
  coelho: PhRabbit,
}

/** O desenho de uma vaga, pelo tipo que ela aponta. `casa` é o fallback de tipo removido. */
function iconeDaVaga(tipoId: string) {
  return ICONE_DA_VAGA[hotelStore.tipoDeAcomodacao(tipoId)?.icone ?? 'casa']
}

/** O nome do tipo, cadastrado pela casa. */
function nomeDoTipo(tipoId: string) {
  return hotelStore.tipoDeAcomodacao(tipoId)?.nome ?? ''
}

const ICONE_DO_RECURSO: Record<RecursoDaAcomodacao, Component> = {
  camera: PhVideoCamera,
  climatizacao: PhSnowflake,
  'area-externa': PhTree,
  'piso-aquecido': PhThermometer,
  janela: PhSun,
}

const salvando = ref(false)
const erro = ref('')

/**
 * Qual cadastro está aberto.
 *
 * Mora no componente e não na rota: é preferência de leitura dentro de uma tela só, e uma aba na
 * URL faria "voltar" significar "troque de aba", que não é o que a seta do navegador promete.
 */
type Aba = 'casa' | 'tipos' | 'tarifas' | 'temporadas'

const aba = ref<Aba>('casa')

const ICONE_DA_ABA: Record<Aba, Component> = {
  casa: PhHouseLine,
  tipos: PhBed,
  tarifas: PhTag,
  temporadas: PhCalendarStar,
}

/*
 * O `PartnerSectionTabs` é do portal e tipa o `id` da aba como `string` — ele serve a telas que
 * não têm união fechada. O acessor recebe a string e o mapa continua sendo `Record<Aba, …>`, que é
 * onde a exaustividade importa: aba nova sem ícone continua sendo erro de compilação.
 */
function iconeDaAba(valor: string) {
  return ICONE_DA_ABA[valor as Aba]
}

const acomodacaoAberta = ref(false)
const acomodacaoEmEdicao = ref<Acomodacao | null>(null)
/** O corredor em que a criação começa, quando o gesto veio de dentro de um deles. */
const corredorSugerido = ref('')

const corredorAberto = ref(false)
const corredorEmEdicao = ref<Bloco | null>(null)

const tarifaAberta = ref(false)
const tarifaEmEdicao = ref<Tarifa | null>(null)

const tipoAberto = ref(false)
const tipoEmEdicao = ref<TipoDeAcomodacao | null>(null)

const temporadaAberta = ref(false)
const temporadaEmEdicao = ref<TemporadaSazonal | null>(null)

onMounted(async () => {
  await hotelStore.carregar()
})

/*
 * Todos os corredores, inclusive os vazios.
 *
 * A versão anterior filtrava os sem acomodação — e com isso um corredor recém-criado simplesmente
 * não aparecia, o que faz a pessoa criá-lo de novo. Corredor vazio é um estado legítimo do
 * cadastro: é onde se está prestes a pôr vaga.
 */
const porCorredor = computed(() =>
  hotelStore.blocos.map((bloco) => ({
    bloco,
    acomodacoes: hotelStore.acomodacoes.filter((item) => item.blocoId === bloco.id),
  })),
)

const paradas = computed(() => hotelStore.acomodacoes.filter((item) => !item.ativa).length)

const lugares = computed(() =>
  hotelStore.acomodacoes.reduce((soma, item) => soma + (item.ativa ? item.capacidade : 0), 0),
)

/**
 * As três abas, com a frase que cada uma governa.
 *
 * A descrição é do `PartnerSectionTabs` e aparece sob a faixa: é onde o subtítulo de cada cadastro
 * passou a morar, em vez de um cabeçalho por seção repetido três vezes na mesma página.
 */
const abas = computed(() => [
  {
    id: 'casa',
    label: t('hotel.acomodacoes.aCasa'),
    description: [
      t(
        'hotel.acomodacoes.resumo',
        { total: hotelStore.acomodacoes.length },
        hotelStore.acomodacoes.length,
      ),
      t('hotel.acomodacoes.lugares', { total: lugares.value }, lugares.value),
      ...(paradas.value > 0 ? [t('hotel.acomodacoes.paradas', { total: paradas.value })] : []),
    ].join(' · '),
  },
  {
    id: 'tipos',
    label: t('hotel.acomodacoes.tipos'),
    description: t('hotel.acomodacoes.tipo.resumo'),
  },
  {
    id: 'tarifas',
    label: t('hotel.acomodacoes.tarifas'),
    description: t('hotel.acomodacoes.preco.resumo'),
  },
  {
    id: 'temporadas',
    label: t('hotel.acomodacoes.temporadas'),
    description: t('hotel.acomodacoes.temporada.resumo'),
  },
])

/**
 * A ação do cabeçalho segue a aba.
 *
 * Um "Nova acomodação" fixo no topo mentia nas outras duas abas: quem está olhando a tabela de
 * preço e toca no botão de criar espera criar uma tabela. O rótulo sai de chamadas explícitas a
 * `t()` e não de uma chave montada com o nome da aba — chave por interpolação some do varredor de
 * traduções, e some junto a garantia de que os seis idiomas têm todas elas.
 */
const acaoDaAba = computed(() => {
  if (aba.value === 'tipos') {
    return { rotulo: t('hotel.acomodacoes.tipo.novo'), abrir: () => abrirTipo(null) }
  }

  if (aba.value === 'tarifas') {
    return { rotulo: t('hotel.acomodacoes.preco.nova'), abrir: () => abrirTarifa(null) }
  }

  if (aba.value === 'temporadas') {
    return { rotulo: t('hotel.acomodacoes.temporada.nova'), abrir: () => abrirTemporada(null) }
  }

  return { rotulo: t('hotel.acomodacoes.nova'), abrir: () => abrirAcomodacao(null) }
})

function usosDoTipo(tipoId: string) {
  return hotelStore.acomodacoes.filter((item) => item.tipoId === tipoId).length
}

function usosDaTarifa(tarifaId: string) {
  return hotelStore.acomodacoes.filter((item) => item.tarifaId === tarifaId).length
}

function diariaDe(acomodacao: Acomodacao) {
  return hotelStore.tarifa(acomodacao.tarifaId)?.diariaPorPorte[acomodacao.porteMaximo] ?? 0
}

function paradaHaDias(acomodacao: Acomodacao) {
  return acomodacao.inativaDesde
    ? Math.floor((Date.now() - Date.parse(acomodacao.inativaDesde)) / 86_400_000)
    : null
}

/**
 * Envelope das mudanças de cadastro.
 *
 * O diálogo só fecha quando a mudança é **aceita**. Recusada por regra — nome repetido, corredor
 * com vaga dentro, tabela em uso —, ele fica aberto com o motivo à vista. Sumir com ele deixaria a
 * pessoa sem saber por que nada mudou.
 */
async function mudar(acao: () => Promise<unknown>, fechar: () => void) {
  salvando.value = true
  erro.value = ''

  try {
    await acao()
    await hotelStore.carregar(true)
    hotelStore.invalidarTudo()
    fechar()
  } catch (falha) {
    erro.value =
      falha instanceof CadastroRecusadoError
        ? `hotel.erros.cadastro.${falha.kind}`
        : 'hotel.erros.acao'
  } finally {
    salvando.value = false
  }
}

function abrirAcomodacao(acomodacao: Acomodacao | null, blocoId = '') {
  acomodacaoEmEdicao.value = acomodacao
  corredorSugerido.value = blocoId
  erro.value = ''
  acomodacaoAberta.value = true
}

function abrirCorredor(corredor: Bloco | null) {
  corredorEmEdicao.value = corredor
  erro.value = ''
  corredorAberto.value = true
}

function abrirTarifa(tarifa: Tarifa | null) {
  tarifaEmEdicao.value = tarifa
  erro.value = ''
  tarifaAberta.value = true
}

function abrirTipo(tipo: TipoDeAcomodacao | null) {
  tipoEmEdicao.value = tipo
  erro.value = ''
  tipoAberto.value = true
}

function abrirTemporada(temporada: TemporadaSazonal | null) {
  temporadaEmEdicao.value = temporada
  erro.value = ''
  temporadaAberta.value = true
}

/* Mover não abre diálogo: é um gesto, e um gesto que pede confirmação deixa de ser gesto. */
function moverTipo(tipoId: string, direcao: 'sobe' | 'desce') {
  void mudar(
    () => catalogoRepository.moverTipo({ tipoId, direcao }),
    () => {},
  )
}

function moverCorredor(blocoId: string, direcao: 'sobe' | 'desce') {
  void mudar(
    () => catalogoRepository.moverBloco({ blocoId, direcao }),
    () => {},
  )
}

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.acomodacoes.pergunta.titulo'),
    texto: t('hotel.tour.acomodacoes.pergunta.texto'),
  },
  {
    alvo: '.corredor',
    titulo: t('hotel.tour.acomodacoes.blocos.titulo'),
    texto: t('hotel.tour.acomodacoes.blocos.texto'),
  },
  {
    alvo: '.vaga--parada',
    titulo: t('hotel.tour.acomodacoes.parada.titulo'),
    texto: t('hotel.tour.acomodacoes.parada.texto'),
  },
  /*
   * O passo aponta para a faixa de abas, e não para a tabela de preço.
   *
   * Com as três abas, a tabela só existe no DOM quando a aba dela está acesa — e o `HotelTour`
   * descarta em silêncio o passo cujo alvo não está na tela. Apontar para a faixa é o que continua
   * verdadeiro nas três, e é também a informação que falta a quem chega: que existem mais duas.
   */
  {
    alvo: '.partner-tabs',
    titulo: t('hotel.tour.acomodacoes.tarifas.titulo'),
    texto: t('hotel.tour.acomodacoes.tarifas.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.acomodacoes.titulo')"
    :subtitle="t('hotel.acomodacoes.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="hotelStore.carregando && hotelStore.acomodacoes.length === 0"
    :error="hotelStore.erro ? t(hotelStore.erro) : ''"
    @retry="hotelStore.carregar(true)"
  >
    <div class="cadastro clinic-scope">
      <!--
        Três abas, e não três seções empilhadas.

        Os três cadastros mudam juntos, mas não se **leem** juntos: quem veio pôr uma baia nova
        passa por vinte vagas, uma tabela de preço e três temporadas para chegar onde queria. Em
        aba, cada cadastro ocupa a tela inteira, e o que a pessoa não veio fazer some de vez —
        continuando a um toque de distância, que é o que a proximidade dos três realmente exige.
      -->
      <PartnerSectionTabs
        :tabs="abas"
        :active-tab="aba"
        :aria-label="t('hotel.acomodacoes.abasRotulo')"
        @select="(id) => (aba = id as Aba)"
      >
        <template #icone="{ tab }">
          <component :is="iconeDaAba(tab.id)" weight="duotone" aria-hidden="true" />
        </template>
      </PartnerSectionTabs>

      <!-- ============================================================ a casa -->
      <section
        v-if="aba === 'casa'"
        id="partner-panel-casa"
        class="painel"
        role="tabpanel"
        aria-labelledby="partner-tab-casa"
      >
        <div class="painel__acoes">
          <Button
            :label="t('hotel.acomodacoes.corredor.novo')"
            icon="pi pi-plus"
            severity="secondary"
            outlined
            size="small"
            @click="abrirCorredor(null)"
          />
        </div>

        <article v-for="(grupo, indice) in porCorredor" :key="grupo.bloco.id" class="corredor">
          <header class="corredor__cabeca">
            <span class="corredor__marca">
              <component
                :is="ICONE_DA_VAGA[grupo.bloco.icone]"
                weight="duotone"
                aria-hidden="true"
              />
            </span>

            <h3 class="corredor__nome">{{ grupo.bloco.nome }}</h3>
            <span class="corredor__conta clinic-value">{{ grupo.acomodacoes.length }}</span>

            <!--
              As ações do corredor ficam à direita e sem rótulo: são gestos de arrumação, e um
              rótulo em cada uma faria o cabeçalho do corredor competir com o nome dele.
            -->
            <span class="corredor__acoes">
              <Button
                icon="pi pi-arrow-up"
                severity="secondary"
                text
                rounded
                size="small"
                :disabled="indice === 0 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.subir')"
                :title="t('hotel.acomodacoes.corredor.subir')"
                @click="moverCorredor(grupo.bloco.id, 'sobe')"
              />
              <Button
                icon="pi pi-arrow-down"
                severity="secondary"
                text
                rounded
                size="small"
                :disabled="indice === porCorredor.length - 1 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.descer')"
                :title="t('hotel.acomodacoes.corredor.descer')"
                @click="moverCorredor(grupo.bloco.id, 'desce')"
              />
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                size="small"
                :aria-label="t('hotel.acomodacoes.corredor.editar')"
                :title="t('hotel.acomodacoes.corredor.editar')"
                @click="abrirCorredor(grupo.bloco)"
              />
            </span>
          </header>

          <ul class="grade">
            <li v-for="acomodacao in grupo.acomodacoes" :key="acomodacao.id">
              <button
                type="button"
                class="vaga"
                :class="{ 'vaga--parada': !acomodacao.ativa }"
                @click="abrirAcomodacao(acomodacao)"
              >
                <span class="vaga__cabeca">
                  <!-- O desenho é nosso; a palavra na dica é a que a casa cadastrou. -->
                  <span class="vaga__marca" :title="nomeDoTipo(acomodacao.tipoId)">
                    <component
                      :is="iconeDaVaga(acomodacao.tipoId)"
                      weight="duotone"
                      aria-hidden="true"
                    />
                  </span>

                  <span class="vaga__quem">
                    <strong class="vaga__nome">{{ acomodacao.nome }}</strong>
                    <span class="vaga__perfil">
                      {{ formato.porte(acomodacao.porteMaximo) }} ·
                      {{
                        t(
                          'hotel.acomodacoes.cabem',
                          { total: acomodacao.capacidade },
                          acomodacao.capacidade,
                        )
                      }}
                    </span>
                  </span>
                </span>

                <!-- Os recursos como desenho: em texto, eram a quarta linha cinza do cartão. -->
                <span v-if="acomodacao.recursos.length > 0" class="vaga__recursos">
                  <span
                    v-for="recurso in acomodacao.recursos"
                    :key="recurso"
                    class="vaga__recurso"
                    :title="formato.recurso(recurso)"
                  >
                    <component :is="ICONE_DO_RECURSO[recurso]" weight="duotone" aria-hidden="true" />
                    <span class="vaga__recursoNome">{{ formato.recurso(recurso) }}</span>
                  </span>
                </span>

                <span class="vaga__pe">
                  <span class="vaga__tabela">{{ hotelStore.tarifa(acomodacao.tarifaId)?.nome }}</span>
                  <strong class="vaga__preco clinic-value">
                    {{ formato.moeda(diariaDe(acomodacao)) }}
                  </strong>
                </span>

                <!-- Há quanto tempo é a informação, não o rótulo de "em manutenção". -->
                <span v-if="!acomodacao.ativa" class="vaga__parada">
                  <PhWrench weight="duotone" aria-hidden="true" />
                  {{ formato.motivoInativa(acomodacao.motivoInativa ?? 'outro') }}
                  <template v-if="paradaHaDias(acomodacao) !== null">
                    · {{ formato.haDias(paradaHaDias(acomodacao) ?? 0) }}
                  </template>
                </span>
              </button>
            </li>

            <!-- Criar a vaga onde ela vai morar, e não num botão longe no topo da página. -->
            <li>
              <button
                type="button"
                class="vaga vaga--nova"
                @click="abrirAcomodacao(null, grupo.bloco.id)"
              >
                <i class="pi pi-plus" aria-hidden="true" />
                {{ t('hotel.acomodacoes.nova') }}
              </button>
            </li>
          </ul>
        </article>
      </section>

      <!-- ============================================================== tipos -->
      <section
        v-else-if="aba === 'tipos'"
        id="partner-panel-tipos"
        class="painel"
        role="tabpanel"
        aria-labelledby="partner-tab-tipos"
      >
        <ul class="tipos">
          <li v-for="(tipo, indice) in hotelStore.tiposDeAcomodacao" :key="tipo.id" class="tipo">
            <span class="tipo__marca">
              <component :is="ICONE_DA_VAGA[tipo.icone]" weight="duotone" aria-hidden="true" />
            </span>

            <span class="tipo__texto">
              <strong class="tipo__nome">{{ tipo.nome }}</strong>
              <span class="tipo__usos">
                {{ t('hotel.acomodacoes.tipo.usos', { total: usosDoTipo(tipo.id) }, usosDoTipo(tipo.id)) }}
              </span>
            </span>

            <span class="tipo__acoes">
              <Button
                icon="pi pi-arrow-up"
                severity="secondary"
                text
                rounded
                size="small"
                :disabled="indice === 0 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.subir')"
                :title="t('hotel.acomodacoes.corredor.subir')"
                @click="moverTipo(tipo.id, 'sobe')"
              />
              <Button
                icon="pi pi-arrow-down"
                severity="secondary"
                text
                rounded
                size="small"
                :disabled="indice === hotelStore.tiposDeAcomodacao.length - 1 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.descer')"
                :title="t('hotel.acomodacoes.corredor.descer')"
                @click="moverTipo(tipo.id, 'desce')"
              />
              <Button
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                size="small"
                :aria-label="t('hotel.acomodacoes.tipo.editar')"
                :title="t('hotel.acomodacoes.tipo.editar')"
                @click="abrirTipo(tipo)"
              />
            </span>
          </li>
        </ul>
      </section>

      <!-- ============================================================= preços -->
      <section
        v-else-if="aba === 'tarifas'"
        id="partner-panel-tarifas"
        class="painel precos"
        role="tabpanel"
        aria-labelledby="partner-tab-tarifas"
      >
        <div class="tabelaRolagem">
          <table class="tabela">
            <thead>
              <tr>
                <th scope="col">{{ t('hotel.acomodacoes.tarifa') }}</th>
                <th v-for="porte in PORTES" :key="porte" scope="col" class="tabela__num">
                  {{ formato.porte(porte) }}
                </th>
                <th scope="col" class="tabela__num">{{ t('hotel.acomodacoes.acompanhante') }}</th>
                <th scope="col"><span class="tabela__oculto">{{ t('hotel.comum.salvar') }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tarifa in hotelStore.tarifas" :key="tarifa.id">
                <th scope="row">
                  {{ tarifa.nome }}
                  <span class="tabela__usos">
                    {{
                      t(
                        'hotel.acomodacoes.preco.usos',
                        { total: usosDaTarifa(tarifa.id) },
                        usosDaTarifa(tarifa.id),
                      )
                    }}
                  </span>
                </th>
                <td v-for="porte in PORTES" :key="porte" class="tabela__num clinic-value">
                  {{ formato.moeda(tarifa.diariaPorPorte[porte]) }}
                </td>
                <td class="tabela__num clinic-value">{{ tarifa.acompanhantePercentual }}%</td>
                <td class="tabela__acao">
                  <Button
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    :aria-label="t('hotel.acomodacoes.preco.editar')"
                    :title="t('hotel.acomodacoes.preco.editar')"
                    @click="abrirTarifa(tarifa)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ========================================================= temporadas -->
      <section
        v-else
        id="partner-panel-temporadas"
        class="painel"
        role="tabpanel"
        aria-labelledby="partner-tab-temporadas"
      >
        <ul class="temporadas">
          <!--
            A lista é das temporadas **cadastradas**, não das materializadas.
            A virada do ano vira três faixas no cálculo de preço, e mostrá-las aqui repetia "Fim de
            ano" três vezes, com intervalos que se contradiziam aos olhos de quem lê.
          -->
          <li v-for="temporada in hotelStore.temporadasSazonais" :key="temporada.id">
            <button type="button" class="temporada" @click="abrirTemporada(temporada)">
              <span class="temporada__cabeca">
                <strong class="temporada__nome">{{ temporada.nome }}</strong>
                <HotelSelo :rotulo="`+${temporada.acrescimoPercentual}%`" tom="acento" />
              </span>

              <FaixaDoAno :inicio="temporada.inicioMesDia" :fim="temporada.fimMesDia" />

              <span class="temporada__quando clinic-value">
                {{ formato.mesDia(temporada.inicioMesDia) }} →
                {{ formato.mesDia(temporada.fimMesDia) }}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <AcomodacaoDialog
      :aberto="acomodacaoAberta"
      :acomodacao="acomodacaoEmEdicao"
      :bloco-sugerido="corredorSugerido"
      :tipos="hotelStore.tiposDeAcomodacao"
      :blocos="hotelStore.blocos"
      :tarifas="hotelStore.tarifas"
      :salvando="salvando"
      :erro="erro"
      @fechar="acomodacaoAberta = false"
      @salvar="
        (payload) =>
          mudar(
            () =>
              acomodacaoEmEdicao
                ? acomodacaoRepository.editar({ ...payload, acomodacaoId: acomodacaoEmEdicao.id })
                : acomodacaoRepository.criar(payload),
            () => (acomodacaoAberta = false),
          )
      "
      @desativar="
        (payload) =>
          mudar(
            () =>
              acomodacaoRepository.desativar({
                ...payload,
                acomodacaoId: acomodacaoEmEdicao?.id ?? '',
              }),
            () => (acomodacaoAberta = false),
          )
      "
      @reativar="
        () =>
          mudar(
            () => acomodacaoRepository.reativar(acomodacaoEmEdicao?.id ?? ''),
            () => (acomodacaoAberta = false),
          )
      "
      @remover="
        () =>
          mudar(
            () => acomodacaoRepository.remover(acomodacaoEmEdicao?.id ?? ''),
            () => (acomodacaoAberta = false),
          )
      "
    />

    <CorredorDialog
      :aberto="corredorAberto"
      :corredor="corredorEmEdicao"
      :vagas="
        corredorEmEdicao
          ? hotelStore.acomodacoes.filter((item) => item.blocoId === corredorEmEdicao?.id).length
          : 0
      "
      :salvando="salvando"
      :erro="erro"
      @fechar="corredorAberto = false"
      @salvar="
        (payload) =>
          mudar(
            () =>
              corredorEmEdicao
                ? catalogoRepository.editarBloco({ ...payload, blocoId: corredorEmEdicao.id })
                : catalogoRepository.criarBloco(payload),
            () => (corredorAberto = false),
          )
      "
      @remover="
        () =>
          mudar(
            () => catalogoRepository.removerBloco(corredorEmEdicao?.id ?? ''),
            () => (corredorAberto = false),
          )
      "
    />

    <TarifaDialog
      :aberto="tarifaAberta"
      :tarifa="tarifaEmEdicao"
      :em-uso="tarifaEmEdicao ? usosDaTarifa(tarifaEmEdicao.id) : 0"
      :salvando="salvando"
      :erro="erro"
      @fechar="tarifaAberta = false"
      @salvar="
        (payload) =>
          mudar(
            () =>
              tarifaEmEdicao
                ? catalogoRepository.editarTarifa({ ...payload, tarifaId: tarifaEmEdicao.id })
                : catalogoRepository.criarTarifa(payload),
            () => (tarifaAberta = false),
          )
      "
      @remover="
        () =>
          mudar(
            () => catalogoRepository.removerTarifa(tarifaEmEdicao?.id ?? ''),
            () => (tarifaAberta = false),
          )
      "
    />

    <TipoDialog
      :aberto="tipoAberto"
      :tipo="tipoEmEdicao"
      :em-uso="tipoEmEdicao ? usosDoTipo(tipoEmEdicao.id) : 0"
      :salvando="salvando"
      :erro="erro"
      @fechar="tipoAberto = false"
      @salvar="
        (payload) =>
          mudar(
            () =>
              tipoEmEdicao
                ? catalogoRepository.editarTipo({ ...payload, tipoId: tipoEmEdicao.id })
                : catalogoRepository.criarTipo(payload),
            () => (tipoAberto = false),
          )
      "
      @remover="
        () =>
          mudar(
            () => catalogoRepository.removerTipo(tipoEmEdicao?.id ?? ''),
            () => (tipoAberto = false),
          )
      "
    />

    <TemporadaDialog
      :aberto="temporadaAberta"
      :temporada="temporadaEmEdicao"
      :salvando="salvando"
      :erro="erro"
      @fechar="temporadaAberta = false"
      @salvar="
        (payload) =>
          mudar(
            () =>
              temporadaEmEdicao
                ? catalogoRepository.editarTemporada({
                    ...payload,
                    temporadaId: temporadaEmEdicao.id,
                  })
                : catalogoRepository.criarTemporada(payload),
            () => (temporadaAberta = false),
          )
      "
      @remover="
        () =>
          mudar(
            () => catalogoRepository.removerTemporada(temporadaEmEdicao?.id ?? ''),
            () => (temporadaAberta = false),
          )
      "
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />

    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <Button
          :label="acaoDaAba.rotulo"
          icon="pi pi-plus"
          size="small"
          @click="acaoDaAba.abrir()"
        />
      </span>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.cadastro {
  display: grid;
  gap: var(--clinic-space-4);
}

/*
 * A faixa de abas abraça as três, em vez de atravessar a página.
 *
 * O `PartnerSectionTabs` é do portal e lá a faixa ocupa a largura toda — o que, com três abas
 * curtas, deixa uma banda de acento de mais de mil pixels com conteúdo só no começo dela. Sálvia é
 * a tinta desta casa, não o papel, e a regra vale também para a moldura de um controle.
 *
 * O ajuste é local de propósito: as telas do portal continuam como estavam.
 */
.cadastro :deep(.partner-tabs__list .p-tablist-tab-list) {
  width: fit-content;
  max-width: 100%;
}

/* ---------------------------------------------------------------- painéis */

.painel {
  display: grid;
  gap: var(--clinic-space-4);
}

/*
 * A ação de criar fica no alto do painel e alinhada à direita.
 *
 * Com as três abas, cada painel governa um cadastro só — então a ação dele não precisa mais de
 * cabeçalho, disco e frase para dizer a que cadastro pertence. Quem diz é a aba acesa.
 */
.painel__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

/* --------------------------------------------------------------- corredor */

.corredor {
  display: grid;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.corredor__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.corredor__marca {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--clinic-line);
  border-radius: 0.6rem;
  color: var(--clinic-muted);
}

.corredor__marca :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
}

.corredor__nome {
  margin: 0;
  font-size: var(--clinic-font-value);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.corredor__tipo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.corredor__conta {
  padding-inline: 0.45rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

/*
 * As ações ficam sempre visíveis, e não só no `hover`: num cadastro que se usa três vezes por ano,
 * esconder o gesto atrás do ponteiro é esconder que ele existe — e quem abre esta tela veio
 * justamente para mexer.
 */
.corredor__acoes {
  display: flex;
  align-items: center;
  margin-inline-start: auto;
  gap: 0.1rem;
}

/* ------------------------------------------------------------------ vagas */

.grade {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  list-style: none;
}

.vaga {
  display: grid;
  width: 100%;
  height: 100%;
  align-content: start;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: border-color 140ms ease;
}

.vaga:hover,
.vaga:focus-visible {
  border-color: var(--clinic-line-strong);
  outline: none;
}

.vaga:focus-visible {
  box-shadow: var(--clinic-focus-ring);
}

/*
 * Parada: tracejado e superfície afundada. A moldura descontínua é canal de **forma** — ela diz
 * "isto não está em operação" antes de qualquer cor, e continua dizendo em escala de cinza.
 */
.vaga--parada {
  border-style: dashed;
  border-color: var(--clinic-line);
  background: var(--clinic-surface-soft);
}

.vaga__cabeca {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.vaga__marca {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
}

.vaga--parada .vaga__marca {
  background: var(--clinic-surface);
}

.vaga__marca :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
}

.vaga__quem {
  display: grid;
  min-width: 0;
  gap: 0;
}

.vaga__nome {
  font-size: var(--clinic-font-value);
  font-weight: 800;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vaga__perfil {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.vaga__recursos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.vaga__recurso {
  display: inline-grid;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  border-radius: 0.4rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-faint);
}

.vaga__recurso :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

/* O nome do recurso fica para o leitor de tela: na tela, o desenho e a dica bastam. */
.vaga__recursoNome {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.vaga__pe {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-block-start: var(--clinic-space-2);
  border-block-start: 1px solid var(--clinic-line-soft);
  gap: var(--clinic-space-2);
}

.vaga__tabela {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.vaga__preco {
  color: var(--clinic-text);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.vaga__parada {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.vaga__parada :deep(svg) {
  width: 0.9rem;
  height: 0.9rem;
}

/* A vaga que ainda não existe: tracejada e sem peso, para não competir com as que existem. */
.vaga--nova {
  display: flex;
  align-items: center;
  justify-content: center;
  min-block-size: 6rem;
  border: 1px dashed var(--clinic-line-strong);
  gap: var(--clinic-space-2);
  background: transparent;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.vaga--nova:hover {
  background: var(--clinic-surface-soft);
  color: var(--clinic-accent-strong);
}

/* ------------------------------------------------------------------ tipos */

/*
 * Os tipos numa moldura só, com filete entre irmãos.
 *
 * São poucos e curtos — nome, uso e três gestos. Um cartão por tipo daria a cada um o peso de um
 * corredor inteiro, e o cadastro que a casa mexe uma vez por ano passaria a parecer mais
 * importante que as vinte vagas que ela olha todo dia.
 */
.tipos {
  margin: 0;
  padding: 0;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  list-style: none;
  overflow: hidden;
}

.tipo {
  display: flex;
  align-items: center;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  gap: var(--clinic-space-3);
}

.tipo + .tipo {
  border-block-start: 1px solid var(--clinic-line-soft);
}

.tipo__marca {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
}

.tipo__marca :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.tipo__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0;
}

.tipo__nome {
  font-size: var(--clinic-font-value);
  font-weight: 800;
  letter-spacing: -0.01em;
}

/* Quantas vagas usam o tipo: é o número que decide se dá para apagá-lo. */
.tipo__usos {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.tipo__acoes {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.1rem;
}

/* ----------------------------------------------------------------- preços */

.tabelaRolagem {
  overflow-x: auto;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--clinic-font-label);
}

.tabela th,
.tabela td {
  padding: 0.45rem 0.6rem;
  text-align: start;
  white-space: nowrap;
}

.tabela thead th {
  border-bottom: 1px solid var(--clinic-line);
  color: var(--clinic-faint);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tabela tbody tr + tr th,
.tabela tbody tr + tr td {
  border-top: 1px solid var(--clinic-line-soft);
}

.tabela tbody tr:hover th,
.tabela tbody tr:hover td {
  background: var(--clinic-surface-soft);
}

.tabela tbody th {
  font-weight: 800;
}

/* Quantas vagas usam esta tabela: é o número que decide se dá para apagá-la. */
.tabela__usos {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 400;
}

.tabela__num {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.tabela__acao {
  width: 1px;
  text-align: end;
}

.tabela__oculto {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------- temporadas */

.temporadas {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  list-style: none;
}

.temporada {
  display: grid;
  width: 100%;
  height: 100%;
  align-content: start;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: border-color 140ms ease;
}

.temporada:hover,
.temporada:focus-visible {
  border-color: var(--clinic-line-strong);
  outline: none;
}

.temporada:focus-visible {
  box-shadow: var(--clinic-focus-ring);
}

.temporada__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.temporada__nome {
  font-size: var(--clinic-font-value);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.temporada__quando {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .vaga,
  .temporada {
    transition: none;
  }
}

/* Caixa-alta rastreada não roda em árabe: o `letter-spacing` desconecta as ligaduras. */
[dir='rtl'] .tabela thead th {
  letter-spacing: normal;
  text-transform: none;
}
</style>
