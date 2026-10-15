<script setup lang="ts">
/**
 * Responder um pedido de reserva — a gaveta que a linha abre.
 *
 * Ao lado da caixa, não no meio dela: o balcão responde com a lista à vista. Substitui os dois
 * diálogos que existiam ("outra acomodação" e "recusar"), que cobriam a caixa e escondiam as datas
 * numa frase.
 *
 * De cima para baixo, na ordem em que a decisão acontece:
 *
 * 1. **O pedido** — a folhinha das noites, o tipo escolhido (ou "o hotel escolhe"), os pets com o
 *    porte, os extras e a observação como chegou.
 * 2. **Datas** — a estadia num calendário de período. O ponto é noite com vaga no tipo pedido (ou
 *    em qualquer tipo, quando o hotel escolhe); o tingido é o que foi pedido. Tocar outras datas
 *    refaz as opções para elas — o balcão pode propor a sexta em vez da quinta, e o aviso diz que
 *    mudou.
 * 3. **Onde** — as unidades livres, da mais indicada à menos, com a estimativa de cada uma.
 * 4. **O aviso** — a frase que sai para quem pediu, antes de sair.
 *
 * O rodapé diz a unidade que grava: "Reservar Baia A3". Recusar troca o corpo da gaveta pelo
 * motivo e pela mensagem.
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
import FolhaDoDia from '@/features/clinico/components/pedidos/FolhaDoDia.vue'
import { addDays } from '@/features/clinico/domain/clinic-time'

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

const { t } = useI18n()
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

const semVagaNoTipo = computed(
  () => pedido.value?.modo === 'acomodacao-escolhida' && props.linha?.tipoTemVaga === false,
)

const prazo = computed(() =>
  pedido.value ? situacaoDoPrazoDaReserva(pedido.value, agoraIso()) : 'no-prazo',
)

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
 * datas que o balcão tocou já são ditas uma vez, acima da lista; repetir em cada cartão poluía.
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

// ------------------------------------------------------------------ recusar

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
</script>

<template>
  <Drawer
    v-model:visible="aberta"
    position="right"
    :modal="false"
    :dismissable="false"
    class="hc-tema gaveta-da-reserva"
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
          <FolhaDoDia
            tamanho="lg"
            :dia="dataDe(pedido.entrada)"
            :ate="dataDe(pedido.saida)"
            :rodape="t('hotel.pedidos.diarias', { n: diarias }, diarias)"
          />
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
            <p class="gr__frase">{{ formato.periodo(pedido.entrada, pedido.saida) }}</p>
            <p class="gr__linha">
              <i class="ph ph-paw-print" aria-hidden="true" />
              {{ petsComPorte }}
            </p>
            <p v-if="semVagaNoTipo" class="gr__linha gr__linha--atencao">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              {{ t('hotel.pedidos.semVagaNoTipo', { tipo: tipoPedido }) }}
            </p>
            <p class="gr__linha" :class="`gr__linha--prazo-${prazo}`">
              <i
                class="ph"
                :class="prazo === 'no-prazo' ? 'ph-clock' : 'ph-clock-countdown'"
                aria-hidden="true"
              />
              {{ fraseDoPrazo }}
            </p>
          </div>
        </section>

        <blockquote v-if="pedido.observacao" class="gr__nota">
          <i class="ph ph-quotes" aria-hidden="true" />
          {{ pedido.observacao }}
        </blockquote>

        <ul class="gr__fatos">
          <li v-if="primeiraVez" class="gr__fato gr__fato--novo">
            <i class="ph ph-sparkle" aria-hidden="true" />
            <span class="gr__fato-texto">
              {{ t('hotel.pedidos.gaveta.primeiraVez') }}
              <span v-if="pedido.novoCadastro" class="gr__fato-dado">
                <bdi dir="ltr">{{ pedido.novoCadastro.telefone }}</bdi>
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
          <p v-else-if="!mesmasDatas" class="gr__linha gr__linha--atencao" aria-live="polite">
            <i class="ph ph-info" aria-hidden="true" />
            {{ t('hotel.pedidos.gaveta.outrasDatas') }}
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              class="gr__voltar-datas"
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
          <p v-else-if="periodo?.ate && opcoes.length === 0" class="gr__linha">
            <i class="ph ph-calendar-x" aria-hidden="true" />
            {{ t('hotel.pedidos.acomodacao.nenhuma') }}
          </p>

          <div
            v-else
            class="gr__opcoes"
            role="radiogroup"
            :aria-label="t('hotel.pedidos.gaveta.onde')"
          >
            <Button
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
                <strong>{{ opcao.acomodacao.nome }}</strong>
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
                <span v-if="mudaAsDatas(opcao)" class="gr__opcao-muda">
                  <i class="ph ph-arrows-left-right" aria-hidden="true" />
                  {{ formato.periodo(opcao.inicio, opcao.fim) }}
                </span>
              </span>
              <span v-if="pedido.tipoId === opcao.tipo.id" class="gr__opcao-selo">
                {{ t('hotel.pedidos.gaveta.pedido') }}
              </span>
              <span v-if="estimativa(opcao) !== null" class="gr__opcao-preco">
                {{ formato.moeda(estimativa(opcao)!) }}
              </span>
            </Button>
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
          <p>{{ textoDoAviso }}</p>
        </section>
      </template>

      <!-- ============================================================ recusar -->
      <template v-else>
        <div class="gr__campo">
          <span id="gr-motivo" class="clinic-label">{{ t('hotel.pedidos.recusa.porque') }}</span>
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
          <span class="clinic-label">
            {{ t('hotel.pedidos.recusa.mensagemPara', { nome: responsavel }) }}
          </span>
          <Textarea v-model="mensagem" rows="6" auto-resize fluid @input="editado = true" />
        </label>
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
.gr-cabeca {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.gr-cabeca__rostos {
  display: inline-flex;
  flex: 0 0 auto;
}

.gr-cabeca__rostos--grupo > * + * {
  margin-inline-start: -0.6rem;
  box-shadow: 0 0 0 2px var(--hc-cartao);
  border-radius: 50%;
}

.gr-cabeca__texto {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.gr-cabeca__titulo {
  margin: 0;
  outline: none;
  color: var(--hc-tinta);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.25;
}

.gr-cabeca__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.gr {
  display: grid;
  gap: 1.1rem;
}

.gr__pedido {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}

.gr__pedido-texto {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
}

.gr__pedido-texto p,
.gr__linha {
  margin: 0;
}

.gr__tipo {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9375rem;
}

.gr__tipo > i {
  color: var(--hc-marca);
}

.gr__tipo strong {
  color: var(--hc-tinta);
}

.gr__frase {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.gr__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.gr__linha > i {
  flex: 0 0 auto;
  transform: translateY(0.1rem);
}

.gr__linha--atencao {
  color: var(--clinic-attention-text);
  font-weight: 650;
}

.gr__linha--prazo-atrasado {
  color: var(--clinic-risk-text);
}

.gr__linha--prazo-vencendo > i {
  color: var(--clinic-attention-text);
}

.gr__voltar-datas.p-button {
  --hc-botao-sombra: none;

  margin-inline-start: auto;
}

.gr__nota {
  display: flex;
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.75rem;
  gap: 0.5rem;
  background: var(--hc-pagina);
  color: var(--hc-tinta);
  font-size: 0.875rem;
  line-height: 1.5;
}

.gr__nota > i {
  flex: 0 0 auto;
  color: var(--hc-tinta-3);
  font-size: 1rem;
}

.gr__fatos {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.35rem;
  list-style: none;
}

.gr__fatos:empty {
  display: none;
}

.gr__fato {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.gr__fato-texto {
  display: grid;
  gap: 0.1rem;
}

.gr__fato-dado {
  color: var(--hc-tinta-2);
  font-weight: 500;
  white-space: nowrap;
}

.gr__fato--novo {
  color: var(--hc-ciano-tinta);
  font-weight: 650;
}

.gr__secao {
  display: grid;
  padding-top: 1rem;
  border-top: 1px solid var(--hc-linha);
  gap: 0.6rem;
}

.gr__titulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 700;
}

.gr__legenda {
  display: flex;
  flex-wrap: wrap;
  margin: -0.15rem 0 0;
  gap: 0.9rem;
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
}

.gr__legenda > span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.gr__ponto {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--hc-marca);
}

.gr__tinta {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  background: var(--hc-marca-clara);
}

/* ------------------------------------------------------------------ onde */

.gr__opcoes {
  display: grid;
  gap: 0.45rem;
}

.gr__opcao.p-button {
  --hc-botao-sombra: none;

  display: grid;
  align-items: center;
  width: 100%;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.8rem;
  gap: 0.7rem;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition:
    border-color 150ms ease-out,
    background-color 150ms ease-out;
}

.gr__opcao.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

.gr__opcao--escolhida.p-button,
.gr__opcao--escolhida.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
}

/* O marcador de rádio desenhado com borda: o botão inteiro é o rádio, o círculo só o indica. */
.gr__marcador {
  width: 1.05rem;
  height: 1.05rem;
  border: 1.5px solid var(--hc-tinta-3);
  border-radius: 50%;
  background: var(--hc-cartao);
}

.gr__opcao--escolhida .gr__marcador {
  border: 5px solid var(--hc-marca);
}

.gr__opcao-nome {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.gr__opcao-nome strong {
  font-size: 0.9375rem;
}

.gr__opcao-nome > span {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.gr__opcao-muda {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--clinic-attention-text) !important;
  font-weight: 650;
}

.gr__opcao-selo {
  padding: 0 0.35rem;
  border-radius: 4px;
  background: var(--hc-marca-forte);
  color: #fff;
  font-size: 0.5625rem;
  font-weight: 750;
  letter-spacing: 0.03em;
  line-height: 1.5;
  text-transform: uppercase;
}

.gr__opcao-preco {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ aviso */

.gr__aviso {
  display: grid;
  padding-top: 1rem;
  border-top: 1px solid var(--hc-linha);
  gap: 0.35rem;
}

.gr__via {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 650;
}

.gr__aviso > p {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 0.75rem 0.75rem 0.75rem 0.2rem;
  background: var(--hc-pagina);
  color: var(--hc-tinta);
  font-size: 0.875rem;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ recusar */

.gr__campo {
  display: grid;
  gap: 0.35rem;
}

.gr__motivos {
  display: flex;
  flex-wrap: wrap;
}

.gr-rodape {
  display: flex;
  gap: 0.5rem;
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
