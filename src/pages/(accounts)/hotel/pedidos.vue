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
 * Irmã da caixa de pedidos da clínica (`/veterinario/pedidos`): a mesma ordem pelo prazo, a
 * contagem regressiva com tom em cada linha, a resposta numa gaveta ao lado da caixa (a linha
 * aberta fica tingida e a lista continua à vista), o histórico recolhido embaixo e o celular de
 * quem pede numa gaveta que empurra a página. As ações do alto são só a configuração e a prévia do
 * celular: a ação desta tela é responder, e ela mora em cada linha.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
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

// ------------------------------------------------------------------ a frase de cima

/** Quantos esperam, quantos passaram do prazo, e quando vence o próximo. */
const fraseDoResumo = computed(() => {
  if (!pedidos.carregado) {
    return ''
  }

  const total = pedidos.abertas.length

  if (total === 0) {
    return t('hotel.pedidos.resumo.nenhum')
  }

  const abertos = t('hotel.pedidos.resumo.abertos', { n: total }, total)

  if (pedidos.atrasadas > 0) {
    return t('clinico.pedidos.tela.resumo', {
      abertos,
      depois: t('hotel.pedidos.resumo.atrasados', { n: pedidos.atrasadas }, pedidos.atrasadas),
    })
  }

  const proximo = pedidos.abertas[0]!.pedido.responderAte

  return t('clinico.pedidos.tela.resumo', {
    abertos,
    depois: t('hotel.pedidos.resumo.proximo', {
      quando:
        dataDe(proximo) === dataDe(agoraIso()) ? formato.hora(proximo) : formato.quando(proximo),
    }),
  })
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

/** O que a última resposta fez, em uma linha — com o atalho para a reserva quando reservou. */
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

  return {
    tipo: atual.tipo,
    /* O texto antigo da vaga perdida mandava a um botão "Outra acomodação" que não existe mais. */
    texto:
      atual.tipo === 'sem-vaga'
        ? t('hotel.pedidos.tela.semVaga')
        : t(`hotel.pedidos.resultado.${atual.tipo}`),
    rota: null,
  }
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
    return t('clinico.pedidos.tela.recusado', {
      motivo: t(`hotel.pedidos.recusa.motivo.${pedido.recusa?.motivo ?? 'outro'}`),
    })
  }

  return t(`hotel.pedidos.respondido.${pedido.status}`)
}

/** O desfecho em cor e ícone: reservado é ok; perder o prazo sem resposta pede atenção. */
function tomDoRespondido(linha: PedidoDeReservaNaCaixa) {
  switch (linha.pedido.status) {
    case 'aceito':
      return { tom: 'ok', icone: 'ph-check-circle' }
    case 'recusado':
      return { tom: 'neutro', icone: 'ph-x-circle' }
    case 'expirado':
      return { tom: 'atencao', icone: 'ph-clock-countdown' }
    default:
      return { tom: 'neutro', icone: 'ph-arrow-u-up-left' }
  }
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
    texto: t('hotel.pedidos.tela.tourResposta'),
  },
  {
    alvo: '.pedidos__celular',
    titulo: t('hotel.tour.pedidos.celular.titulo'),
    texto: t('hotel.tour.pedidos.celular.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela-pedidos"
    :carregando="!pedidos.carregado && !pedidos.erro"
    :erro="pedidos.erro && !pedidos.carregado ? t(pedidos.erro) : ''"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="pedidos.carregar()"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <!--
      Nenhuma ação cheia no alto: a ação desta tela é responder, e ela mora em cada linha. Em cima
      ficam as duas portas da configuração e, mais leve, a prévia do celular.
    -->
    <template #acoes>
      <Button
        type="button"
        class="pedidos__celular"
        severity="secondary"
        text
        icon="ph ph-device-mobile"
        :label="t('clinico.pedidos.tela.verComoPede')"
        :aria-expanded="appAberto"
        @click="appAberto = !appAberto"
      />
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-link"
        :label="t('hotel.pedidos.acoes.link')"
        aria-haspopup="dialog"
        @click="popoverDoLink?.toggle($event)"
      />
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-sliders-horizontal"
        :label="t('clinico.pedidos.tela.configurar')"
        :title="t('hotel.pedidos.acoes.configurar')"
        aria-haspopup="dialog"
        @click="configAberta = true"
      />
    </template>

    <div class="pedidos">
      <!-- Desligado: dito na primeira linha, com o jeito de religar. -->
      <p v-if="desligado" class="aviso aviso--atencao" role="status">
        <i class="ph ph-pause-circle aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t('hotel.pedidos.desligado') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-play"
          :label="t('hotel.pedidos.religar')"
          @click="ligarDeNovo"
        />
      </p>

      <p
        v-if="resultado"
        class="aviso"
        :class="resultado.tipo === 'reservado' ? 'aviso--ok' : 'aviso--neutro'"
        role="status"
      >
        <i
          class="ph aviso__icone"
          :class="resultado.tipo === 'reservado' ? 'ph-check-circle' : 'ph-info'"
          aria-hidden="true"
        />
        <span class="aviso__texto">{{ resultado.texto }}</span>
        <RouterLink v-if="resultado.rota" class="ui-mais" :to="resultado.rota">
          {{ t('hotel.pedidos.resultado.verReserva') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
        <Button
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('hotel.pedidos.resultado.dispensar')"
          @click="pedidos.dispensarResultado()"
        />
      </p>

      <p v-if="pedidos.erro && pedidos.carregado" class="aviso aviso--risco" role="alert">
        <i class="ph ph-warning-circle aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t(pedidos.erro) }}</span>
      </p>

      <UiSecao
        id="pedidos-de-reserva"
        :titulo="t('hotel.pedidos.secao.abertos')"
        :contagem="pedidos.abertas.length"
        :descricao="pedidos.abertas.length > 1 ? t('clinico.pedidos.tela.descricao') : ''"
      >
        <div class="caixa pedidos__caixa ui-folha">
          <TransitionGroup
            v-if="pedidos.abertas.length > 0"
            tag="ul"
            name="linha"
            class="ui-lista caixa__lista"
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

          <div v-else class="caixa__vazio">
            <span class="caixa__vazio-icone" aria-hidden="true">
              <i class="ph ph-calendar-plus" />
            </span>
            <strong>{{ t('hotel.pedidos.vazio.titulo') }}</strong>
            <p>{{ t('hotel.pedidos.vazio.descricao') }}</p>
          </div>
        </div>
      </UiSecao>

      <!-- O respondido é histórico: recolhido no fim, uma linha por pedido. -->
      <section v-if="pedidos.respondidas.length > 0" class="historico">
        <button
          type="button"
          class="historico__alternar"
          :aria-expanded="historicoAberto"
          aria-controls="pedidos-de-reserva-respondidos"
          @click="historicoAberto = !historicoAberto"
        >
          <i
            class="ph"
            :class="historicoAberto ? 'ph-caret-down' : 'ph-caret-right'"
            aria-hidden="true"
          />
          {{ t('clinico.pedidos.tela.respondidos') }}
          <span class="ui-contagem">{{ pedidos.respondidas.length }}</span>
        </button>

        <ul
          v-if="historicoAberto"
          id="pedidos-de-reserva-respondidos"
          class="ui-folha ui-lista"
        >
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
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ nomesDe(linha.pedido) }}</strong>
              <span class="ui-linha__meta respondido__meta ui-num">
                {{ formato.periodo(linha.pedido.entrada, linha.pedido.saida) }}
              </span>
            </span>
            <span
              class="respondido__como"
              :class="`respondido__como--${tomDoRespondido(linha).tom}`"
            >
              <i class="ph" :class="tomDoRespondido(linha).icone" aria-hidden="true" />
              {{ fraseDoRespondido(linha) }}
            </span>
            <span class="respondido__quando ui-num">
              {{ formato.relativo(linha.pedido.respondidoEm ?? linha.pedido.criadoEm) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <template #sempre>
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

      <Popover ref="popoverDoLink" class="clinic-overlay">
        <div class="link">
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
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-copy"
              :aria-label="t('hotel.pedidos.link.copiar')"
              :title="t('hotel.pedidos.link.copiar')"
              @click="copiarLink"
            />
          </div>
          <div class="link__acoes">
            <Button
              type="button"
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
        class="pedidos-gaveta clinic-overlay"
        :style="{ width: 'min(27rem, 94vw)' }"
      >
        <template #header>
          <h2 class="pedidos-gaveta__titulo">
            <i class="ph ph-device-mobile" aria-hidden="true" />
            {{ t('hotel.pedidos.acoes.verNoApp') }}
          </h2>
        </template>

        <div class="pedidos-gaveta__corpo clinic-scope">
          <div class="ensaio">
            <span id="ensaio-pessoa-hotel" class="ensaio__rotulo">
              {{ t('hotel.pedidos.ensaio.quem') }}
            </span>
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
    </template>
  </UiPagina>
</template>

<style scoped>
/* Os botões contornado e de texto no padrão do Trilha: no escuro, o cinza do preset sumia. */
.tela-pedidos {
  --p-button-outlined-secondary-border-color: var(--linha-forte);
  --p-button-outlined-secondary-color: var(--tinta);
  --p-button-outlined-secondary-hover-background: var(--superficie-2);
  --p-button-outlined-secondary-active-background: var(--superficie-3);
  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);
}

.pedidos {
  display: grid;
  gap: 28px;
}

/* ------------------------------------------------------------------ avisos de estado */

.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 14px 12px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.aviso__icone {
  flex: none;
  font-size: 20px;
}

.aviso__texto {
  flex: 1 1 18rem;
  min-width: 0;
}

.aviso--ok {
  border-color: color-mix(in oklab, var(--ok) 35%, transparent);
  background: var(--ok-fundo);
}

.aviso--ok .aviso__icone {
  color: var(--ok-tinta);
}

.aviso--atencao {
  border-color: color-mix(in oklab, var(--atencao) 35%, transparent);
  background: var(--atencao-fundo);
}

.aviso--atencao .aviso__icone {
  color: var(--atencao-tinta);
}

.aviso--risco {
  border-color: color-mix(in oklab, var(--risco) 35%, transparent);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.aviso--neutro .aviso__icone {
  color: var(--tinta-2);
}

/* ------------------------------------------------------------------ a caixa */

.caixa {
  overflow: hidden;
}

.caixa__lista {
  container-type: inline-size;
}

.caixa__vazio {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 44px 24px;
  text-align: center;
}

.caixa__vazio-icone {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  margin-bottom: 6px;
  border-radius: 14px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 24px;
}

.caixa__vazio strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.caixa__vazio p {
  max-width: 46ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ respondidos */

.historico {
  display: grid;
  gap: 12px;
}

.historico__alternar {
  display: inline-flex;
  min-height: 36px;
  justify-self: start;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 6px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.historico__alternar:hover {
  background: var(--superficie-2);
}

.historico__alternar:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.historico__alternar > i {
  color: var(--tinta-2);
  font-size: 16px;
}

[dir='rtl'] .historico__alternar > .ph-caret-right {
  scale: -1 1;
}

.respondido {
  display: grid;
  min-height: 60px;
  align-items: center;
  gap: 6px 16px;
  grid-template-columns: 3rem minmax(10rem, 1fr) minmax(0, 1.5fr) 7rem;
  padding: 10px 18px;
}

.respondido__rostos {
  display: inline-flex;
}

.respondido__rostos > * + * {
  margin-inline-start: -10px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--superficie);
}

.respondido__meta {
  white-space: nowrap;
}

.respondido__como {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.4;
}

.respondido__como i {
  flex: none;
  font-size: 15px;
  transform: translateY(2px);
}

.respondido__como--ok {
  color: var(--ok-tinta);
}

.respondido__como--atencao {
  color: var(--atencao-tinta);
}

.respondido__quando {
  color: var(--tinta-3);
  font-size: 13px;
  text-align: end;
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
  transform: translateY(-6px);
}

.linha-leave-to {
  opacity: 0;
  transform: translateY(6px);
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
    text-align: start;
  }
}

/* ------------------------------------------------------------------ popover do link */

.link {
  display: grid;
  width: min(24rem, 86vw);
  gap: 10px;
}

.link__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.link__ajuda {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.link__campo,
.link__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link__campo > :first-child {
  flex: 1;
}

/* ------------------------------------------------------------------ gaveta do celular */

.pedidos-gaveta__titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.pedidos-gaveta__titulo i {
  color: var(--hotel-tinta);
  font-size: 20px;
}

.pedidos-gaveta__corpo {
  display: grid;
  gap: 14px;
}

/* O ensaio da demonstração: quem está com o celular, e a disputa pelo próximo envio. */
.ensaio {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.ensaio__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.ensaio :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  color: var(--tinta);
}

.ensaio__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
}
</style>
