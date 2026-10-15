<script setup lang="ts">
/**
 * Pedidos de horário — o agendamento online visto da recepção.
 *
 * O responsável pede pelo app ou pelo link da clínica, por dois caminhos: escolhendo dia, horário
 * e profissional na agenda que a clínica abre, ou dizendo quando pode e deixando a clínica marcar
 * no melhor horário. Os dois chegam aqui, e alguém da casa responde. Cada resposta vira, na mesma
 * gravação, um atendimento na agenda (com a origem do pedido à vista) e um aviso para quem pediu.
 *
 * A ordem da lista é a do prazo prometido, não a de chegada: "respondemos em até 4 h" conta só o
 * expediente, e o pedido da noite vence no meio da manhã. O que já foi respondido mora recolhido
 * embaixo — histórico, não trabalho.
 *
 * Responder mora numa gaveta ao lado da caixa, não num diálogo no meio dela: a linha aberta fica
 * tingida, o calendário do pedido aparece na gaveta, e a lista continua à vista. A linha só tem o
 * que decide a triagem — a folhinha do dia, quem, o quê, o prazo e o botão.
 *
 * O celular do responsável abre numa gaveta que empurra a página: dá para pedir lá e ver a linha
 * chegar aqui, ou responder aqui e ver o aviso chegar lá. É a demonstração inteira em meio minuto.
 * As duas gavetas moram do mesmo lado; abrir a de resposta guarda o celular, e fechá-la o devolve.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import {
  PhCalendarPlus,
  PhClockCounterClockwise,
  PhDeviceMobile,
  PhLink,
  PhTray,
} from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import '@/components/home/home-card.css'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import AgendamentoOnlineGaveta from '@/features/clinico/components/pedidos/AgendamentoOnlineGaveta.vue'
import AgendarNoApp from '@/features/clinico/components/pedidos/AgendarNoApp.vue'
import PedidoGaveta from '@/features/clinico/components/pedidos/PedidoGaveta.vue'
import PedidoLinha from '@/features/clinico/components/pedidos/PedidoLinha.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoPedido } from '@/features/clinico/composables/useRotulosDoPedido'
import {
  disputarProximaReserva,
  pedidoRepository,
  reservaVaiSerDisputada,
  type PedidoNaCaixa,
} from '@/features/clinico/data/agendamento-online'
import { RESPONSAVEL_DA_DEMONSTRACAO } from '@/features/clinico/data/seed-responsavel'
import { RESPONSAVEL_SEM_VINCULO } from '@/features/clinico/data/seed-pedidos'
import type { AgendamentoOnline, MotivoDaRecusaDoPedido } from '@/features/clinico/data/types'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { usePedidosStore } from '@/features/clinico/stores/pedidos'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const clinico = useClinicoStore()
const pedidos = usePedidosStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

async function carregar() {
  await clinico.carregar()
  await pedidos.carregar()
}

onMounted(carregar)

// ------------------------------------------------------------------ a frase de cima

/** Quantos esperam, quantos passaram do prazo, e quando vence o próximo. */
const fraseDoResumo = computed(() => {
  if (!pedidos.carregado) {
    return ''
  }

  const total = pedidos.abertas.length

  if (total === 0) {
    return t('clinico.pedidos.resumo.nenhum')
  }

  const partes = [t('clinico.pedidos.resumo.abertos', { n: total }, total)]

  if (pedidos.atrasadas > 0) {
    partes.push(t('clinico.pedidos.resumo.atrasados', { n: pedidos.atrasadas }, pedidos.atrasadas))
  } else {
    const proximo = pedidos.abertas[0]!.pedidos[0]!.responderAte

    partes.push(
      t('clinico.pedidos.resumo.proximo', {
        quando:
          clinicClock.dateOf(proximo) === clinicClock.today()
            ? formato.hora(proximo)
            : rotulos.quando(proximo),
      }),
    )
  }

  return partes.join(' · ')
})

const desligado = computed(() => pedidos.configuracao !== null && !pedidos.configuracao.ativo)

// ------------------------------------------------------------------ responder

/** A linha na gaveta, pela chave: a caixa relida traz a linha nova, e a respondida fecha a gaveta. */
const chaveEmResposta = ref<string | null>(null)

const emResposta = computed(
  () => pedidos.abertas.find((linha) => linha.chave === chaveEmResposta.value) ?? null,
)

/** O celular estava aberto quando a gaveta de resposta abriu: volta quando ela fechar. */
const celularGuardado = ref(false)

function abrirResposta(linha: PedidoNaCaixa) {
  if (chaveEmResposta.value === null && appAberto.value) {
    celularGuardado.value = true
    appAberto.value = false
  }

  chaveEmResposta.value = linha.chave
}

function fecharResposta() {
  chaveEmResposta.value = null

  if (celularGuardado.value) {
    celularGuardado.value = false
    appAberto.value = true
  }
}

async function aceitar(
  linha: PedidoNaCaixa,
  escolha: { professionalId: string; inicio: string } | null,
) {
  const deuCerto = await pedidos.aceitar(linha.chave, linha.pedidos[0]!.id, escolha)

  if (deuCerto && chaveEmResposta.value === linha.chave) {
    fecharResposta()
  }
}

async function recusar(payload: { motivo: MotivoDaRecusaDoPedido; mensagem: string }) {
  const linha = emResposta.value

  if (!linha) {
    return
  }

  const deuCerto = await pedidos.recusar(
    linha.chave,
    linha.pedidos[0]!.id,
    payload.motivo,
    payload.mensagem,
  )

  if (deuCerto) {
    fecharResposta()
  }
}

/** O que a última resposta fez, em uma linha — com o atalho para a agenda quando marcou. */
const resultado = computed(() => {
  const atual = pedidos.resultado

  if (!atual) {
    return null
  }

  if (atual.tipo === 'marcado') {
    const [primeiro] = atual.atendimentos

    if (!primeiro) {
      return null
    }

    return {
      tipo: 'marcado' as const,
      texto: t('clinico.pedidos.resultado.marcado', {
        pets: rotulos.nomes(atual.atendimentos.map((item) => clinico.pet(item.petId)?.nome ?? '')),
        quando: rotulos.quando(primeiro.inicio),
        profissional: clinico.profissional(primeiro.professionalId)?.nome ?? '',
      }),
      rota: `/veterinario/agenda?data=${clinicClock.dateOf(primeiro.inicio)}&foco=${primeiro.id}`,
    }
  }

  return {
    tipo: atual.tipo,
    texto: t(`clinico.pedidos.resultado.${atual.tipo}`),
    rota: null,
  }
})

// ------------------------------------------------------------------ histórico

const historicoAberto = ref(false)

function fraseDoRespondido(linha: PedidoNaCaixa) {
  const pedido = linha.pedidos[0]!

  switch (pedido.status) {
    case 'aceito': {
      const parametros = {
        quando: linha.marcado ? rotulos.quando(linha.marcado.inicio) : '',
        profissional: linha.marcado
          ? (clinico.profissional(linha.marcado.professionalId)?.nome ?? '')
          : '',
      }

      return pedido.respondidoPor === 'automatico'
        ? t('clinico.pedidos.respondido.automatico', parametros)
        : t('clinico.pedidos.respondido.aceito', parametros)
    }
    case 'recusado':
      return t('clinico.pedidos.respondido.recusado', {
        motivo: t(`clinico.pedidos.recusa.motivo.${pedido.recusa?.motivo ?? 'outro'}`),
      })
    default:
      return t(`clinico.pedidos.respondido.${pedido.status}`)
  }
}

function petsDa(linha: PedidoNaCaixa) {
  return linha.pedidos.map((pedido) => {
    const pet = pedido.petId ? clinico.pet(pedido.petId) : null
    const nome = pet?.nome ?? pedido.novoCadastro?.petNome ?? ''

    return {
      id: pedido.id,
      nome,
      iniciais: pet?.iniciais ?? nome.slice(0, 2).toUpperCase(),
      especie: pet?.especie ?? pedido.novoCadastro?.especie ?? null,
      fotoUrl: pet?.fotoUrl ?? '',
    }
  })
}

// ------------------------------------------------------------------ configuração e link

const configAberta = ref(false)
const salvandoConfig = ref(false)

async function salvarConfiguracao(nova: AgendamentoOnline) {
  salvandoConfig.value = true

  const deuCerto = await pedidos.salvarConfiguracao(nova)

  salvandoConfig.value = false

  if (deuCerto) {
    configAberta.value = false
  }
}

async function ligarDeNovo() {
  if (pedidos.configuracao) {
    await pedidos.salvarConfiguracao({ ...pedidos.configuracao, ativo: true })
  }
}

const popoverDoLink = ref<InstanceType<typeof Popover> | null>(null)

const caminhoDoLink = computed(() =>
  pedidos.configuracao ? `/agendar/${pedidos.configuracao.slug}` : '',
)

const enderecoDoLink = computed(() => `${window.location.origin}${caminhoDoLink.value}`)

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(enderecoDoLink.value)
    toast.add({ severity: 'success', summary: t('clinico.pedidos.link.copiado'), life: 2000 })
  } catch {
    /* Sem área de transferência, o endereço continua no campo para copiar à mão. */
  }
}

const compartilharNoWhatsapp = computed(
  () =>
    `https://wa.me/?text=${encodeURIComponent(
      t('clinico.pedidos.link.textoParaCompartilhar', {
        clinica: pedidoRepository.clinica().nome,
        endereco: enderecoDoLink.value,
      }),
    )}`,
)

/**
 * Abre a página pública **nesta aba**. Numa aba nova a demonstração começaria do zero — os dados
 * são de mentira e moram na memória desta —, e o pedido feito lá nunca chegaria aqui.
 */
function abrirPagina() {
  popoverDoLink.value?.hide()
  void router.push(caminhoDoLink.value)
}

// ------------------------------------------------------------------ o celular

const appAberto = ref(false)

/* O celular empurra a página só com largura para isso; em 1024 px passa por cima, sem véu. */
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => appAberto.value && telaLarga.value),
  '27rem',
)

/* Abrir o celular com a gaveta de resposta aberta: a resposta fica para depois, o celular na frente. */
watch(appAberto, (aberto) => {
  if (aberto && chaveEmResposta.value !== null) {
    celularGuardado.value = false
    chaveEmResposta.value = null
  }
})

const pessoa = ref<string>(RESPONSAVEL_DA_DEMONSTRACAO)

const pessoas = computed(() => [
  { valor: RESPONSAVEL_DA_DEMONSTRACAO, rotulo: t('clinico.pedidos.ensaio.fatima') },
  { valor: RESPONSAVEL_SEM_VINCULO, rotulo: t('clinico.pedidos.ensaio.renata') },
])

const disputa = ref(reservaVaiSerDisputada())

function alternarDisputa(valor: boolean) {
  disputa.value = valor
  disputarProximaReserva(valor)
}

async function celularMudou() {
  /* A disputa vale para um toque só: o servidor de mentira já a consumiu. */
  disputa.value = reservaVaiSerDisputada()
  await pedidos.avisarMudanca()
}
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('clinico.pedidos.subtitulo')"
    :title="t('clinico.pedidos.titulo')"
    :loading="!pedidos.carregado && !pedidos.erro"
    :error="pedidos.erro && !pedidos.carregado ? t(pedidos.erro) : ''"
    block-when-suspended
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.pedidos.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.pedidos.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <nav class="hc-acoes" :aria-label="t('clinico.pedidos.acoes.rotulo')">
            <Button
              type="button"
              class="hc-pilula"
              :label="t('clinico.pedidos.acoes.verNoApp')"
              :aria-expanded="appAberto"
              @click="appAberto = !appAberto"
            >
              <template #icon>
                <PhDeviceMobile class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
              </template>
            </Button>
            <Button
              type="button"
              class="hc-pilula"
              :label="t('clinico.pedidos.acoes.link')"
              aria-haspopup="dialog"
              @click="popoverDoLink?.toggle($event)"
            >
              <template #icon>
                <PhLink class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
              </template>
            </Button>
            <Button
              type="button"
              class="hc-pilula"
              icon="ph ph-sliders-horizontal"
              :label="t('clinico.pedidos.acoes.configurar')"
              aria-haspopup="dialog"
              @click="configAberta = true"
            />
          </nav>
        </div>
      </div>
    </template>

    <div class="pedidos clinic-scope">
      <!-- Desligado: dito na primeira linha, com o jeito de religar. -->
      <p v-if="desligado" class="pedidos__desligado" role="status">
        <i class="ph ph-pause-circle" aria-hidden="true" />
        <span>{{ t('clinico.pedidos.desligado') }}</span>
        <Button
          size="small"
          severity="secondary"
          outlined
          :label="t('clinico.pedidos.religar')"
          @click="ligarDeNovo"
        />
      </p>

      <p
        v-if="resultado"
        class="pedidos__resultado"
        :class="`pedidos__resultado--${resultado.tipo}`"
        role="status"
      >
        <i
          class="ph"
          :class="resultado.tipo === 'marcado' ? 'ph-check-circle' : 'ph-info'"
          aria-hidden="true"
        />
        <span class="pedidos__resultado-texto">{{ resultado.texto }}</span>
        <RouterLink
          v-if="resultado.rota"
          class="pedidos__resultado-link clinic-focusable"
          :to="resultado.rota"
        >
          {{ t('clinico.pedidos.resultado.verNaAgenda') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
        <Button
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('clinico.pedidos.resultado.dispensar')"
          @click="pedidos.dispensarResultado()"
        />
      </p>

      <p v-if="pedidos.erro && pedidos.carregado" class="pedidos__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(pedidos.erro) }}
      </p>

      <section class="hc pedidos__caixa">
        <header class="hc__cabeca">
          <h2 class="hc__titulo">
            <PhTray class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('clinico.pedidos.secao.abertos') }}
          </h2>
          <span class="hc__ferramentas">{{ t('clinico.pedidos.secao.ordem') }}</span>
        </header>

        <TransitionGroup
          v-if="pedidos.abertas.length > 0"
          tag="ul"
          name="linha"
          class="pedidos__lista"
        >
          <PedidoLinha
            v-for="linha in pedidos.abertas"
            :key="linha.chave"
            :linha="linha"
            :respondendo="pedidos.respondendo === linha.chave"
            :ocupado="pedidos.respondendo !== null"
            :aberta="chaveEmResposta === linha.chave"
            @aceitar="aceitar(linha, $event)"
            @abrir="abrirResposta(linha)"
          />
        </TransitionGroup>

        <div v-else class="pedidos__vazio">
          <PhCalendarPlus class="pedidos__vazio-icone" weight="duotone" aria-hidden="true" />
          <strong>{{ t('clinico.pedidos.vazio.titulo') }}</strong>
          <p>{{ t('clinico.pedidos.vazio.descricao') }}</p>
        </div>
      </section>

      <!-- O respondido é histórico: recolhido, uma linha por pedido. -->
      <section v-if="pedidos.respondidas.length > 0" class="pedidos__historico">
        <Button
          class="pedidos__alternar"
          severity="secondary"
          text
          size="small"
          :icon="historicoAberto ? 'ph ph-caret-down' : 'ph ph-caret-right'"
          :label="t('clinico.pedidos.secao.respondidos', { n: pedidos.respondidas.length })"
          :aria-expanded="historicoAberto"
          @click="historicoAberto = !historicoAberto"
        />

        <ul v-if="historicoAberto" class="hc pedidos__respondidos">
          <li v-for="linha in pedidos.respondidas" :key="linha.chave" class="respondido">
            <span class="respondido__rostos">
              <PetAvatar
                v-for="pet in petsDa(linha)"
                :key="pet.id"
                :nome="pet.nome"
                :iniciais="pet.iniciais"
                :especie="pet.especie"
                :foto-url="pet.fotoUrl"
                tamanho="sm"
              />
            </span>
            <span class="respondido__texto">
              <strong>{{ rotulos.nomes(petsDa(linha).map((pet) => pet.nome)) }}</strong>
              <span>
                {{ clinico.tipo(linha.pedidos[0]!.typeId)?.nome }} ·
                <i
                  class="ph"
                  :class="
                    linha.pedidos[0]!.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'
                  "
                  aria-hidden="true"
                />
                {{ t(`clinico.pedidos.canal.${linha.pedidos[0]!.canal}`) }}
              </span>
            </span>
            <span class="respondido__como" :class="`respondido__como--${linha.pedidos[0]!.status}`">
              {{ fraseDoRespondido(linha) }}
            </span>
            <span class="respondido__quando">
              <PhClockCounterClockwise aria-hidden="true" />
              {{ formato.relativo(linha.pedidos[0]!.respondidoEm ?? linha.pedidos[0]!.criadoEm) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <PedidoGaveta
      :linha="emResposta"
      :salvando="pedidos.respondendo !== null"
      @marcar="emResposta && aceitar(emResposta, $event)"
      @recusar="recusar"
      @fechar="fecharResposta"
    />

    <AgendamentoOnlineGaveta
      v-model:visivel="configAberta"
      :configuracao="pedidos.configuracao"
      :salvando="salvandoConfig"
      @salvar="salvarConfiguracao"
    />

    <Popover ref="popoverDoLink" class="hc-tema">
      <div class="link clinic-scope">
        <p class="link__titulo">{{ t('clinico.pedidos.link.titulo') }}</p>
        <p class="link__ajuda">{{ t('clinico.pedidos.link.ajuda') }}</p>
        <div class="link__campo">
          <InputText
            :model-value="enderecoDoLink"
            readonly
            fluid
            :aria-label="t('clinico.pedidos.link.titulo')"
          />
          <Button
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :aria-label="t('clinico.pedidos.link.copiar')"
            @click="copiarLink"
          />
        </div>
        <div class="link__acoes">
          <Button
            size="small"
            icon="ph ph-arrow-square-out"
            :label="t('clinico.pedidos.link.abrir')"
            @click="abrirPagina"
          />
          <Button
            as="a"
            :href="compartilharNoWhatsapp"
            target="_blank"
            rel="noopener"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-whatsapp-logo"
            :label="t('clinico.pedidos.link.whatsapp')"
          />
        </div>
      </div>
    </Popover>

    <!--
      O celular do responsável, numa gaveta que empurra a página: os dois lados à vista. Clicar na
      página não fecha a gaveta — responder aqui e ver o aviso chegar lá é a demonstração.
    -->
    <Drawer
      v-model:visible="appAberto"
      position="right"
      :modal="false"
      :dismissable="false"
      class="hc-tema pedidos-gaveta"
      :style="{ width: 'min(27rem, 94vw)' }"
    >
      <template #header>
        <h2 class="pedidos-gaveta__titulo">
          <PhDeviceMobile class="hc__icone" weight="duotone" aria-hidden="true" />
          {{ t('clinico.pedidos.acoes.verNoApp') }}
        </h2>
      </template>

      <div class="pedidos-gaveta__corpo clinic-scope">
        <div class="ensaio">
          <span id="ensaio-pessoa" class="clinic-label">{{
            t('clinico.pedidos.ensaio.quem')
          }}</span>
          <SelectButton
            v-model="pessoa"
            :options="pessoas"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="ensaio-pessoa"
          />
          <label class="ensaio__chave">
            <ToggleSwitch :model-value="disputa" @update:model-value="alternarDisputa" />
            <span>{{ t('clinico.pedidos.ensaio.disputa') }}</span>
          </label>
        </div>

        <AgendarNoApp :tutor-id="pessoa" @mudou="celularMudou" />
      </div>
    </Drawer>
  </PartnerPageFrame>
</template>

<style scoped>
.pedidos {
  display: grid;
  gap: var(--clinic-space-4);
}

.pedidos__lista {
  display: grid;
  container-type: inline-size;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pedidos__desligado,
.pedidos__resultado,
.pedidos__erro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--hc-borda);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--hc-cartao);
  font-size: var(--clinic-font-label);
  font-weight: 600;
}

.pedidos__desligado > span,
.pedidos__resultado-texto {
  flex: 1 1 16rem;
  min-width: 0;
}

.pedidos__desligado > i {
  color: var(--clinic-attention-text);
}

.pedidos__resultado--marcado {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

.pedidos__resultado-link {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-1);
  border-radius: var(--clinic-radius-control);
  color: var(--hc-marca-forte);
  font-weight: 700;
  text-decoration: none;
}

.pedidos__resultado-link:hover {
  text-decoration: underline;
}

.pedidos__erro {
  color: var(--clinic-risk-text);
}

.pedidos__caixa {
  gap: 0.25rem;
}

.pedidos__vazio {
  display: grid;
  padding: 2rem 1rem;
  gap: 0.35rem;
  color: var(--hc-tinta-2);
  justify-items: center;
  text-align: center;
}

.pedidos__vazio strong {
  color: var(--hc-tinta);
}

.pedidos__vazio p {
  max-width: 34rem;
  margin: 0;
  line-height: 1.5;
}

.pedidos__vazio-icone {
  width: 2rem;
  height: 2rem;
  color: var(--hc-marca);
}

.pedidos__historico {
  display: grid;
  gap: var(--clinic-space-2);
}

.pedidos__alternar.p-button {
  justify-self: start;
  color: var(--hc-tinta-2);
  font-weight: 700;
}

.pedidos__respondidos {
  margin: 0;
  padding-block: 0.4rem;
  gap: 0;
  list-style: none;
}

.respondido {
  display: grid;
  align-items: center;
  padding: 0.6rem 0;
  gap: 0.75rem;
  grid-template-columns: auto minmax(10rem, 1fr) minmax(0, 1.4fr) auto;
}

.respondido + .respondido {
  border-top: 1px solid var(--hc-linha);
}

.respondido__rostos {
  display: inline-flex;
}

.respondido__rostos > * + * {
  margin-inline-start: -0.55rem;
  box-shadow: 0 0 0 2px var(--hc-cartao);
  border-radius: 50%;
}

.respondido__texto {
  display: grid;
  min-width: 0;
  font-size: 0.875rem;
}

.respondido__texto > span {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.respondido__como {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 600;
}

.respondido__como--aceito {
  color: var(--hc-marca-forte);
}

.respondido__quando {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  white-space: nowrap;
}

/* O pedido que sai da lista ao ser respondido: o movimento diz para onde ele foi. */
.linha-enter-active,
.linha-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.linha-enter-from {
  opacity: 0;
  transform: translateY(-0.4rem);
}

.linha-leave-to {
  opacity: 0;
  transform: translateY(0.4rem);
}

.linha-move {
  transition: transform 180ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .linha-enter-active,
  .linha-leave-active,
  .linha-move {
    transition: none;
  }
}

@media (max-width: 900px) {
  .respondido {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .respondido__como,
  .respondido__quando {
    grid-column: 2;
  }
}

/* ------------------------------------------------------------------ popover do link */

.link {
  display: grid;
  width: min(24rem, 86vw);
  gap: 0.55rem;
}

.link__titulo {
  margin: 0;
  font-weight: 700;
}

.link__ajuda {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.link__campo,
.link__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.link__campo > :first-child {
  flex: 1;
}

/* ------------------------------------------------------------------ gaveta do celular */

.pedidos-gaveta__titulo {
  display: inline-flex;
  align-items: center;
  margin: 0;
  gap: 0.55rem;
  color: var(--hc-tinta);
  font-size: 1rem;
  font-weight: 650;
}

.pedidos-gaveta__corpo {
  display: grid;
  gap: 0.85rem;
}

.ensaio {
  display: grid;
  padding: 0.75rem;
  border: 1px dashed var(--hc-borda);
  border-radius: 0.75rem;
  gap: 0.45rem;
}

.ensaio__chave {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--hc-tinta-2);
  font-size: var(--clinic-font-label);
  cursor: pointer;
}
</style>
