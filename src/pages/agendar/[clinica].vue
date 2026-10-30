<script setup lang="ts">
/**
 * A página pública de agendamento da clínica — para quem ainda não tem o app.
 *
 * É o endereço que a clínica põe no Instagram, no WhatsApp e no cartão do balcão. Abre no celular
 * de quem nunca ouviu falar do PetJourney, então a página não pede conta nem senha: mostra a
 * clínica, o horário de atendimento e o contato de emergência, e o mesmo fluxo do app — com o
 * cadastro mínimo no fim, depois de a pessoa ter visto que tem vaga.
 *
 * Com `?pedido=<código>`, vira a página de acompanhamento daquele pedido: é o endereço que vai na
 * mensagem de confirmação, o único lugar onde quem não tem o app vê a resposta e desiste.
 *
 * **Protótipo.** Os dados moram na memória desta aba: o pedido feito aqui aparece na caixa da
 * recepção porque o portal abre a página na mesma aba. Por isso a faixa de demonstração no topo
 * leva de volta ao portal — ela some quando não há sessão, como seria para o responsável.
 *
 * A tela dividida é a `PaginaPublica`, a mesma do hotel: aqui só o que é da clínica — os cinco
 * passos, quem atende e o contato. Tudo dado do contrato, nada inventado para encher.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PaginaPublica, {
  type ContatoDaPagina,
  type PassoDaPagina,
} from '@/components/publico/PaginaPublica.vue'
import FluxoDoPedido from '@/features/clinico/components/pedidos/fluxo/FluxoDoPedido.vue'
import {
  criarFluxoDoPedido,
  proverFluxo,
  type EtapaDoFluxo,
} from '@/features/clinico/components/pedidos/fluxo/fluxo-do-pedido'
import { useRotulosDoPedido } from '@/features/clinico/composables/useRotulosDoPedido'
import type { OpcaoDeHorario, PedidoPeloLink } from '@/features/clinico/contrato/responsavel'
import {
  agendamentoOnlineDoResponsavel,
  pedidoRepository,
} from '@/features/clinico/data/agendamento-online'
import { SLUG_DA_CLINICA } from '@/features/clinico/data/seed-pedidos'
import { usePedidosStore } from '@/features/clinico/stores/pedidos'
import { isAuthenticated } from '@/service/auth/auth-session'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoPedido()
const pedidosStore = usePedidosStore()

const fluxo = criarFluxoDoPedido({
  canal: 'link',
  tutorId: () => null,
  aoMudar: () => void pedidosStore.avisarMudanca(),
})

proverFluxo(fluxo)

const clinica = computed(() => fluxo.clinica.value)
/* O endereço antigo da demonstração continua abrindo: link divulgado não pode virar "não encontrada". */
const encontrada = computed(() =>
  [pedidoRepository.configuracao().slug, SLUG_DA_CLINICA].includes(
    String(route.params.clinica ?? ''),
  ),
)

const endereco = computed(
  () => `${window.location.origin}/agendar/${String(route.params.clinica ?? '')}`,
)

/** O código do pedido acompanhado; vazio é a página de pedir. */
const token = computed(() => (typeof route.query.pedido === 'string' ? route.query.pedido : ''))

onMounted(() => {
  if (encontrada.value) {
    void fluxo.iniciar()
  }
})

// ------------------------------------------------------------------ a clínica, no topo

const estado = computed(() => {
  const emergencia = clinica.value?.emergencia

  if (!emergencia) {
    return null
  }

  if (emergencia.abertaAgora) {
    return {
      tom: 'aberto' as const,
      texto: t('clinico.pedidos.app.abertaAte', { hora: emergencia.fechaAs }),
    }
  }

  return emergencia.abreEm
    ? {
        tom: 'fechado' as const,
        texto: t('clinico.pedidos.app.fechadaAbre', { quando: rotulos.quando(emergencia.abreEm) }),
      }
    : null
})

const promessa = computed(() =>
  clinica.value?.recebePedidos
    ? t('clinico.pedidos.link.promessa', { horas: clinica.value.prazoDeRespostaHoras })
    : '',
)

// ------------------------------------------------------------------ os passos

/**
 * As etapas do link em cinco passos. "Com quem", o calendário e o "quando você pode" são um passo
 * só para quem pede: é tudo a resposta de "quando". A emergência fica no primeiro — é um desvio do
 * motivo, não um passo adiante.
 */
const PASSO_DA_ETAPA: Partial<Record<EtapaDoFluxo, number>> = {
  motivo: 0,
  emergencia: 0,
  modo: 1,
  profissional: 2,
  horario: 2,
  preferencia: 2,
  'seus-dados': 3,
  revisar: 4,
  enviado: 5,
}

const passoAtual = computed(() => PASSO_DA_ETAPA[fluxo.etapa.value] ?? 0)
const emEmergencia = computed(() => fluxo.etapa.value === 'emergencia')

/** A reserva vira pedido no envio e some do fluxo; o passo continua dizendo o horário escolhido. */
const ultimaOpcao = ref<OpcaoDeHorario | null>(null)

watch(
  () => fluxo.reserva.value,
  (reserva) => {
    if (reserva) {
      ultimaOpcao.value = reserva.opcao
    }
  },
)

const quandoEscolhido = computed(() => {
  const { pedido } = fluxo

  if (pedido.modo === 'HORARIO_ESCOLHIDO') {
    if (passoAtual.value > 2 && ultimaOpcao.value) {
      return `${rotulos.quando(ultimaOpcao.value.inicio)} · ${ultimaOpcao.value.profissional.nome}`
    }

    return passoAtual.value === 2
      ? (fluxo.profissional.value?.nome ?? t('clinico.pedidos.app.qualquerProfissional'))
      : ''
  }

  if (pedido.modo === 'MELHOR_HORARIO' && passoAtual.value > 2) {
    return rotulos.preferencia({
      ...fluxo.janela.value,
      /* O mesmo de-para da revisão: o contrato fala MANHA, o rótulo fala manha. */
      periodos: pedido.periodos.map((periodo) => (periodo === 'MANHA' ? 'manha' : 'tarde')),
      professionalId: pedido.profissionalId,
    })
  }

  return ''
})

const passos = computed((): PassoDaPagina[] | null => {
  if (!encontrada.value || !clinica.value || token.value) {
    return null
  }

  const { pedido } = fluxo

  return [
    {
      id: 'motivo',
      rotulo: t('clinico.pedidos.link.passos.motivo'),
      valor: pedido.motivo ? t(`clinico.pedidos.app.motivo.${pedido.motivo}`) : '',
      desvio: emEmergencia.value,
    },
    {
      id: 'modo',
      rotulo: t('clinico.pedidos.link.passos.modo'),
      valor: pedido.modo && !emEmergencia.value ? t(`clinico.pedidos.app.modo.${pedido.modo}`) : '',
    },
    {
      id: 'quando',
      rotulo: t('clinico.pedidos.link.passos.quando'),
      valor: emEmergencia.value ? '' : quandoEscolhido.value,
    },
    {
      id: 'dados',
      rotulo: t('clinico.pedidos.link.passos.dados'),
      valor:
        passoAtual.value > 3
          ? `${pedido.visitante.nome.trim()} · ${pedido.visitante.petNome.trim()}`
          : '',
    },
    {
      id: 'revisar',
      rotulo: t('clinico.pedidos.app.etapa.revisar'),
      valor: '',
    },
  ]
})

/** "Passo 2 de 5" acima do título. Some na emergência, depois de enviar e no acompanhamento. */
const contagemDoPasso = computed(() =>
  !passos.value || emEmergencia.value || passoAtual.value >= passos.value.length
    ? ''
    : t('clinico.pedidos.link.passos.contagem', {
        atual: passoAtual.value + 1,
        total: passos.value.length,
      }),
)

// ------------------------------------------------------------------ quem atende e o contato

/** A especialidade vem como chave da lista do app, ou por extenso — a mesma regra da etapa. */
function especialidade(valor: string | null) {
  if (!valor) {
    return ''
  }

  const chave = `clinico.pedidos.app.especialidade.${valor}`

  return te(chave) ? t(chave) : valor
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

/** Os rostos lado a lado, os primeiros nomes numa frase e as especialidades em outra. */
const equipe = computed(() => {
  const profissionais = clinica.value?.profissionais ?? []
  const especialidades = [
    ...new Set(profissionais.map((item) => especialidade(item.especialidade)).filter(Boolean)),
  ]

  return {
    titulo: t('clinico.pedidos.link.equipe'),
    rostos: profissionais.map((item) => ({
      id: item.id,
      nome: item.nome,
      fotoUrl: item.fotoUrl,
      iniciais: iniciais(item.nome),
    })),
    nomes: rotulos.nomes(profissionais.map((item) => item.nome.split(/\s+/)[0] ?? item.nome)),
    detalhe: especialidades.length > 0 ? rotulos.nomes(especialidades) : '',
  }
})

const contatos = computed((): ContatoDaPagina[] => {
  const atual = clinica.value

  if (!atual) {
    return []
  }

  const todos = [
    {
      id: 'telefone',
      icone: 'ph-phone',
      rotulo: t('clinico.pedidos.link.telefoneDaClinica'),
      valor: atual.clinica.telefone,
    },
    {
      id: 'whatsapp',
      icone: 'ph-whatsapp-logo',
      rotulo: t('clinico.pedidos.link.whatsappRotulo'),
      valor: atual.emergencia.whatsapp,
    },
    {
      id: 'plantao',
      icone: 'ph-first-aid',
      rotulo: t('clinico.pedidos.app.plantao'),
      valor: atual.emergencia.telefoneDePlantao,
    },
  ]

  return todos.filter((item): item is ContatoDaPagina => Boolean(item.valor))
})

// ------------------------------------------------------------------ acompanhamento

const acompanhado = ref<PedidoPeloLink | null>(null)
const desistindo = ref(false)

async function carregarAcompanhado() {
  acompanhado.value = token.value
    ? await agendamentoOnlineDoResponsavel.pedidoPorToken(token.value)
    : null
}

watch(token, carregarAcompanhado, { immediate: true })
watch(() => pedidosStore.versao, carregarAcompanhado)

/** A cor do estado do pedido acompanhado: esperando, confirmado, recusado ou parado. */
const tomDaSituacao = computed(() => {
  switch (acompanhado.value?.status) {
    case 'AGUARDANDO_CLINICA':
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
    await agendamentoOnlineDoResponsavel.cancelarPedido(acompanhado.value.id)
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
    ? {
        texto: t('clinico.pedidos.link.demo'),
        voltar: t('clinico.pedidos.link.voltarAoPortal'),
      }
    : null,
)
</script>

<template>
  <PaginaPublica
    icone="ph-first-aid-kit"
    lugar="clinica"
    :nome="clinica?.clinica.nome ?? null"
    :endereco="clinica?.enderecoResumo"
    :estado="estado"
    :promessa="promessa"
    :passos="passos"
    :passo-atual="passoAtual"
    :titulo-dos-passos="t('clinico.pedidos.link.seuPedido')"
    :rotulo-dos-passos="t('clinico.pedidos.link.passos.rotulo')"
    :rotulo-feito="t('clinico.pedidos.link.passos.feito')"
    :contagem="contagemDoPasso"
    :equipe="equipe"
    :contatos="contatos"
    :rotulo-dos-contatos="t('clinico.pedidos.link.contato')"
    :assinatura="t('clinico.pedidos.link.rodape')"
    :demo="demo"
    :com-pe="encontrada"
    @voltar="router.push('/veterinario/pedidos')"
  >
    <div v-if="!encontrada" class="publica__vazio">
      <i class="ph ph-magnifying-glass" aria-hidden="true" />
      <h2>{{ t('clinico.pedidos.link.naoEncontrada') }}</h2>
      <p>{{ t('clinico.pedidos.link.naoEncontradaAjuda') }}</p>
    </div>

    <!-- Acompanhamento: o pedido do link da mensagem. -->
    <div v-else-if="token" class="publica__acompanhar">
      <template v-if="acompanhado">
        <h2>{{ t('clinico.pedidos.link.seuPedido') }}</h2>

        <section class="ui-folha acompanhar">
          <p class="acompanhar__situacao" :class="`acompanhar__situacao--${tomDaSituacao}`">
            <span class="acompanhar__disco" aria-hidden="true">
              <i
                class="ph"
                :class="{
                  'ph-hourglass-medium': acompanhado.status === 'AGUARDANDO_CLINICA',
                  'ph-calendar-check': acompanhado.status === 'ACEITO',
                  'ph-calendar-x':
                    acompanhado.status === 'RECUSADO' || acompanhado.status === 'EXPIRADO',
                  'ph-x-circle': acompanhado.status === 'CANCELADO_PELO_RESPONSAVEL',
                }"
              />
            </span>
            {{ t(`clinico.pedidos.link.situacao.${acompanhado.status}`) }}
          </p>

          <p class="acompanhar__oque">
            {{ rotulos.nomes(acompanhado.pets.map((pet) => pet.nome)) }} ·
            {{ acompanhado.servico.nome }}
          </p>

          <p v-if="acompanhado.status === 'AGUARDANDO_CLINICA'" class="acompanhar__linha">
            <i class="ph ph-clock" aria-hidden="true" />
            {{ t('clinico.pedidos.app.ate', { quando: rotulos.quando(acompanhado.responderAte) }) }}
          </p>
          <p v-if="acompanhado.horarioMarcado" class="acompanhar__linha acompanhar__linha--forte">
            <i class="ph ph-calendar-check" aria-hidden="true" />
            {{ rotulos.quando(acompanhado.horarioMarcado.inicio) }} ·
            {{ acompanhado.horarioMarcado.profissional.nome }}
          </p>
          <blockquote v-if="acompanhado.recusa" class="acompanhar__mensagem">
            {{ acompanhado.recusa.mensagemDaClinica }}
          </blockquote>
        </section>

        <div class="publica__acoes">
          <Button
            :label="t('clinico.pedidos.link.outroPedido')"
            icon="ph ph-calendar-plus"
            @click="novoPedido"
          />
          <Button
            v-if="acompanhado.podeCancelar"
            severity="secondary"
            outlined
            :label="t('clinico.pedidos.app.desistir')"
            :loading="desistindo"
            @click="desistir"
          />
        </div>
      </template>
      <div v-else class="publica__vazio">
        <i class="ph ph-magnifying-glass" aria-hidden="true" />
        <h2>{{ t('clinico.pedidos.link.pedidoNaoEncontrado') }}</h2>
        <div class="publica__acoes">
          <Button
            :label="t('clinico.pedidos.link.outroPedido')"
            icon="ph ph-calendar-plus"
            @click="novoPedido"
          />
        </div>
      </div>
    </div>

    <FluxoDoPedido v-else :endereco-do-link="endereco" />
  </PaginaPublica>
</template>
