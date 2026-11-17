<script setup lang="ts">
/**
 * A caixa de pedidos de hospedagem pela API (E7-03b, PJ-6B946W, parte do portal; guia e7 35): o
 * que chegou pelo app e pelo link do hotel. Quatro situações (`?status=`): esperando resposta (do
 * mais antigo), aceitos, recusados e encerrados (desistiu ou expirou, do mais recente). A linha
 * diz quem, quando, o tipo ou "o hotel escolhe" e o prazo, que conta só o balcão aberto (vencendo
 * nos últimos 30 minutos, atrasado depois). Responder mora numa gaveta; a configuração, em outra.
 *
 * O pedido não segura vaga: a caixa mostra os pendentes por ordem de chegada, sem promessa.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { ApiError } from '@/service/api'
import { lerCasa, type TipoDaCasa } from '@/service/parceiro/hotel-casa-service'
import {
  ABAS_DA_CAIXA,
  lerReservaOnline,
  listarPedidosDoHotel,
  type AbaDaCaixaDoHotel,
  type PedidoDoHotel,
  type ReservaOnline,
} from '@/service/parceiro/hotel-pedidos-service'
import { SITE_PUBLICO } from '@/utils/parceiro/pagina-publica'

import PedidoDoHotelGaveta from './PedidoDoHotelGaveta.vue'
import ReservaOnlineGaveta from './ReservaOnlineGaveta.vue'

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDasReservas()
const route = useRoute()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()

const escreve = computed(() => Boolean(store.modulo('HOTEL')?.podeEscrever))
const podeResponder = computed(() => escreve.value && store.temPermissao('hotel.reserva'))
const podeConfigurar = computed(() => escreve.value && store.temPermissao('estabelecimento.editar'))

const aba = computed<AbaDaCaixaDoHotel>({
  get: () => {
    const pedida = route.query.status
    return typeof pedida === 'string' && (ABAS_DA_CAIXA as readonly string[]).includes(pedida)
      ? (pedida as AbaDaCaixaDoHotel)
      : 'PENDENTES'
  },
  set: (nova) => {
    const query = { ...route.query }
    if (nova === 'PENDENTES') delete query.status
    else query.status = nova
    void router.replace({ query })
  },
})
const opcoes = computed(() =>
  ABAS_DA_CAIXA.map((valor) => ({ valor, rotulo: t(`pedidosDoHotel.abas.${valor}`) })),
)

const itens = ref<PedidoDoHotel[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')
const recado = ref('')
const reservaDoRecado = ref<string | null>(null)

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarPedidosDoHotel(
      { status: aba.value, cursor: mais ? cursor.value : null },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
  } catch (err) {
    if (mais && err instanceof ApiError && err.detalhes.errorKey === 'CURSOR_INVALIDO') {
      cursor.value = null
      return carregar()
    }
    erro.value = lerErroDoCadastro(err, t('pedidosDoHotel.erroLista')).mensagem
  } finally {
    carregando.value = false
  }
}

const configuracao = ref<ReservaOnline | null>(null)
const tipos = ref<TipoDaCasa[]>([])

onMounted(async () => {
  void carregar()
  const [config, casa] = await Promise.all([
    lerReservaOnline(parceiroQuery()).catch(() => null),
    lerCasa(parceiroQuery()).catch(() => null),
  ])
  configuracao.value = config
  tipos.value = casa?.tipos ?? []
})
watch(aba, () => void carregar())

function quem(p: PedidoDoHotel) {
  return p.animais.map((a) => a.nome).join(' e ')
}

function meta(p: PedidoDoHotel) {
  return [
    rotulos.periodo(p.entrada, p.saida),
    rotulos.diarias(p.diarias),
    p.modo === 'HOTEL_ESCOLHE' ? t('pedidosDoHotel.hotelEscolheCurto') : (p.tipo?.nome ?? ''),
    t(`pedidosDoHotel.canal.${p.canal}`),
    p.quemPede ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const TOM_DO_PRAZO = {
  NO_PRAZO: '',
  VENCENDO: 'ui-selo--atencao',
  ATRASADO: 'ui-selo--risco',
} as const

/* ------------------------------------------------------------------------- as gavetas */

const pedidoAberto = ref<string | null>(null)
const gavetaAberta = ref(false)
const configAberta = ref(false)

function abrir(p: PedidoDoHotel) {
  pedidoAberto.value = p.id
  gavetaAberta.value = true
}

function respondido(texto: string, reservaId: string | null) {
  recado.value = texto
  reservaDoRecado.value = reservaId
  invalidarPendenciasDoPortal()
  void carregar()
}

/* ---------------------------------------------------------------------------- o vazio */

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026), como na caixa da Clínica: em "Esperando
 * resposta", como o pedido chega até aqui, em três etapas, e a ação que faz pedido chegar: o link
 * do hotel, quando ele recebe pedidos, ou ligar a reserva online, quando está pausada. As outras
 * situações só dizem o que vai aparecer nelas.
 */
const ICONE_DO_VAZIO: Record<AbaDaCaixaDoHotel, string> = {
  PENDENTES: 'ph ph-calendar-plus',
  ACEITOS: 'ph ph-calendar-check',
  RECUSADOS: 'ph ph-calendar-x',
  ENCERRADOS: 'ph ph-archive',
}

const passosDoPedido = computed<PassoDoGuia[]>(() =>
  [
    { id: 'pedir', icone: 'ph ph-device-mobile' },
    { id: 'chegar', icone: 'ph ph-tray-arrow-down' },
    { id: 'responder', icone: 'ph ph-calendar-check' },
  ].map(({ id, icone }) => ({
    id,
    icone,
    titulo: t(`pedidosDoHotel.guia.${id}.titulo`),
    texto: t(`pedidosDoHotel.guia.${id}.texto`),
  })),
)

/** O link de pedidos, só quando ele recebe: reserva online ligada e pedido pelo link aceito. */
const linkDePedidos = computed(() => {
  const config = configuracao.value
  return config?.ativo && config.aceitaPeloLink && config.slug
    ? `${SITE_PUBLICO}/reservar/${encodeURIComponent(config.slug)}`
    : null
})

async function copiarLinkDePedidos() {
  if (!linkDePedidos.value) return

  try {
    await navigator.clipboard.writeText(linkDePedidos.value)
    toast.add({ severity: 'success', summary: t('clinico.pedidos.link.copiado'), life: 2500 })
  } catch {
    toast.add({ severity: 'warn', summary: linkDePedidos.value, life: 8000 })
  }
}

const resumo = computed(() => {
  if (aba.value !== 'PENDENTES' || carregando.value) return ''
  const atrasados = itens.value.filter((p) => p.prazo === 'ATRASADO').length
  return [
    itens.value.length
      ? t('pedidosDoHotel.resumo.abertos', { n: itens.value.length }, itens.value.length)
      : t('pedidosDoHotel.resumo.nenhum'),
    atrasados ? t('pedidosDoHotel.resumo.atrasados', { n: atrasados }, atrasados) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <UiPagina :titulo="t('pedidosDoHotel.caixa')" :resumo="resumo" icone="ph ph-calendar-plus">
    <template v-if="configuracao" #acoes>
      <Button
        type="button"
        icon="ph ph-sliders-horizontal"
        :label="t('pedidosDoHotel.config.acao')"
        @click="configAberta = true"
      />
    </template>

    <div class="cx">
      <p v-if="configuracao && !configuracao.ativo" class="ui-folha cx__aviso" role="status">
        <i class="ph ph-pause-circle" aria-hidden="true" />
        <span>{{ t('pedidosDoHotel.desligado') }}</span>
      </p>
      <p v-if="recado" class="ui-folha cx__aviso cx__aviso--ok" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>{{ recado }}</span>
        <RouterLink v-if="reservaDoRecado" :to="`/hotel/reserva/${reservaDoRecado}`">{{
          t('pedidosDoHotel.verReserva')
        }}</RouterLink>
      </p>

      <SelectButton
        v-model="aba"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('pedidosDoHotel.situacoes')"
        class="cx__abas"
      />

      <p v-if="erro" class="cx__erro" role="alert">{{ erro }}</p>

      <section v-if="itens.length || carregando" class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="itens.length" class="ui-lista">
          <li v-for="p in itens" :key="p.id" class="ui-linha">
            <span class="ui-linha__texto">
              <span class="cx__nome">
                <strong class="ui-linha__titulo">{{ quem(p) }}</strong>
                <span v-if="p.prazo" class="ui-selo" :class="TOM_DO_PRAZO[p.prazo]">{{
                  p.prazo === 'ATRASADO'
                    ? t('pedidosDoHotel.prazoPassou')
                    : t('pedidosDoHotel.responderAte', { quando: rotulos.quando(p.responderAte) })
                }}</span>
              </span>
              <span class="ui-linha__meta">{{ meta(p) }}</span>
            </span>
            <span class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                :severity="p.status === 'PENDENTE' && podeResponder ? undefined : 'secondary'"
                :outlined="!(p.status === 'PENDENTE' && podeResponder)"
                :label="
                  p.status === 'PENDENTE' && podeResponder
                    ? t('pedidosDoHotel.responder')
                    : t('pedidosDoHotel.ver')
                "
                @click="abrir(p)"
              />
            </span>
          </li>
        </ul>
      </section>

      <UiVazioIlustrado
        v-else-if="!erro && aba === 'PENDENTES'"
        :icone="ICONE_DO_VAZIO.PENDENTES"
        :titulo="t('pedidosDoHotel.vazio.PENDENTES')"
        :texto="t('pedidosDoHotel.vazioTexto.PENDENTES')"
        :guia-titulo="t('pedidosDoHotel.guia.titulo')"
        :passos="passosDoPedido"
      >
        <template
          v-if="linkDePedidos || (configuracao && !configuracao.ativo && podeConfigurar)"
          #acao
        >
          <template v-if="linkDePedidos">
            <Button
              type="button"
              icon="ph ph-copy"
              :label="t('clinico.pedidos.link.copiar')"
              @click="copiarLinkDePedidos"
            />
            <Button
              as="a"
              :href="linkDePedidos"
              target="_blank"
              rel="noopener noreferrer"
              severity="secondary"
              outlined
              icon="ph ph-arrow-square-out"
              :label="t('clinico.pedidos.link.abrir')"
            />
          </template>
          <Button
            v-else
            type="button"
            icon="ph ph-power"
            :label="t('pedidosDoHotel.guia.ligar')"
            @click="configAberta = true"
          />
        </template>
      </UiVazioIlustrado>

      <UiVazioIlustrado
        v-else-if="!erro"
        :icone="ICONE_DO_VAZIO[aba]"
        :titulo="t(`pedidosDoHotel.vazio.${aba}`)"
        :texto="t(`pedidosDoHotel.vazioTexto.${aba}`)"
      />

      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="cx__mais"
        :label="t('reservasDoHotel.lista.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>

    <PedidoDoHotelGaveta
      v-model:visible="gavetaAberta"
      :pedido-id="pedidoAberto"
      :pode-responder="podeResponder"
      @respondido="respondido"
    />
    <ReservaOnlineGaveta
      v-if="configuracao"
      v-model:visible="configAberta"
      :configuracao="configuracao"
      :tipos="tipos"
      :pode-salvar="podeConfigurar"
      @salva="(nova) => (configuracao = nova)"
    />
  </UiPagina>
</template>

<style scoped>
.cx {
  display: grid;
  gap: 16px;
}

.cx__aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 20px;
  color: var(--tinta);
  font-size: 14px;
}

.cx__aviso > i {
  color: var(--atencao-tinta);
  font-size: 17px;
}

.cx__aviso--ok > i {
  color: var(--ok-tinta);
}

.cx__aviso a {
  color: var(--tinta);
  font-weight: 600;
}

.cx__abas {
  justify-self: start;
  flex-wrap: wrap;
}

.cx__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.cx__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cx__mais {
  justify-self: start;
}
</style>
