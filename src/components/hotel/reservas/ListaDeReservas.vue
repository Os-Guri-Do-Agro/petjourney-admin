<script setup lang="ts">
/**
 * A lista de reservas (E7-02b, guia e7 28): abre no que está por vir ("a partir de ontem" na casa)
 * e o histórico fica a um toque. Cada linha diz quem, quando, onde e, para quem vê dinheiro, o
 * total, o pago e se falta o sinal. A pendente diz há quanto tempo espera (não expira sozinha).
 * O cursor só vale para o mesmo filtro: cursor inválido recarrega do começo.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  listarReservas,
  type ItemDaLista,
  type StatusDaReserva,
} from '@/service/parceiro/hotel-reservas-service'

import { TOM_DO_STATUS, useRotulosDasReservas } from './useRotulosDasReservas'

const props = defineProps<{
  /** "Nova reserva" no vazio: a mesma condição do botão do alto (`hotel.reserva` e a casa lida). */
  podeReservar?: boolean
}>()
const emit = defineEmits<{ nova: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

type Quando = 'PROXIMAS' | 'HISTORICO'
type FiltroDeStatus = 'TODAS' | StatusDaReserva

const quando = ref<Quando>('PROXIMAS')
const filtro = ref<FiltroDeStatus>('TODAS')
const itens = ref<ItemDaLista[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')

const opcoesDeQuando = computed(() => [
  { valor: 'PROXIMAS', rotulo: t('reservasDoHotel.lista.proximas') },
  { valor: 'HISTORICO', rotulo: t('reservasDoHotel.lista.historico') },
])
const opcoesDeStatus = computed(() => [
  { valor: 'TODAS', rotulo: t('reservasDoHotel.lista.todas') },
  ...(['PENDENTE', 'CONFIRMADA', 'HOSPEDADO'] as const).map((valor) => ({
    valor,
    rotulo: rotulos.status(valor),
  })),
])

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarReservas(
      {
        status: filtro.value === 'TODAS' ? null : [filtro.value],
        historico: quando.value === 'HISTORICO',
        cursor: mais ? cursor.value : null,
      },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
  } catch (err) {
    if (mais && err instanceof ApiError && err.detalhes.errorKey === 'CURSOR_INVALIDO') {
      cursor.value = null
      return carregar()
    }
    erro.value = lerErroDoCadastro(err, t('reservasDoHotel.lista.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch([quando, filtro], () => void carregar())

function quem(item: ItemDaLista) {
  return item.animais.map((a) => a.nome).join(' e ')
}

function meta(item: ItemDaLista) {
  return [
    rotulos.periodo(item.entradaPrevista, item.saidaPrevista),
    rotulos.diarias(item.diarias),
    item.acomodacao.nome,
    rotulos.origem(item.origem),
  ].join(' · ')
}

function dinheiro(item: ItemDaLista) {
  if (typeof item.totalCentavos !== 'number') return ''
  return [
    t('reservasDoHotel.lista.total', { valor: rotulos.dinheiro(item.totalCentavos) }),
    typeof item.pagoCentavos === 'number'
      ? t('reservasDoHotel.lista.pago', { valor: rotulos.dinheiro(item.pagoCentavos) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const semSinal = (item: ItemDaLista) =>
  ['PENDENTE', 'CONFIRMADA'].includes(item.status) &&
  typeof item.pagoCentavos === 'number' &&
  typeof item.sinalCentavos === 'number' &&
  item.pagoCentavos < item.sinalCentavos

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026): sem reserva pela frente, como uma reserva
 * anda, em três etapas, e "Nova reserva" embaixo. O Histórico vazio só diz o que aparece nele; com
 * uma situação escolhida, o vazio é do filtro, e fica a linha.
 */
const semFiltro = computed(() => filtro.value === 'TODAS')

/*
 * Cada etapa com o botão dela para o balcão (17/11/2026): a Nova reserva abre a gaveta; registrar
 * o sinal e fazer o check-in moram na reserva, e ficam apagados até haver uma.
 */
const passosDaReserva = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`reservasDoHotel.lista.guia.${id}.titulo`),
    texto: t(`reservasDoHotel.lista.guia.${id}.texto`),
    acao: props.podeReservar ? acao : undefined,
  })

  return [
    passo('entra', 'ph ph-calendar-plus', {
      rotulo: t('reservasDoHotel.nova.titulo'),
      icone: 'ph ph-plus',
      aoClicar: () => emit('nova'),
    }),
    passo('sinal', 'ph ph-coins', {
      rotulo: t('reservasDoHotel.pagamento.titulo'),
      icone: 'ph ph-coins',
      bloqueada: true,
    }),
    passo('estadia', 'ph ph-door-open', {
      rotulo: t('estadiaDoHotel.checkin.titulo'),
      icone: 'ph ph-sign-in',
      bloqueada: true,
    }),
  ]
})

defineExpose({ carregar })
</script>

<template>
  <div class="lr">
    <div class="lr__filtros">
      <SelectButton
        v-model="quando"
        :options="opcoesDeQuando"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('reservasDoHotel.lista.quando')"
      />
      <SelectButton
        v-model="filtro"
        :options="opcoesDeStatus"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('reservasDoHotel.lista.filtro')"
      />
    </div>

    <p v-if="erro" class="lr__erro" role="alert">{{ erro }}</p>

    <section
      v-if="itens.length || carregando || !semFiltro"
      class="ui-folha ui-lista"
      :aria-busy="carregando"
    >
      <ul v-if="itens.length" class="ui-lista">
        <li v-for="item in itens" :key="item.id">
          <RouterLink :to="`/hotel/reserva/${item.id}`" class="ui-linha lr__linha">
            <span class="ui-linha__texto">
              <span class="lr__nome">
                <strong class="ui-linha__titulo">{{ quem(item) }}</strong>
                <span
                  class="ui-selo"
                  :class="
                    TOM_DO_STATUS[item.status] ? `ui-selo--${TOM_DO_STATUS[item.status]}` : ''
                  "
                  >{{ rotulos.status(item.status) }}</span
                >
                <span v-if="semSinal(item)" class="ui-selo ui-selo--atencao">{{
                  t('reservasDoHotel.lista.semSinal')
                }}</span>
              </span>
              <span class="ui-linha__meta">{{ meta(item) }}</span>
              <span v-if="dinheiro(item)" class="ui-linha__meta">{{ dinheiro(item) }}</span>
              <span v-if="item.pendenteHaHoras !== null" class="ui-linha__meta">{{
                t(
                  'reservasDoHotel.lista.pendenteHa',
                  { n: item.pendenteHaHoras },
                  item.pendenteHaHoras,
                )
              }}</span>
              <span v-if="item.motivoCancelamento" class="ui-linha__meta">{{
                rotulos.motivo(item.motivoCancelamento)
              }}</span>
            </span>
            <i class="ph ph-caret-right ui-linha__fim" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
      <p v-else-if="!carregando" class="ui-vazio">
        {{ t('reservasDoHotel.lista.vazioHistorico') }}
      </p>
    </section>

    <UiVazioIlustrado
      v-else-if="!erro && quando === 'PROXIMAS'"
      icone="ph ph-calendar-blank"
      :titulo="t('reservasDoHotel.lista.proximasVazio.titulo')"
      :texto="t('reservasDoHotel.lista.proximasVazio.texto')"
      :guia-titulo="t('reservasDoHotel.lista.guia.titulo')"
      :passos="passosDaReserva"
    />

    <UiVazioIlustrado
      v-else-if="!erro"
      icone="ph ph-clock-counter-clockwise"
      :titulo="t('reservasDoHotel.lista.historicoVazio.titulo')"
      :texto="t('reservasDoHotel.lista.historicoVazio.texto')"
    />

    <Button
      v-if="cursor"
      type="button"
      severity="secondary"
      outlined
      class="lr__mais"
      :label="t('reservasDoHotel.lista.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />
  </div>
</template>

<style scoped>
.lr {
  display: grid;
  gap: 16px;
}

.lr__filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.lr__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.lr__linha {
  color: inherit;
  text-decoration: none;
}

.lr__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.lr__mais {
  justify-self: start;
}
</style>
