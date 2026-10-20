<script setup lang="ts">
/**
 * Responder um pedido — a gaveta que a linha abre.
 *
 * Mora ao lado da caixa, não no meio da tela: a recepção responde com a lista à vista, e a linha
 * aberta fica tingida para o olho voltar a ela. Substitui os dois diálogos que existiam ("outro
 * horário" e "recusar"), que cobriam a caixa e mostravam os horários como lista corrida.
 *
 * De cima para baixo, na ordem em que a decisão acontece:
 *
 * 1. **O pedido** — o dia e a hora pedidos em destaque, o serviço, a queixa como chegou, e o que muda a
 *    resposta: primeira vez, histórico liberado, remarcação.
 * 2. **Quando marcar** — o mês num calendário (o ponto é dia com vaga, o anel é o dia pedido, o
 *    tingido é a janela em que a pessoa pode) e, embaixo, os horários do dia com um profissional
 *    de cada vez. Os outros que têm vaga no dia ficam numa linha, a um toque — sessenta botões de
 *    horário na tela seria a parede de volta.
 * 3. **O aviso** — a frase que sai para quem pediu, antes de sair.
 *
 * O rodapé diz o que o botão grava: "Aceitar 18:30" quando é o horário pedido, "Marcar qui. 15/10
 * · 09:00" quando a clínica escolheu outro. Recusar troca o corpo da gaveta pelo motivo e pela
 * mensagem — um assunto por vez, com o caminho de volta.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../composables/useRotulosDoPedido'
import {
  pedidoRepository,
  type DiaDaAgendaDoPedido,
  type PedidoNaCaixa,
} from '../../data/agendamento-online'
import type { MotivoDaRecusaDoPedido } from '../../data/types'
import { aparenciaDoTipo } from '../../domain/appointment-kind'
import { addDays } from '../../domain/clinic-time'
import {
  periodoDe,
  situacaoDoPrazo,
  TIPO_DO_MOTIVO,
  type OpcaoDeHorarioInterna,
} from '../../domain/pedidos'
import { clinicClock, useClinicoStore } from '../../stores/clinico'
import { usePedidosStore } from '../../stores/pedidos'

import CalendarioDoPedido, { type SituacaoNoCalendario } from './CalendarioDoPedido.vue'
import PedidoQuando from './PedidoQuando.vue'

const props = defineProps<{
  linha: PedidoNaCaixa | null
  salvando: boolean
}>()

const emit = defineEmits<{
  marcar: [escolha: { professionalId: string; inicio: string } | null]
  recusar: [payload: { motivo: MotivoDaRecusaDoPedido; mensagem: string }]
  fechar: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const pedidosStore = usePedidosStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

const LARGURA = '30rem'

const aberta = computed({
  get: () => props.linha !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

/* Empurra a página só com largura para isso; em 1024 px passa por cima, sem véu. */
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => aberta.value && telaLarga.value),
  LARGURA,
)

const vista = ref<'responder' | 'recusar'>('responder')

// ------------------------------------------------------------------ o pedido

const primeiro = computed(() => props.linha?.pedidos[0] ?? null)
const tipo = computed(() => (primeiro.value ? clinico.tipo(primeiro.value.typeId) : null))
const aparencia = computed(() => aparenciaDoTipo(tipo.value?.kind))
const escolheu = computed(() => primeiro.value?.modo === 'horario-escolhido')

const pets = computed(() =>
  (props.linha?.pedidos ?? []).map((pedido) => {
    const pet = pedido.petId ? clinico.pet(pedido.petId) : null
    const nome = pet?.nome ?? pedido.novoCadastro?.petNome ?? ''

    return {
      id: pedido.id,
      nome,
      iniciais: pet?.iniciais ?? nome.slice(0, 2).toUpperCase(),
      especie: pet?.especie ?? pedido.novoCadastro?.especie ?? null,
      fotoUrl: pet?.fotoUrl ?? '',
    }
  }),
)

const nomes = computed(() => rotulos.nomes(pets.value.map((pet) => pet.nome)))

const responsavel = computed(() => {
  const pedido = primeiro.value

  if (!pedido) {
    return ''
  }

  return (
    (pedido.tutorId ? clinico.tutor(pedido.tutorId)?.nome : null) ?? pedido.novoCadastro?.nome ?? ''
  )
})

const primeiraVez = computed(() =>
  (props.linha?.pedidos ?? []).some(
    (pedido) => pedido.novoCadastro !== null && !(pedido.petId && clinico.pet(pedido.petId)),
  ),
)

/** Veio pelo link, mas o telefone já é de um cliente: não é um segundo cadastro. */
const jaCliente = computed(
  () =>
    primeiro.value?.canal === 'link' && primeiro.value.tutorId !== null && !primeiraVez.value,
)

/** Para quando: o dia e a hora escolhidos, ou a janela e o período em que pode. */
const quandoDoPedido = computed(() => {
  const pedido = primeiro.value

  if (!pedido) {
    return null
  }

  if (escolheu.value && pedido.inicio) {
    return {
      dia: clinicClock.dateOf(pedido.inicio),
      ate: null,
      principal: formato.hora(pedido.inicio),
      hora: true,
      riscada: !props.linha!.horarioLivre,
    }
  }

  if (pedido.preferencia) {
    const periodos = pedido.preferencia.periodos

    return {
      dia: pedido.preferencia.de,
      ate: pedido.preferencia.ate,
      principal:
        periodos.length === 1
          ? t(`clinico.pedidos.periodoTitulo.${periodos[0]}`)
          : t('clinico.pedidos.tela.qualquerHora'),
      hora: false,
      riscada: false,
    }
  }

  return null
})

/** O que foi pedido, em frase: "Escolheu 18:30 com Caio Nogueira", "Pode de manhã · qualquer…". */
const fraseDoPedido = computed(() => {
  const pedido = primeiro.value

  if (!pedido) {
    return ''
  }

  if (escolheu.value && pedido.inicio) {
    const profissional = clinico.profissional(pedido.professionalId ?? '')?.nome ?? ''

    if ((props.linha?.pedidos.length ?? 0) > 1) {
      return t('clinico.pedidos.escolheuSeguidos', {
        dia: rotulos.dia(clinicClock.dateOf(pedido.inicio)),
        horas: rotulos.nomes(props.linha!.pedidos.map((item) => formato.hora(item.inicio ?? ''))),
        profissional,
      })
    }

    return t('clinico.pedidos.escolheu', { quando: rotulos.quando(pedido.inicio), profissional })
  }

  if (pedido.preferencia) {
    const quem = pedido.preferencia.professionalId
      ? t('clinico.pedidos.comProfissional', {
          nome: clinico.profissional(pedido.preferencia.professionalId)?.nome ?? '',
        })
      : t('clinico.pedidos.qualquerProfissional')

    return t('clinico.pedidos.pode', { janela: rotulos.preferencia(pedido.preferencia), quem })
  }

  return ''
})

const prazo = computed(() =>
  primeiro.value ? situacaoDoPrazo(primeiro.value, clinicClock.nowIso()) : 'no-prazo',
)

/** O mesmo tom da linha: risco quando passou ou falta meia hora, atenção nas duas horas seguintes. */
const tomDoPrazo = computed(() => {
  if (prazo.value !== 'no-prazo') {
    return 'risco'
  }

  const ate = primeiro.value?.responderAte
  const minutos = ate ? (Date.parse(ate) - Date.parse(clinicClock.nowIso())) / 60_000 : Infinity

  return minutos <= 120 ? 'atencao' : 'neutro'
})

const fraseDoPrazo = computed(() => {
  const ate = primeiro.value?.responderAte

  if (!ate) {
    return ''
  }

  if (prazo.value === 'atrasado') {
    return t('clinico.pedidos.prazo.atrasado', { valor: formato.relativo(ate) })
  }

  const hoje = clinicClock.dateOf(ate) === clinicClock.today()

  return t('clinico.pedidos.prazo.ate', { quando: hoje ? formato.hora(ate) : rotulos.quando(ate) })
})

// ------------------------------------------------------------------ recusar
/*
 * O estado da recusa vem antes do calendário: o `watch` imediato da linha (logo abaixo) chama
 * `reiniciarRecusa()` na montagem, e com os `ref`s declarados depois dele a gaveta quebrava ao
 * abrir a tela ("Cannot access 'motivo' before initialization").
 */

const MOTIVOS: MotivoDaRecusaDoPedido[] = [
  'sem-horario',
  'precisa-avaliar',
  'servico-indisponivel',
  'emergencia',
  'outro',
]

const motivo = ref<MotivoDaRecusaDoPedido>('sem-horario')
const mensagem = ref('')
/** A recepção mexeu no texto: trocar o motivo não apaga o que ela escreveu. */
const editado = ref(false)

const opcoesDeMotivo = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: t(`clinico.pedidos.recusa.motivo.${valor}`) })),
)

function textoPadrao() {
  return t(`clinico.pedidos.recusa.mensagem.${motivo.value}`, {
    nome: responsavel.value.split(' ')[0] ?? '',
    pets: nomes.value,
    telefone: pedidosStore.configuracao?.emergencia.telefone ?? '',
  })
}

function reiniciarRecusa() {
  motivo.value = 'sem-horario'
  editado.value = false
  mensagem.value = textoPadrao()
}

watch(motivo, () => {
  if (!editado.value) {
    mensagem.value = textoPadrao()
  }
})

function irParaRecusa() {
  if (!editado.value) {
    mensagem.value = textoPadrao()
  }

  vista.value = 'recusar'
}

// ------------------------------------------------------------------ o calendário

const hoje = computed(() => clinicClock.today())
const ultimoDia = computed(() => addDays(hoje.value, 45))

const agenda = ref<DiaDaAgendaDoPedido[]>([])
const carregando = ref(false)
const falhou = ref(false)
const dia = ref<string | null>(null)
const profissionalId = ref<string>('')
const escolhida = ref<OpcaoDeHorarioInterna | null>(null)

function mesma(a: OpcaoDeHorarioInterna | null, b: { professionalId: string; inicio: string }) {
  return a !== null && a.professionalId === b.professionalId && a.inicio === b.inicio
}

const situacoes = computed(
  (): Record<string, SituacaoNoCalendario> =>
    Object.fromEntries(agenda.value.map((item) => [item.data, item.situacao])),
)

const diaAtual = computed(() => agenda.value.find((item) => item.data === dia.value) ?? null)

const janela = computed(() =>
  !escolheu.value && primeiro.value?.preferencia
    ? { de: primeiro.value.preferencia.de, ate: primeiro.value.preferencia.ate }
    : null,
)

const destaque = computed(() =>
  escolheu.value && primeiro.value?.inicio ? clinicClock.dateOf(primeiro.value.inicio) : null,
)

/** Os profissionais com vaga no dia, na ordem da casa, com quantos horários cada um tem. */
const profissionaisDoDia = computed(() => {
  const contagem = new Map<string, number>()

  for (const opcao of diaAtual.value?.horarios ?? []) {
    contagem.set(opcao.professionalId, (contagem.get(opcao.professionalId) ?? 0) + 1)
  }

  return [...contagem.entries()].map(([id, total]) => ({
    id,
    nome: clinico.profissional(id)?.nome ?? '',
    total,
  }))
})

const opcoesDoSelect = computed(() =>
  profissionaisDoDia.value.map((item) => ({
    valor: item.id,
    rotulo: t('clinico.pedidos.gaveta.profissionalComVagas', { nome: item.nome, n: item.total }),
  })),
)

const outrosComVaga = computed(() =>
  profissionaisDoDia.value.filter((item) => item.id !== profissionalId.value),
)

/** Quem o pedido trazia: o escolhido, o preferido, ou quem já atende o pet. */
const profissionalDoPedido = computed(() => {
  const pedido = primeiro.value

  if (!pedido) {
    return null
  }

  return escolheu.value ? pedido.professionalId : (pedido.preferencia?.professionalId ?? null)
})

/** Ao trocar de dia, fica com quem estava — se tiver vaga — ou com quem o pedido trazia. */
watch(diaAtual, () => {
  const ids = profissionaisDoDia.value.map((item) => item.id)

  if (ids.includes(profissionalId.value)) {
    return
  }

  profissionalId.value =
    (profissionalDoPedido.value && ids.includes(profissionalDoPedido.value)
      ? profissionalDoPedido.value
      : ids[0]) ?? ''
})

const periodosDoDia = computed(() => {
  const doProfissional = (diaAtual.value?.horarios ?? []).filter(
    (opcao) => opcao.professionalId === profissionalId.value,
  )

  return (['manha', 'tarde'] as const)
    .map((periodo) => ({
      periodo,
      horarios: doProfissional.filter(
        (opcao) => periodoDe(clinicClock.minutesOf(opcao.inicio)) === periodo,
      ),
    }))
    .filter((grupo) => grupo.horarios.length > 0)
})

function ehOPedido(opcao: OpcaoDeHorarioInterna) {
  const pedido = primeiro.value

  return (
    escolheu.value &&
    pedido?.inicio === opcao.inicio &&
    pedido.professionalId === opcao.professionalId
  )
}

/** Fora do que a pessoa disse que pode: dia fora da janela, ou período que ela não marcou. */
function foraDaPreferencia(opcao: OpcaoDeHorarioInterna) {
  const preferencia = primeiro.value?.preferencia

  if (escolheu.value || !preferencia) {
    return false
  }

  const data = clinicClock.dateOf(opcao.inicio)
  const periodo = periodoDe(clinicClock.minutesOf(opcao.inicio))

  return (
    data < preferencia.de ||
    data > preferencia.ate ||
    (preferencia.periodos.length > 0 && !preferencia.periodos.includes(periodo))
  )
}

function rotuloDaHora(opcao: OpcaoDeHorarioInterna) {
  return opcao.porPet.length > 1
    ? rotulos.nomes(opcao.porPet.map((trecho) => formato.hora(trecho.inicio)))
    : formato.hora(opcao.inicio)
}

async function carregarAgenda() {
  const linha = props.linha

  if (!linha) {
    return
  }

  carregando.value = true
  falhou.value = false

  try {
    agenda.value = await pedidoRepository.agenda(linha.pedidos[0]!.id, hoje.value, ultimoDia.value)
  } catch {
    falhou.value = true
    agenda.value = []
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.linha?.chave,
  async (chave) => {
    vista.value = 'responder'
    agenda.value = []
    escolhida.value = null
    dia.value = null
    profissionalId.value = ''
    reiniciarRecusa()

    if (!chave || !props.linha) {
      return
    }

    await carregarAgenda()

    const linha = props.linha
    const pedido = linha.pedidos[0]!

    /* Começa no horário pedido, se ainda serve; senão no que a caixa sugeriu; senão no 1º dia livre. */
    const alvo =
      linha.horarioLivre && pedido.inicio && pedido.professionalId
        ? { professionalId: pedido.professionalId, inicio: pedido.inicio }
        : linha.sugestao
          ? { professionalId: linha.sugestao.professionalId, inicio: linha.sugestao.inicio }
          : null

    if (alvo) {
      dia.value = clinicClock.dateOf(alvo.inicio)
      profissionalId.value = alvo.professionalId
      escolhida.value =
        agenda.value
          .find((item) => item.data === dia.value)
          ?.horarios.find((opcao) => mesma(opcao, alvo)) ?? null
    } else {
      dia.value =
        (janela.value &&
          agenda.value.find((item) => item.data >= janela.value!.de && item.situacao === 'livre')
            ?.data) ??
        agenda.value.find((item) => item.situacao === 'livre')?.data ??
        hoje.value
    }
  },
  { immediate: true },
)

// ------------------------------------------------------------------ o aviso e o botão

const marcaOPedido = computed(
  () =>
    escolhida.value !== null && Boolean(props.linha?.horarioLivre) && ehOPedido(escolhida.value),
)

const rotuloDoBotao = computed(() => {
  if (!escolhida.value) {
    return t('clinico.pedidos.gaveta.escolhaUmHorario')
  }

  if (marcaOPedido.value) {
    return t('clinico.pedidos.gaveta.aceitarEm', { hora: rotuloDaHora(escolhida.value) })
  }

  return t('clinico.pedidos.gaveta.marcarEm', {
    dia: rotulos.dia(clinicClock.dateOf(escolhida.value.inicio)),
    hora: rotuloDaHora(escolhida.value),
  })
})

const viaDoAviso = computed(() =>
  primeiro.value?.canal === 'link'
    ? t('clinico.pedidos.horario.avisoPorMensagem', { nome: responsavel.value })
    : t('clinico.pedidos.horario.avisoPorPush', { nome: responsavel.value }),
)

const textoDoAviso = computed(() =>
  escolhida.value
    ? t('clinico.pedidos.horario.aviso', {
        pets: nomes.value,
        quando: rotulos.quando(escolhida.value.inicio),
        profissional: clinico.profissional(escolhida.value.professionalId)?.nome ?? '',
      })
    : '',
)

function marcar() {
  if (!escolhida.value) {
    return
  }

  emit(
    'marcar',
    marcaOPedido.value
      ? null
      : { professionalId: escolhida.value.professionalId, inicio: escolhida.value.inicio },
  )
}

const podeRecusar = computed(() => mensagem.value.trim().length > 0)
</script>

<template>
  <Drawer
    v-model:visible="aberta"
    position="right"
    :modal="false"
    :dismissable="false"
    class="gaveta-do-pedido clinic-overlay"
    :style="{ width: `min(${LARGURA}, 96vw)` }"
  >
    <template #header>
      <div v-if="linha" class="gp-cabeca">
        <span class="gp-cabeca__rostos" :class="{ 'gp-cabeca__rostos--grupo': pets.length > 1 }">
          <PetAvatar
            v-for="pet in pets"
            :key="pet.id"
            :nome="pet.nome"
            :iniciais="pet.iniciais"
            :especie="pet.especie"
            :foto-url="pet.fotoUrl"
            tamanho="md"
          />
        </span>
        <span class="gp-cabeca__texto">
          <!-- O foco abre no título: o leitor anuncia o pedido, e nenhum dia do calendário nasce com anel. -->
          <h2 class="gp-cabeca__titulo" tabindex="-1" autofocus>
            {{
              vista === 'recusar'
                ? t('clinico.pedidos.recusa.titulo', { pets: nomes })
                : t('clinico.pedidos.gaveta.titulo', { pets: nomes })
            }}
          </h2>
          <span class="gp-cabeca__meta">
            <i
              class="ph"
              :class="primeiro?.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
              aria-hidden="true"
            />
            {{ responsavel }} · {{ t(`clinico.pedidos.canal.${primeiro?.canal ?? 'app'}`) }}
          </span>
        </span>
      </div>
    </template>

    <div v-if="linha && primeiro" class="gp clinic-scope">
      <!-- ============================================================ responder -->
      <template v-if="vista === 'responder'">
        <section class="gp__pedido" :aria-label="t('clinico.pedidos.gaveta.oPedido')">
          <PedidoQuando
            v-if="quandoDoPedido"
            class="gp__quando-pedido"
            tamanho="lg"
            :dia="quandoDoPedido.dia"
            :ate="quandoDoPedido.ate"
            :principal="quandoDoPedido.principal"
            :hora="quandoDoPedido.hora"
            :riscada="quandoDoPedido.riscada"
          />
          <div class="gp__pedido-texto">
            <p class="gp__servico">
              <i
                v-if="aparencia.icone"
                :class="aparencia.icone"
                :style="{ color: aparencia.cor }"
                aria-hidden="true"
              />
              <strong>{{ tipo?.nome }}</strong>
              <span v-if="TIPO_DO_MOTIVO[primeiro.motivo] === 'consulta'" class="gp__motivo">
                · {{ t(`clinico.pedidos.motivo.${primeiro.motivo}`) }}
              </span>
            </p>
            <p class="gp__frase">{{ fraseDoPedido }}</p>
            <p v-if="escolheu && !linha.horarioLivre" class="gp__linha gp__linha--atencao">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              {{ t('clinico.pedidos.ocupado') }}
            </p>
            <p class="gp__linha gp__linha--prazo" :class="`gp__linha--prazo-${tomDoPrazo}`">
              <i
                class="ph"
                :class="tomDoPrazo === 'neutro' ? 'ph-clock' : 'ph-clock-countdown'"
                aria-hidden="true"
              />
              {{ fraseDoPrazo }}
            </p>
          </div>
        </section>

        <blockquote v-if="primeiro.queixa" class="gp__queixa">
          <i class="ph ph-quotes" aria-hidden="true" />
          <span>{{ primeiro.queixa }}</span>
        </blockquote>

        <ul
          v-if="primeiraVez || jaCliente || primeiro.compartilhaHistorico || primeiro.remarcaAppointmentId"
          class="gp__fatos"
        >
          <li v-if="primeiraVez" class="gp__fato gp__fato--novo">
            <i class="ph ph-sparkle" aria-hidden="true" />
            <span class="gp__fato-texto">
              {{ t('clinico.pedidos.gaveta.primeiraVez') }}
              <span v-if="primeiro.novoCadastro" class="gp__fato-dado">
                <bdi dir="ltr" class="ui-num">{{ primeiro.novoCadastro.telefone }}</bdi>
                <template v-if="primeiro.novoCadastro.nascimento">
                  · {{ formato.idade(primeiro.novoCadastro.nascimento) }}
                </template>
              </span>
            </span>
          </li>
          <li v-if="jaCliente" class="gp__fato">
            <i class="ph ph-address-book" aria-hidden="true" />
            {{ t('clinico.pedidos.jaCliente') }}
          </li>
          <li v-if="primeiro.compartilhaHistorico" class="gp__fato">
            <i class="ph ph-share-network" aria-hidden="true" />
            {{ t('clinico.pedidos.historicoLiberado') }}
          </li>
          <li v-if="primeiro.remarcaAppointmentId" class="gp__fato">
            <i class="ph ph-arrows-clockwise" aria-hidden="true" />
            {{ t('clinico.pedidos.remarcacao') }}
          </li>
        </ul>

        <section class="gp__quando" :aria-labelledby="'gp-quando'">
          <h3 id="gp-quando" class="gp__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
              <i class="ph ph-calendar-blank" />
            </span>
            {{ t('clinico.pedidos.gaveta.quando') }}
          </h3>

          <CalendarioDoPedido
            v-model:dia="dia"
            :min="hoje"
            :max="ultimoDia"
            :situacoes="situacoes"
            :destaque="destaque"
            :janela="janela"
            :rotulo="t('clinico.pedidos.gaveta.quando')"
          />

          <p class="gp__legenda" aria-hidden="true">
            <span><span class="gp__ponto" />{{ t('clinico.pedidos.app.legenda.livre') }}</span>
            <span v-if="destaque"
              ><span class="gp__anel" />{{ t('clinico.pedidos.gaveta.legendaPedido') }}</span
            >
            <span v-if="janela"
              ><span class="gp__tinta" />{{ t('clinico.pedidos.gaveta.legendaJanela') }}</span
            >
          </p>

          <p v-if="carregando" class="gp__linha" role="status">
            <i class="ph ph-circle-notch ph-spin" aria-hidden="true" />
            {{ t('clinico.pedidos.horario.procurando') }}
          </p>
          <p v-else-if="falhou" class="gp__linha gp__linha--risco" role="alert">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            {{ t('clinico.pedidos.erros.sugestoes') }}
          </p>

          <template v-else-if="diaAtual">
            <p class="gp__dia">{{ rotulos.dia(diaAtual.data) }}</p>

            <p v-if="diaAtual.situacao === 'fechado'" class="gp__linha">
              <i class="ph ph-door" aria-hidden="true" />
              {{
                diaAtual.feriado
                  ? t('clinico.pedidos.app.fechadaFeriado', { feriado: diaAtual.feriado })
                  : t('clinico.pedidos.app.fechadaNoDia')
              }}
            </p>
            <p v-else-if="diaAtual.situacao === 'cheio'" class="gp__linha">
              <i class="ph ph-calendar-x" aria-hidden="true" />
              {{ t('clinico.pedidos.app.semHorarioNoDia') }}
            </p>

            <template v-else>
              <Select
                v-model="profissionalId"
                :options="opcoesDoSelect"
                option-label="rotulo"
                option-value="valor"
                fluid
                :aria-label="t('clinico.pedidos.gaveta.profissional')"
              />

              <div v-for="grupo in periodosDoDia" :key="grupo.periodo" class="gp__periodo">
                <span class="gp__rotulo">{{
                  t(`clinico.pedidos.periodoTitulo.${grupo.periodo}`)
                }}</span>
                <div class="gp__horas">
                  <button
                    v-for="opcao in grupo.horarios"
                    :key="opcao.inicio"
                    type="button"
                    class="gp__hora ui-num"
                    :class="{
                      'gp__hora--escolhida': escolhida && mesma(escolhida, opcao),
                      'gp__hora--pedido': ehOPedido(opcao),
                      'gp__hora--fora': foraDaPreferencia(opcao),
                    }"
                    :aria-pressed="Boolean(escolhida && mesma(escolhida, opcao))"
                    @click="escolhida = opcao"
                  >
                    {{ rotuloDaHora(opcao) }}
                    <span v-if="ehOPedido(opcao)" class="gp__hora-selo">
                      {{ t('clinico.pedidos.tela.horaPedida') }}
                    </span>
                  </button>
                </div>
              </div>

              <p v-if="outrosComVaga.length > 0" class="gp__outros">
                <span>{{ t('clinico.pedidos.gaveta.tambemLivre') }}</span>
                <Button
                  v-for="item in outrosComVaga"
                  :key="item.id"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :label="
                    t('clinico.pedidos.gaveta.profissionalComVagas', {
                      nome: item.nome,
                      n: item.total,
                    })
                  "
                  @click="profissionalId = item.id"
                />
              </p>
            </template>
          </template>
        </section>

        <section v-if="escolhida" class="gp__aviso">
          <span class="gp__via">
            <i class="ph ph-paper-plane-tilt" aria-hidden="true" />
            {{ viaDoAviso }}
          </span>
          <p class="gp__bolha">{{ textoDoAviso }}</p>
          <p v-if="foraDaPreferencia(escolhida)" class="gp__linha gp__linha--atencao">
            <i class="ph ph-info" aria-hidden="true" />
            {{ t('clinico.pedidos.horario.foraDaJanela') }}
          </p>
        </section>
      </template>

      <!-- ============================================================ recusar -->
      <template v-else>
        <div class="gp__campo">
          <span id="gp-motivo" class="gp__rotulo-campo">{{ t('clinico.pedidos.recusa.porque') }}</span>
          <SelectButton
            v-model="motivo"
            :options="opcoesDeMotivo"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="gp-motivo"
            class="gp__motivos"
          />
        </div>

        <label class="gp__campo">
          <span class="gp__rotulo-campo">
            {{ t('clinico.pedidos.recusa.mensagemPara', { nome: responsavel }) }}
          </span>
          <Textarea v-model="mensagem" rows="6" auto-resize fluid @input="editado = true" />
        </label>

        <p class="gp__linha">
          <i class="ph ph-info" aria-hidden="true" />
          {{
            primeiro.canal === 'link'
              ? t('clinico.pedidos.recusa.notaLink')
              : t('clinico.pedidos.recusa.notaApp')
          }}
        </p>
      </template>
    </div>

    <template #footer>
      <div v-if="linha" class="gp-rodape">
        <template v-if="vista === 'responder'">
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('clinico.pedidos.recusar')"
            :disabled="salvando"
            @click="irParaRecusa"
          />
          <Button
            type="button"
            icon="ph ph-check"
            class="gp-rodape__principal"
            :label="rotuloDoBotao"
            :disabled="!escolhida"
            :loading="salvando"
            @click="marcar"
          />
        </template>
        <template v-else>
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-arrow-left"
            :label="t('clinico.pedidos.gaveta.voltar')"
            :disabled="salvando"
            @click="vista = 'responder'"
          />
          <Button
            type="button"
            icon="ph ph-paper-plane-tilt"
            class="gp-rodape__principal"
            :label="t('clinico.pedidos.recusa.enviar')"
            :disabled="!podeRecusar"
            :loading="salvando"
            @click="emit('recusar', { motivo, mensagem })"
          />
        </template>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
/* ------------------------------------------------------------------ cabeçalho */

.gp-cabeca {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.gp-cabeca__rostos {
  display: inline-flex;
  flex: none;
}

.gp-cabeca__rostos--grupo > * + * {
  margin-inline-start: -12px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--superficie);
}

.gp-cabeca__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.gp-cabeca__titulo {
  margin: 0;
  outline: none;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.gp-cabeca__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ corpo */

.gp {
  display: grid;
  gap: 18px;
  color: var(--tinta);
}

/* O pedido: o "quando" grande à esquerda, o que e o prazo à direita — uma faixa tingida só. */
.gp__pedido {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.gp__quando-pedido {
  flex: none;
  min-width: 6.5rem;
  padding-inline-end: 16px;
  border-inline-end: 1px solid var(--linha);
}

.gp__pedido-texto {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.gp__pedido-texto p,
.gp__linha {
  margin: 0;
}

.gp__servico {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-size: 15px;
}

.gp__servico strong {
  color: var(--tinta);
  font-weight: 600;
}

.gp__motivo {
  color: var(--tinta-2);
}

.gp__frase {
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.gp__linha {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.gp__linha > i {
  flex: none;
  transform: translateY(1px);
}

.gp__linha--atencao {
  color: var(--atencao-tinta);
  font-weight: 550;
}

.gp__linha--prazo {
  font-weight: 550;
}

.gp__linha--risco,
.gp__linha--prazo-risco {
  color: var(--risco-tinta);
}

.gp__linha--prazo-atencao {
  color: var(--atencao-tinta);
}

.gp__queixa {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-inline-start: 3px solid var(--linha-forte);
  border-radius: 4px 12px 12px 4px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.gp__queixa > i {
  flex: none;
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.gp__fatos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gp__fato {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.gp__fato > i {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
  transform: translateY(2px);
}

.gp__fato-texto {
  display: grid;
  gap: 2px;
}

.gp__fato-dado {
  color: var(--tinta-2);
  font-weight: 450;
  white-space: nowrap;
}

.gp__fato--novo {
  color: var(--clinica-tinta);
  font-weight: 550;
}

.gp__fato--novo > i {
  color: var(--clinica-tinta);
}

/* ------------------------------------------------------------------ quando */

.gp__quando {
  display: grid;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--linha);
}

.gp__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

/* O calendário é compartilhado (hotel, página pública): aqui só o dia da semana sai da caixa alta. */
.gp__quando :deep(.p-datepicker-weekday) {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 550;
  text-transform: none;
}

.gp__legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: -4px 0 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.gp__legenda > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gp__ponto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--musgo);
}

.gp__anel {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--musgo);
}

.gp__tinta {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--musgo-fundo);
}

.gp__dia {
  margin: 4px 0 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.gp__periodo {
  display: grid;
  gap: 8px;
}

.gp__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.gp__horas {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(4.6rem, 1fr));
}

.gp__hora {
  position: relative;
  min-height: 38px;
  padding: 0 6px;
  border: 1px solid var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition:
    background-color var(--pj-tempo-curto) ease-out,
    border-color var(--pj-tempo-curto) ease-out;
}

.gp__hora:hover {
  border-color: var(--musgo);
  background: var(--musgo-fundo);
}

.gp__hora:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

/* Fora do que a pessoa disse que pode: a borda tracejada avisa antes do clique. */
.gp__hora--fora {
  border-style: dashed;
  color: var(--tinta-2);
}

.gp__hora--pedido {
  border-color: var(--clinica);
}

.gp__hora--escolhida,
.gp__hora--escolhida:hover {
  border-color: var(--musgo);
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.gp__hora-selo {
  position: absolute;
  top: -9px;
  right: 4px;
  padding: 0 5px;
  border-radius: 5px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-family: var(--font-texto);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 16px;
}

.gp__outros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ aviso */

.gp__aviso {
  display: grid;
  gap: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--linha);
}

.gp__via {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

/* A mensagem como chega no celular: um balão. */
.gp__bolha {
  margin: 0;
  padding: 10px 14px;
  border-radius: 14px 14px 14px 4px;
  background: var(--clinica-fundo);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ recusar */

.gp__campo {
  display: grid;
  gap: 8px;
}

.gp__rotulo-campo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.gp__motivos {
  display: flex;
  flex-wrap: wrap;
}

/* O segmento escolhido: superfície e tinta, legível nos dois temas. */
.gp__motivos :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  color: var(--tinta);
}

/* ------------------------------------------------------------------ rodapé */

.gp-rodape {
  display: flex;
  gap: 8px;
}

.gp-rodape__principal.p-button {
  flex: 1;
}

@media (prefers-reduced-motion: reduce) {
  .gp__hora {
    transition: none;
  }
}
</style>
