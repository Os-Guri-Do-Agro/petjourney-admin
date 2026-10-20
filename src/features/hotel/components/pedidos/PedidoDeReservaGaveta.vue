<script setup lang="ts">
/**
 * Responder um pedido de reserva — a gaveta que a linha abre.
 *
 * Ao lado da caixa, não no meio dela: o balcão responde com a lista à vista, e a linha aberta fica
 * tingida para o olho voltar a ela. Irmã da gaveta de pedidos da clínica, com o que é de hotel.
 *
 * De cima para baixo, na ordem em que a decisão acontece:
 *
 * 1. **O pedido** — as noites em destaque, o tipo escolhido (ou "o hotel escolhe"), os pets com o
 *    porte, o prazo com tom, a observação como chegou e o que muda a resposta.
 * 2. **Datas** — a estadia num calendário de período. O ponto é noite com vaga no tipo pedido (ou
 *    em qualquer tipo, quando o hotel escolhe); o tingido é o que foi pedido. Tocar outras datas
 *    refaz as opções para elas — o balcão pode propor a sexta em vez da quinta, e o aviso diz que
 *    mudou.
 * 3. **Onde** — as unidades livres, da mais indicada à menos, com a estimativa de cada uma.
 * 4. **O aviso** — a frase que sai para quem pediu, antes de sair.
 *
 * O rodapé diz a unidade que grava: "Reservar Baia A3". Recusar troca o corpo da gaveta pelo
 * motivo e pela mensagem — um assunto por vez, com o caminho de volta.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import CalendarioDoPedido, {
  type SituacaoNoCalendario,
} from '@/features/clinico/components/pedidos/CalendarioDoPedido.vue'
import { addDays } from '@/features/clinico/domain/clinic-time'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import { pedidoDeReservaRepository, type PedidoDeReservaNaCaixa } from '../../data/reserva-online'
import { agoraIso, getDataset, hojeIso } from '../../data/store'
import type { MotivoDaRecusaDaReserva } from '../../data/types'
import { contarDiarias, dataDe, horaDe, instante, offsetDe } from '../../domain/hotel-time'
import {
  situacaoDoPrazoDaReserva,
  type SugestaoDeAcomodacao,
} from '../../domain/pedidos-de-reserva'

const props = defineProps<{
  linha: PedidoDeReservaNaCaixa | null
  /** "Bento e Açaí" — os nomes já resolvidos pela página. */
  nomes: string
  responsavel: string
  /** O telefone do balcão, para a mensagem de recusa. */
  telefone: string
  salvando: boolean
}>()

const emit = defineEmits<{
  reservar: [escolha: { acomodacaoId: string; inicio: string; fim: string }]
  recusar: [payload: { motivo: MotivoDaRecusaDaReserva; mensagem: string }]
  fechar: []
}>()

const { t, locale } = useI18n()
const formato = useHotelFormat()

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

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

// ------------------------------------------------------------------ o pedido

const pedido = computed(() => props.linha?.pedido ?? null)

function petDoHotel(id: string | null) {
  return id ? (getDataset().pets.find((item) => item.id === id) ?? null) : null
}

const pets = computed(() => {
  const atual = pedido.value

  if (!atual) {
    return []
  }

  const conhecidos = [atual.petId, atual.acompanhantePetId]
    .map((id) => petDoHotel(id))
    .filter((item) => item !== null)
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      iniciais: item.iniciais,
      especie: item.especie,
      fotoUrl: item.fotoUrl,
      porte: item.porte,
    }))

  if (conhecidos.length > 0 || !atual.novoCadastro) {
    return conhecidos
  }

  const nome = atual.novoCadastro.petNome

  return [
    {
      id: atual.id,
      nome,
      iniciais: nome.slice(0, 2).toUpperCase(),
      especie: atual.novoCadastro.especie,
      fotoUrl: '',
      porte: atual.novoCadastro.porte,
    },
  ]
})

/** "Bento · Grande, Açaí · Médio" — o porte decide onde cada um cabe. */
const petsComPorte = computed(() =>
  pets.value
    .map((item) => (item.porte ? `${item.nome} · ${t(`hotel.porte.${item.porte}`)}` : item.nome))
    .join(', '),
)

const primeiraVez = computed(
  () =>
    pedido.value !== null &&
    pedido.value.novoCadastro !== null &&
    !(pedido.value.petId && petDoHotel(pedido.value.petId)),
)

const tipoPedido = computed(() =>
  pedido.value?.tipoId
    ? (getDataset().tiposDeAcomodacao.find((item) => item.id === pedido.value!.tipoId)?.nome ?? '')
    : '',
)

const diarias = computed(() =>
  pedido.value ? contarDiarias(pedido.value.entrada, pedido.value.saida) : 0,
)

/** As noites pedidas em destaque, como na linha: o mês, "28–31" grande, as diárias. */
const noitesPedidas = computed(() => {
  if (!pedido.value) {
    return null
  }

  const de = dataDe(pedido.value.entrada)
  const ate = dataDe(pedido.value.saida)
  const mes = (iso: string) =>
    new Intl.DateTimeFormat(tag.value, { month: 'short', timeZone: 'UTC' })
      .format(new Date(`${iso}T12:00:00Z`))
      .replace(/\.$/, '')

  return {
    mes: mes(de) === mes(ate) ? mes(de) : `${mes(de)}–${mes(ate)}`,
    noites: `${Number(de.slice(8, 10))}–${Number(ate.slice(8, 10))}`,
  }
})

const semVagaNoTipo = computed(
  () => pedido.value?.modo === 'acomodacao-escolhida' && props.linha?.tipoTemVaga === false,
)

const prazo = computed(() =>
  pedido.value ? situacaoDoPrazoDaReserva(pedido.value, agoraIso()) : 'no-prazo',
)

/** O mesmo tom da linha: risco quando passou ou falta meia hora, atenção nas duas horas seguintes. */
const tomDoPrazo = computed(() => {
  if (prazo.value !== 'no-prazo') {
    return 'risco'
  }

  const ate = pedido.value?.responderAte
  const minutos = ate ? (Date.parse(ate) - Date.parse(agoraIso())) / 60_000 : Infinity

  return minutos <= 120 ? 'atencao' : 'neutro'
})

const fraseDoPrazo = computed(() => {
  const ate = pedido.value?.responderAte

  if (!ate) {
    return ''
  }

  if (prazo.value === 'atrasado') {
    return t('hotel.pedidos.prazo.atrasado', { valor: formato.relativo(ate) })
  }

  return t('hotel.pedidos.prazo.ate', {
    quando: dataDe(ate) === dataDe(agoraIso()) ? formato.hora(ate) : formato.quando(ate),
  })
})

// ------------------------------------------------------------------ recusar
/*
 * O estado da recusa vem antes das datas: o `watch` imediato da linha (mais abaixo) chama
 * `reiniciarRecusa()` na montagem, e com os `ref`s declarados depois dele a gaveta quebrava ao
 * abrir a tela ("Cannot access 'motivo' before initialization") — o mesmo defeito que a gaveta da
 * clínica teve.
 */

const MOTIVOS: MotivoDaRecusaDaReserva[] = ['sem-vaga', 'exigencias', 'perfil', 'outro']

const motivo = ref<MotivoDaRecusaDaReserva>('sem-vaga')
const mensagem = ref('')
/** O balcão mexeu no texto: trocar o motivo não apaga o que ele escreveu. */
const editado = ref(false)

const opcoesDeMotivo = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: t(`hotel.pedidos.recusa.motivo.${valor}`) })),
)

function textoPadrao() {
  return t(`hotel.pedidos.recusa.mensagem.${motivo.value}`, {
    nome: props.responsavel.split(' ')[0] ?? '',
    nomes: props.nomes,
    telefone: props.telefone,
  })
}

function reiniciarRecusa() {
  motivo.value = 'sem-vaga'
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

const podeRecusar = computed(() => mensagem.value.trim().length > 0)

// ------------------------------------------------------------------ datas

const hoje = computed(() => hojeIso())
const ultimoDia = computed(() => addDays(hoje.value, 90))

const noites = ref<Record<string, SituacaoNoCalendario>>({})
const periodo = ref<{ de: string; ate: string | null } | null>(null)

const periodoPedido = computed(() =>
  pedido.value ? { de: dataDe(pedido.value.entrada), ate: dataDe(pedido.value.saida) } : null,
)

/** As datas tocadas são as do pedido? Então valem as sugestões com o "aceita mudar um dia". */
const mesmasDatas = computed(
  () =>
    periodo.value !== null &&
    periodoPedido.value !== null &&
    periodo.value.de === periodoPedido.value.de &&
    periodo.value.ate === periodoPedido.value.ate,
)

/** O período tocado, com a hora de entrada e de saída do próprio pedido. */
function instantesDo(atual: { de: string; ate: string }) {
  const base = pedido.value!
  const offset = offsetDe(base.entrada)

  return {
    inicio: instante(atual.de, horaDe(base.entrada), offset),
    fim: instante(atual.ate, horaDe(base.saida), offset),
  }
}

// ------------------------------------------------------------------ onde

const opcoes = ref<SugestaoDeAcomodacao[]>([])
const carregando = ref(false)
const escolhida = ref<string | null>(null)

function chaveDa(opcao: SugestaoDeAcomodacao) {
  return `${opcao.acomodacao.id}|${opcao.inicio}`
}

const selecionada = computed(
  () => opcoes.value.find((opcao) => chaveDa(opcao) === escolhida.value) ?? null,
)

async function carregarOpcoes() {
  const atual = pedido.value

  if (!atual || !periodo.value?.ate) {
    return
  }

  carregando.value = true

  try {
    if (mesmasDatas.value) {
      opcoes.value = await pedidoDeReservaRepository.sugestoes(atual.id, 6)
    } else {
      const { inicio, fim } = instantesDo({ de: periodo.value.de, ate: periodo.value.ate })

      opcoes.value = await pedidoDeReservaRepository.sugestoesNoPeriodo(atual.id, inicio, fim, 6)
    }

    escolhida.value = opcoes.value[0] ? chaveDa(opcoes.value[0]) : null
  } catch {
    opcoes.value = []
    escolhida.value = null
  } finally {
    carregando.value = false
  }
}

watch(
  () => periodo.value && `${periodo.value.de}|${periodo.value.ate}`,
  () => {
    if (periodo.value?.ate) {
      void carregarOpcoes()
    }
  },
)

watch(
  () => props.linha?.pedido.id,
  async (id) => {
    vista.value = 'responder'
    opcoes.value = []
    escolhida.value = null
    noites.value = {}
    reiniciarRecusa()

    if (!id || !periodoPedido.value) {
      periodo.value = null

      return
    }

    periodo.value = { ...periodoPedido.value }

    try {
      noites.value = await pedidoDeReservaRepository.noites(id, hoje.value, ultimoDia.value)
    } catch {
      noites.value = {}
    }
  },
  { immediate: true },
)

function estimativa(opcao: SugestaoDeAcomodacao) {
  if (!pedido.value) {
    return null
  }

  return pedidoDeReservaRepository.estimativa(
    pedido.value.id,
    opcao.acomodacao.id,
    opcao.inicio,
    opcao.fim,
  )
}

/**
 * A unidade fica em datas diferentes das que estão no calendário — o "aceita mudar um dia". As
 * datas que o balcão tocou já são ditas uma vez, acima da lista; repetir em cada opção poluía.
 */
function mudaAsDatas(opcao: SugestaoDeAcomodacao) {
  const alvo = periodo.value?.ate
    ? instantesDo({ de: periodo.value.de, ate: periodo.value.ate })
    : { inicio: pedido.value?.entrada, fim: pedido.value?.saida }

  return opcao.inicio !== alvo.inicio || opcao.fim !== alvo.fim
}

const textoDoAviso = computed(() =>
  selecionada.value
    ? t('hotel.pedidos.acomodacao.aviso', {
        nomes: props.nomes,
        acomodacao: selecionada.value.acomodacao.nome,
        periodo: formato.periodo(selecionada.value.inicio, selecionada.value.fim),
      })
    : '',
)

function reservar() {
  if (selecionada.value) {
    emit('reservar', {
      acomodacaoId: selecionada.value.acomodacao.id,
      inicio: selecionada.value.inicio,
      fim: selecionada.value.fim,
    })
  }
}
</script>

<template>
  <Drawer
    v-model:visible="aberta"
    position="right"
    :modal="false"
    :dismissable="false"
    class="gaveta-da-reserva clinic-overlay pj-lugar--hotel"
    :style="{ width: `min(${LARGURA}, 96vw)` }"
  >
    <template #header>
      <div v-if="pedido" class="gr-cabeca">
        <span class="gr-cabeca__rostos" :class="{ 'gr-cabeca__rostos--grupo': pets.length > 1 }">
          <PetAvatar
            v-for="item in pets"
            :key="item.id"
            :nome="item.nome"
            :iniciais="item.iniciais"
            :especie="item.especie"
            :foto-url="item.fotoUrl"
            tamanho="md"
          />
        </span>
        <span class="gr-cabeca__texto">
          <!-- O foco abre no título: o leitor anuncia o pedido, e nenhum dia do calendário nasce com anel. -->
          <h2 class="gr-cabeca__titulo" tabindex="-1" autofocus>
            {{
              vista === 'recusar'
                ? t('hotel.pedidos.recusa.titulo', { nomes })
                : t('hotel.pedidos.gaveta.titulo', { nomes })
            }}
          </h2>
          <span class="gr-cabeca__meta">
            <i
              class="ph"
              :class="pedido.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
              aria-hidden="true"
            />
            {{ responsavel }} · {{ t(`hotel.pedidos.canal.${pedido.canal}`) }}
          </span>
        </span>
      </div>
    </template>

    <div v-if="pedido" class="gr clinic-scope">
      <!-- ============================================================ responder -->
      <template v-if="vista === 'responder'">
        <section class="gr__pedido" :aria-label="t('hotel.pedidos.gaveta.oPedido')">
          <span
            v-if="noitesPedidas"
            class="gr__noites"
            role="img"
            :aria-label="formato.periodo(pedido.entrada, pedido.saida)"
          >
            <span class="gr__noites-mes" aria-hidden="true">{{ noitesPedidas.mes }}</span>
            <span class="gr__noites-numero ui-num" aria-hidden="true">
              {{ noitesPedidas.noites }}
            </span>
            <span class="gr__noites-diarias" aria-hidden="true">
              {{ t('hotel.pedidos.diarias', { n: diarias }, diarias) }}
            </span>
          </span>

          <div class="gr__pedido-texto">
            <p class="gr__tipo">
              <i
                class="ph"
                :class="pedido.modo === 'acomodacao-escolhida' ? 'ph-bed' : 'ph-magic-wand'"
                aria-hidden="true"
              />
              <strong>
                {{
                  pedido.modo === 'acomodacao-escolhida'
                    ? t('hotel.pedidos.escolheuTipo', { tipo: tipoPedido })
                    : t('hotel.pedidos.hotelEscolhe')
                }}
              </strong>
            </p>
            <p class="gr__frase ui-num">{{ formato.periodo(pedido.entrada, pedido.saida) }}</p>
            <p class="gr__linha">
              <i class="ph ph-paw-print" aria-hidden="true" />
              {{ petsComPorte }}
            </p>
            <p v-if="semVagaNoTipo" class="gr__linha gr__linha--atencao">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              {{ t('hotel.pedidos.semVagaNoTipo', { tipo: tipoPedido }) }}
            </p>
            <p class="gr__linha gr__linha--prazo" :class="`gr__linha--prazo-${tomDoPrazo}`">
              <i
                class="ph"
                :class="tomDoPrazo === 'neutro' ? 'ph-clock' : 'ph-clock-countdown'"
                aria-hidden="true"
              />
              {{ fraseDoPrazo }}
            </p>
          </div>
        </section>

        <blockquote v-if="pedido.observacao" class="gr__nota">
          <i class="ph ph-quotes" aria-hidden="true" />
          <span>{{ pedido.observacao }}</span>
        </blockquote>

        <ul
          v-if="primeiraVez || pedido.servicos.length > 0 || pets.length > 1 || pedido.aceitaMudarUmDia"
          class="gr__fatos"
        >
          <li v-if="primeiraVez" class="gr__fato gr__fato--novo">
            <i class="ph ph-sparkle" aria-hidden="true" />
            <span class="gr__fato-texto">
              {{ t('hotel.pedidos.gaveta.primeiraVez') }}
              <span v-if="pedido.novoCadastro" class="gr__fato-dado">
                <bdi dir="ltr" class="ui-num">{{ pedido.novoCadastro.telefone }}</bdi>
              </span>
            </span>
          </li>
          <li v-if="pedido.servicos.length > 0" class="gr__fato">
            <i class="ph ph-plus-circle" aria-hidden="true" />
            {{ pedido.servicos.map((servico) => t(`hotel.servico.${servico}`)).join(' · ') }}
          </li>
          <li v-if="pets.length > 1" class="gr__fato">
            <i class="ph ph-users-three" aria-hidden="true" />
            {{ t('hotel.pedidos.mesmaAcomodacao') }}
          </li>
          <li v-if="pedido.aceitaMudarUmDia" class="gr__fato">
            <i class="ph ph-arrows-left-right" aria-hidden="true" />
            {{ t('hotel.pedidos.gaveta.aceitaMudar') }}
          </li>
        </ul>

        <section class="gr__secao" aria-labelledby="gr-datas">
          <h3 id="gr-datas" class="gr__titulo">{{ t('hotel.pedidos.gaveta.datas') }}</h3>

          <CalendarioDoPedido
            v-model:periodo="periodo"
            modo="periodo"
            :min="hoje"
            :max="ultimoDia"
            :situacoes="noites"
            :janela="periodoPedido"
            :rotulo="t('hotel.pedidos.gaveta.datas')"
          />

          <p class="gr__legenda" aria-hidden="true">
            <span><span class="gr__ponto" />{{ t('hotel.pedidos.gaveta.legendaVaga') }}</span>
            <span><span class="gr__tinta" />{{ t('hotel.pedidos.gaveta.legendaPedido') }}</span>
          </p>

          <p v-if="periodo && !periodo.ate" class="gr__linha" aria-live="polite">
            <i class="ph ph-hand-tap" aria-hidden="true" />
            {{ t('hotel.pedidos.gaveta.toqueSaida') }}
          </p>
          <p v-else-if="!mesmasDatas" class="gr__outras" aria-live="polite">
            <span class="gr__linha gr__linha--atencao">
              <i class="ph ph-info" aria-hidden="true" />
              {{ t('hotel.pedidos.gaveta.outrasDatas') }}
            </span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-counter-clockwise"
              :label="t('hotel.pedidos.gaveta.voltarDatas')"
              @click="periodo = periodoPedido ? { ...periodoPedido } : null"
            />
          </p>
        </section>

        <section class="gr__secao" aria-labelledby="gr-onde">
          <h3 id="gr-onde" class="gr__titulo">{{ t('hotel.pedidos.gaveta.onde') }}</h3>

          <p v-if="carregando" class="gr__linha" role="status">
            <i class="ph ph-circle-notch ph-spin" aria-hidden="true" />
            {{ t('hotel.pedidos.acomodacao.procurando') }}
          </p>
          <p v-else-if="periodo?.ate && opcoes.length === 0" class="gr__nenhuma">
            <i class="ph ph-calendar-x" aria-hidden="true" />
            {{ t('hotel.pedidos.acomodacao.nenhuma') }}
          </p>

          <div
            v-else
            class="gr__opcoes"
            role="radiogroup"
            :aria-label="t('hotel.pedidos.gaveta.onde')"
          >
            <button
              v-for="opcao in opcoes"
              :key="chaveDa(opcao)"
              type="button"
              role="radio"
              class="gr__opcao"
              :class="{ 'gr__opcao--escolhida': escolhida === chaveDa(opcao) }"
              :aria-checked="escolhida === chaveDa(opcao)"
              @click="escolhida = chaveDa(opcao)"
            >
              <span class="gr__marcador" aria-hidden="true" />
              <span class="gr__opcao-nome">
                <strong>
                  {{ opcao.acomodacao.nome }}
                  <span v-if="pedido.tipoId === opcao.tipo.id" class="ui-selo ui-selo--lugar">
                    {{ t('hotel.pedidos.tela.tipoPedido') }}
                  </span>
                </strong>
                <span>
                  {{ opcao.tipo.nome }}
                  <template v-if="opcao.acomodacao.porteMaximo">
                    ·
                    {{
                      t('hotel.pedidos.gaveta.ate', {
                        porte: t(`hotel.porte.${opcao.acomodacao.porteMaximo}`),
                      })
                    }}
                  </template>
                </span>
                <span v-if="mudaAsDatas(opcao)" class="gr__opcao-muda ui-num">
                  <i class="ph ph-arrows-left-right" aria-hidden="true" />
                  {{ formato.periodo(opcao.inicio, opcao.fim) }}
                </span>
              </span>
              <span v-if="estimativa(opcao) !== null" class="gr__opcao-preco ui-num">
                {{ formato.moeda(estimativa(opcao)!) }}
              </span>
            </button>
          </div>
        </section>

        <section v-if="selecionada" class="gr__aviso">
          <span class="gr__via">
            <i class="ph ph-paper-plane-tilt" aria-hidden="true" />
            {{
              pedido.canal === 'link'
                ? t('hotel.pedidos.acomodacao.avisoPorMensagem')
                : t('hotel.pedidos.acomodacao.avisoPorPush')
            }}
          </span>
          <p class="gr__bolha">{{ textoDoAviso }}</p>
        </section>
      </template>

      <!-- ============================================================ recusar -->
      <template v-else>
        <div class="gr__campo">
          <span id="gr-motivo" class="gr__rotulo-campo">{{ t('hotel.pedidos.recusa.porque') }}</span>
          <SelectButton
            v-model="motivo"
            :options="opcoesDeMotivo"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="gr-motivo"
            class="gr__motivos"
          />
        </div>

        <label class="gr__campo">
          <span class="gr__rotulo-campo">
            {{ t('hotel.pedidos.recusa.mensagemPara', { nome: responsavel }) }}
          </span>
          <Textarea v-model="mensagem" rows="6" auto-resize fluid @input="editado = true" />
        </label>

        <p class="gr__linha">
          <i class="ph ph-info" aria-hidden="true" />
          {{
            pedido.canal === 'link'
              ? t('hotel.pedidos.acomodacao.avisoPorMensagem')
              : t('hotel.pedidos.acomodacao.avisoPorPush')
          }}
        </p>
      </template>
    </div>

    <template #footer>
      <div v-if="pedido" class="gr-rodape">
        <template v-if="vista === 'responder'">
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('hotel.pedidos.recusar')"
            :disabled="salvando"
            @click="irParaRecusa"
          />
          <Button
            type="button"
            icon="ph ph-check"
            class="gr-rodape__principal"
            :label="
              selecionada
                ? t('hotel.pedidos.reservarEm', { acomodacao: selecionada.acomodacao.nome })
                : t('hotel.pedidos.gaveta.escolha')
            "
            :disabled="!selecionada"
            :loading="salvando"
            @click="reservar"
          />
        </template>
        <template v-else>
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-arrow-left"
            :label="t('hotel.pedidos.gaveta.voltar')"
            :disabled="salvando"
            @click="vista = 'responder'"
          />
          <Button
            type="button"
            icon="ph ph-paper-plane-tilt"
            class="gr-rodape__principal"
            :label="t('hotel.pedidos.recusa.enviar')"
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

.gr-cabeca {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.gr-cabeca__rostos {
  display: inline-flex;
  flex: none;
}

.gr-cabeca__rostos--grupo > * + * {
  margin-inline-start: -12px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--superficie);
}

.gr-cabeca__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.gr-cabeca__titulo {
  margin: 0;
  outline: none;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.gr-cabeca__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ corpo */

.gr {
  display: grid;
  gap: 18px;
  color: var(--tinta);
}

/* O pedido: as noites grandes à esquerda, o que e o prazo à direita — uma faixa tingida só. */
.gr__pedido {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.gr__noites {
  display: grid;
  flex: none;
  min-width: 6rem;
  align-content: start;
  gap: 1px;
  padding-inline-end: 16px;
  border-inline-end: 1px solid var(--linha);
  line-height: 1.15;
}

.gr__noites-mes,
.gr__noites-diarias {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
}

.gr__noites-numero {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.gr__pedido-texto {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.gr__pedido-texto p,
.gr__linha {
  margin: 0;
}

.gr__tipo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-size: 15px;
}

.gr__tipo > i {
  color: var(--hotel-tinta);
  transform: translateY(2px);
}

.gr__tipo strong {
  color: var(--tinta);
  font-weight: 600;
}

.gr__frase {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.gr__linha {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.gr__linha > i {
  flex: none;
  transform: translateY(1px);
}

.gr__linha--atencao {
  color: var(--atencao-tinta);
  font-weight: 550;
}

.gr__linha--prazo {
  font-weight: 550;
}

.gr__linha--prazo-risco {
  color: var(--risco-tinta);
}

.gr__linha--prazo-atencao {
  color: var(--atencao-tinta);
}

.gr__nota {
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

.gr__nota > i {
  flex: none;
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.gr__fatos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gr__fato {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.gr__fato > i {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
  transform: translateY(2px);
}

.gr__fato-texto {
  display: grid;
  gap: 2px;
}

.gr__fato-dado {
  color: var(--tinta-2);
  font-weight: 450;
  white-space: nowrap;
}

.gr__fato--novo,
.gr__fato--novo > i {
  color: var(--hotel-tinta);
  font-weight: 550;
}

/* ------------------------------------------------------------------ seções */

.gr__secao {
  display: grid;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--linha);
}

.gr__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.gr__legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: -4px 0 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.gr__legenda > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gr__ponto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--musgo);
}

.gr__tinta {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--musgo-fundo);
}

.gr__outras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin: 0;
}

.gr__nenhuma {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.gr__nenhuma > i {
  flex: none;
  transform: translateY(2px);
}

/* ------------------------------------------------------------------ onde */

.gr__opcoes {
  display: grid;
  gap: 8px;
}

.gr__opcao {
  display: grid;
  width: 100%;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 10px 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition:
    border-color var(--pj-tempo-curto) ease-out,
    background-color var(--pj-tempo-curto) ease-out;
}

.gr__opcao:hover {
  border-color: var(--musgo);
}

.gr__opcao:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.gr__opcao--escolhida,
.gr__opcao--escolhida:hover {
  border-color: var(--musgo);
  background: var(--musgo-fundo);
}

/* O marcador de rádio desenhado com borda: o botão inteiro é o rádio, o círculo só o indica. */
.gr__marcador {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
}

.gr__opcao--escolhida .gr__marcador {
  border: 5px solid var(--musgo);
}

.gr__opcao-nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.gr__opcao-nome strong {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 15px;
  font-weight: 600;
}

.gr__opcao-nome strong .ui-selo {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.gr__opcao-nome > span {
  color: var(--tinta-2);
  font-size: 13px;
}

.gr__opcao-muda {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--atencao-tinta) !important;
  font-weight: 550;
}

.gr__opcao-preco {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ aviso */

.gr__aviso {
  display: grid;
  gap: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--linha);
}

.gr__via {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

/* A mensagem como chega no celular: um balão, na cor da casa. */
.gr__bolha {
  margin: 0;
  padding: 10px 14px;
  border-radius: 14px 14px 14px 4px;
  background: var(--hotel-fundo);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ recusar */

.gr__campo {
  display: grid;
  gap: 8px;
}

.gr__rotulo-campo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.gr__motivos {
  display: flex;
  flex-wrap: wrap;
}

/* O segmento escolhido: superfície e tinta, legível nos dois temas. */
.gr__motivos :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  color: var(--tinta);
}

/* ------------------------------------------------------------------ rodapé */

.gr-rodape {
  display: flex;
  gap: 8px;
}

.gr-rodape__principal.p-button {
  flex: 1;
}

@media (prefers-reduced-motion: reduce) {
  .gr__opcao {
    transition: none;
  }
}
</style>
