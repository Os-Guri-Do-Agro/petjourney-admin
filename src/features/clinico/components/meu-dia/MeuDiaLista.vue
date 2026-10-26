<script setup lang="ts">
/**
 * Hoje, versão **Três números e uma lista**, no desenho da mesa da recepção.
 *
 * - Em cima, dois cartões: os números da recepção (quantos esperam, a maior espera, quantos faltam
 *   até o fim do dia) com os pacientes das próximas quatro horas; e a sala de agora, com o tempo de
 *   consulta, os outros lugares que pedem atenção e o "continuar".
 * - No meio, os filtros (profissional, serviço, período, busca), que valem para a lista.
 * - Embaixo, a folha: as abas (em sala, internação, fila do dia), a lista à esquerda e o paciente
 *   escolhido à direita, num cartão escuro, com os atalhos da ficha e a ação principal.
 *
 * Navegação no topo, tokens e os dois temas em `components/layout/moldura-lista.css`.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import '@/components/layout/moldura-lista.css'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import type { Appointment } from '@/features/clinico/data/types'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const props = defineProps<{ dia: MeuDia }>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const LIMITE_DA_FILA = 5
/** Quem chegou há pouco ainda "chegou"; daqui para cima, já está "esperando". */
const CHEGOU_HA_POUCO = 5

/* O agora da tela anda sozinho: os minutos de espera não param quando a página fica aberta. */
const agora = ref(clinicClock.nowIso())
const relogio = setInterval(() => (agora.value = clinicClock.nowIso()), 20_000)

watch(
  () => props.dia.doDia,
  () => (agora.value = clinicClock.nowIso()),
)
onBeforeUnmount(() => clearInterval(relogio))

const agoraMin = computed(() => clinicClock.minutesOf(agora.value))

function minutosDesde(iso: string | null) {
  void agora.value

  return props.dia.minutosDesde(iso) ?? 0
}

function nomeDo(item: Appointment) {
  return props.dia.pet(item.petId)?.nome ?? ''
}

function caminhoDe(destino: RouteLocationRaw) {
  return typeof destino === 'string' ? destino : 'path' in destino ? (destino.path ?? '') : ''
}

function daInternacao(destino: RouteLocationRaw) {
  return caminhoDe(destino).includes('/internacao')
}

/* ------------------------------------------------------------------------- os números */

const maiorEspera = computed(() =>
  Math.max(0, ...props.dia.naRecepcao.map((item) => minutosDesde(item.chegadaEm))),
)

const ateOFim = computed(
  () => props.dia.emConsulta.length + props.dia.naRecepcao.length + props.dia.aSeguir.length,
)

/** As quatro horas a partir desta: quem tem horário em cada uma e quanto dela já passou. */
const horas = computed(() => {
  const atual = Math.floor(agoraMin.value / 60)

  return [0, 1, 2, 3].map((deslocamento) => {
    const hora = atual + deslocamento
    const itens = props.dia.doDia.filter(
      (item) => Math.floor(clinicClock.minutesOf(item.inicio) / 60) === hora,
    )

    return {
      hora,
      itens,
      passou: deslocamento === 0 ? (agoraMin.value - hora * 60) / 60 : 0,
    }
  })
})

/* ------------------------------------------------------------------- a sala de agora */

const salaEscolhida = ref<string | null>(null)

const emDestaque = computed(
  () =>
    props.dia.emConsulta.find((item) => item.id === salaEscolhida.value) ??
    props.dia.emConsulta[0] ??
    null,
)

const urgenciasDaInternacao = computed(() =>
  props.dia.urgentes.filter((linha) => daInternacao(linha.to)),
)

/** Os lugares embaixo do tempo: as salas em consulta e o que é urgente na internação. */
const lugares = computed(() => [
  ...props.dia.emConsulta.slice(0, 2).map((item) => ({
    id: item.id,
    tipo: 'sala' as const,
    lugar: props.dia.salasDe(item),
    titulo: nomeDo(item),
    detalhe: t('clinico.meuDia.versoes.lista.sala.com', {
      vet: props.dia.profissionaisDe(item).split(' ')[0],
    }),
    item,
  })),
  ...urgenciasDaInternacao.value
    .slice(0, 3 - Math.min(2, props.dia.emConsulta.length))
    .map((linha) => ({
      id: linha.id,
      tipo: 'internacao' as const,
      lugar: linha.detalhe ?? '',
      titulo: linha.frase,
      detalhe: '',
      to: linha.to,
    })),
])

/* ---------------------------------------------------------------------------- filtros */

const filtrosAbertos = ref(true)
const profissional = ref('todos')
const servico = ref('todos')
const periodo = ref<'dia' | 'manha' | 'tarde'>('dia')
const busca = ref('')

const opcoesDeProfissional = computed(() => [
  { valor: 'todos', rotulo: t('clinico.meuDia.versoes.lista.filtros.profissional') },
  ...clinico.profissionais
    .filter((pessoa) => pessoa.ativo)
    .map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome })),
])

const opcoesDeServico = computed(() => [
  { valor: 'todos', rotulo: t('clinico.meuDia.versoes.lista.filtros.servico') },
  ...clinico.tipos.map((tipo) => ({ valor: tipo.id, rotulo: tipo.nome })),
])

const opcoesDePeriodo = computed(() => [
  { valor: 'dia', rotulo: t('clinico.meuDia.versoes.lista.filtros.dia'), icone: 'ph ph-clock' },
  { valor: 'manha', rotulo: t('clinico.meuDia.versoes.lista.filtros.manha'), icone: 'ph ph-sun' },
  {
    valor: 'tarde',
    rotulo: t('clinico.meuDia.versoes.lista.filtros.tarde'),
    icone: 'ph ph-sun-horizon',
  },
])

const iconeDoPeriodo = computed(
  () => opcoesDePeriodo.value.find((opcao) => opcao.valor === periodo.value)?.icone ?? '',
)

const filtrosAtivos = computed(
  () =>
    [
      profissional.value !== 'todos',
      servico.value !== 'todos',
      periodo.value !== 'dia',
      Boolean(busca.value.trim()),
    ].filter(Boolean).length,
)

function semAcento(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function passaNosFiltros(item: Appointment) {
  if (profissional.value !== 'todos' && item.professionalId !== profissional.value) {
    return false
  }

  if (servico.value !== 'todos' && item.typeId !== servico.value) {
    return false
  }

  const minuto = clinicClock.minutesOf(item.inicio)

  if (
    (periodo.value === 'manha' && minuto >= 12 * 60) ||
    (periodo.value === 'tarde' && minuto < 12 * 60)
  ) {
    return false
  }

  const termo = semAcento(busca.value.trim())

  return (
    !termo ||
    semAcento(`${nomeDo(item)} ${props.dia.tutor(item.tutorId)?.nome ?? ''}`).includes(termo)
  )
}

/* ------------------------------------------------------------------------------ abas */

type Aba = 'sala' | 'internacao' | 'fila'

const aba = ref<Aba>('fila')
const filaAberta = ref(false)

const emSala = computed(() => props.dia.emConsulta.filter(passaNosFiltros))
const fila = computed(() => [...props.dia.naRecepcao, ...props.dia.aSeguir].filter(passaNosFiltros))
const internacao = computed(() => props.dia.linhasDaPauta.filter((linha) => daInternacao(linha.to)))

const abas = computed(() => [
  {
    valor: 'sala',
    rotulo: t('clinico.meuDia.versoes.lista.abas.sala'),
    total: emSala.value.length,
    urgente: false,
  },
  {
    valor: 'internacao',
    rotulo: t('clinico.meuDia.versoes.lista.abas.internacao'),
    total: internacao.value.length,
    urgente: urgenciasDaInternacao.value.length > 0,
  },
  {
    valor: 'fila',
    rotulo: t('clinico.meuDia.versoes.lista.abas.fila'),
    total: fila.value.length,
    urgente: false,
  },
])

const lista = computed(() => (aba.value === 'sala' ? emSala.value : fila.value))
const listaVisivel = computed(() =>
  aba.value === 'fila' && !filaAberta.value ? lista.value.slice(0, LIMITE_DA_FILA) : lista.value,
)
const escondidos = computed(() => Math.max(0, lista.value.length - listaVisivel.value.length))

const escolhidoId = ref<string | null>(null)
const escolhido = computed(
  () => lista.value.find((item) => item.id === escolhidoId.value) ?? lista.value[0] ?? null,
)

const linhaEscolhidaId = ref<string | null>(null)
const linhaEscolhida = computed(
  () =>
    internacao.value.find((linha) => linha.id === linhaEscolhidaId.value) ??
    internacao.value[0] ??
    null,
)

function estadoDe(item: Appointment) {
  if (item.status === 'aguardando') {
    const espera = minutosDesde(item.chegadaEm)

    return {
      tom: espera > CHEGOU_HA_POUCO ? 'espera' : 'chegou',
      rotulo:
        espera > CHEGOU_HA_POUCO
          ? t('clinico.meuDia.versoes.lista.estado.esperando')
          : t('clinico.meuDia.versoes.lista.estado.chegou'),
      valor: formato.duracao(espera),
    }
  }

  if (item.status === 'em-atendimento') {
    return {
      tom: 'sala',
      rotulo: t('clinico.meuDia.versoes.lista.estado.emConsulta'),
      valor: formato.duracao(minutosDesde(item.iniciadoEm ?? item.inicio)),
    }
  }

  return { tom: 'marcado', rotulo: formato.status(item.status), valor: formato.hora(item.inicio) }
}

/* -------------------------------------------------------------------- o paciente */

const petEscolhido = computed(() => (escolhido.value ? props.dia.pet(escolhido.value.petId) : null))

const alertaDoEscolhido = computed(() =>
  petEscolhido.value ? (props.dia.alertasRelevantes(petEscolhido.value)[0] ?? null) : null,
)

const chipDoEscolhido = computed(() => {
  const item = escolhido.value

  if (!item) {
    return ''
  }

  if (item.status === 'aguardando') {
    return t('clinico.meuDia.versoes.lista.estado.naRecepcao')
  }

  return item.status === 'em-atendimento'
    ? t('clinico.meuDia.versoes.lista.estado.emConsulta')
    : formato.status(item.status)
})

const atalhos = computed(() => {
  const item = escolhido.value

  if (!item) {
    return []
  }

  return [
    {
      id: 'resumo',
      icone: 'ph ph-notepad',
      rotulo: t('clinico.resumoDoPaciente.verResumo'),
      to: props.dia.rotaDoResumo(item),
    },
    {
      id: 'vacinas',
      icone: 'ph ph-syringe',
      rotulo: t('clinico.meuDia.versoes.lista.detalhe.vacinas'),
      to: `/veterinario/paciente/${item.petId}/vacinas`,
    },
    {
      id: 'historico',
      icone: 'ph ph-clock-counter-clockwise',
      rotulo: t('clinico.meuDia.versoes.lista.detalhe.historico'),
      to: `/veterinario/paciente/${item.petId}/historico`,
    },
  ]
})

/** Os três números do pé do cartão, que mudam com o que o paciente está fazendo. */
const rodape = computed(() => {
  const item = escolhido.value

  if (!item) {
    return []
  }

  const posicao = fila.value.findIndex((outro) => outro.id === item.id)
  const seguinte = posicao >= 0 ? fila.value[posicao + 1] : null
  const depois = seguinte ? nomeDo(seguinte) : t('clinico.meuDia.versoes.lista.detalhe.ninguem')

  if (item.status === 'em-atendimento') {
    return [
      {
        rotulo: t('clinico.meuDia.versoes.lista.detalhe.naSala'),
        valor: formato.duracao(minutosDesde(item.iniciadoEm ?? item.inicio)),
      },
      { rotulo: t('clinico.meuDia.versoes.lista.detalhe.sala'), valor: props.dia.salasDe(item) },
      {
        rotulo: t('clinico.meuDia.versoes.lista.detalhe.profissional'),
        valor: props.dia.profissionaisDe(item).split(' ')[0],
      },
    ]
  }

  return [
    item.status === 'aguardando'
      ? {
          rotulo: t('clinico.meuDia.versoes.lista.detalhe.espera'),
          valor: formato.duracao(minutosDesde(item.chegadaEm)),
        }
      : {
          rotulo: t('clinico.meuDia.versoes.lista.detalhe.horario'),
          valor: formato.hora(item.inicio),
        },
    {
      rotulo: t('clinico.meuDia.versoes.lista.detalhe.posicao'),
      valor: t('clinico.meuDia.versoes.lista.detalhe.posicaoValor', { n: posicao + 1 }),
    },
    { rotulo: t('clinico.meuDia.versoes.lista.detalhe.depois'), valor: depois },
  ]
})
</script>

<template>
  <UiPagina
    class="ls"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <template #cabecalho>
      <header class="ls-cabeca">
        <RouterLink
          class="ls-redondo"
          to="/inicio"
          :aria-label="t('clinico.meuDia.versoes.lista.voltar')"
          :title="t('clinico.meuDia.versoes.lista.voltar')"
        >
          <i class="ph ph-arrow-left" aria-hidden="true" />
        </RouterLink>
        <h1>{{ t('clinico.meuDia.versoes.lista.titulo') }}</h1>
        <div class="ls-cabeca__fim">
          <Button
            type="button"
            class="ls-redondo"
            :class="{ 'ls-redondo--ativo': filtrosAbertos }"
            :aria-label="t('clinico.meuDia.versoes.lista.filtros.botao')"
            :aria-pressed="filtrosAbertos"
            @click="filtrosAbertos = !filtrosAbertos"
          >
            <i class="ph ph-funnel-simple" aria-hidden="true" />
          </Button>
          <RouterLink class="ls-novo" :to="{ path: '/veterinario/agenda', query: { novo: '1' } }">
            <i class="ph ph-plus" aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.lista.novo') }}
          </RouterLink>
        </div>
      </header>
    </template>

    <!-- Em cima: os números da recepção e a sala de agora. -->
    <div class="ls-topo">
      <section class="ls-cartao ls-numeros" :aria-label="t('clinico.meuDia.abertura.indicadores')">
        <dl class="ls-numeros__trio">
          <div>
            <dt>{{ t('clinico.meuDia.versoes.lista.numeros.recepcao') }}</dt>
            <dd>
              <strong>{{ dia.naRecepcao.length }}</strong>
              {{ t('clinico.meuDia.versoes.lista.numeros.pets', dia.naRecepcao.length) }}
            </dd>
          </div>
          <div>
            <dt>{{ t('clinico.meuDia.versoes.lista.numeros.espera') }}</dt>
            <dd>
              <strong>{{ maiorEspera }}</strong>
              {{ t('clinico.meuDia.versoes.lista.numeros.min') }}
            </dd>
          </div>
          <div>
            <dt>{{ t('clinico.meuDia.versoes.lista.numeros.fimDoDia') }}</dt>
            <dd>
              <strong>{{ ateOFim }}</strong>
              {{ t('clinico.meuDia.versoes.lista.numeros.atendimentos', ateOFim) }}
            </dd>
          </div>
        </dl>

        <div class="ls-horas">
          <p class="ls-horas__cabeca">
            <span>{{ t('clinico.meuDia.versoes.lista.porHorario') }}</span>
            <span class="ls-horas__legenda">
              <span aria-hidden="true" />
              {{ t('clinico.meuDia.versoes.lista.horaPassou') }}
            </span>
          </p>
          <ol class="ls-horas__lista">
            <li v-for="hora in horas" :key="hora.hora" class="ls-hora">
              <span class="ls-hora__rotulo">
                {{ t('clinico.meuDia.versoes.lista.hora', { h: hora.hora }) }}
              </span>
              <span class="ls-hora__barra" aria-hidden="true">
                <span :style="{ width: `${Math.round(hora.passou * 100)}%` }" />
              </span>
              <span v-if="hora.itens.length" class="ls-hora__gente">
                <span class="ls-hora__rostos" aria-hidden="true">
                  <PetAvatar
                    v-for="item in hora.itens.slice(0, 3)"
                    :key="item.id"
                    :nome="nomeDo(item)"
                    :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                    :especie="dia.pet(item.petId)?.especie ?? null"
                    :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                    tamanho="sm"
                  />
                </span>
                <span class="ls-hora__conta">{{ hora.itens.length }}</span>
              </span>
            </li>
          </ol>
        </div>
      </section>

      <section class="ls-cartao ls-sala" aria-labelledby="ls-sala-titulo">
        <header class="ls-sala__cabeca">
          <h2 id="ls-sala-titulo">
            {{
              emDestaque
                ? t('clinico.meuDia.versoes.lista.sala.agoraNo', { sala: dia.salasDe(emDestaque) })
                : t('clinico.meuDia.versoes.lista.sala.nenhuma')
            }}
          </h2>
          <RouterLink
            v-if="emDestaque"
            class="ls-redondo ls-redondo--pequeno"
            :to="dia.rotaDoProntuario(emDestaque)"
            :aria-label="t('clinico.meuDia.versoes.lista.sala.abrir')"
            :title="t('clinico.meuDia.versoes.lista.sala.abrir')"
          >
            <i class="ph ph-arrow-up-right" aria-hidden="true" />
          </RouterLink>
        </header>

        <p v-if="emDestaque" class="ls-sala__tempo">
          <strong>{{ minutosDesde(emDestaque.iniciadoEm ?? emDestaque.inicio) }}</strong>
          {{ t('clinico.meuDia.versoes.lista.numeros.min') }}
          <span class="ls-sala__chip">
            <i class="ph ph-stethoscope" aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.lista.sala.emConsulta', { pet: nomeDo(emDestaque) }) }}
          </span>
        </p>

        <div class="ls-sala__pe">
          <ul class="ls-lugares">
            <li v-for="lugar in lugares" :key="lugar.id">
              <Button
                v-if="lugar.tipo === 'sala'"
                type="button"
                class="ls-lugar"
                :class="{ 'ls-lugar--ativo': emDestaque?.id === lugar.id }"
                :aria-pressed="emDestaque?.id === lugar.id"
                @click="salaEscolhida = lugar.id"
              >
                <small>{{ lugar.lugar }}</small>
                <strong>{{ lugar.titulo }}</strong>
                <span>{{ lugar.detalhe }}</span>
              </Button>
              <RouterLink v-else class="ls-lugar ls-lugar--urgente" :to="lugar.to">
                <small><span aria-hidden="true" />{{ lugar.lugar }}</small>
                <strong>{{ lugar.titulo }}</strong>
              </RouterLink>
            </li>
          </ul>
          <Button
            v-if="emDestaque"
            type="button"
            class="ls-continuar"
            :label="t('clinico.meuDia.versoes.lista.sala.continuar')"
            @click="dia.abrirProntuario(emDestaque)"
          />
        </div>
      </section>
    </div>

    <!-- Os filtros: valem para a lista da folha. -->
    <div v-show="filtrosAbertos" class="ls-filtros">
      <span class="ls-filtros__rotulo">
        {{ t('clinico.meuDia.versoes.lista.filtros.ativos') }}
        <span class="ls-contagem">{{ filtrosAtivos }}</span>
      </span>
      <Select
        v-model="profissional"
        :options="opcoesDeProfissional"
        option-label="rotulo"
        option-value="valor"
        :aria-label="t('clinico.meuDia.versoes.lista.filtros.profissional')"
        class="ls-filtro"
      />
      <Select
        v-model="servico"
        :options="opcoesDeServico"
        option-label="rotulo"
        option-value="valor"
        :aria-label="t('clinico.meuDia.versoes.lista.filtros.servico')"
        class="ls-filtro"
      />
      <Select
        v-model="periodo"
        :options="opcoesDePeriodo"
        option-label="rotulo"
        option-value="valor"
        :aria-label="t('clinico.meuDia.versoes.lista.filtros.periodo')"
        class="ls-filtro ls-filtro--curto"
      >
        <template #value="{ value }">
          <span class="ls-filtro__valor">
            {{ opcoesDePeriodo.find((opcao) => opcao.valor === value)?.rotulo }}
            <i :class="iconeDoPeriodo" aria-hidden="true" />
          </span>
        </template>
      </Select>
      <span class="ls-busca">
        <InputText
          v-model="busca"
          type="search"
          :placeholder="t('clinico.meuDia.versoes.lista.filtros.busca')"
          :aria-label="t('clinico.meuDia.versoes.lista.filtros.busca')"
        />
        <i class="ph ph-magnifying-glass" aria-hidden="true" />
      </span>
    </div>

    <!-- A folha: as abas, a lista e o paciente escolhido. -->
    <section class="ls-folha" :aria-label="t('clinico.meuDia.versoes.lista.abas.aria')">
      <SelectButton
        v-model="aba"
        :options="abas"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('clinico.meuDia.versoes.lista.abas.aria')"
        class="ls-abas"
      >
        <template #option="{ option }">
          <span class="ls-aba">
            {{ option.rotulo }}
            <span class="ls-aba__conta" :class="{ 'ls-aba__conta--urgente': option.urgente }">
              {{ option.total }}
            </span>
          </span>
        </template>
      </SelectButton>

      <div class="ls-folha__miolo">
        <!-- A lista. -->
        <div class="ls-lista">
          <h2 class="ls-lista__titulo">
            {{ abas.find((opcao) => opcao.valor === aba)?.rotulo }}
          </h2>

          <ul v-if="aba === 'internacao' && internacao.length" class="ls-linhas">
            <li v-for="linha in internacao" :key="linha.id">
              <Button
                type="button"
                class="ls-linha"
                :class="{ 'ls-linha--escolhida': linhaEscolhida?.id === linha.id }"
                :aria-pressed="linhaEscolhida?.id === linha.id"
                @click="linhaEscolhidaId = linha.id"
              >
                <span
                  class="ls-linha__icone"
                  :class="`ls-linha__icone--${linha.tom}`"
                  aria-hidden="true"
                >
                  <i :class="linha.tom === 'risco' ? 'ph ph-warning-octagon' : 'ph ph-bed'" />
                </span>
                <span class="ls-linha__texto">
                  <strong>{{ linha.frase }}</strong>
                  <small>{{ linha.detalhe }}</small>
                </span>
              </Button>
            </li>
          </ul>

          <ul v-else-if="aba !== 'internacao' && listaVisivel.length" class="ls-linhas">
            <li v-for="item in listaVisivel" :key="item.id">
              <Button
                type="button"
                class="ls-linha"
                :class="{ 'ls-linha--escolhida': escolhido?.id === item.id }"
                :aria-pressed="escolhido?.id === item.id"
                @click="escolhidoId = item.id"
              >
                <PetAvatar
                  :nome="nomeDo(item)"
                  :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                  :especie="dia.pet(item.petId)?.especie ?? null"
                  :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="ls-linha__texto">
                  <strong>{{ nomeDo(item) }}</strong>
                  <small>
                    <template v-if="dia.alertasRelevantes(dia.pet(item.petId)).length">
                      <i class="ph ph-warning ls-linha__alerta" aria-hidden="true" />
                    </template>
                    {{
                      [
                        dia.tipoDe(item),
                        item.status === 'aguardando'
                          ? t('clinico.meuDia.versoes.lista.estado.naRecepcao').toLowerCase()
                          : dia.profissionaisDe(item),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </small>
                </span>
                <span class="ls-pilula" :class="`ls-pilula--${estadoDe(item).tom}`">
                  {{ estadoDe(item).rotulo }}
                </span>
                <span class="ls-linha__valor">{{ estadoDe(item).valor }}</span>
              </Button>
            </li>
          </ul>

          <p v-else class="ls-vazio">
            {{
              filtrosAtivos
                ? t('clinico.meuDia.versoes.lista.vazio.filtro')
                : aba === 'sala'
                  ? t('clinico.meuDia.versoes.lista.vazio.sala')
                  : aba === 'internacao'
                    ? t('clinico.meuDia.versoes.lista.vazio.internacao')
                    : t('clinico.meuDia.semProximo')
            }}
          </p>

          <Button
            v-if="aba === 'fila' && (escondidos > 0 || filaAberta)"
            type="button"
            text
            class="ls-mais"
            :label="
              filaAberta
                ? t('clinico.meuDia.versoes.lista.fila.menos')
                : t('clinico.meuDia.versoes.lista.fila.outros', { n: escondidos }, escondidos)
            "
            :icon="filaAberta ? 'ph ph-arrow-up' : 'ph ph-arrow-right'"
            icon-pos="right"
            :aria-expanded="filaAberta"
            @click="filaAberta = !filaAberta"
          />
        </div>

        <!-- O escolhido da internação. -->
        <article v-if="aba === 'internacao' && linhaEscolhida" class="ls-detalhe">
          <div class="ls-detalhe__topo">
            <div class="ls-campo ls-campo--largo">
              <span class="ls-campo__rotulo">{{ linhaEscolhida.onde }}</span>
              <p class="ls-detalhe__frase">{{ linhaEscolhida.frase }}</p>
              <span class="ls-campo__apoio">{{ linhaEscolhida.detalhe }}</span>
            </div>
          </div>
          <div class="ls-detalhe__pe">
            <span />
            <RouterLink class="p-button p-component ls-acao" :to="linhaEscolhida.to">
              {{ t('clinico.meuDia.versoes.lista.internacao.abrir') }}
            </RouterLink>
          </div>
        </article>

        <!-- O paciente escolhido. -->
        <article
          v-else-if="aba !== 'internacao' && escolhido && petEscolhido"
          class="ls-detalhe"
          aria-labelledby="ls-detalhe-nome"
        >
          <div class="ls-detalhe__topo">
            <div class="ls-campo">
              <span class="ls-campo__rotulo">
                {{ t('clinico.meuDia.versoes.lista.detalhe.paciente') }}
              </span>
              <span class="ls-detalhe__nome">
                <strong id="ls-detalhe-nome">{{ petEscolhido.nome }}</strong>
                <span class="ls-detalhe__chip">{{ chipDoEscolhido }}</span>
              </span>
            </div>
            <div class="ls-campo">
              <span class="ls-campo__rotulo">
                {{ t('clinico.meuDia.versoes.lista.detalhe.atendimento') }}
              </span>
              <strong class="ls-campo__valor">{{ dia.tipoDe(escolhido) }}</strong>
              <span class="ls-campo__apoio">
                {{
                  t('clinico.meuDia.versoes.lista.sala.com', {
                    vet: dia.profissionaisDe(escolhido),
                  })
                }}
              </span>
            </div>
            <div class="ls-campo">
              <span class="ls-campo__rotulo">
                {{
                  alertaDoEscolhido
                    ? formato.alerta(alertaDoEscolhido.kind)
                    : t('clinico.meuDia.versoes.lista.detalhe.responsavel')
                }}
              </span>
              <span class="ls-campo__icone">
                <span aria-hidden="true">
                  <i :class="alertaDoEscolhido ? 'ph ph-heartbeat' : 'ph ph-user'" />
                </span>
                <strong>
                  {{
                    alertaDoEscolhido
                      ? (alertaDoEscolhido.detalhe ?? formato.alerta(alertaDoEscolhido.kind))
                      : (dia.tutor(escolhido.tutorId)?.nome ?? '')
                  }}
                </strong>
              </span>
            </div>
          </div>

          <ul class="ls-atalhos">
            <li v-for="atalho in atalhos" :key="atalho.id">
              <RouterLink class="ls-atalho" :to="atalho.to">
                <span class="ls-atalho__icone" aria-hidden="true"><i :class="atalho.icone" /></span>
                <i class="ph ph-arrow-up-right ls-atalho__seta" aria-hidden="true" />
                <strong>{{ atalho.rotulo }}</strong>
              </RouterLink>
            </li>
            <li>
              <RouterLink
                class="ls-atalho ls-atalho--novo"
                :to="{
                  path: '/veterinario/agenda',
                  query: { novo: '1', paciente: escolhido.petId },
                }"
                :aria-label="
                  t('clinico.meuDia.versoes.lista.detalhe.agendar', { pet: petEscolhido.nome })
                "
                :title="
                  t('clinico.meuDia.versoes.lista.detalhe.agendar', { pet: petEscolhido.nome })
                "
              >
                <span class="ls-atalho__mais" aria-hidden="true"><i class="ph ph-plus" /></span>
              </RouterLink>
            </li>
          </ul>

          <div class="ls-detalhe__pe">
            <dl class="ls-rodape">
              <div v-for="campo in rodape" :key="campo.rotulo">
                <dt>{{ campo.rotulo }}</dt>
                <dd>{{ campo.valor }}</dd>
              </div>
            </dl>
            <div class="ls-detalhe__acoes">
              <RouterLink
                v-if="escolhido.status === 'aguardando' || escolhido.status === 'em-atendimento'"
                class="ls-redondo ls-redondo--noite"
                :to="dia.focoNaAgenda(escolhido.id)"
                :aria-label="t('clinico.fila.aceite.verNaAgenda')"
                :title="t('clinico.fila.aceite.verNaAgenda')"
              >
                <i class="ph ph-calendar-blank" aria-hidden="true" />
              </RouterLink>
              <Button
                v-if="escolhido.status === 'aguardando' || escolhido.status === 'em-atendimento'"
                type="button"
                class="ls-acao"
                icon="ph ph-door-open"
                :label="
                  escolhido.status === 'aguardando'
                    ? t('clinico.hoje.chamar')
                    : t('clinico.meuDia.versoes.lista.sala.continuar')
                "
                @click="dia.abrirProntuario(escolhido)"
              />
              <RouterLink
                v-else
                class="p-button p-component ls-acao"
                :to="dia.focoNaAgenda(escolhido.id)"
              >
                <i class="ph ph-calendar-blank" aria-hidden="true" />
                {{ t('clinico.fila.aceite.verNaAgenda') }}
              </RouterLink>
            </div>
          </div>
        </article>
      </div>
    </section>

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<!-- Em tela estreita a moldura é a do portal: a área de conteúdo vira o fundo da mesa. -->
<style>
.palco__conteudo:has(.ls) {
  background: var(--ls-fundo, #edf1ef);
}
</style>

<style scoped>
.ls.ls {
  max-width: none;
  padding: 8px 20px 40px;
}

/* --------------------------------------------------------------------------- cabeçalho */

.ls-cabeca {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 16px;
}

.ls-cabeca h1 {
  margin: 0;
  color: var(--ls-tinta);
  font-family: var(--ls-display);
  font-size: 38px;
  font-weight: 560;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.ls-cabeca__fim {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-inline-start: auto;
}

/* O botão redondo de contorno: voltar, filtros, abrir. */
.ls-redondo,
.ls-redondo.p-button {
  display: inline-grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 1px solid var(--ls-linha-forte);
  border-radius: 50%;
  background: transparent;
  color: var(--ls-tinta);
  font-size: 18px;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.ls-redondo:hover,
.ls-redondo.p-button:hover {
  background: var(--ls-cartao-2);
}

.ls-redondo--ativo.p-button {
  border-color: transparent;
  background: var(--ls-cartao);
}

.ls-redondo--pequeno {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.ls-redondo--noite {
  border-color: var(--ls-noite-linha);
  color: var(--ls-sobre-noite);
}

.ls-redondo--noite:hover {
  background: var(--ls-noite-2);
}

.ls-novo {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  border: 1px solid var(--ls-linha-forte);
  border-radius: 999px;
  color: var(--ls-tinta);
  font-size: 14.5px;
  font-weight: 650;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.ls-novo:hover {
  background: var(--ls-cartao-2);
}

.ls-redondo:focus-visible,
.ls-novo:focus-visible,
.ls-atalho:focus-visible,
.ls-lugar:focus-visible {
  outline: 2px solid var(--ls-marca);
  outline-offset: 2px;
}

/* ------------------------------------------------------------------------------- topo */

.ls-topo {
  display: grid;
  gap: 16px;
  margin-top: 4px;
  grid-template-columns: minmax(0, 2fr) minmax(340px, 1fr);
}

.ls-cartao {
  min-width: 0;
  padding: 22px 24px;
  border-radius: 26px;
  background: var(--ls-cartao);
  box-shadow: inset 0 0 0 1px var(--ls-linha);
}

.ls-numeros {
  display: grid;
  gap: 28px;
}

.ls-numeros__trio {
  display: grid;
  margin: 0;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ls-numeros__trio dt {
  color: var(--ls-tinta-2);
  font-size: 14px;
}

.ls-numeros__trio dd {
  margin: 10px 0 0;
  color: var(--ls-tinta-2);
  font-size: 16px;
}

.ls-numeros__trio strong {
  margin-inline-end: 4px;
  color: var(--ls-tinta);
  font-family: var(--ls-display);
  font-size: 46px;
  font-variant-numeric: tabular-nums;
  font-weight: 520;
  letter-spacing: -0.03em;
  line-height: 1;
}

.ls-horas__cabeca {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 12px;
  color: var(--ls-tinta-2);
  font-size: 13px;
}

.ls-horas__legenda {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ls-horas__legenda span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ls-marca);
}

.ls-horas__lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  list-style: none;
}

.ls-hora {
  display: grid;
  gap: 8px;
}

.ls-hora__rotulo {
  color: var(--ls-tinta);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.ls-hora__barra {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--ls-cartao-2);
}

.ls-hora__barra span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ls-marca);
}

.ls-hora__gente {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.ls-hora__rostos {
  display: inline-flex;
}

.ls-hora__rostos :deep(.avatar) {
  box-shadow: 0 0 0 2px var(--ls-cartao);
}

.ls-hora__rostos :deep(.avatar + .avatar) {
  margin-inline-start: -8px;
}

.ls-hora__conta {
  display: inline-grid;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  place-items: center;
  border-radius: 999px;
  background: var(--ls-cartao-2);
  color: var(--ls-tinta);
  font-size: 13px;
  font-weight: 650;
}

/* A sala de agora. */
.ls-sala {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ls-sala__cabeca {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ls-sala__cabeca h2 {
  margin: 0;
  color: var(--ls-tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.ls-sala__tempo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin: 0;
  color: var(--ls-tinta-2);
  font-size: 16px;
}

.ls-sala__tempo strong {
  color: var(--ls-tinta);
  font-family: var(--ls-display);
  font-size: 46px;
  font-variant-numeric: tabular-nums;
  font-weight: 520;
  letter-spacing: -0.03em;
  line-height: 1;
}

.ls-sala__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--ls-linha-forte);
  color: var(--ls-tinta);
  font-size: 13px;
  font-weight: 600;
}

.ls-sala__pe {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: auto;
}

.ls-lugares {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-end;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ls-lugares li {
  min-width: 0;
  flex: 1;
}

.ls-lugar,
.ls-lugar.p-button {
  display: grid;
  width: 100%;
  min-height: 72px;
  align-content: end;
  justify-content: start;
  justify-items: start;
  gap: 2px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: var(--ls-cartao-2);
  color: var(--ls-tinta);
  text-align: start;
  text-decoration: none;
}

.ls-lugar--ativo.p-button {
  min-height: 92px;
  background: var(--ls-marca);
  color: var(--ls-sobre-marca);
}

.ls-lugar small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  opacity: 0.8;
}

.ls-lugar small span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ls-coral);
}

.ls-lugar strong {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.25;
}

.ls-lugar span {
  font-size: 11.5px;
}

.ls-lugar--urgente strong {
  font-size: 12px;
  font-weight: 600;
}

.ls-continuar.p-button {
  flex: none;
  min-height: 52px;
  padding-inline: 22px;
  border: 0;
  background: var(--ls-tinta);
  color: var(--ls-cartao);
  font-weight: 650;
}

.ls-continuar.p-button:hover {
  background: color-mix(in srgb, var(--ls-tinta) 88%, var(--ls-marca));
}

/* ---------------------------------------------------------------------------- filtros */

.ls-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 20px 0 0;
}

.ls-filtros__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-inline-end: 6px;
  color: var(--ls-tinta);
  font-size: 14px;
  font-weight: 650;
}

.ls-contagem {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: var(--ls-tinta);
  color: var(--ls-cartao);
  font-size: 12px;
  font-weight: 700;
}

.ls-filtro {
  width: 236px;
}

.ls-filtro--curto {
  width: 168px;
}

.ls-filtro__valor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ls-busca {
  position: relative;
  min-width: 220px;
  flex: 1;
}

.ls-busca i {
  position: absolute;
  top: 50%;
  right: 16px;
  color: var(--ls-tinta-2);
  font-size: 17px;
  pointer-events: none;
  transform: translateY(-50%);
}

/* ------------------------------------------------------------------------------ folha */

.ls-folha {
  position: relative;
  margin-top: 40px;
  padding: 44px 20px 20px;
  border-radius: 30px;
  background: var(--ls-folha);
  color: var(--ls-folha-tinta);
}

/* As abas, presas na borda de cima da folha, na noite. */
.ls-abas.ls-abas.ls-abas.ls-abas.ls-abas {
  position: absolute;
  top: 0;
  left: 50%;
  padding: 5px;
  border: 8px solid var(--ls-fundo);
  border-radius: 999px;
  background: var(--ls-abas);
  transform: translate(-50%, -50%);
}

.ls-abas.ls-abas.ls-abas.ls-abas.ls-abas :deep(.p-togglebutton) {
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  color: var(--ls-sobre-noite);
}

/* O tema escuro pinta o miolo da aba escolhida por cima da sálvia: aqui ele fica transparente. */
.ls-abas.ls-abas.ls-abas.ls-abas.ls-abas
  :deep(.p-togglebutton.p-togglebutton-checked .p-togglebutton-content) {
  background: transparent;
  box-shadow: none;
}

.ls-abas.ls-abas.ls-abas.ls-abas.ls-abas :deep(.p-togglebutton.p-togglebutton-checked) {
  background: var(--ls-marca);
  color: var(--ls-sobre-marca);
}

.ls-abas.ls-abas.ls-abas.ls-abas.ls-abas :deep(.p-togglebutton-content) {
  padding: 8px 16px;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
}

.ls-aba {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.ls-aba__conta {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  background: rgb(255 255 255 / 14%);
  font-size: 12px;
  font-weight: 700;
}

.ls-aba__conta--urgente {
  background: var(--ls-coral);
  color: #fff;
}

.p-togglebutton-checked .ls-aba__conta:not(.ls-aba__conta--urgente) {
  background: var(--ls-abas);
  color: var(--ls-sobre-noite);
}

.ls-folha__miolo {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(340px, 0.95fr) minmax(0, 1.25fr);
}

/* A lista. */
.ls-lista {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.ls-lista__titulo {
  margin: 0 0 8px;
  padding-inline: 8px;
  color: var(--ls-folha-tinta);
  font-family: var(--ls-display);
  font-size: 19px;
  font-weight: 650;
}

.ls-linhas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ls-linha.p-button {
  display: grid;
  width: 100%;
  min-height: 64px;
  align-items: center;
  gap: 12px;
  padding: 8px 14px 8px 8px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: var(--ls-folha-tinta);
  grid-template-columns: 40px minmax(0, 1fr) auto 64px;
  text-align: start;
}

.ls-linha.p-button:hover {
  background: var(--ls-folha-2);
}

.ls-linha.p-button:focus-visible {
  outline: 2px solid var(--ls-folha-marca);
  outline-offset: -2px;
}

.ls-linha--escolhida.p-button,
.ls-linha--escolhida.p-button:hover {
  background: var(--ls-noite);
  color: var(--ls-sobre-noite);
}

.ls-linha__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ls-linha__texto strong {
  overflow: hidden;
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ls-linha__texto small {
  overflow: hidden;
  color: var(--ls-folha-tinta-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ls-linha--escolhida .ls-linha__texto small {
  color: var(--ls-sobre-noite-2);
}

.ls-linha__alerta {
  color: var(--ls-folha-ambar);
}

.ls-linha--escolhida .ls-linha__alerta {
  color: var(--ls-ambar);
}

.ls-linha__valor {
  font-family: var(--ls-display);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  text-align: end;
  white-space: nowrap;
}

.ls-linha__icone {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  background: var(--ls-folha-2);
  color: var(--ls-folha-tinta-2);
  font-size: 18px;
}

.ls-linha__icone--risco {
  color: var(--ls-folha-coral);
}

.ls-linhas li:has(.ls-linha__icone) .ls-linha.p-button {
  grid-template-columns: 40px minmax(0, 1fr);
}

/* O estado em pílula: clara na folha, branca na linha escolhida. */
.ls-pilula {
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--ls-folha-2);
  color: var(--ls-folha-tinta);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.ls-pilula--espera {
  color: var(--ls-folha-ambar);
}

.ls-pilula--sala {
  color: var(--ls-folha-marca);
}

.ls-linha--escolhida .ls-pilula {
  background: #fff;
  color: #142721;
}

.ls-mais.p-button {
  justify-self: start;
  margin-top: 8px;
  padding-inline: 8px;
  color: var(--ls-folha-tinta);
  font-size: 14px;
  font-weight: 650;
  text-decoration: underline;
  text-decoration-color: var(--ls-marca);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.ls-vazio {
  margin: 0;
  padding: 16px 8px;
  color: var(--ls-folha-tinta-2);
  font-size: 15px;
}

/* O paciente escolhido, na noite. */
.ls-detalhe {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 18px;
  padding: 22px;
  border-radius: 26px;
  background: var(--ls-noite);
  color: var(--ls-sobre-noite);
}

.ls-detalhe__topo {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
}

.ls-campo {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 6px;
}

.ls-campo--largo {
  grid-column: 1 / -1;
}

.ls-campo__rotulo {
  color: var(--ls-sobre-noite-2);
  font-size: 12.5px;
}

.ls-campo__valor {
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
}

.ls-campo__apoio {
  color: var(--ls-sobre-noite-2);
  font-size: 13px;
}

.ls-campo__icone {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.ls-campo__icone > span {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--ls-noite-2);
  color: var(--ls-ambar);
  font-size: 17px;
}

.ls-detalhe__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.ls-detalhe__nome strong {
  font-family: var(--ls-display);
  font-size: 34px;
  font-weight: 560;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.ls-detalhe__chip {
  padding: 4px 12px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--ls-noite-linha);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.ls-detalhe__frase {
  margin: 0;
  font-family: var(--ls-display);
  font-size: 26px;
  font-weight: 560;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/* Os atalhos da ficha: quadrados na noite, com o ícone em cima e a seta no canto. */
.ls-atalhos {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  list-style: none;
}

.ls-atalho {
  position: relative;
  display: grid;
  height: 100%;
  min-height: 116px;
  align-content: space-between;
  padding: 14px;
  border-radius: 18px;
  box-shadow: inset 0 0 0 1px var(--ls-noite-linha);
  color: var(--ls-sobre-noite);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.ls-atalho:hover {
  background: var(--ls-noite-2);
}

.ls-atalho__icone {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--ls-noite-2);
  font-size: 16px;
}

.ls-atalho__seta {
  position: absolute;
  top: 14px;
  right: 14px;
  color: var(--ls-sobre-noite-2);
  font-size: 15px;
}

.ls-atalho strong {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
}

.ls-atalho--novo {
  place-items: center;
  border: 1.5px dashed var(--ls-noite-linha);
  box-shadow: none;
}

.ls-atalho__mais {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  background: var(--ls-noite-2);
  font-size: 18px;
}

/* O pé do cartão: os três números do momento e as ações. */
.ls-detalhe__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 14px 14px 14px 18px;
  border-radius: 20px;
  background: var(--ls-noite-2);
}

.ls-rodape {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;
}

.ls-rodape dt {
  color: var(--ls-sobre-noite-2);
  font-size: 12px;
}

.ls-rodape dd {
  margin: 2px 0 0;
  font-family: var(--ls-display);
  font-size: 19px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.ls-detalhe__acoes {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-inline-start: auto;
}

.ls-acao,
.ls-acao.p-button {
  min-height: 48px;
  gap: 8px;
  padding-inline: 22px;
  font-size: 15px;
  text-decoration: none;
}

/* --------------------------------------------------------------------------- estreito */

@media (max-width: 1280px) {
  .ls-topo {
    grid-template-columns: minmax(0, 1fr);
  }

  .ls-folha__miolo {
    grid-template-columns: minmax(0, 1fr);
  }

  .ls-detalhe__topo {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .ls-detalhe__topo .ls-campo:first-child {
    grid-column: 1 / -1;
  }
}
</style>
