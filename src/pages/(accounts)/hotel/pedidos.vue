<script setup lang="ts">
/**
 * Pedidos de reserva — a reserva online vista do balcão do hotel.
 *
 * O responsável pede pelo app ou pelo link do hotel, por dois caminhos: escolhendo o tipo de
 * acomodação vendo o que está livre nas datas, ou deixando o hotel escolher a melhor. Os dois
 * chegam aqui, e o balcão responde: reserva numa unidade (a sugerida, ou outra), ou recusa dizendo
 * por quê. O aceite cria a reserva `pendente` no mapa, com a origem do pedido, e avisa quem pediu
 * — falta o sinal, como em toda reserva da casa.
 *
 * Irmã da caixa de pedidos da clínica (`/veterinario/pedidos`): a mesma ordem pelo prazo, o mesmo
 * histórico recolhido, o mesmo celular na gaveta que empurra a página.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { PhCalendarPlus, PhDeviceMobile, PhLink, PhTray } from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import '@/components/home/home-card.css'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { RESPONSAVEL_SEM_VINCULO } from '@/features/clinico/data/seed-pedidos'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import PedidoDeReservaGaveta from '@/features/hotel/components/pedidos/PedidoDeReservaGaveta.vue'
import PedidoDeReservaLinha from '@/features/hotel/components/pedidos/PedidoDeReservaLinha.vue'
import ReservaOnlineGaveta from '@/features/hotel/components/pedidos/ReservaOnlineGaveta.vue'
import ReservarNoApp from '@/features/hotel/components/pedidos/ReservarNoApp.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  disputarProximoEnvio,
  envioVaiSerDisputado,
  pedidoDeReservaRepository,
  type PedidoDeReservaNaCaixa,
} from '@/features/hotel/data/reserva-online'
import { agoraIso, getDataset } from '@/features/hotel/data/store'
import type {
  MotivoDaRecusaDaReserva,
  PedidoDeReserva,
  ReservaOnline,
} from '@/features/hotel/data/types'
import { dataDe } from '@/features/hotel/domain/hotel-time'
import { usePedidosDeReservaStore } from '@/features/hotel/stores/pedidos-de-reserva'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const toast = useToast()
const pedidos = usePedidosDeReservaStore()
const formato = useHotelFormat()

onMounted(() => pedidos.carregar())

// ------------------------------------------------------------------ nomes

function nomesDe(pedido: PedidoDeReserva): string {
  const nomes = [pedido.petId, pedido.acompanhantePetId]
    .filter((id): id is string => Boolean(id))
    .map((id) => getDataset().pets.find((pet) => pet.id === id)?.nome ?? '')
    .filter(Boolean)

  const lista = nomes.length > 0 ? nomes : [pedido.novoCadastro?.petNome ?? '']

  return new Intl.ListFormat(INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE], {
    type: 'conjunction',
  }).format(lista)
}

function responsavelDe(pedido: PedidoDeReserva): string {
  const tutor = pedido.tutorId
    ? getDataset().tutores.find((item) => item.id === pedido.tutorId)
    : null

  return tutor?.nome ?? pedido.novoCadastro?.nome ?? ''
}

// ------------------------------------------------------------------ resumo

const fraseDoResumo = computed(() => {
  if (!pedidos.carregado) {
    return ''
  }

  const total = pedidos.abertas.length

  if (total === 0) {
    return t('hotel.pedidos.resumo.nenhum')
  }

  const partes = [t('hotel.pedidos.resumo.abertos', { n: total }, total)]

  if (pedidos.atrasadas > 0) {
    partes.push(t('hotel.pedidos.resumo.atrasados', { n: pedidos.atrasadas }, pedidos.atrasadas))
  } else {
    const proximo = pedidos.abertas[0]!.pedido.responderAte

    partes.push(
      t('hotel.pedidos.resumo.proximo', {
        quando:
          dataDe(proximo) === dataDe(agoraIso()) ? formato.hora(proximo) : formato.quando(proximo),
      }),
    )
  }

  return partes.join(' · ')
})

const desligado = computed(() => pedidos.configuracao !== null && !pedidos.configuracao.ativo)

// ------------------------------------------------------------------ responder

/*
 * Responder mora numa gaveta ao lado da caixa, pela id do pedido: a caixa relida traz a linha nova,
 * e a respondida fecha a gaveta. As duas gavetas (resposta e celular) moram do mesmo lado: abrir a
 * de resposta guarda o celular, e fechá-la o devolve.
 */
const idEmResposta = ref<string | null>(null)

const emResposta = computed(
  () => pedidos.abertas.find((linha) => linha.pedido.id === idEmResposta.value) ?? null,
)

const celularGuardado = ref(false)

function abrirResposta(linha: PedidoDeReservaNaCaixa) {
  if (idEmResposta.value === null && appAberto.value) {
    celularGuardado.value = true
    appAberto.value = false
  }

  idEmResposta.value = linha.pedido.id
}

function fecharResposta() {
  idEmResposta.value = null

  if (celularGuardado.value) {
    celularGuardado.value = false
    appAberto.value = true
  }
}

async function aceitar(
  linha: PedidoDeReservaNaCaixa,
  escolha: { acomodacaoId: string; inicio: string; fim: string } | null,
) {
  const deuCerto = await pedidos.aceitar(linha.pedido.id, escolha)

  if (deuCerto && idEmResposta.value === linha.pedido.id) {
    fecharResposta()
  }
}

async function recusar(payload: { motivo: MotivoDaRecusaDaReserva; mensagem: string }) {
  const linha = emResposta.value

  if (!linha) {
    return
  }

  const deuCerto = await pedidos.recusar(linha.pedido.id, payload.motivo, payload.mensagem)

  if (deuCerto) {
    fecharResposta()
  }
}

const resultado = computed(() => {
  const atual = pedidos.resultado

  if (!atual) {
    return null
  }

  if (atual.tipo === 'reservado') {
    const pedido = getDataset().pedidosDeReserva.find((item) => item.id === atual.pedidoId)
    const acomodacao = getDataset().acomodacoes.find(
      (item) => item.id === atual.reserva.acomodacaoId,
    )

    return {
      tipo: 'reservado' as const,
      texto: t('hotel.pedidos.resultado.reservado', {
        nomes: pedido ? nomesDe(pedido) : '',
        acomodacao: acomodacao?.nome ?? '',
        periodo: formato.periodo(atual.reserva.entradaPrevista, atual.reserva.saidaPrevista),
      }),
      rota: `/hotel/reserva/${atual.reserva.id}`,
    }
  }

  return { tipo: atual.tipo, texto: t(`hotel.pedidos.resultado.${atual.tipo}`), rota: null }
})

// ------------------------------------------------------------------ histórico

const historicoAberto = ref(false)

function fraseDoRespondido(linha: PedidoDeReservaNaCaixa) {
  const { pedido } = linha

  if (pedido.status === 'aceito' && linha.reserva) {
    return t('hotel.pedidos.respondido.aceito', {
      acomodacao: linha.reserva.acomodacao,
      valor: formato.moeda(linha.reserva.totalCentavos),
    })
  }

  if (pedido.status === 'recusado') {
    return t('hotel.pedidos.respondido.recusado', {
      motivo: t(`hotel.pedidos.recusa.motivo.${pedido.recusa?.motivo ?? 'outro'}`),
    })
  }

  return t(`hotel.pedidos.respondido.${pedido.status}`)
}

function rostosDe(pedido: PedidoDeReserva) {
  const ids = [pedido.petId, pedido.acompanhantePetId].filter((id): id is string => Boolean(id))
  const pets = ids
    .map((id) => getDataset().pets.find((pet) => pet.id === id))
    .filter((pet) => pet !== undefined)

  if (pets.length === 0) {
    const nome = pedido.novoCadastro?.petNome ?? ''

    return [
      {
        id: pedido.id,
        nome,
        iniciais: nome.slice(0, 2).toUpperCase(),
        especie: pedido.novoCadastro?.especie ?? null,
        fotoUrl: '',
      },
    ]
  }

  return pets.map((pet) => ({
    id: pet.id,
    nome: pet.nome,
    iniciais: pet.iniciais,
    especie: pet.especie,
    fotoUrl: pet.fotoUrl,
  }))
}

// ------------------------------------------------------------------ configuração e link

const configAberta = ref(false)
const salvandoConfig = ref(false)

async function salvarConfiguracao(nova: ReservaOnline) {
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
  pedidos.configuracao ? `/reservar/${pedidos.configuracao.slug}` : '',
)
const enderecoDoLink = computed(() => `${window.location.origin}${caminhoDoLink.value}`)

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(enderecoDoLink.value)
    toast.add({ severity: 'success', summary: t('hotel.pedidos.link.copiado'), life: 2000 })
  } catch {
    /* Sem área de transferência, o endereço continua no campo. */
  }
}

const compartilharNoWhatsapp = computed(
  () =>
    `https://wa.me/?text=${encodeURIComponent(
      t('hotel.pedidos.link.textoParaCompartilhar', {
        hotel: pedidoDeReservaRepository.hotel().nome,
        endereco: enderecoDoLink.value,
      }),
    )}`,
)

/** Na mesma aba: os dados são de demonstração e moram na memória desta aba. */
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
  if (aberto && idEmResposta.value !== null) {
    celularGuardado.value = false
    idEmResposta.value = null
  }
})

const pessoa = ref<string>('tutor-luciana')

const pessoas = computed(() => [
  { valor: 'tutor-luciana', rotulo: t('hotel.pedidos.ensaio.luciana') },
  { valor: RESPONSAVEL_SEM_VINCULO, rotulo: t('hotel.pedidos.ensaio.renata') },
])

const disputa = ref(envioVaiSerDisputado())

function alternarDisputa(valor: boolean) {
  disputa.value = valor
  disputarProximoEnvio(valor)
}

async function celularMudou() {
  disputa.value = envioVaiSerDisputado()
  await pedidos.avisarMudanca()
}

// ------------------------------------------------------------------ como usar

const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.pedidos.pergunta.titulo'),
    texto: t('hotel.tour.pedidos.pergunta.texto'),
  },
  {
    alvo: '.pedidos__caixa',
    titulo: t('hotel.tour.pedidos.caixa.titulo'),
    texto: t('hotel.tour.pedidos.caixa.texto'),
  },
  {
    alvo: '.pedido__botoes',
    titulo: t('hotel.tour.pedidos.resposta.titulo'),
    texto: t('hotel.tour.pedidos.resposta.texto'),
  },
  {
    alvo: '.pedidos__celular',
    titulo: t('hotel.tour.pedidos.celular.titulo'),
    texto: t('hotel.tour.pedidos.celular.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="t('hotel.pedidos.titulo')"
    :subtitle="t('hotel.pedidos.subtitulo')"
    :loading="!pedidos.carregado && !pedidos.erro"
    :error="pedidos.erro && !pedidos.carregado ? t(pedidos.erro) : ''"
    tour
    @tour="tourAberto = true"
    @retry="pedidos.carregar()"
  >
    <div class="pedidos clinic-scope">
      <p v-if="fraseDoResumo" class="pedidos__resumo" aria-live="polite">{{ fraseDoResumo }}</p>

      <p v-if="desligado" class="pedidos__desligado" role="status">
        <i class="ph ph-pause-circle" aria-hidden="true" />
        <span>{{ t('hotel.pedidos.desligado') }}</span>
        <Button
          size="small"
          severity="secondary"
          outlined
          :label="t('hotel.pedidos.religar')"
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
          :class="resultado.tipo === 'reservado' ? 'ph-check-circle' : 'ph-info'"
          aria-hidden="true"
        />
        <span class="pedidos__resultado-texto">{{ resultado.texto }}</span>
        <RouterLink
          v-if="resultado.rota"
          class="pedidos__resultado-link clinic-focusable"
          :to="resultado.rota"
        >
          {{ t('hotel.pedidos.resultado.verReserva') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
        <Button
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('hotel.pedidos.resultado.dispensar')"
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
            {{ t('hotel.pedidos.secao.abertos') }}
          </h2>
          <span class="hc__ferramentas">{{ t('hotel.pedidos.secao.ordem') }}</span>
        </header>

        <TransitionGroup
          v-if="pedidos.abertas.length > 0"
          tag="ul"
          name="linha"
          class="pedidos__lista"
        >
          <PedidoDeReservaLinha
            v-for="linha in pedidos.abertas"
            :key="linha.pedido.id"
            :linha="linha"
            :respondendo="pedidos.respondendo === linha.pedido.id"
            :ocupado="pedidos.respondendo !== null"
            :aberta="idEmResposta === linha.pedido.id"
            @aceitar="aceitar(linha, $event)"
            @abrir="abrirResposta(linha)"
          />
        </TransitionGroup>

        <div v-else class="pedidos__vazio">
          <PhCalendarPlus class="pedidos__vazio-icone" weight="duotone" aria-hidden="true" />
          <strong>{{ t('hotel.pedidos.vazio.titulo') }}</strong>
          <p>{{ t('hotel.pedidos.vazio.descricao') }}</p>
        </div>
      </section>

      <section v-if="pedidos.respondidas.length > 0" class="pedidos__historico">
        <Button
          class="pedidos__alternar"
          severity="secondary"
          text
          size="small"
          :icon="historicoAberto ? 'ph ph-caret-down' : 'ph ph-caret-right'"
          :label="t('hotel.pedidos.secao.respondidos', { n: pedidos.respondidas.length })"
          :aria-expanded="historicoAberto"
          @click="historicoAberto = !historicoAberto"
        />

        <ul v-if="historicoAberto" class="hc pedidos__respondidos">
          <li v-for="linha in pedidos.respondidas" :key="linha.pedido.id" class="respondido">
            <span class="respondido__rostos">
              <PetAvatar
                v-for="rosto in rostosDe(linha.pedido)"
                :key="rosto.id"
                :nome="rosto.nome"
                :iniciais="rosto.iniciais"
                :especie="rosto.especie"
                :foto-url="rosto.fotoUrl"
                tamanho="sm"
              />
            </span>
            <span class="respondido__texto">
              <strong>{{ nomesDe(linha.pedido) }}</strong>
              <span>{{ formato.periodo(linha.pedido.entrada, linha.pedido.saida) }}</span>
            </span>
            <span class="respondido__como" :class="`respondido__como--${linha.pedido.status}`">
              {{ fraseDoRespondido(linha) }}
            </span>
            <span class="respondido__quando">
              {{ formato.relativo(linha.pedido.respondidoEm ?? linha.pedido.criadoEm) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <PedidoDeReservaGaveta
      :linha="emResposta"
      :nomes="emResposta ? nomesDe(emResposta.pedido) : ''"
      :responsavel="emResposta ? responsavelDe(emResposta.pedido) : ''"
      :telefone="pedidos.configuracao?.urgencia.telefone ?? ''"
      :salvando="pedidos.respondendo !== null"
      @reservar="emResposta && aceitar(emResposta, $event)"
      @recusar="recusar"
      @fechar="fecharResposta"
    />

    <ReservaOnlineGaveta
      v-model:visivel="configAberta"
      :configuracao="pedidos.configuracao"
      :salvando="salvandoConfig"
      @salvar="salvarConfiguracao"
    />

    <Popover ref="popoverDoLink" class="hc-tema">
      <div class="link clinic-scope">
        <p class="link__titulo">{{ t('hotel.pedidos.link.titulo') }}</p>
        <p class="link__ajuda">{{ t('hotel.pedidos.link.ajuda') }}</p>
        <div class="link__campo">
          <InputText
            :model-value="enderecoDoLink"
            readonly
            fluid
            :aria-label="t('hotel.pedidos.link.titulo')"
          />
          <Button
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :aria-label="t('hotel.pedidos.link.copiar')"
            @click="copiarLink"
          />
        </div>
        <div class="link__acoes">
          <Button
            size="small"
            icon="ph ph-arrow-square-out"
            :label="t('hotel.pedidos.link.abrir')"
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
            :label="t('hotel.pedidos.link.whatsapp')"
          />
        </div>
      </div>
    </Popover>

    <!--
      O celular do responsável, numa gaveta que empurra a página. Clicar na página não fecha:
      responder aqui e ver o aviso chegar lá é a demonstração.
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
          {{ t('hotel.pedidos.acoes.verNoApp') }}
        </h2>
      </template>

      <div class="pedidos-gaveta__corpo clinic-scope">
        <div class="ensaio">
          <span id="ensaio-pessoa-hotel" class="clinic-label">{{
            t('hotel.pedidos.ensaio.quem')
          }}</span>
          <SelectButton
            v-model="pessoa"
            :options="pessoas"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="ensaio-pessoa-hotel"
          />
          <label class="ensaio__chave">
            <ToggleSwitch :model-value="disputa" @update:model-value="alternarDisputa" />
            <span>{{ t('hotel.pedidos.ensaio.disputa') }}</span>
          </label>
        </div>

        <ReservarNoApp :tutor-id="pessoa" @mudou="celularMudou" />
      </div>
    </Drawer>

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />

    <template #actions>
      <Button
        class="pedidos__celular"
        :label="t('hotel.pedidos.acoes.verNoApp')"
        size="small"
        severity="secondary"
        outlined
        :aria-expanded="appAberto"
        @click="appAberto = !appAberto"
      >
        <template #icon>
          <PhDeviceMobile class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
        </template>
      </Button>
      <Button
        :label="t('hotel.pedidos.acoes.link')"
        size="small"
        severity="secondary"
        outlined
        aria-haspopup="dialog"
        @click="popoverDoLink?.toggle($event)"
      >
        <template #icon>
          <PhLink class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
        </template>
      </Button>
      <Button
        icon="ph ph-sliders-horizontal"
        :label="t('hotel.pedidos.acoes.configurar')"
        size="small"
        severity="secondary"
        outlined
        aria-haspopup="dialog"
        @click="configAberta = true"
      />
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.pedidos {
  display: grid;
  gap: var(--clinic-space-4);
}

.pedidos__resumo {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.95rem;
  font-weight: 600;
}

.pedidos__lista {
  display: grid;
  margin: 0;
  padding: 0;
  container-type: inline-size;
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

.pedidos__resultado--reservado {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

.pedidos__resultado-link {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-1);
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
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  white-space: nowrap;
}

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
