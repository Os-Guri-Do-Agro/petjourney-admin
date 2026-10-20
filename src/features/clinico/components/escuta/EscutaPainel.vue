<script setup lang="ts">
/**
 * Anamnese por voz: a seção que escuta a consulta e propõe a anamnese.
 *
 * Mora **acima** da anamnese, como a pré-consulta — é informação de fora, ainda não incorporada,
 * e a moldura tracejada diz isso. A diferença é a cor: periwinkle, a tinta de "a máquina propôs
 * e ninguém aprovou". Aplicado, o valor desce para o formulário e a moldura perde a cor.
 *
 * ## Duas partes: o cabeçalho que fica e o corpo que recolhe
 *
 * O **cabeçalho** diz tudo que importa sem abrir nada: o estado (ouvindo, pausado, revisão), o
 * relógio, quem autorizou e o resumo da fase — quantos campos já apareceram e quantos pedem
 * conferência. É por isso que a seção pode recolher em qualquer fase: recolhida, ela continua
 * dizendo que o microfone está aberto.
 *
 * O **corpo** tem a conversa e o prontuário proposto. A primeira versão punha os dois lado a lado
 * o tempo todo, e o preço aparecia na revisão: uma coluna de conversa presa à esquerda com um vão
 * vazio embaixo, doze campos descendo numa coluna só à direita, e o formulário da anamnese
 * empurrado para duas telas abaixo do topo.
 *
 * ## A conversa entra e sai de cena
 *
 * Ouvindo, a conversa fica ao lado: ver a transcrição chegando é a prova de que a escuta funciona.
 * Na revisão, ela sai — a decisão é sobre os campos, e cada campo já traz a própria citação. A
 * conversa inteira volta a um clique, pelo botão do cabeçalho ou pela citação de qualquer campo,
 * que a reabre já na fala certa.
 *
 * Sem a conversa, o prontuário proposto ganha a largura toda e se arruma em duas colunas, pelos
 * mesmos grupos do formulário embaixo — o que trouxe o paciente, sinais gerais, prevenção,
 * antecedentes. Comparar os dois deixa de ser um exercício de achar onde cada campo foi parar.
 *
 * ## O que a tela diz de si mesma
 *
 * Uma nota curta no corpo diz quem transcreve e quem propõe — e que o motor é de regras, sem
 * modelo de linguagem. Enquanto for verdade que a inteligência é pequena, a tela tem de dizer
 * isso sem ninguém precisar procurar. A mesma regra já vale na proposta de rotina do hotel.
 *
 * ## O corpo mora numa gaveta à direita
 *
 * A conversa e o prontuário proposto abrem num painel lateral, sem máscara, e não mais por cima do
 * formulário: na seção larga, a revisão empurrava a anamnese duas telas para baixo, e conferir um
 * campo proposto contra o formulário era rolar para cima e para baixo. Na gaveta, o formulário
 * continua inteiro à esquerda e editável, e na anamnese fica só a linha do cabeçalho — o estado,
 * o relógio e o resumo —, que é o que diz que o microfone está aberto. Recolher é fechar a gaveta.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Na anamnese, a escuta é uma faixa tracejada no tom da máquina, com o disco do estado, o relógio,
 * quem autorizou e as ações (pausar, encerrar). Ouvindo, o disco é o único vermelho da faixa e
 * pulsa — discreta, porque é uma linha só; óbvia, porque é a única coisa que se mexe na folha. A
 * gaveta empurra o prontuário em tela larga (`useSidePanelOffset`, o mesmo das outras gavetas
 * não-modais) em vez de cobri-lo.
 *
 * ## Teclado
 *
 * A seção é `data-fora-do-teclado`: o `Enter` que avança campo no modo de digitação rápida não
 * atravessa a revisão, e o foco inicial da etapa continua caindo na queixa principal.
 */
import {
  PhListChecks,
  PhMicrophone,
  PhMicrophoneSlash,
  PhScales,
  PhShieldCheck,
  PhStethoscope,
  PhThermometer,
  PhWaveform,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { computed, nextTick, ref, useId, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'

import EscutaAutorizacao from './EscutaAutorizacao.vue'
import EscutaCampo, { type CitacaoVisivel } from './EscutaCampo.vue'
import EscutaConversa, { type GrifoDaConversa } from './EscutaConversa.vue'
import EscutaNivel from './EscutaNivel.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDaEscuta } from '../../composables/useRotulosDaEscuta'
import type { Anamnese, AntecedenteKind, Pet, Tutor } from '../../data/types'
import { CAMPOS_DA_ESCUTA, normalizar, textoDaCitacao } from '../../domain/escuta'
import type {
  CampoDaEscuta,
  NotaDaEscutaKind,
  PropostaDaEscuta,
  ValorDaEscuta,
} from '../../domain/escuta'
import { useEscutaStore } from '../../stores/escuta'

const props = defineProps<{
  encounterId: string
  anamnese: Anamnese
  pet: Pet | null
  tutor: Tutor | null
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const emit = defineEmits<{ aplicar: [patch: Partial<Anamnese>] }>()

const { t } = useI18n()
const escuta = useEscutaStore()
const formato = useClinicFormat()
const rotulos = useRotulosDaEscuta()
const idDoCorpo = useId()

const conversa = ref<InstanceType<typeof EscutaConversa> | null>(null)
const destacada = ref<string | null>(null)

const visivel = computed(() => escuta.aberta && escuta.encounterId === props.encounterId)

/**
 * Com a gaveta aberta, a página abre espaço para ela em tela larga: o prontuário estreita em vez
 * de ficar por baixo — inclusive os botões de pausar e encerrar desta linha. No tablet a gaveta
 * fica por cima, e leva esses botões no próprio cabeçalho.
 */
const gavetaAberta = computed(() => visivel.value && !escuta.recolhida)
const telaLarga = useTelaLarga(1200)

useSidePanelOffset(
  computed(() => gavetaAberta.value && telaLarga.value),
  'min(30rem, 94vw)',
)
const responsavel = computed(() => props.tutor?.nome.trim().split(/\s+/)[0] ?? '')

const modoDoCampo = computed(() => {
  if (escuta.fase === 'aplicada') {
    return 'rastro'
  }

  return escuta.fase === 'revisao' ? 'revisao' : 'escuta'
})

const ouvindo = computed(() => escuta.fase === 'gravando' || escuta.fase === 'pausada')

/** Fechar a gaveta pelo X ou pelo Esc é recolher a seção. */
function aoMudarGaveta(aberta: boolean) {
  if (!aberta && !escuta.recolhida) {
    escuta.alternarRecolhida()
  }
}

// ------------------------------------------------------------------ cabeçalho

type Estado = { rotulo: string; icone: Component | null; tom: string }

const estado = computed<Estado>(() => {
  switch (escuta.fase) {
    case 'gravando':
      return { rotulo: t('clinico.escuta.estado.gravando'), icone: PhMicrophone, tom: 'ouvindo' }
    case 'pausada':
      return {
        rotulo: t('clinico.escuta.estado.pausada'),
        icone: PhMicrophoneSlash,
        tom: 'pausado',
      }
    case 'encerrando':
      return { rotulo: t('clinico.escuta.estado.encerrando'), icone: null, tom: 'pausado' }
    case 'revisao':
      return { rotulo: t('clinico.escuta.estado.revisao'), icone: PhListChecks, tom: 'maquina' }
    default:
      return { rotulo: t('clinico.escuta.estado.aplicada'), icone: PhWaveform, tom: 'aplicado' }
  }
})

const autorizadaPor = computed(() =>
  escuta.autorizacao
    ? t('clinico.escuta.autorizadaPor', {
        responsavel: escuta.autorizacao.responsavel,
        hora: formato.hora(escuta.autorizacao.em),
      })
    : '',
)

/** Os campos de valor único: o antecedente é lista e não entra na conta de "faltou perguntar". */
const CAMPOS_UNICOS = CAMPOS_DA_ESCUTA.filter((campo) => campo !== 'antecedente')

const preenchidos = computed(
  () =>
    new Set<CampoDaEscuta>(
      escuta.propostas.map((proposta) => proposta.campo).filter((campo) => campo !== 'antecedente'),
    ),
)

/** Quantas propostas pedem um segundo olhar — é o número que decide se dá para revisar rápido. */
const paraConferir = computed(
  () =>
    escuta.propostas.filter((proposta) => (escuta.alertas.get(proposta.id) ?? []).length > 0)
      .length,
)

const contagem = computed(() => {
  const decisoes = escuta.propostas.map((proposta) => escuta.decisoes[proposta.id])

  return {
    aplicados: decisoes.filter((decisao) => decisao?.incluir).length,
    corrigidos: decisoes.filter((decisao) => decisao?.incluir && decisao.corrigida).length,
    deFora: decisoes.filter((decisao) => !decisao?.incluir).length,
  }
})

/**
 * O resumo da fase, que o cabeçalho mostra mesmo com a seção recolhida.
 *
 * Cada fase conta o que importa nela: ouvindo, quanto da anamnese já apareceu; na revisão,
 * quanto já foi marcado; depois de aplicar, o que entrou, o que foi corrigido e o que ficou de
 * fora. "Para conferir" só aparece quando existe — zero alerta não é notícia.
 */
const resumoDaFase = computed(() => {
  const itens: { chave: string; texto: string }[] = []
  const conferir = () =>
    paraConferir.value > 0
      ? [
          {
            chave: 'conferir',
            texto: t('clinico.escuta.meta.conferir', { total: paraConferir.value }),
          },
        ]
      : []

  if (escuta.fase === 'aplicada') {
    const { aplicados, corrigidos, deFora } = contagem.value

    itens.push({
      chave: 'aplicados',
      texto: t('clinico.escuta.resumo.aplicados', { total: aplicados }, aplicados),
    })

    if (corrigidos > 0) {
      itens.push({
        chave: 'corrigidos',
        texto: t('clinico.escuta.resumo.corrigidos', { total: corrigidos }, corrigidos),
      })
    }

    if (deFora > 0) {
      itens.push({
        chave: 'deFora',
        texto: t('clinico.escuta.resumo.deFora', { total: deFora }, deFora),
      })
    }

    return itens
  }

  if (escuta.fase === 'revisao') {
    return [
      {
        chave: 'marcados',
        texto: t('clinico.escuta.meta.marcados', {
          marcados: escuta.marcadas.length,
          total: escuta.propostas.length,
        }),
      },
      ...conferir(),
    ]
  }

  return [
    {
      chave: 'campos',
      texto: t('clinico.escuta.meta.campos', {
        preenchidos: preenchidos.value.size,
        total: CAMPOS_UNICOS.length,
      }),
    },
    ...conferir(),
  ]
})

/**
 * A linha de baixo do cabeçalho: quem autorizou e as contas da fase.
 *
 * O nome da seção não entra aqui. O estado ao lado do disco já diz o que ela é — "Ouvindo",
 * "Revise antes de salvar", "Conversa gravada" —, e a linha, que precisa caber ao lado das
 * ações, quebrava para dizer uma coisa que a tela inteira já diz.
 */
const meta = computed(() => [
  ...(autorizadaPor.value ? [{ chave: 'autorizacao', texto: autorizadaPor.value }] : []),
  ...resumoDaFase.value,
])

// ------------------------------------------------------------------ conversa e grifos

const grifos = computed(() => {
  const mapa = new Map<string, GrifoDaConversa[]>()
  const grifar = (trechoId: string, inicio: number, fim: number, propostaId: string) => {
    mapa.set(trechoId, [...(mapa.get(trechoId) ?? []), { inicio, fim, propostaId }])
  }

  for (const proposta of escuta.propostas) {
    for (const citacao of proposta.citacoes) {
      grifar(citacao.trechoId, citacao.inicio, citacao.fim, proposta.id)
    }
  }

  for (const nota of escuta.notas) {
    grifar(nota.citacao.trechoId, nota.citacao.inicio, nota.citacao.fim, nota.id)
  }

  return mapa
})

function citacoesDe(proposta: PropostaDaEscuta): CitacaoVisivel[] {
  return proposta.citacoes.map((citacao) => ({
    trechoId: citacao.trechoId,
    texto: textoDaCitacao(citacao, escuta.trechosPorId),
    hora: rotulos.relogio(escuta.trechosPorId.get(citacao.trechoId)?.emMs ?? 0),
  }))
}

/**
 * "De onde veio isto?" — a conversa abre na fala.
 *
 * Com a conversa oculta, abri-la rearruma o prontuário proposto de duas colunas para uma, e o
 * campo que a pessoa estava conferindo muda de lugar. Por isso ele volta para a vista depois do
 * rearranjo: a pergunta foi sobre ele, e a resposta não pode fazê-lo sumir.
 */
async function verNaConversa(trechoId: string) {
  const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const rearrumou = !escuta.conversaAberta || escuta.recolhida

  escuta.abrirConversa()
  await nextTick()

  if (rearrumou) {
    origem?.scrollIntoView({ block: 'nearest' })
  }

  conversa.value?.mostrar(trechoId)
}

// ------------------------------------------------------------------ prontuário proposto

type GrupoId = 'queixa' | 'sinais' | 'prevencao' | 'antecedentes'

/**
 * Os grupos do formulário, na ordem dele.
 *
 * A coluna é fixa por grupo, e não decidida pelo tamanho: numa distribuição automática, um campo
 * que chega no meio da conversa empurraria um grupo inteiro de uma coluna para a outra diante de
 * quem está olhando. Lida de cima para baixo e da esquerda para a direita, a ordem é a da
 * anamnese.
 */
const GRUPOS: { id: GrupoId; campos: CampoDaEscuta[]; coluna: 0 | 1 }[] = [
  {
    id: 'queixa',
    campos: ['queixaPrincipal', 'duracaoSintomas', 'evolucao', 'historia'],
    coluna: 0,
  },
  { id: 'sinais', campos: ['apetite', 'evacuacao', 'miccao', 'ambiente'], coluna: 0 },
  { id: 'prevencao', campos: ['vacinacaoEmDia', 'vermifugacaoEmDia'], coluna: 1 },
  { id: 'antecedentes', campos: ['antecedente'], coluna: 1 },
]

const TITULO_DO_GRUPO: Record<GrupoId, string> = {
  queixa: 'clinico.escuta.grupo.queixa',
  sinais: 'clinico.prontuario.anamnese.sinaisGerais',
  prevencao: 'clinico.prontuario.anamnese.prevencao',
  antecedentes: 'clinico.prontuario.anamnese.antecedentes',
}

/**
 * O que ficou sem resposta no grupo.
 *
 * Ouvindo, é a lista do que falta perguntar. Na revisão, o que a conversa não cobriu. No rastro,
 * nada: o que não apareceu já não pede ação.
 */
function faltaNoGrupo(grupo: (typeof GRUPOS)[number], quantas: number): string {
  if (escuta.fase === 'aplicada') {
    return ''
  }

  if (grupo.id === 'antecedentes') {
    return quantas === 0 ? t('clinico.escuta.proposta.nenhumAntecedente') : ''
  }

  const faltam = grupo.campos
    .filter((campo) => !preenchidos.value.has(campo))
    .map((campo) => rotulos.campo(campo))

  if (faltam.length === 0) {
    return ''
  }

  return t(
    escuta.fase === 'revisao'
      ? 'clinico.escuta.proposta.naoApareceu'
      : 'clinico.escuta.proposta.aindaNao',
    { campos: faltam.join(' · ') },
  )
}

const colunas = computed(() => {
  const montados = GRUPOS.map((grupo) => {
    const propostas = escuta.propostas.filter((proposta) => grupo.campos.includes(proposta.campo))

    return {
      id: grupo.id,
      coluna: grupo.coluna,
      titulo: t(TITULO_DO_GRUPO[grupo.id]),
      propostas,
      falta: faltaNoGrupo(grupo, propostas.length),
    }
  })
    /* No rastro, grupo vazio é só título: sai. */
    .filter((grupo) => escuta.fase !== 'aplicada' || grupo.propostas.length > 0)

  return [
    montados.filter((grupo) => grupo.coluna === 0),
    montados.filter((grupo) => grupo.coluna === 1),
  ]
})

/** Vazio, ou o que o formulário já tem e seria trocado. Igual ao proposto não é troca. */
function noProntuario(proposta: PropostaDaEscuta): string {
  const campo = proposta.campo

  if (campo === 'antecedente' || campo === 'historia') {
    return ''
  }

  const presente = props.anamnese[campo]

  if (presente === null || presente === '') {
    return ''
  }

  const valor = escuta.decisoes[proposta.id]?.valor ?? proposta.valor

  if (
    presente === valor ||
    (typeof presente === 'string' &&
      typeof valor === 'string' &&
      normalizar(presente) === normalizar(valor))
  ) {
    return ''
  }

  /* A frase segue depois do valor; o ponto final dele viraria ponto duplo. */
  return rotulos.valor(campo, presente).replace(/[.\s]+$/, '')
}

function nota(proposta: PropostaDaEscuta): string {
  if (proposta.campo === 'historia' && props.anamnese.historia.trim()) {
    return t('clinico.escuta.proposta.somaHistoria')
  }

  if (proposta.campo === 'antecedente') {
    const decisao = escuta.decisoes[proposta.id]
    const tipo = decisao?.tipo ?? proposta.tipo
    const descricao = normalizar(String(decisao?.valor ?? proposta.valor).trim())
    const repetido = props.anamnese.antecedentes.some(
      (item) => item.kind === tipo && normalizar(item.descricao.trim()) === descricao,
    )

    return repetido ? t('clinico.escuta.proposta.jaRegistrado') : ''
  }

  return ''
}

function corrigir(
  id: string,
  mudanca: { valor: ValorDaEscuta; tipo: AntecedenteKind | null; quando: string },
) {
  escuta.corrigir(id, mudanca)
}

// ------------------------------------------------------------------ o que foi ouvido e fica de fora

const ICONE_DA_NOTA: Record<NotaDaEscutaKind, Component> = {
  hipotese: PhStethoscope,
  'peso-informado': PhScales,
  medida: PhThermometer,
}

const notas = computed(() =>
  escuta.notas.map((item) => ({
    ...item,
    texto: textoDaCitacao(item.citacao, escuta.trechosPorId),
    hora: rotulos.relogio(escuta.trechosPorId.get(item.citacao.trechoId)?.emMs ?? 0),
  })),
)

// ------------------------------------------------------------------ aplicar

const totalMarcado = computed(() => escuta.marcadas.length)

let sequenciaDeIds = 0

function aplicar() {
  const patch = escuta.aplicar(props.anamnese, () => {
    sequenciaDeIds += 1

    return `ant-${Date.now().toString(36)}-${sequenciaDeIds}`
  })

  emit('aplicar', patch)
}

function gravarDeNovo() {
  escuta.pedirGravacao(props.encounterId)
}

const temAcoes = computed(
  () => ouvindo.value || (escuta.fase === 'aplicada' && !props.somenteLeitura),
)
</script>

<template>
  <!-- O sexo só conjuga as falas da consulta de demonstração: em branco, o masculino genérico. -->
  <EscutaAutorizacao
    v-if="pet"
    :encounter-id="encounterId"
    :responsavel="responsavel"
    :pet="pet.nome"
    :sexo="pet.sexo ?? 'macho'"
  />

  <section
    v-if="visivel"
    class="escuta"
    :class="[`escuta--${escuta.fase}`, { 'escuta--recolhida': escuta.recolhida }]"
    :aria-label="t('clinico.escuta.titulo')"
    data-fora-do-teclado
  >
    <!-- ------------------------------------------------ cabeçalho: fica sempre -->
    <header class="topo">
      <span class="disco" :class="`disco--${estado.tom}`" aria-hidden="true">
        <component :is="estado.icone" v-if="estado.icone" weight="bold" />
        <i v-else class="ph ph-spin ph-circle-notch" />
      </span>

      <div class="topo__textos">
        <p class="topo__linha">
          <!-- Só o estado é anunciado; o relógio, não: sessenta anúncios por minuto falariam por cima da consulta. -->
          <strong class="topo__estado" role="status">{{ estado.rotulo }}</strong>
          <span class="topo__relogio ui-num" role="timer" aria-live="off">{{
            rotulos.relogio(escuta.tempoMs)
          }}</span>
          <EscutaNivel v-if="escuta.fase === 'gravando'" :nivel="escuta.nivel" />
        </p>

        <!--
          Texto corrido, e não itens soltos: o ponto entre dois itens fica colado ao de antes por
          um espaço inseparável, e a linha quebra depois dele — nunca começa por um ponto.
        -->
        <p class="topo__meta">
          <template v-for="(item, indice) in meta" :key="item.chave">
            <span class="topo__item" :class="`topo__item--${item.chave}`"
              ><PhShieldCheck
                v-if="item.chave === 'autorizacao'"
                weight="duotone"
                class="topo__icone"
                aria-hidden="true"
              />{{ item.texto }}</span
            ><span v-if="indice < meta.length - 1" class="topo__ponto" aria-hidden="true"
              >&nbsp;·</span
            >{{ ' ' }}
          </template>
        </p>
      </div>

      <div v-if="temAcoes" class="topo__acoes">
        <template v-if="ouvindo">
          <Button
            v-if="escuta.fonte === 'demonstracao' && escuta.fase === 'gravando'"
            :label="t('clinico.escuta.acoes.adiantar')"
            icon="ph ph-fast-forward"
            severity="secondary"
            text
            size="small"
            @click="escuta.adiantar()"
          />
          <Button
            v-if="escuta.fase === 'gravando'"
            :label="t('clinico.escuta.acoes.pausar')"
            icon="ph ph-pause"
            severity="secondary"
            outlined
            size="small"
            @click="escuta.pausar()"
          />
          <Button
            v-else
            :label="t('clinico.escuta.acoes.retomar')"
            severity="secondary"
            outlined
            size="small"
            @click="escuta.retomar()"
          >
            <template #icon>
              <PhMicrophone
                weight="bold"
                class="p-button-icon p-button-icon-left"
                aria-hidden="true"
              />
            </template>
          </Button>
          <!-- Contornado: a ação cheia da tela é "Finalizar atendimento"; o parar tem o ícone em risco. -->
          <Button
            class="encerrar"
            :label="t('clinico.escuta.acoes.encerrar')"
            icon="ph ph-stop-circle"
            severity="secondary"
            outlined
            size="small"
            @click="escuta.encerrar()"
          />
        </template>

        <Button
          v-else
          :label="t('clinico.escuta.acoes.gravarDeNovo')"
          severity="secondary"
          text
          size="small"
          @click="gravarDeNovo"
        >
          <template #icon>
            <PhMicrophone
              weight="bold"
              class="p-button-icon p-button-icon-left"
              aria-hidden="true"
            />
          </template>
        </Button>
      </div>

      <!-- Controles de vista, separados das ações: mudam o que se vê, nunca o que se grava. -->
      <div class="topo__vista">
        <Button
          class="topo__recolher"
          :label="
            escuta.recolhida
              ? t('clinico.escuta.vista.abrirPainel')
              : t('clinico.escuta.vista.fecharPainel')
          "
          :icon="escuta.recolhida ? 'ph ph-corners-out' : 'ph ph-x'"
          severity="secondary"
          outlined
          size="small"
          :aria-expanded="!escuta.recolhida"
          :aria-controls="idDoCorpo"
          @click="escuta.alternarRecolhida()"
        />
      </div>
    </header>

    <!-- ------------------------------------------------ corpo: na gaveta à direita -->
    <Drawer
      :visible="!escuta.recolhida"
      position="right"
      :modal="false"
      class="hc-tema escuta-gaveta"
      :style="{ width: 'min(30rem, 94vw)' }"
      @update:visible="aoMudarGaveta"
    >
      <template #header>
        <div class="gaveta__topo">
          <span class="disco disco--pequeno" :class="`disco--${estado.tom}`" aria-hidden="true">
            <component :is="estado.icone" v-if="estado.icone" weight="bold" />
            <i v-else class="ph ph-spin ph-circle-notch" />
          </span>
          <h2 class="gaveta__titulo">{{ estado.rotulo }}</h2>
          <span class="topo__relogio ui-num" aria-hidden="true">{{
            rotulos.relogio(escuta.tempoMs)
          }}</span>
          <!-- Só no tablet: em tela larga a linha da anamnese continua à vista com estes botões. -->
          <span v-if="ouvindo" class="gaveta__acoes">
            <Button
              v-if="escuta.fase === 'gravando'"
              :label="t('clinico.escuta.acoes.pausar')"
              icon="ph ph-pause"
              severity="secondary"
              outlined
              size="small"
              @click="escuta.pausar()"
            />
            <Button
              v-else
              :label="t('clinico.escuta.acoes.retomar')"
              icon="ph ph-play"
              severity="secondary"
              outlined
              size="small"
              @click="escuta.retomar()"
            />
            <Button
              :label="t('clinico.escuta.acoes.encerrar')"
              icon="ph ph-stop-circle"
              size="small"
              @click="escuta.encerrar()"
            />
          </span>
          <Button
            class="gaveta__conversa"
            :label="
              escuta.conversaAberta
                ? t('clinico.escuta.vista.ocultarConversa')
                : t('clinico.escuta.vista.mostrarConversa')
            "
            :icon="escuta.conversaAberta ? 'ph ph-eye-slash' : 'ph ph-chats-circle'"
            severity="secondary"
            text
            size="small"
            :aria-pressed="escuta.conversaAberta"
            @click="escuta.alternarConversa()"
          />
        </div>
      </template>

      <div :id="idDoCorpo" class="corpo-da-secao">
        <!-- A frase que não pode sumir enquanto for verdade: quem transcreve e quem propõe. -->
        <p class="aviso">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t(`clinico.escuta.aviso.${escuta.fonte}`) }}
        </p>

        <p v-if="escuta.erro && escuta.fase !== 'inativa'" class="falha" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          {{ t(`clinico.escuta.erro.${escuta.erro}`) }}
        </p>

        <div class="corpo" :class="{ 'corpo--so-proposta': !escuta.conversaAberta }">
          <EscutaConversa
            v-show="escuta.conversaAberta"
            ref="conversa"
            class="corpo__conversa"
            :trechos="escuta.trechos"
            :interino="escuta.interino"
            :responsavel="responsavel || t('clinico.escuta.autorizacao.responsavelGenerico')"
            :grifos="grifos"
            :destacada="destacada"
            :ouvindo="escuta.fase === 'gravando'"
          />

          <section class="proposta" :aria-label="t('clinico.escuta.proposta.titulo')">
            <h3 class="proposta__titulo">{{ t('clinico.escuta.proposta.titulo') }}</h3>

            <div class="grupos">
              <div v-for="(coluna, indice) in colunas" :key="indice" class="grupos__coluna">
                <section v-for="grupo in coluna" :key="grupo.id" class="grupo">
                  <h4 class="grupo__titulo">{{ grupo.titulo }}</h4>

                  <TransitionGroup
                    v-if="grupo.propostas.length > 0"
                    name="entra"
                    tag="ul"
                    class="grupo__lista"
                  >
                    <EscutaCampo
                      v-for="proposta in grupo.propostas"
                      :key="proposta.id"
                      :proposta="proposta"
                      :alertas="escuta.alertas.get(proposta.id) ?? []"
                      :modo="modoDoCampo"
                      :decisao="escuta.decisoes[proposta.id] ?? null"
                      :citacoes="citacoesDe(proposta)"
                      :no-prontuario="modoDoCampo === 'revisao' ? noProntuario(proposta) : ''"
                      :nota="modoDoCampo === 'revisao' ? nota(proposta) : ''"
                      :desabilitado="somenteLeitura"
                      @marcar="escuta.marcar(proposta.id, $event)"
                      @corrigir="corrigir(proposta.id, $event)"
                      @desfazer="escuta.desfazerCorrecao(proposta.id)"
                      @olhar="destacada = $event ? proposta.id : null"
                      @ver-na-conversa="verNaConversa"
                    />
                  </TransitionGroup>

                  <!-- O que falta perguntar enquanto ouve; o que não foi conversado, na revisão. -->
                  <p v-if="grupo.falta" class="grupo__falta">{{ grupo.falta }}</p>
                </section>

                <!-- Ouvido e não preenchido: fecha a segunda coluna, depois dos antecedentes. -->
                <section v-if="indice === 1 && notas.length > 0" class="grupo">
                  <h4 class="grupo__titulo">{{ t('clinico.escuta.notas.titulo') }}</h4>
                  <ul class="notas">
                    <li v-for="item in notas" :key="item.id" class="nota">
                      <component
                        :is="ICONE_DA_NOTA[item.kind]"
                        weight="duotone"
                        class="nota__icone"
                        aria-hidden="true"
                      />
                      <div>
                        <Button
                          class="nota__citacao"
                          link
                          size="small"
                          :title="t('clinico.escuta.proposta.verNaConversa')"
                          @click="verNaConversa(item.citacao.trechoId)"
                        >
                          <span class="nota__texto">“{{ item.texto }}”</span>
                          <span class="nota__hora ui-num">{{ item.hora }}</span>
                        </Button>
                        <p class="nota__porque">{{ t(`clinico.escuta.notas.${item.kind}`) }}</p>
                      </div>
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </section>
        </div>

        <!-- ---------------------------------------------- revisão -->
        <footer v-if="escuta.fase === 'revisao'" class="rodape">
          <div class="rodape__textos">
            <p class="rodape__nada">{{ t('clinico.escuta.rodape.nadaSalvo') }}</p>
            <p class="rodape__decisao">
              <PhStethoscope weight="duotone" aria-hidden="true" />
              {{
                somenteLeitura && motivoLeitura ? motivoLeitura : t('clinico.escuta.rodape.decisao')
              }}
            </p>
          </div>

          <span class="rodape__acoes">
            <Button
              :label="t('clinico.escuta.acoes.descartar')"
              severity="secondary"
              text
              size="small"
              @click="escuta.descartar()"
            />
            <Button
              :label="
                totalMarcado > 0
                  ? t('clinico.escuta.acoes.aplicar', { total: totalMarcado }, totalMarcado)
                  : t('clinico.escuta.acoes.aplicarNenhum')
              "
              icon="ph ph-check"
              :disabled="totalMarcado === 0 || somenteLeitura"
              @click="aplicar"
            />
          </span>
        </footer>
      </div>
    </Drawer>
  </section>
</template>

<style scoped>
/*
 * Os tons da escuta. A "máquina" (o periwinkle de "a máquina propôs e ninguém aprovou") vem do
 * token do módulo, com contraste conferido nos dois temas; o resto é do kit.
 */
.escuta,
.corpo-da-secao,
.gaveta__topo {
  --maquina: var(--clinic-maquina);
  --maquina-fundo: var(--clinic-maquina-bg);
  --maquina-linha: var(--clinic-maquina-line);
}

/*
 * Moldura tracejada, como a da pré-consulta, e pelo mesmo motivo: a seção é informação de fora,
 * ainda não incorporada. A linha é a da máquina; o fundo é o da folha.
 */
.escuta {
  container: escuta / inline-size;
  display: grid;
  gap: 0;
  padding: 12px 14px 12px 12px;
  border: 1.5px dashed var(--maquina-linha);
  border-radius: var(--raio-cartao);
  background: var(--superficie);
}

/* Ouvindo, a faixa toma o tom do microfone aberto — sem virar alarme. */
.escuta--gravando {
  border-color: color-mix(in oklab, var(--risco) 55%, var(--linha));
  background: color-mix(in oklab, var(--risco-fundo) 35%, var(--superficie));
}

/* Aplicada já é prontuário: a moldura da máquina sai e fica a linha comum de qualquer folha. */
.escuta--aplicada {
  border-style: solid;
  border-color: var(--linha);
}

/* ------------------------------------------------------------------ cabeçalho */

.topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.disco {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  font-size: 19px;
}

/* Ouvindo é o único vermelho da seção: microfone aberto numa sala com gente não pode passar despercebido. */
.disco--ouvindo {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  animation: pulsar 1.8s ease-in-out infinite;
}

@keyframes pulsar {
  50% {
    box-shadow: 0 0 0 5px color-mix(in oklab, var(--risco) 22%, transparent);
  }
}

.disco--pausado {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.disco--maquina {
  background: var(--maquina-fundo);
  color: var(--maquina);
}

.disco--aplicado {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.topo__textos {
  display: grid;
  min-width: 0;
  flex: 1 1 18rem;
  gap: 2px;
}

.topo__linha {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.topo__estado {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.topo__relogio {
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 650;
}

/* A linha de baixo é o resumo: quem autorizou e as contas da fase, em texto corrido. */
.topo__meta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.55;
}

/* Cada item inteiro numa linha: a quebra só acontece no espaço depois do ponto. */
.topo__item {
  white-space: nowrap;
}

/* O preflight do Tailwind faz todo `svg` virar bloco; aqui o ícone anda junto do texto. */
.topo__icone {
  display: inline-block;
  margin-inline-end: 4px;
  vertical-align: -0.125em;
}

.topo__ponto {
  color: var(--tinta-3);
}

.topo__item--conferir {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.topo__acoes,
.topo__vista {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.encerrar :deep(.p-button-icon) {
  color: var(--risco);
}

/* Entre o que muda a gravação e o que muda a vista, uma régua fina. */
.topo__acoes + .topo__vista {
  padding-inline-start: 8px;
  border-inline-start: 1px solid var(--linha);
}

/* ------------------------------------------------------------------ gaveta */

/*
 * Na gaveta a seção não é mais o contêiner: o corpo é. Com 30 rem, a conversa fica em cima e o
 * prontuário proposto embaixo, numa coluna — as regras `@container escuta` já sabiam fazer isso.
 */
.corpo-da-secao {
  container: escuta / inline-size;
  display: grid;
  gap: 16px;
}

.gaveta__topo {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.gaveta__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.gaveta__acoes {
  display: none;
  gap: 6px;
}

@media (max-width: 74.99rem) {
  .gaveta__acoes {
    display: inline-flex;
  }
}

.gaveta__conversa.p-button {
  margin-inline-start: auto;
}

.disco--pequeno {
  width: 30px;
  height: 30px;
  font-size: 15px;
  animation: none;
}

/* Nota compacta, como a da proposta de rotina: diz o que é sem roubar o espaço dos campos. */
.aviso,
.falha {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;
}

.aviso {
  background: var(--superficie-2);
  color: var(--tinta-2);
}

.aviso .ph,
.falha .ph {
  margin-top: 2px;
  font-size: 15px;
}

.falha {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-weight: 550;
}

.corpo {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
}

.corpo--so-proposta {
  grid-template-columns: minmax(0, 1fr);
}

/*
 * A conversa fica presa enquanto a revisão rola: é para ela que cada citação aponta, e rastrear
 * um campo até a fala não pode depender de a fala ainda estar na tela.
 */
.corpo__conversa {
  position: sticky;
  top: 16px;
  padding-inline-end: 20px;
  border-inline-end: 1px solid var(--linha);
}

@container escuta (max-width: 52rem) {
  .corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .corpo__conversa {
    position: static;
    padding-inline-end: 0;
    padding-bottom: 16px;
    border-inline-end: 0;
    border-bottom: 1px solid var(--linha);
  }

  .corpo__conversa :deep(.conversa__lista) {
    max-height: 16rem;
  }
}

/* ------------------------------------------------------------------ prontuário proposto */

.proposta {
  container: proposta / inline-size;
  display: grid;
  min-width: 0;
  gap: 12px;
}

.proposta__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.grupos {
  display: grid;
  align-items: start;
  gap: 20px 24px;
  grid-template-columns: minmax(0, 1fr);
}

/* Com largura — a conversa oculta, ou tela muito larga —, os grupos se dividem em duas colunas. */
@container proposta (min-width: 44rem) {
  .grupos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.grupos__coluna {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 20px;
}

.grupo {
  display: grid;
  gap: 4px;
}

/* O título do grupo é o da folha da anamnese: frase, com um fio até a margem. */
.grupo__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.grupo__titulo::after {
  height: 1px;
  flex: 1;
  background: var(--linha);
  content: '';
}

.grupo__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.grupo__falta {
  margin: 0;
  padding-top: 4px;
  color: var(--tinta-3);
  font-size: 13px;
  line-height: 1.45;
}

/* Linha que entra na lista: é a única animação dos campos, e diz "este acabou de ser ouvido". */
.entra-enter-active {
  transition:
    opacity var(--pj-tempo-medio) ease-out,
    transform var(--pj-tempo-medio) ease-out;
}

.entra-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

/* ------------------------------------------------------------------ notas */

.notas {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 8px 0 0;
  list-style: none;
}

.nota {
  display: grid;
  gap: 12px;
  grid-template-columns: 22px minmax(0, 1fr);
}

.nota__icone {
  justify-self: center;
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 18px;
}

.nota__citacao.p-button {
  gap: 6px;
  padding: 0;
  color: var(--tinta);
  font-size: 14px;
}

.nota__texto {
  font-style: italic;
  text-align: start;
}

.nota__hora {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.nota__porque {
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ rodapé */

/* O rodapé da revisão fica preso ao pé da gaveta: a decisão está sempre a um clique. */
.rodape {
  position: sticky;
  z-index: 1;
  bottom: -1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: -1.25rem;
  padding: 16px 0 1.25rem;
  border-top: 1px solid var(--linha);
  background: var(--superficie);
}

.rodape__textos {
  display: grid;
  gap: 2px;
}

.rodape__nada {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.rodape__decisao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rodape__acoes {
  display: flex;
  gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .disco--ouvindo {
    animation: none;
  }
}
</style>
