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
 * **Tela dividida (15/10/2026).** A primeira versão era a coluna do celular solta no meio da tela,
 * e no computador sobrava tudo. Agora a tela se divide como num checkout: a metade da clínica, em
 * teal, com o nome, se está aberta, os passos do pedido com o que já foi escolhido, quem atende e o
 * contato; e a metade do pedido, clara, com o fluxo solto na página. Tudo dado do contrato — nada
 * inventado para encher. Abaixo de 1024 px vira uma coluna: a clínica no topo, o fluxo, e equipe e
 * contato no fim; os passos saem e o "Passo 2 de 5" acima do título conta o caminho.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
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
const encontrada = computed(
  () => pedidoRepository.configuracao().slug === String(route.params.clinica ?? ''),
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

const passos = computed(() => {
  const { pedido } = fluxo

  return [
    {
      id: 'motivo',
      rotulo: t('clinico.pedidos.link.passos.motivo'),
      valor: pedido.motivo ? t(`clinico.pedidos.app.motivo.${pedido.motivo}`) : '',
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

/** Feito, o de agora ou ainda por vir. Na emergência, quem diz o desvio é o motivo em coral. */
function estadoDoPasso(indice: number) {
  if (indice < passoAtual.value) {
    return 'feito'
  }

  return indice === passoAtual.value ? 'atual' : 'depois'
}

/** "Passo 2 de 5" acima do título. Some na emergência, depois de enviar e no acompanhamento. */
const contagemDoPasso = computed(() =>
  !encontrada.value || token.value || emEmergencia.value || passoAtual.value >= passos.value.length
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
    rostos: profissionais,
    nomes: rotulos.nomes(profissionais.map((item) => item.nome.split(/\s+/)[0] ?? item.nome)),
    especialidades: especialidades.length > 0 ? rotulos.nomes(especialidades) : '',
  }
})

/** O contato é texto, não botão: "ligar" só existe no desvio da emergência. */
const contatos = computed(() => {
  const atual = clinica.value

  if (!atual) {
    return []
  }

  return [
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
  ].filter((item) => Boolean(item.valor))
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

const temSessao = computed(() => isAuthenticated())

function voltarAoPortal() {
  void router.push('/veterinario/pedidos')
}
</script>

<template>
  <div class="publica hc-tema" :class="{ 'publica--demo': temSessao }">
    <!-- Faixa de demonstração: só para quem veio do portal. O responsável nunca a vê. -->
    <div v-if="temSessao" class="publica__demo">
      <span>
        <i class="ph ph-flask" aria-hidden="true" />
        {{ t('clinico.pedidos.link.demo') }}
      </span>
      <Button
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('clinico.pedidos.link.voltarAoPortal')"
        @click="voltarAoPortal"
      />
    </div>

    <div class="publica__palco">
      <!-- O teal da metade da clínica, com a pata da marca no canto. Só fundo. -->
      <div class="publica__fundo" aria-hidden="true" />

      <header class="publica__clinica">
        <span class="publica__icone" aria-hidden="true"><i class="ph ph-first-aid-kit" /></span>

        <template v-if="clinica">
          <h1>{{ clinica.clinica.nome }}</h1>
          <p class="publica__endereco">{{ clinica.enderecoResumo }}</p>
          <p
            class="publica__estado"
            :class="{ 'publica__estado--fechada': !clinica.emergencia.abertaAgora }"
          >
            <span class="publica__ponto" aria-hidden="true" />
            <template v-if="clinica.emergencia.abertaAgora">
              {{ t('clinico.pedidos.app.abertaAte', { hora: clinica.emergencia.fechaAs }) }}
            </template>
            <template v-else-if="clinica.emergencia.abreEm">
              {{
                t('clinico.pedidos.app.fechadaAbre', {
                  quando: rotulos.quando(clinica.emergencia.abreEm),
                })
              }}
            </template>
          </p>
          <p v-if="clinica.recebePedidos" class="publica__promessa">
            {{ t('clinico.pedidos.link.promessa', { horas: clinica.prazoDeRespostaHoras }) }}
          </p>
        </template>
      </header>

      <!-- Em que passo o pedido está e o que já foi escolhido. No acompanhamento, não há passo. -->
      <section v-if="encontrada && clinica && !token" class="publica__passos">
        <h2 class="publica__rotulo">{{ t('clinico.pedidos.link.seuPedido') }}</h2>
        <ol class="passos" :aria-label="t('clinico.pedidos.link.passos.rotulo')">
          <li
            v-for="(passo, indice) in passos"
            :key="passo.id"
            class="passo"
            :class="`passo--${estadoDoPasso(indice)}`"
            :aria-current="estadoDoPasso(indice) === 'atual' ? 'step' : undefined"
          >
            <span class="passo__marca" aria-hidden="true">
              <i v-if="estadoDoPasso(indice) === 'feito'" class="ph ph-check" />
              <template v-else>{{ indice + 1 }}</template>
            </span>
            <span class="passo__texto">
              <strong>{{ passo.rotulo }}</strong>
              <span
                v-if="passo.valor"
                class="passo__valor"
                :class="{ 'passo__valor--risco': emEmergencia && indice === 0 }"
              >
                {{ passo.valor }}
              </span>
              <span v-if="estadoDoPasso(indice) === 'feito'" class="publica__so-leitor">
                {{ t('clinico.pedidos.link.passos.feito') }}
              </span>
            </span>
          </li>
        </ol>
      </section>

      <footer v-if="encontrada && clinica" class="publica__pe">
        <div v-if="equipe.rostos.length > 0" class="equipe">
          <h2 class="publica__rotulo">{{ t('clinico.pedidos.link.equipe') }}</h2>
          <div class="equipe__linha">
            <span class="equipe__rostos" aria-hidden="true">
              <span
                v-for="item in equipe.rostos"
                :key="item.id"
                class="equipe__rosto"
                :title="item.nome"
              >
                <img v-if="item.fotoUrl" :src="item.fotoUrl" alt="" />
                <template v-else>{{ iniciais(item.nome) }}</template>
              </span>
            </span>
            <span class="equipe__texto">
              <strong>{{ equipe.nomes }}</strong>
              <span v-if="equipe.especialidades">{{ equipe.especialidades }}</span>
            </span>
          </div>
        </div>

        <ul
          v-if="contatos.length > 0"
          class="contatos"
          :aria-label="t('clinico.pedidos.link.contato')"
        >
          <li v-for="item in contatos" :key="item.id">
            <i class="ph" :class="item.icone" aria-hidden="true" />
            <span class="publica__so-leitor">{{ item.rotulo }}</span>
            <span dir="ltr">{{ item.valor }}</span>
          </li>
        </ul>

        <p class="publica__assinatura">{{ t('clinico.pedidos.link.rodape') }}</p>
      </footer>

      <main class="publica__fluxo">
        <p v-if="contagemDoPasso" class="publica__contagem">{{ contagemDoPasso }}</p>

        <div v-if="!encontrada" class="publica__vazio">
          <i class="ph ph-magnifying-glass" aria-hidden="true" />
          <h2>{{ t('clinico.pedidos.link.naoEncontrada') }}</h2>
          <p>{{ t('clinico.pedidos.link.naoEncontradaAjuda') }}</p>
        </div>

        <!-- Acompanhamento: o pedido do link da mensagem. -->
        <div v-else-if="token" class="publica__acompanhar">
          <template v-if="acompanhado">
            <p class="publica__contagem">{{ t('clinico.pedidos.link.seuPedido') }}</p>
            <h2>
              {{ rotulos.nomes(acompanhado.pets.map((pet) => pet.nome)) }} ·
              {{ acompanhado.servico.nome }}
            </h2>

            <p class="publica__situacao" :class="`publica__situacao--${acompanhado.status}`">
              <i
                class="ph"
                :class="{
                  'ph-hourglass-medium': acompanhado.status === 'AGUARDANDO_CLINICA',
                  'ph-calendar-check': acompanhado.status === 'ACEITO',
                  'ph-calendar-x':
                    acompanhado.status === 'RECUSADO' || acompanhado.status === 'EXPIRADO',
                  'ph-x-circle': acompanhado.status === 'CANCELADO_PELO_RESPONSAVEL',
                }"
                aria-hidden="true"
              />
              {{ t(`clinico.pedidos.link.situacao.${acompanhado.status}`) }}
            </p>

            <p v-if="acompanhado.status === 'AGUARDANDO_CLINICA'" class="fx-ajuda">
              {{
                t('clinico.pedidos.app.ate', { quando: rotulos.quando(acompanhado.responderAte) })
              }}
            </p>
            <p v-if="acompanhado.horarioMarcado" class="publica__marcado">
              {{ rotulos.quando(acompanhado.horarioMarcado.inicio) }} ·
              {{ acompanhado.horarioMarcado.profissional.nome }}
            </p>
            <blockquote v-if="acompanhado.recusa" class="publica__mensagem">
              {{ acompanhado.recusa.mensagemDaClinica }}
            </blockquote>

            <div class="publica__acoes">
              <Button
                v-if="acompanhado.podeCancelar"
                severity="secondary"
                outlined
                :label="t('clinico.pedidos.app.desistir')"
                :loading="desistindo"
                @click="desistir"
              />
              <Button
                :label="t('clinico.pedidos.link.outroPedido')"
                icon="ph ph-calendar-plus"
                @click="novoPedido"
              />
            </div>
          </template>
          <template v-else>
            <h2>{{ t('clinico.pedidos.link.pedidoNaoEncontrado') }}</h2>
            <Button :label="t('clinico.pedidos.link.outroPedido')" @click="novoPedido" />
          </template>
        </div>

        <FluxoDoPedido v-else :endereco-do-link="endereco" />
      </main>

      <LanguageSwitcher class="publica__idioma" variant="auth" tone="surface" />
    </div>
  </div>
</template>

<style scoped>
/*
 * A metade da clínica tem o teal da pílula cheia e da moldura do portal. Contrastes sobre #1F6457:
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
 * Duas metades, como um checkout: a clínica à esquerda, o pedido à direita. O conteúdo de cada
 * uma fica no meio da sua metade; o que sobra em volta é fundo — a pata de um lado, a grade do outro.
 */
.publica__palco {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  grid-template-areas:
    'clinica fluxo'
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

/* ------------------------------------------------------------------ a metade da clínica */

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

.publica__clinica,
.publica__passos,
.publica__pe {
  width: min(100%, var(--lado-largura));
  justify-self: center;
  padding-inline: var(--respiro);
  color: var(--faixa-tinta);
}

.publica__clinica {
  display: grid;
  grid-area: clinica;
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

.publica__clinica h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.1;
  text-wrap: balance;
}

.publica__clinica p {
  margin: 0;
}

.publica__endereco {
  color: var(--faixa-apagada);
  font-size: 0.9375rem;
  line-height: 1.45;
}

/* Aberta ou fechada: o ponto é o sinal, a frase diz até quando. */
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

.publica__ponto {
  width: 0.5rem;
  height: 0.5rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #93e2b3;
  box-shadow: 0 0 0 3px rgb(147 226 179 / 22%);
}

.publica__estado--fechada .publica__ponto {
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
.passo:not(:last-child)::before {
  position: absolute;
  width: 2px;
  inset-block: 2.1rem 0.25rem;
  inset-inline-start: calc(0.925rem - 1px);
  border-radius: 1px;
  background: var(--faixa-fio);
  content: '';
  transition: background-color 180ms ease-out;
}

.passo--feito:not(:last-child)::before {
  background: var(--faixa-menta);
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
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    box-shadow 180ms ease-out,
    color 180ms ease-out;
}

.passo--feito .passo__marca {
  border-color: transparent;
  background: var(--faixa-menta);
  color: var(--faixa);
  font-size: 0.875rem;
}

.passo--atual .passo__marca {
  border-color: transparent;
  background: var(--faixa-tinta);
  box-shadow: 0 0 0 5px rgb(255 255 255 / 14%);
  color: var(--faixa);
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

.passo__valor--risco {
  color: var(--faixa-coral);
  font-weight: 650;
}

/* O pé da metade: quem atende, o contato e a assinatura, encostados embaixo. */
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

.equipe .publica__rotulo {
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

.publica__contagem {
  margin: 0 0 0.25rem;
  color: var(--hc-marca-forte);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* O título da etapa na escala da página, e não na do celular. */
.publica__fluxo :deep(.fx-topo__titulo) {
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

.publica__vazio,
.publica__acompanhar {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.publica__vazio > i {
  color: var(--hc-tinta-3);
  font-size: 1.6rem;
}

.publica__fluxo h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.publica__vazio p,
.publica__acompanhar p {
  margin: 0;
}

.publica__situacao {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
}

.publica__situacao--ACEITO {
  color: var(--hc-marca-forte);
}

.publica__situacao--RECUSADO,
.publica__situacao--EXPIRADO {
  color: var(--clinic-attention-text);
}

.publica__marcado {
  font-size: 1rem;
  font-weight: 700;
}

.publica__mensagem {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 0.7rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  line-height: 1.5;
}

.publica__acoes {
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
 * Abaixo de 1024 px as metades não cabem lado a lado: a clínica vira o topo, o fluxo vem logo
 * abaixo e quem atende e o contato descem para o fim, já sobre o claro. Os passos saem — o
 * "Passo 2 de 5" acima do título conta o caminho.
 */
@media (max-width: 1023px) {
  .publica__palco {
    grid-template-areas:
      'clinica'
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

  .publica__clinica,
  .publica__pe,
  .publica__fluxo {
    width: min(100%, 44rem);
    justify-self: center;
    padding-inline: 1.5rem;
  }

  .publica__clinica {
    padding-block: 1.5rem 2rem;
  }

  .publica__clinica h1 {
    font-size: 1.6rem;
  }

  .publica__passos {
    display: none;
  }

  .publica__idioma {
    grid-area: clinica;
  }

  .publica__fluxo {
    padding-block: 2rem 1rem;
  }

  .publica__fluxo :deep(.fx-topo__titulo),
  .publica__fluxo h2 {
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

@media (prefers-reduced-motion: reduce) {
  .passo::before,
  .passo__marca {
    transition: none;
  }
}
</style>
