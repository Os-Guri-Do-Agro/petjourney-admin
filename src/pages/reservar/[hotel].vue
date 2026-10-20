<script setup lang="ts">
/**
 * A página pública de reserva do hotel — para quem ainda não tem o app.
 *
 * Irmã da página de agendamento da clínica (`/agendar/:clinica`): sem conta e sem senha, o mesmo
 * fluxo do app, o cadastro mínimo no fim e, com `?pedido=<código>`, o acompanhamento do pedido — o
 * endereço que vai na mensagem de confirmação.
 *
 * A tela dividida é a `PaginaPublica`, a mesma da clínica: aqui só o que é do hotel — os seis
 * passos (o pet, as datas, a acomodação, os extras, os dados e a revisão), e no pé as regras da
 * estadia no lugar da equipe: horário de entrada e saída, sinal e cancelamento. Tudo dado do
 * contrato.
 *
 * **Protótipo:** os dados moram na memória desta aba, e a faixa de demonstração leva de volta ao
 * portal só para quem tem sessão.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PaginaPublica, {
  type ContatoDaPagina,
  type PassoDaPagina,
} from '@/components/publico/PaginaPublica.vue'
import FluxoDaReserva from '@/features/hotel/components/pedidos/fluxo/FluxoDaReserva.vue'
import {
  criarFluxoDaReserva,
  proverFluxoDaReserva,
  type EtapaDaReserva,
} from '@/features/hotel/components/pedidos/fluxo/fluxo-da-reserva'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { PedidoDeReservaPeloLink } from '@/features/hotel/contrato/responsavel'
import {
  pedidoDeReservaRepository,
  reservaOnlineDoResponsavel,
} from '@/features/hotel/data/reserva-online'
import { usePedidosDeReservaStore } from '@/features/hotel/stores/pedidos-de-reserva'
import { isAuthenticated } from '@/service/auth/auth-session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useHotelFormat()
const pedidosStore = usePedidosDeReservaStore()

const fluxo = criarFluxoDaReserva({
  canal: 'link',
  tutorId: () => null,
  aoMudar: () => void pedidosStore.avisarMudanca(),
})

proverFluxoDaReserva(fluxo)

const hotel = computed(() => fluxo.hotel.value)
const encontrado = computed(
  () => pedidoDeReservaRepository.configuracao().slug === String(route.params.hotel ?? ''),
)
const endereco = computed(
  () => `${window.location.origin}/reservar/${String(route.params.hotel ?? '')}`,
)

const token = computed(() => (typeof route.query.pedido === 'string' ? route.query.pedido : ''))

onMounted(() => {
  if (encontrado.value) {
    void fluxo.iniciar()
  }
})

// ------------------------------------------------------------------ o hotel, no topo

/** O balcão: o horário em que a recepção responde, sem estado de agora — o relógio, não o ponto. */
const estado = computed(() =>
  hotel.value
    ? {
        tom: 'neutro' as const,
        texto: t('hotel.pedidos.app.balcao', {
          abre: hotel.value.balcao.abre,
          fecha: hotel.value.balcao.fecha,
        }),
      }
    : null,
)

const promessa = computed(() =>
  hotel.value?.recebePedidos
    ? t('hotel.pedidos.link.promessa', { horas: hotel.value.prazoDeRespostaHoras })
    : '',
)

// ------------------------------------------------------------------ os passos

/**
 * As etapas do link em seis passos. O modo e a escolha da acomodação são um passo só: é tudo a
 * resposta de "onde". A urgência fica nas datas — é um desvio delas, não um passo adiante.
 */
const PASSO_DA_ETAPA: Partial<Record<EtapaDaReserva, number>> = {
  'pet-do-link': 0,
  porte: 0,
  datas: 1,
  urgente: 1,
  modo: 2,
  acomodacao: 2,
  extras: 3,
  'seus-dados': 4,
  revisar: 5,
  enviado: 6,
}

const passoAtual = computed(() => PASSO_DA_ETAPA[fluxo.etapa.value] ?? 0)
const emUrgencia = computed(() => fluxo.etapa.value === 'urgente')

const SERVICO: Record<string, string> = {
  BANHO: 'banho',
  TOSA: 'tosa',
  PASSEIO_EXTRA: 'passeio-extra',
}

const passos = computed((): PassoDaPagina[] | null => {
  if (!encontrado.value || !hotel.value || token.value) {
    return null
  }

  const { pedido } = fluxo
  const passo = passoAtual.value
  const caoComPorte = pedido.visitante.especie === 'CANINA' && pedido.visitante.porte

  const pet = [
    pedido.visitante.especie === 'CANINA'
      ? t('hotel.pedidos.app.cao')
      : t('hotel.pedidos.app.gato'),
    caoComPorte ? t(`hotel.porte.${pedido.visitante.porte!.toLowerCase()}`) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const datas =
    fluxo.entradaIso.value && fluxo.saidaIso.value
      ? `${formato.periodo(fluxo.entradaIso.value, fluxo.saidaIso.value)} · ${t(
          'hotel.pedidos.diarias',
          { n: fluxo.diarias.value },
          fluxo.diarias.value,
        )}`
      : ''

  const acomodacao =
    pedido.modo === 'HOTEL_ESCOLHE'
      ? t('hotel.pedidos.app.modo.HOTEL_ESCOLHE')
      : (fluxo.tipoEscolhido.value?.nome ??
        (pedido.modo ? t(`hotel.pedidos.app.modo.${pedido.modo}`) : ''))

  const extras =
    pedido.servicos.length > 0
      ? pedido.servicos.map((servico) => t(`hotel.servico.${SERVICO[servico]}`)).join(', ')
      : t('hotel.pedidos.link.semExtras')

  return [
    { id: 'pet', rotulo: t('hotel.pedidos.link.passos.pet'), valor: passo > 0 ? pet : '' },
    {
      id: 'datas',
      rotulo: t('hotel.pedidos.link.passos.datas'),
      valor: emUrgencia.value ? t('hotel.pedidos.app.etapa.urgente') : passo > 1 ? datas : '',
      desvio: emUrgencia.value,
    },
    {
      id: 'acomodacao',
      rotulo: t('hotel.pedidos.link.passos.acomodacao'),
      valor: passo >= 2 ? acomodacao : '',
    },
    { id: 'extras', rotulo: t('hotel.pedidos.link.passos.extras'), valor: passo > 3 ? extras : '' },
    {
      id: 'dados',
      rotulo: t('clinico.pedidos.link.passos.dados'),
      valor:
        passo > 4 ? `${pedido.visitante.nome.trim()} · ${pedido.visitante.petNome.trim()}` : '',
    },
    { id: 'revisar', rotulo: t('hotel.pedidos.app.etapa.revisar'), valor: '' },
  ]
})

/** "Passo 2 de 6" acima do título. Some na urgência, depois de enviar e no acompanhamento. */
const contagemDoPasso = computed(() =>
  !passos.value || emUrgencia.value || passoAtual.value >= passos.value.length
    ? ''
    : t('clinico.pedidos.link.passos.contagem', {
        atual: passoAtual.value + 1,
        total: passos.value.length,
      }),
)

// ------------------------------------------------------------------ as regras e o contato

/** O que a pessoa precisa saber antes de pedir: a hora de entrar e sair, o sinal e o cancelamento. */
const regras = computed(() =>
  hotel.value
    ? {
        titulo: t('hotel.pedidos.link.regras'),
        linhas: [
          {
            icone: 'ph-clock',
            texto: t('hotel.pedidos.app.regraSaida', {
              entrada: hotel.value.horarioDeEntrada,
              saida: hotel.value.horarioDeSaida,
            }),
          },
          {
            icone: 'ph-hand-coins',
            texto: t('hotel.pedidos.link.regraSinal', {
              percentual: hotel.value.sinalPercentual,
            }),
          },
          {
            icone: 'ph-calendar-x',
            texto: t('hotel.pedidos.app.regraCancelar', {
              dias: hotel.value.cancelamentoSemCustoDias,
            }),
          },
        ],
      }
    : null,
)

const contatos = computed((): ContatoDaPagina[] => {
  const atual = hotel.value

  if (!atual) {
    return []
  }

  const todos = [
    {
      id: 'telefone',
      icone: 'ph-phone',
      rotulo: t('clinico.pedidos.link.telefoneDaClinica'),
      valor: atual.hotel.telefone,
    },
    {
      id: 'whatsapp',
      icone: 'ph-whatsapp-logo',
      rotulo: t('clinico.pedidos.link.whatsappRotulo'),
      valor: atual.urgencia.whatsapp,
    },
  ]

  return todos.filter((item): item is ContatoDaPagina => Boolean(item.valor))
})

// ------------------------------------------------------------------ acompanhamento

const acompanhado = ref<PedidoDeReservaPeloLink | null>(null)
const desistindo = ref(false)

async function carregarAcompanhado() {
  acompanhado.value = token.value
    ? await reservaOnlineDoResponsavel.pedidoPorToken(token.value)
    : null
}

watch(token, carregarAcompanhado, { immediate: true })
watch(() => pedidosStore.versao, carregarAcompanhado)

/** A cor do estado do pedido acompanhado: esperando, reservado, recusado ou parado. */
const tomDaSituacao = computed(() => {
  switch (acompanhado.value?.status) {
    case 'AGUARDANDO_HOTEL':
      return 'espera'
    case 'ACEITO':
      return 'ok'
    case 'RECUSADO':
    case 'EXPIRADO':
      return 'risco'
    default:
      return 'neutro'
  }
})

async function desistir() {
  if (!acompanhado.value) {
    return
  }

  desistindo.value = true

  try {
    await reservaOnlineDoResponsavel.cancelarPedido(acompanhado.value.id)
    await pedidosStore.avisarMudanca()
    await carregarAcompanhado()
  } finally {
    desistindo.value = false
  }
}

function novoPedido() {
  void router.replace({ path: route.path })
}

const demo = computed(() =>
  isAuthenticated()
    ? { texto: t('hotel.pedidos.link.demo'), voltar: t('hotel.pedidos.link.voltarAoPortal') }
    : null,
)
</script>

<template>
  <PaginaPublica
    icone="ph-house-line"
    lugar="hotel"
    :nome="hotel?.hotel.nome ?? null"
    :endereco="hotel?.hotel.endereco"
    :estado="estado"
    :promessa="promessa"
    :passos="passos"
    :passo-atual="passoAtual"
    :titulo-dos-passos="t('hotel.pedidos.link.seuPedido')"
    :rotulo-dos-passos="t('clinico.pedidos.link.passos.rotulo')"
    :rotulo-feito="t('clinico.pedidos.link.passos.feito')"
    :contagem="contagemDoPasso"
    :regras="regras"
    :contatos="contatos"
    :rotulo-dos-contatos="t('clinico.pedidos.link.contato')"
    :assinatura="t('hotel.pedidos.link.rodape')"
    :demo="demo"
    :com-pe="encontrado"
    @voltar="router.push('/hotel/pedidos')"
  >
    <div v-if="!encontrado" class="publica__vazio">
      <i class="ph ph-magnifying-glass" aria-hidden="true" />
      <h2>{{ t('hotel.pedidos.link.naoEncontrado') }}</h2>
      <p>{{ t('hotel.pedidos.link.naoEncontradoAjuda') }}</p>
    </div>

    <!-- Acompanhamento: o pedido do link da mensagem. -->
    <div v-else-if="token" class="publica__acompanhar">
      <template v-if="acompanhado">
        <h2>{{ t('hotel.pedidos.link.seuPedido') }}</h2>

        <section class="ui-folha acompanhar">
          <p class="acompanhar__situacao" :class="`acompanhar__situacao--${tomDaSituacao}`">
            <span class="acompanhar__disco" aria-hidden="true">
              <i
                class="ph"
                :class="{
                  'ph-hourglass-medium': acompanhado.status === 'AGUARDANDO_HOTEL',
                  'ph-calendar-check': acompanhado.status === 'ACEITO',
                  'ph-calendar-x':
                    acompanhado.status === 'RECUSADO' || acompanhado.status === 'EXPIRADO',
                  'ph-x-circle': acompanhado.status === 'CANCELADO_PELO_RESPONSAVEL',
                }"
              />
            </span>
            {{ t(`hotel.pedidos.link.situacao.${acompanhado.status}`) }}
          </p>

          <p class="acompanhar__oque">{{ acompanhado.pets.map((pet) => pet.nome).join(', ') }}</p>
          <p class="acompanhar__linha">
            <i class="ph ph-calendar-blank" aria-hidden="true" />
            {{ formato.periodo(acompanhado.entrada, acompanhado.saida) }}
          </p>
          <p v-if="acompanhado.reserva" class="acompanhar__linha acompanhar__linha--forte">
            <i class="ph ph-bed" aria-hidden="true" />
            {{ acompanhado.reserva.acomodacao }} ·
            {{ formato.moeda(acompanhado.reserva.totalCentavos) }}
          </p>
          <p v-if="acompanhado.reserva" class="acompanhar__linha">
            <i class="ph ph-hand-coins" aria-hidden="true" />
            {{
              t('hotel.pedidos.link.sinal', {
                valor: formato.moeda(acompanhado.reserva.sinalCentavos),
              })
            }}
          </p>
          <blockquote v-if="acompanhado.recusa" class="acompanhar__mensagem">
            {{ acompanhado.recusa.mensagemDoHotel }}
          </blockquote>
        </section>

        <div class="publica__acoes">
          <Button
            :label="t('hotel.pedidos.link.outroPedido')"
            icon="ph ph-calendar-plus"
            @click="novoPedido"
          />
          <Button
            v-if="acompanhado.podeCancelar"
            severity="secondary"
            outlined
            :label="t('hotel.pedidos.app.desistir')"
            :loading="desistindo"
            @click="desistir"
          />
        </div>
      </template>
      <div v-else class="publica__vazio">
        <i class="ph ph-magnifying-glass" aria-hidden="true" />
        <h2>{{ t('hotel.pedidos.link.pedidoNaoEncontrado') }}</h2>
        <div class="publica__acoes">
          <Button
            :label="t('hotel.pedidos.link.outroPedido')"
            icon="ph ph-calendar-plus"
            @click="novoPedido"
          />
        </div>
      </div>
    </div>

    <FluxoDaReserva v-else :endereco-do-link="endereco" />
  </PaginaPublica>
</template>
