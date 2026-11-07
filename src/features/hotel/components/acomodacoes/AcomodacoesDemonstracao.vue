<script setup lang="ts">
/**
 * A casa — a planta do hotel e o cadastro de tudo que cerca uma acomodação.
 *
 * **O sistema não adivinha como o hotel é.** Quem monta a casa é a operação: cria os corredores,
 * cadastra as vagas, dá nome, põe preço e diz quando dezembro fica caro. Esta tela existe para que
 * nada disso dependa de ninguém — nem de um chamado de suporte, nem de um deploy.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * - **A planta** abre a tela: um cômodo por corredor, na ordem física da casa, com "x de y
 *   ocupadas" e quantas sobram. Cada acomodação é um ladrilho — nome, tipo, quem cabe (espécie,
 *   porte, quantos) e, no meio, **quem está nela agora**, com o rosto; livre fica calma, e a fora
 *   de operação fica hachurada, com o motivo e há quantos dias. O ladrilho abre o cadastro; o
 *   rosto abre a estadia de quem está lá.
 * - **Tipos, tarifas e temporadas** continuam a um toque, num seletor de vista logo abaixo das
 *   abas do destino. Não são abas de navegação — a URL não muda —, são outras vistas do mesmo
 *   cadastro. A ação cheia do alto segue a vista: "Nova acomodação" na planta, "Nova tabela" nas
 *   tarifas.
 *
 * As temporadas mantêm a régua do ano. "01/07 → 31/07" contra "20/12 → 05/01" obriga a montar o
 * calendário de cabeça para saber quando cai, quanto dura e se encosta na outra — e é o tipo de
 * conta que se erra na hora de dar desconto.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import AcomodacaoDialog from '@/features/hotel/components/acomodacoes/AcomodacaoDialog.vue'
import CorredorDialog from '@/features/hotel/components/acomodacoes/CorredorDialog.vue'
import FaixaDoAno from '@/features/hotel/components/acomodacoes/FaixaDoAno.vue'
import TarifaDialog from '@/features/hotel/components/acomodacoes/TarifaDialog.vue'
import TemporadaDialog from '@/features/hotel/components/acomodacoes/TemporadaDialog.vue'
import TipoDialog from '@/features/hotel/components/acomodacoes/TipoDialog.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { TemporadaSazonal } from '@/features/hotel/data/fixtures'
import {
  acomodacaoRepository,
  CadastroRecusadoError,
  catalogoRepository,
  type HospedeNaCasa,
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
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']

/*
 * Os mapas de desenho, todos `Record<…>` fechado: acrescentar um tipo ao domínio sem dar ícone a
 * ele passa a ser erro de compilação, e não um quadrado vazio descoberto em produção.
 *
 * O nome do tipo e do corredor é cadastro da casa; o que continua nosso é a biblioteca de formas
 * entre as quais ela escolhe. A palavra é dela, o traço é nosso.
 */
const ICONE_DO_DESENHO: Record<IconeDeAcomodacao, string> = {
  casa: 'ph ph-house-line',
  cama: 'ph ph-bed',
  gato: 'ph ph-cat',
  cao: 'ph ph-dog',
  grupo: 'ph ph-users-three',
  escudo: 'ph ph-shield-check',
  arvore: 'ph ph-tree',
  passaro: 'ph ph-bird',
  coelho: 'ph ph-rabbit',
}

const ICONE_DO_RECURSO: Record<RecursoDaAcomodacao, string> = {
  camera: 'ph ph-video-camera',
  climatizacao: 'ph ph-snowflake',
  'area-externa': 'ph ph-tree',
  'piso-aquecido': 'ph ph-thermometer',
  janela: 'ph ph-sun',
}

/** O desenho de uma vaga, pelo tipo que ela aponta. `casa` é o fallback de tipo removido. */
function iconeDaVaga(tipoId: string) {
  return ICONE_DO_DESENHO[hotelStore.tipoDeAcomodacao(tipoId)?.icone ?? 'casa']
}

/** O nome do tipo, cadastrado pela casa. */
function nomeDoTipo(tipoId: string) {
  return hotelStore.tipoDeAcomodacao(tipoId)?.nome ?? ''
}

const salvando = ref(false)
const erro = ref('')

/**
 * Qual vista do cadastro está aberta.
 *
 * Mora no componente e não na rota: é preferência de leitura dentro de uma tela só, e uma aba na
 * URL faria "voltar" significar "troque de vista", que não é o que a seta do navegador promete.
 */
type Aba = 'casa' | 'tipos' | 'tarifas' | 'temporadas'

const aba = ref<Aba>('casa')

const ICONE_DA_ABA: Record<Aba, string> = {
  casa: 'ph ph-squares-four',
  tipos: 'ph ph-bed',
  tarifas: 'ph ph-tag',
  temporadas: 'ph ph-calendar-star',
}

/*
 * O slot `#option` do `SelectButton` entrega a opção como `any`; o acessor recebe esse `any` num
 * parâmetro tipado, o que mantém o mapa exaustivo.
 */
function iconeDaAba(valor: Aba) {
  return ICONE_DA_ABA[valor]
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

/**
 * Quem está em cada acomodação agora.
 *
 * Os hóspedes vêm da mesma leitura da lista de Hóspedes. A planta não espera por eles: o
 * cadastro desenha primeiro, e o rosto entra no ladrilho quando chega — uma falha aqui deixa a
 * planta sem rostos, não sem planta.
 */
async function carregarOcupacao() {
  await hospedagem.carregarHospedes()
}

onMounted(async () => {
  await hotelStore.carregar()
  await carregarOcupacao()
})

watch(
  () => hotelStore.revisao,
  () => void carregarOcupacao(),
)

const ocupantePorAcomodacao = computed(() => {
  const mapa = new Map<string, HospedeNaCasa>()

  for (const hospede of hospedagem.hospedes) {
    mapa.set(hospede.hospedagem.acomodacaoId, hospede)
  }

  return mapa
})

function ocupante(acomodacao: Acomodacao) {
  return ocupantePorAcomodacao.value.get(acomodacao.id) ?? null
}

type EstadoDoLadrilho = 'ocupada' | 'livre' | 'parada'

function estadoDe(acomodacao: Acomodacao): EstadoDoLadrilho {
  if (ocupante(acomodacao)) {
    return 'ocupada'
  }

  return acomodacao.ativa ? 'livre' : 'parada'
}

/*
 * Todos os corredores, inclusive os vazios.
 *
 * Corredor vazio é um estado legítimo do cadastro: é onde se está prestes a pôr vaga. Filtrá-lo
 * faz o corredor recém-criado sumir — e a pessoa criá-lo de novo.
 */
const porCorredor = computed(() =>
  hotelStore.blocos.map((bloco) => {
    const acomodacoes = hotelStore.acomodacoes
      .filter((item) => item.blocoId === bloco.id)
      .sort((uma, outra) => uma.nome.localeCompare(outra.nome, undefined, { numeric: true }))
    const ativas = acomodacoes.filter((item) => item.ativa).length
    const ocupadas = acomodacoes.filter((item) => ocupante(item) !== null).length

    return {
      bloco,
      acomodacoes,
      ativas,
      ocupadas,
      livres: Math.max(0, ativas - ocupadas),
    }
  }),
)

const paradas = computed(() => hotelStore.acomodacoes.filter((item) => !item.ativa).length)

const lugares = computed(() =>
  hotelStore.acomodacoes.reduce((soma, item) => soma + (item.ativa ? item.capacidade : 0), 0),
)

const ocupadasAgora = computed(
  () => hotelStore.acomodacoes.filter((item) => ocupante(item) !== null).length,
)

const livresAgora = computed(
  () => hotelStore.acomodacoes.filter((item) => item.ativa && ocupante(item) === null).length,
)

/**
 * A casa numa frase: o tamanho dela e como está agora.
 *
 * "20 acomodações cadastradas, 39 lugares, 5 ocupadas agora, 14 livres, 1 fora de operação." O
 * tamanho e o agora na mesma linha porque é a pergunta de quem abre o cadastro para mexer: o que
 * eu tenho, e o que eu posso tirar do ar sem desalojar ninguém.
 */
const fraseDaCasa = computed(() => {
  const total = hotelStore.acomodacoes.length
  /*
   * "Ocupadas agora" e "livres" vêm de quem está na casa. Se essa leitura falhou, a frase dizia "0
   * ocupadas agora, 19 livres" com cinco hóspedes dentro: sem ela, fica só o tamanho da casa.
   */
  const semOcupacao = Boolean(hospedagem.erro)
  const partes = [
    t('hotel.acomodacoes.resumo', { total }, total),
    t('hotel.acomodacoes.lugares', { total: lugares.value }, lugares.value),
    ...(semOcupacao
      ? []
      : [
          t('hotel.casa.resumo.ocupadas', { total: ocupadasAgora.value }, ocupadasAgora.value),
          t('hotel.casa.resumo.livres', { total: livresAgora.value }, livresAgora.value),
        ]),
  ]

  if (paradas.value > 0) {
    partes.push(t('hotel.acomodacoes.paradas', { total: paradas.value }))
  }

  return t('clinico.internacao.nova.resumo.frase', {
    texto: partes.reduce((frase, parte) =>
      t('clinico.internacao.nova.resumo.lista', { a: frase, b: parte }),
    ),
  })
})

/** As quatro vistas do cadastro, cada uma com quantos itens tem. */
const opcoesDeVista = computed(() => [
  {
    valor: 'casa' as const,
    rotulo: t('hotel.casa.vista.planta'),
    total: hotelStore.acomodacoes.length,
  },
  {
    valor: 'tipos' as const,
    rotulo: t('hotel.acomodacoes.tipos'),
    total: hotelStore.tiposDeAcomodacao.length,
  },
  {
    valor: 'tarifas' as const,
    rotulo: t('hotel.acomodacoes.tarifas'),
    total: hotelStore.tarifas.length,
  },
  {
    valor: 'temporadas' as const,
    rotulo: t('hotel.acomodacoes.temporadas'),
    total: hotelStore.temporadasSazonais.length,
  },
])

/** A frase que explica a vista aberta, ao lado do seletor. A planta se explica sozinha. */
const descricaoDaVista = computed(() => {
  if (aba.value === 'tipos') {
    return t('hotel.acomodacoes.tipo.resumo')
  }

  if (aba.value === 'tarifas') {
    return t('hotel.acomodacoes.preco.resumo')
  }

  if (aba.value === 'temporadas') {
    return t('hotel.acomodacoes.temporada.resumo')
  }

  return t('hotel.casa.vista.plantaDescricao')
})

/**
 * A ação do cabeçalho segue a vista.
 *
 * Um "Nova acomodação" fixo no topo mentia nas outras vistas: quem está olhando a tabela de preço
 * e toca no botão de criar espera criar uma tabela. O rótulo sai de chamadas explícitas a `t()` e
 * não de uma chave montada com o nome da vista — chave por interpolação some do varredor de
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

/** Quem cabe, numa linha: o tipo, as espécies e até que porte. */
function quemCabe(acomodacao: Acomodacao) {
  const intl = INTL_LOCALE[locale.value as Locale]

  return [
    nomeDoTipo(acomodacao.tipoId),
    acomodacao.especiesAceitas.map((especie) => formato.especie(especie)).join(', '),
    t('hotel.casa.ladrilho.ate', {
      porte: formato.porte(acomodacao.porteMaximo).toLocaleLowerCase(intl),
    }),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * A saída de quem está lá: "sai hoje às 16:30" ou "sai 24/10 · 10:00". Passada a hora (com a meia
 * hora de folga do Painel), o atraso: às 20h a casa dizia "sai hoje às 16:30" de quem ainda estava
 * na baia.
 */
function saidaDe(hospede: HospedeNaCasa) {
  const saida = hospede.hospedagem.saidaPrevistaEm
  const atraso = Math.floor((Date.parse(hotelClock.nowIso()) - Date.parse(saida)) / 60_000)

  /* Curta, porque o cartão corta: "sai 16:30 · atrasou 3 h". */
  if (atraso > 30) {
    return `${t('hotel.hoje.hospedes.sai', { quando: formato.hora(saida) })} · ${t(
      'hotel.hospedes.foco.atrasou',
      { tempo: formato.duracao(atraso >= 60 ? Math.floor(atraso / 60) * 60 : atraso) },
    )}`
  }

  return t('hotel.hoje.hospedes.sai', {
    quando:
      saida.slice(0, 10) === hotelClock.today()
        ? t('hotel.hospedes.cartao.hojeAs', { hora: formato.hora(saida) })
        : formato.quando(saida),
  })
}

function rotaDaEstadia(hospedagemId: string) {
  return `/hotel/hospedagem/${hospedagemId}`
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

const vazio = computed(
  () =>
    !hotelStore.carregando &&
    !hotelStore.erro &&
    hotelStore.pronto &&
    hotelStore.blocos.length === 0,
)

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
    alvo: '.ladrilho--parada',
    titulo: t('hotel.tour.acomodacoes.parada.titulo'),
    texto: t('hotel.tour.acomodacoes.parada.texto'),
  },
  /*
   * O passo aponta para o seletor de vistas, e não para a tabela de preço: a tabela só existe no
   * DOM quando a vista dela está acesa, e o `HotelTour` descarta em silêncio o passo cujo alvo não
   * está na tela. O seletor é o que continua verdadeiro nas quatro.
   */
  {
    alvo: '.vistas',
    titulo: t('hotel.tour.acomodacoes.tarifas.titulo'),
    texto: t('hotel.tour.acomodacoes.tarifas.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela"
    :carregando="hotelStore.carregando && hotelStore.acomodacoes.length === 0"
    :erro="hotelStore.erro ? t(hotelStore.erro) : ''"
    :vazio="vazio"
    :vazio-titulo="t('hotel.casa.vazioTitulo')"
    :vazio-descricao="t('hotel.casa.vazioDescricao')"
    :vazio-acao="t('hotel.acomodacoes.corredor.novo')"
    vazio-icone="ph ph-house-line"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="hotelStore.carregar(true)"
    @acao-do-vazio="abrirCorredor(null)"
  >
    <template #resumo>
      <span aria-live="polite">{{ fraseDaCasa }}</span>
    </template>

    <template #acoes>
      <Button type="button" icon="ph ph-plus" :label="acaoDaAba.rotulo" @click="acaoDaAba.abrir()" />
    </template>

    <div class="casa">
      <!--
        As outras vistas do cadastro, num seletor e não em abas: as abas do alto são o destino
        (Acomodações | Rotina padrão), e uma segunda fileira de abas logo abaixo faria a pessoa
        perder qual das duas mudou a URL.
      -->
      <div class="barra">
        <SelectButton
          v-model="aba"
          class="vistas"
          :options="opcoesDeVista"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.acomodacoes.abasRotulo')"
        >
          <template #option="{ option }">
            <i :class="iconeDaAba(option.valor)" class="vista__icone" aria-hidden="true" />
            <span class="vista__rotulo">{{ option.rotulo }}</span>
            <span class="ui-contagem vista__conta">{{ option.total }}</span>
          </template>
        </SelectButton>

        <p class="barra__descricao">{{ descricaoDaVista }}</p>
      </div>

      <!-- ============================================================ a planta -->
      <div v-if="aba === 'casa'" class="planta">
        <section
          v-for="(grupo, indice) in porCorredor"
          :key="grupo.bloco.id"
          class="corredor"
          :style="{ '--corredor-vagas': Math.max(1, grupo.acomodacoes.length) }"
          :aria-labelledby="`corredor-${grupo.bloco.id}`"
        >
          <header class="corredor__cabeca">
            <span class="corredor__icone" aria-hidden="true">
              <i :class="ICONE_DO_DESENHO[grupo.bloco.icone]" />
            </span>

            <span class="corredor__titulos">
              <h2 :id="`corredor-${grupo.bloco.id}`" class="corredor__nome">
                {{ grupo.bloco.nome }}
              </h2>
              <span class="corredor__conta ui-num">
                {{
                  t('hotel.casa.corredor.ocupadas', {
                    ocupadas: grupo.ocupadas,
                    ativas: grupo.ativas,
                  })
                }}
              </span>
            </span>

            <span
              v-if="grupo.acomodacoes.length > 0"
              class="ui-selo corredor__vagas"
              :class="grupo.livres > 0 ? 'ui-selo--ok' : 'ui-selo--contorno'"
            >
              {{
                grupo.livres > 0
                  ? t('hotel.casa.resumo.livres', { total: grupo.livres }, grupo.livres)
                  : t('hotel.casa.corredor.cheio')
              }}
            </span>

            <!--
              As ações do corredor ficam sempre à vista e sem rótulo: são gestos de arrumação, e um
              rótulo em cada uma faria o cabeçalho competir com o nome do corredor.
            -->
            <span class="corredor__acoes">
              <!--
                Criar a vaga onde ela vai morar: o diálogo já abre neste corredor. No corredor
                estreito fica só o "+" — um botão só-ícone de verdade, e não o rotulado com a
                palavra escondida, que guardava o vão do rótulo e deixava o "+" fora do centro.
              -->
              <template v-if="grupo.acomodacoes.length > 0">
                <Button
                  type="button"
                  class="corredor__nova corredor__nova--rotulo"
                  icon="ph ph-plus"
                  :label="t('hotel.acomodacoes.nova')"
                  :aria-label="t('hotel.casa.corredor.novaEm', { corredor: grupo.bloco.nome })"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="abrirAcomodacao(null, grupo.bloco.id)"
                />
                <Button
                  type="button"
                  class="corredor__nova corredor__nova--icone"
                  icon="ph ph-plus"
                  :aria-label="t('hotel.casa.corredor.novaEm', { corredor: grupo.bloco.nome })"
                  :title="t('hotel.acomodacoes.nova')"
                  severity="secondary"
                  outlined
                  rounded
                  @click="abrirAcomodacao(null, grupo.bloco.id)"
                />
              </template>
              <Button
                type="button"
                icon="ph ph-arrow-up"
                severity="secondary"
                text
                rounded
                :disabled="indice === 0 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.subir')"
                :title="t('hotel.acomodacoes.corredor.subir')"
                @click="moverCorredor(grupo.bloco.id, 'sobe')"
              />
              <Button
                type="button"
                icon="ph ph-arrow-down"
                severity="secondary"
                text
                rounded
                :disabled="indice === porCorredor.length - 1 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.descer')"
                :title="t('hotel.acomodacoes.corredor.descer')"
                @click="moverCorredor(grupo.bloco.id, 'desce')"
              />
              <Button
                type="button"
                icon="ph ph-pencil-simple"
                severity="secondary"
                text
                rounded
                :aria-label="t('hotel.acomodacoes.corredor.editar')"
                :title="t('hotel.acomodacoes.corredor.editar')"
                @click="abrirCorredor(grupo.bloco)"
              />
            </span>
          </header>

          <ul class="corredor__vagas-lista">
            <li v-for="acomodacao in grupo.acomodacoes" :key="acomodacao.id">
              <article
                class="ladrilho"
                :class="[
                  `ladrilho--${estadoDe(acomodacao)}`,
                  estadoDe(acomodacao) === 'ocupada' ? 'ui-marca ui-marca--lugar' : '',
                ]"
              >
                <header class="ladrilho__topo">
                  <span class="ladrilho__desenho" aria-hidden="true">
                    <i :class="iconeDaVaga(acomodacao.tipoId)" />
                  </span>

                  <span class="ladrilho__titulos">
                    <!--
                      O nome é o botão que abre o cadastro, e o `::after` dele cobre o ladrilho
                      inteiro: a superfície toda vira alvo sem um `@click` no `<article>`, que
                      dispararia junto com o rosto do hóspede.
                    -->
                    <button
                      type="button"
                      class="ladrilho__abrir"
                      :aria-label="t('hotel.casa.ladrilho.editar', { nome: acomodacao.nome })"
                      @click="abrirAcomodacao(acomodacao)"
                    >
                      {{ acomodacao.nome }}
                    </button>
                    <span class="ladrilho__perfil">{{ quemCabe(acomodacao) }}</span>
                  </span>

                </header>

                <!-- Quem está lá agora: o rosto abre a estadia. -->
                <RouterLink
                  v-if="ocupante(acomodacao)"
                  class="ladrilho__hospede"
                  :to="rotaDaEstadia(ocupante(acomodacao)!.hospedagem.id)"
                  :aria-label="
                    t('hotel.hospedes.acao.abrir', { pet: ocupante(acomodacao)!.petNome })
                  "
                >
                  <span class="ladrilho__rostos">
                    <PetAvatar
                      :nome="ocupante(acomodacao)!.petNome"
                      :iniciais="ocupante(acomodacao)!.petIniciais"
                      :especie="ocupante(acomodacao)!.petEspecie"
                      :foto-url="ocupante(acomodacao)!.petFotoUrl"
                      tamanho="md"
                    />
                    <PetAvatar
                      v-if="ocupante(acomodacao)!.acompanhante"
                      class="ladrilho__segundo"
                      :nome="ocupante(acomodacao)!.acompanhante!.nome"
                      :iniciais="ocupante(acomodacao)!.acompanhante!.iniciais"
                      :especie="ocupante(acomodacao)!.acompanhante!.especie"
                      :foto-url="ocupante(acomodacao)!.acompanhante!.fotoUrl"
                      tamanho="xs"
                    />
                  </span>
                  <span class="ladrilho__quem">
                    <strong>
                      {{ ocupante(acomodacao)!.petNome }}
                      <template v-if="ocupante(acomodacao)!.acompanhante">
                        <span class="ladrilho__com">
                          {{
                            t('hotel.hospedes.cartao.com', {
                              pet: ocupante(acomodacao)!.acompanhante!.nome,
                            })
                          }}
                        </span>
                      </template>
                    </strong>
                    <small>{{ saidaDe(ocupante(acomodacao)!) }}</small>
                  </span>
                  <i class="ph ph-caret-right ladrilho__seta" aria-hidden="true" />
                </RouterLink>

                <!-- Há quanto tempo é a informação, não o rótulo de "fora de operação". -->
                <p v-else-if="!acomodacao.ativa" class="ladrilho__parada">
                  <i class="ph ph-wrench" aria-hidden="true" />
                  <span>
                    <strong>{{ t('hotel.impedimento.inativa') }}</strong>
                    <small>
                      {{ formato.motivoInativa(acomodacao.motivoInativa ?? 'outro') }}
                      <template v-if="paradaHaDias(acomodacao) !== null">
                        · {{ formato.haDias(paradaHaDias(acomodacao) ?? 0) }}
                      </template>
                    </small>
                    <small v-if="acomodacao.detalheInativa" class="ladrilho__detalhe">
                      {{ acomodacao.detalheInativa }}
                    </small>
                  </span>
                </p>

                <p v-else class="ladrilho__livre">
                  <i class="ph ph-door-open" aria-hidden="true" />
                  <strong>{{ t('hotel.casa.ladrilho.livreAgora') }}</strong>
                </p>

                <!--
                  O pé em duas colunas de duas linhas: à esquerda quantos cabem e, embaixo, os
                  recursos numa fileira só; à direita a diária e, embaixo, a tabela. Os recursos
                  espremidos entre os dois quebravam em 2 × 2 e desalinhavam o pé dos vizinhos.
                -->
                <footer class="ladrilho__pe">
                  <span class="ladrilho__capacidade">
                    <span class="ladrilho__cabem">
                      <i class="ph ph-paw-print" aria-hidden="true" />
                      {{
                        t(
                          'hotel.acomodacoes.cabem',
                          { total: acomodacao.capacidade },
                          acomodacao.capacidade,
                        )
                      }}
                    </span>

                    <!-- Os recursos como desenho, com o nome na dica e para o leitor de tela. -->
                    <span v-if="acomodacao.recursos.length > 0" class="ladrilho__recursos">
                      <span
                        v-for="recurso in acomodacao.recursos"
                        :key="recurso"
                        class="ladrilho__recurso"
                        :title="formato.recurso(recurso)"
                      >
                        <i :class="ICONE_DO_RECURSO[recurso]" aria-hidden="true" />
                        <span class="oculto">{{ formato.recurso(recurso) }}</span>
                      </span>
                    </span>
                  </span>

                  <span class="ladrilho__preco">
                    <strong class="ui-num">{{ formato.moeda(diariaDe(acomodacao)) }}</strong>
                    <small>{{ hotelStore.tarifa(acomodacao.tarifaId)?.nome }}</small>
                  </span>
                </footer>
              </article>
            </li>

            <!-- O corredor vazio é o lugar de pôr a primeira vaga, e diz isso no próprio chão. -->
            <li v-if="grupo.acomodacoes.length === 0">
              <button
                type="button"
                class="ladrilho ladrilho--nova"
                @click="abrirAcomodacao(null, grupo.bloco.id)"
              >
                <i class="ph ph-plus" aria-hidden="true" />
                <span>{{ t('hotel.acomodacoes.nova') }}</span>
                <small>{{ t('hotel.casa.ladrilho.noCorredor', { corredor: grupo.bloco.nome }) }}</small>
              </button>
            </li>
          </ul>
        </section>

        <!-- O corredor novo entra onde vai ficar: no fim da casa. -->
        <button type="button" class="corredor-novo" @click="abrirCorredor(null)">
          <i class="ph ph-plus" aria-hidden="true" />
          <span>
            <strong>{{ t('hotel.acomodacoes.corredor.novo') }}</strong>
            <small>{{ t('hotel.acomodacoes.corredor.nomeDica') }}</small>
          </span>
        </button>
      </div>

      <!-- ============================================================== tipos -->
      <ul v-else-if="aba === 'tipos'" class="ui-lista ui-folha tipos">
        <li v-for="(tipo, indice) in hotelStore.tiposDeAcomodacao" :key="tipo.id">
          <div class="ui-linha tipo">
            <span class="tipo__desenho" aria-hidden="true">
              <i :class="ICONE_DO_DESENHO[tipo.icone]" />
            </span>

            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ tipo.nome }}</strong>
              <span class="ui-linha__meta">
                {{
                  t('hotel.acomodacoes.tipo.usos', { total: usosDoTipo(tipo.id) }, usosDoTipo(tipo.id))
                }}
              </span>
            </span>

            <span class="ui-linha__fim">
              <Button
                type="button"
                icon="ph ph-arrow-up"
                severity="secondary"
                text
                rounded
                :disabled="indice === 0 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.subir')"
                :title="t('hotel.acomodacoes.corredor.subir')"
                @click="moverTipo(tipo.id, 'sobe')"
              />
              <Button
                type="button"
                icon="ph ph-arrow-down"
                severity="secondary"
                text
                rounded
                :disabled="indice === hotelStore.tiposDeAcomodacao.length - 1 || salvando"
                :aria-label="t('hotel.acomodacoes.corredor.descer')"
                :title="t('hotel.acomodacoes.corredor.descer')"
                @click="moverTipo(tipo.id, 'desce')"
              />
              <!--
                Na lista estreita (celular) o "Editar" vira só o lápis: com a palavra, os três
                botões tomavam a linha e o nome do tipo saía cortado ("Isolame…").
              -->
              <Button
                type="button"
                class="tipo__editar tipo__editar--rotulo"
                icon="ph ph-pencil-simple"
                :label="t('hotel.casa.editar')"
                severity="secondary"
                outlined
                size="small"
                :aria-label="t('hotel.acomodacoes.tipo.editar')"
                @click="abrirTipo(tipo)"
              />
              <Button
                type="button"
                class="tipo__editar tipo__editar--icone"
                icon="ph ph-pencil-simple"
                severity="secondary"
                text
                rounded
                :aria-label="t('hotel.acomodacoes.tipo.editar')"
                :title="t('hotel.acomodacoes.tipo.editar')"
                @click="abrirTipo(tipo)"
              />
            </span>
          </div>
        </li>
      </ul>

      <!-- ============================================================= preços -->
      <div v-else-if="aba === 'tarifas'" class="ui-folha precos">
        <div class="precos__rolagem">
          <table class="ui-tabela tabela">
            <thead>
              <tr>
                <th scope="col">{{ t('hotel.acomodacoes.tarifa') }}</th>
                <th v-for="porte in PORTES" :key="porte" scope="col" class="tabela__num">
                  {{ formato.porte(porte) }}
                </th>
                <th scope="col" class="tabela__num">{{ t('hotel.acomodacoes.acompanhante') }}</th>
                <th scope="col">
                  <span class="oculto">{{ t('hotel.acomodacoes.preco.editar') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tarifa in hotelStore.tarifas" :key="tarifa.id">
                <th scope="row">
                  <span class="tabela__nome">
                    <strong>{{ tarifa.nome }}</strong>
                    <small>
                      {{
                        t(
                          'hotel.acomodacoes.preco.usos',
                          { total: usosDaTarifa(tarifa.id) },
                          usosDaTarifa(tarifa.id),
                        )
                      }}
                    </small>
                  </span>
                </th>
                <td v-for="porte in PORTES" :key="porte" class="tabela__num ui-num">
                  {{ formato.moeda(tarifa.diariaPorPorte[porte]) }}
                </td>
                <td class="tabela__num ui-num">{{ tarifa.acompanhantePercentual }}%</td>
                <td class="tabela__acao">
                  <Button
                    type="button"
                    icon="ph ph-pencil-simple"
                    severity="secondary"
                    text
                    rounded
                    :aria-label="t('hotel.acomodacoes.preco.editar')"
                    :title="t('hotel.acomodacoes.preco.editar')"
                    @click="abrirTarifa(tarifa)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= temporadas -->
      <!--
        A lista é das temporadas **cadastradas**, não das materializadas: a virada do ano vira três
        faixas no cálculo de preço, e mostrá-las aqui repetia "Fim de ano" três vezes, com
        intervalos que se contradiziam aos olhos de quem lê.
      -->
      <ul v-else class="ui-lista ui-folha temporadas">
        <li v-for="temporada in hotelStore.temporadasSazonais" :key="temporada.id">
          <button type="button" class="ui-linha temporada" @click="abrirTemporada(temporada)">
            <span class="temporada__icone" aria-hidden="true">
              <i class="ph ph-calendar-star" />
            </span>

            <span class="ui-linha__texto temporada__texto">
              <strong class="ui-linha__titulo">{{ temporada.nome }}</strong>
              <span class="ui-linha__meta ui-num">
                {{
                  t('hotel.casa.temporada.intervalo', {
                    de: formato.mesDia(temporada.inicioMesDia),
                    ate: formato.mesDia(temporada.fimMesDia),
                  })
                }}
              </span>
            </span>

            <span class="temporada__regua">
              <FaixaDoAno :inicio="temporada.inicioMesDia" :fim="temporada.fimMesDia" />
            </span>

            <span class="ui-linha__fim">
              <span class="ui-selo ui-selo--lugar ui-num">+{{ temporada.acrescimoPercentual }}%</span>
              <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
            </span>
          </button>
        </li>
      </ul>
    </div>

    <template #sempre>
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
    </template>
  </UiPagina>
</template>

<style scoped>
.casa {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
}

.oculto {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ a barra */

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
}

.vistas :deep(.p-togglebutton-content) {
  gap: 7px;
}

.vista__icone {
  font-size: 16px;
}

.vista__rotulo {
  white-space: nowrap;
}

.vista__conta {
  min-width: 22px;
  height: 20px;
  padding-inline: 6px;
  font-size: 11.5px;
}

.vistas :deep(.p-togglebutton-checked) .vista__conta {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.barra__descricao {
  min-width: 0;
  flex: 1 1 260px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ a planta
 * Cada corredor é um cômodo: chão levemente mais claro que o fundo, parede fina, o nome na porta.
 * As acomodações são os únicos objetos com papel — o cômodo não é cartão, é lugar.
 *
 * Os corredores correm lado a lado, cada um tão largo quanto as próprias vagas pedem
 * (`--corredor-vagas`, contando o ladrilho de criar), e quebram de linha quando não cabem.
 */
.planta {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 20px;
}

.corredor {
  --ladrilho: 228px;
  --vao: 12px;

  display: grid;
  min-width: min(100%, 280px);
  flex: var(--corredor-vagas) 1
    calc(var(--corredor-vagas) * (var(--ladrilho) + var(--vao)) + 20px);
  align-content: start;
  gap: 16px;
  padding: 16px 16px 18px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-painel);
  background: color-mix(in oklab, var(--superficie-3) 50%, transparent);
  container: corredor / inline-size;
}

/* No escuro o chão afunda pelo outro lado: um pouco mais claro que o fundo, mais escuro que o papel. */
.app-dark .corredor {
  background: color-mix(in oklab, var(--superficie-2) 40%, transparent);
}

.corredor__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-inline: 2px;
}

.corredor__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

.corredor__titulos {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.corredor__nome {
  margin: 0;
  overflow: hidden;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.corredor__conta {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.corredor__acoes {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

.corredor__nova--rotulo {
  margin-inline-end: 6px;
}

.corredor__nova--icone {
  display: none;
}

/* No corredor estreito, o "+" fica sozinho: o nome do corredor precisa do espaço. */
@container corredor (max-width: 620px) {
  .corredor__nova--rotulo {
    display: none;
  }

  .corredor__nova--icone {
    display: inline-flex;
  }
}

/* ---- o corredor que ainda não existe: tracejado, no fim da casa */

.corredor-novo {
  display: flex;
  min-width: min(100%, 280px);
  flex: 0 1 300px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 84px;
  padding: 16px;
  border: 1px dashed color-mix(in oklab, var(--linha-forte) 70%, transparent);
  border-radius: var(--raio-painel);
  background: transparent;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition:
    border-color var(--pj-tempo-curto) ease,
    background-color var(--pj-tempo-curto) ease;
}

.corredor-novo > i {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--superficie-2);
  font-size: 18px;
}

.corredor-novo span {
  display: grid;
  gap: 1px;
}

.corredor-novo strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.corredor-novo small {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.corredor-novo:hover {
  border-color: var(--pj-lugar);
  background: color-mix(in oklab, var(--pj-lugar-fundo) 60%, transparent);
}

.corredor-novo:hover > i {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.corredor-novo:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.corredor__vagas-lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--vao);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--ladrilho)), 1fr));
  list-style: none;
}

.corredor__vagas-lista > li {
  display: grid;
  min-width: 0;
}

/* ------------------------------------------------------------------ o ladrilho */

.ladrilho {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 188px;
  flex-direction: column;
  gap: 12px;
  padding: 14px 14px 12px 16px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
  color: var(--tinta);
  transition:
    border-color var(--pj-tempo-curto) ease,
    box-shadow var(--pj-tempo-curto) ease,
    transform var(--pj-tempo-curto) var(--pj-curva-chega);
}

.ladrilho:not(.ladrilho--nova):hover {
  border-color: var(--linha-media);
  box-shadow: var(--sombra-2);
  transform: translateY(-1px);
}

/* Fora de operação: hachurado e calado, mas no lugar — continua sendo uma porta da casa. */
.ladrilho--parada {
  border-style: dashed;
  border-color: var(--linha-media);
  background:
    repeating-linear-gradient(
      -45deg,
      transparent 0 9px,
      color-mix(in oklab, var(--linha) 75%, transparent) 9px 10px
    ),
    color-mix(in oklab, var(--superficie) 55%, transparent);
  box-shadow: none;
}

.ladrilho__topo {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
}

.ladrilho__desenho {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 17px;
}

.ladrilho--ocupada .ladrilho__desenho {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.ladrilho--parada .ladrilho__desenho {
  background: var(--superficie);
}

.ladrilho__titulos {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.ladrilho__abrir {
  overflow: hidden;
  padding: 0;
  border: 0;
  background: none;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-family: var(--font-dados);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.005em;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladrilho__abrir::after {
  position: absolute;
  border-radius: 14px;
  content: '';
  inset: 0;
}

.ladrilho__abrir:focus-visible {
  outline: none;
}

/* O foco contorna o ladrilho, que é o que o clique de fato aciona — não só o nome. */
.ladrilho__abrir:focus-visible::after {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.ladrilho__perfil {
  display: -webkit-box;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}


/* ---- o meio: quem está, livre ou parada */

/* O rosto fica acima do botão do ladrilho, e abre a estadia de quem está lá. */
.ladrilho__hospede {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  margin-inline: -6px;
  padding: 6px;
  border-radius: 10px;
  color: var(--tinta);
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) ease;
}

.ladrilho__hospede:hover {
  background: var(--pj-lugar-fundo);
}

.ladrilho__hospede:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 0;
}

.ladrilho__rostos {
  position: relative;
  display: inline-flex;
  flex: none;
}

.ladrilho__segundo {
  position: absolute;
  inset-block-end: -3px;
  inset-inline-end: -5px;
  box-shadow: 0 0 0 2px var(--superficie);
}

.ladrilho__quem {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.ladrilho__quem strong {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladrilho__com {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
}

.ladrilho__quem small {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladrilho__seta {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
}

[dir='rtl'] .ladrilho__seta {
  scale: -1 1;
}

.ladrilho__livre {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.ladrilho__livre > i {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border: 1px dashed color-mix(in oklab, var(--ok) 60%, var(--linha));
  border-radius: 50%;
  color: var(--ok-tinta);
  font-size: 17px;
}

.ladrilho__livre strong {
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 600;
}


.ladrilho__parada {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
}

.ladrilho__parada > i {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 16px;
}

.ladrilho__parada span {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.ladrilho__parada strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ladrilho__parada small {
  font-size: 12.5px;
}

.ladrilho__detalhe {
  display: -webkit-box;
  overflow: hidden;
  color: var(--tinta-3);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

/* ---- o pé: quantos cabem, o que tem, quanto custa */

.ladrilho__pe {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--linha);
}

/* Quantos cabem em cima e os recursos embaixo: a mesma altura de duas linhas da diária ao lado. */
.ladrilho__capacidade {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 5px;
}

.ladrilho__cabem {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
}

.ladrilho__cabem i {
  color: var(--pj-lugar-tinta);
  font-size: 14px;
}

.ladrilho__recursos {
  display: flex;
  max-width: 100%;
  gap: 3px;
}

.ladrilho__recurso {
  display: inline-grid;
  width: 20px;
  height: 20px;
  flex: none;
  place-items: center;
  border-radius: 6px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13px;
}

.ladrilho__preco {
  display: grid;
  flex: none;
  justify-items: end;
  margin-inline-start: auto;
  line-height: 1.15;
  text-align: end;
}

.ladrilho__preco strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.ladrilho__preco small {
  color: var(--tinta-3);
  font-size: 11.5px;
}

/* ---- a vaga que ainda não existe: tracejada e sem peso, para não competir com as que existem */

.ladrilho--nova {
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed color-mix(in oklab, var(--linha-forte) 70%, transparent);
  background: transparent;
  box-shadow: none;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  text-align: center;
}

.ladrilho--nova i {
  display: grid;
  width: 36px;
  height: 36px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 50%;
  background: var(--superficie-2);
  font-size: 18px;
}

.ladrilho--nova span {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ladrilho--nova small {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.ladrilho--nova:hover {
  border-color: var(--pj-lugar);
  background: color-mix(in oklab, var(--pj-lugar-fundo) 60%, transparent);
}

.ladrilho--nova:hover i {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.ladrilho--nova:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ tipos */

.tipos {
  container: tipos / inline-size;
}

.tipo {
  padding-inline: 18px 12px;
}

.tipo__editar--icone {
  display: none;
}

/* Lista estreita: o lápis sozinho, e o nome do tipo fica com a largura. */
@container tipos (max-width: 480px) {
  .tipo {
    gap: 12px;
    padding-inline: 14px 8px;
  }

  .tipo__editar--rotulo {
    display: none;
  }

  .tipo__editar--icone {
    display: inline-flex;
  }
}

.tipo__desenho {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 19px;
}

.tipo .ui-linha__fim {
  gap: 2px;
}

.tipo .ui-linha__fim :deep(.p-button-outlined) {
  margin-inline-start: 8px;
}

/* ------------------------------------------------------------------ preços */

.precos {
  overflow: hidden;
  container: precos / inline-size;
}

/* A tabela larga rola dentro da folha; a página nunca rola de lado. */
.precos__rolagem {
  overflow-x: auto;
}

.tabela {
  min-width: 760px;
}

.tabela th:first-child,
.tabela td:first-child {
  padding-inline-start: 20px;
}

/*
 * O nome da tabela é cabeçalho da linha, mas lê como a primeira célula: tinta cheia, não rótulo,
 * e o papel e o fio da linha — não o poço e o fio forte do cabeçalho de colunas, que o `th` do kit
 * trazia e faziam a primeira coluna parecer uma faixa à parte, com as linhas desencontradas.
 */
.tabela tbody th {
  height: 58px;
  border-bottom-color: var(--linha-suave);
  background: var(--superficie);
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 400;
}

.tabela tbody tr:last-child th {
  border-bottom: 0;
}

.tabela tbody tr:hover th {
  background: var(--superficie-2);
}

.tabela__nome {
  display: grid;
  gap: 1px;
}

.tabela__nome strong {
  font-weight: 600;
}

.tabela__nome small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 400;
}

.tabela__num {
  text-align: end;
  white-space: nowrap;
}

.tabela thead .tabela__num {
  text-align: end;
}

.tabela__acao {
  width: 1px;
  padding-inline: 8px 12px;
  text-align: end;
}

/*
 * Quando a tabela rola de lado (celular, janela estreita), o nome fica parado à esquerda: rolar até
 * "Gigante" sem saber de que tabela é aquele preço é ler número solto. O fio separa o que fica do
 * que passa por baixo.
 */
@container precos (max-width: 760px) {
  .tabela thead th:first-child,
  .tabela tbody th {
    position: sticky;
    inset-inline-start: 0;
    z-index: 1;
    border-inline-end: 1px solid var(--linha-suave);
  }

  .tabela th:first-child,
  .tabela td:first-child {
    padding-inline-start: 16px;
  }
}

/* ------------------------------------------------------------- temporadas */

.temporada {
  min-height: 68px;
  gap: 16px;
}

.temporada__icone {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 19px;
}

.temporada__texto {
  flex: 0 1 240px;
}

/* A régua do ano no meio da linha: quando cai, quanto dura e se encosta na outra. */
.temporada__regua {
  display: block;
  min-width: 120px;
  flex: 1 1 auto;
}

.temporada__regua :deep(.regua) {
  block-size: 8px;
}

.temporadas {
  container: temporadas / inline-size;
}

/*
 * Lista estreita: o selo e a seta ficam na linha do nome, à direita, e a régua desce para a linha
 * de baixo alinhada com o texto. Antes a linha quebrava e o selo caía sozinho embaixo do ícone.
 */
@container temporadas (max-width: 560px) {
  .temporada {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 14px;
    row-gap: 10px;
    padding-inline: 16px;
  }

  .temporada__icone {
    grid-row: 1;
  }

  .temporada__texto {
    grid-row: 1;
    grid-column: 2;
  }

  .temporada .ui-linha__fim {
    grid-row: 1;
    grid-column: 3;
  }

  .temporada__regua {
    min-width: 0;
    grid-row: 2;
    grid-column: 2 / -1;
  }
}

@media (max-width: 900px) {
  /* Os corredores um embaixo do outro, e o "Novo corredor" com a mesma largura que eles. */
  .corredor,
  .corredor-novo {
    flex-basis: 100%;
  }
}

@media (max-width: 640px) {
  /* Quatro vistas não cabem numa fileira de telefone: viram duas por linha, sem cortar a palavra. */
  .vistas {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .vistas :deep(.p-togglebutton-content) {
    justify-content: center;
  }

  .vista__icone {
    display: none;
  }

  .corredor {
    padding: 12px 10px 12px;
  }

  .corredor__cabeca {
    flex-wrap: wrap;
  }

  /* O nome do corredor fica com a linha toda; vagas e gestos descem para a de baixo. */
  .corredor__titulos {
    flex-basis: calc(100% - 46px);
  }

  .corredor__vagas {
    margin-inline-start: 44px;
  }

  .corredor__acoes {
    margin-inline-start: auto;
  }

  .ladrilho {
    min-height: 0;
  }

  .ladrilho--nova {
    min-height: 92px;
  }

  .corredor__nova--rotulo {
    display: none;
  }

  .corredor__nova--icone {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ladrilho,
  .ladrilho__hospede {
    transition: none;
  }

  .ladrilho:not(.ladrilho--nova):hover {
    transform: none;
  }
}
</style>
