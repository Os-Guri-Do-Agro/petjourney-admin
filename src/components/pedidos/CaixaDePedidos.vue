<script setup lang="ts">
/**
 * Pedidos de horário pela API (E3-05, PJ-SVL85R, parte do portal): a caixa da recepção.
 *
 * Quatro situações (`?status=`): esperando resposta (do mais antigo), aceitos, recusados e
 * encerrados (do mais recente), 50 por página com o cursor. A linha tem o que decide a triagem: o
 * dia e a hora pedidos (ou a janela do melhor horário), quem e o quê, a folhinha riscada quando o
 * horário escolhido foi ocupado depois, e o prazo, que a API conta só no expediente. Responder mora
 * numa gaveta ao lado; a configuração do online, em outra.
 *
 * Quem pode: a caixa pede `pedido.responder`; aceitar pede também `agenda.escrever`; a
 * configuração lê com `agenda.ler` e salva com `estabelecimento.editar`. Com a Clínica só para
 * consulta, tudo se lê e nada se responde.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import ConfiguracaoOnlineGaveta from '@/components/pedidos/ConfiguracaoOnlineGaveta.vue'
import { chaveDaRecusa, chaveDoMotivo, diaCurto } from '@/components/pedidos/leitura-do-pedido'
import RespostaDoPedidoGaveta from '@/components/pedidos/RespostaDoPedidoGaveta.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  ABAS_DA_CAIXA,
  diaDoInstante,
  horaDoInstante,
  horarioEscolhido,
  horarioSumiu,
  listarPedidos,
  obterConfiguracaoOnline,
  type AbaDaCaixa,
  type ConfiguracaoOnline,
  type PedidoNaCaixa,
} from '@/service/parceiro/pedidos-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/* ------------------------------------------------------------------------------ quem pode */

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeRecusar = computed(() => clinicaEscreve.value && store.temPermissao('pedido.responder'))
const podeAceitar = computed(() => podeRecusar.value && store.temPermissao('agenda.escrever'))
const podeConfigurar = computed(
  () => clinicaEscreve.value && store.temPermissao('estabelecimento.editar'),
)

/* ------------------------------------------------------------------------------- a aba */

const aba = computed<AbaDaCaixa>(() => {
  const pedida = route.query.status
  return typeof pedida === 'string' && (ABAS_DA_CAIXA as readonly string[]).includes(pedida)
    ? (pedida as AbaDaCaixa)
    : 'PENDENTES'
})

const opcoesDeAba = computed(() =>
  ABAS_DA_CAIXA.map((valor) => ({ valor, rotulo: t(`pedidos.caixa.aba.${valor}`) })),
)

function trocarAba(nova: AbaDaCaixa | null) {
  if (!nova || nova === aba.value) return

  const query = { ...route.query }
  if (nova === 'PENDENTES') delete query.status
  else query.status = nova
  void router.replace({ query })
}

/* ---------------------------------------------------------------------------- a lista */

const itens = ref<PedidoNaCaixa[]>([])
const proximoCursor = ref<string | null>(null)
const carregando = ref(true)
const carregandoMais = ref(false)
const jaCarregou = ref(false)
const erro = ref('')

/* Trocar de aba antes de a resposta chegar: a página da aba anterior não vale mais. */
const leitura = criarUltimaLeitura()

async function carregar() {
  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  try {
    const pagina = await listarPedidos({ status: aba.value }, parceiroQuery())
    if (!leitura.valendo(vez)) return
    itens.value = pagina.itens
    proximoCursor.value = pagina.proximoCursor
    jaCarregou.value = true
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('pedidos.caixa.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value) return

  const vez = leitura.atual()
  carregandoMais.value = true

  try {
    const pagina = await listarPedidos(
      { status: aba.value, cursor: proximoCursor.value },
      parceiroQuery(),
    )
    if (!leitura.valendo(vez)) return
    itens.value = [...itens.value, ...pagina.itens]
    proximoCursor.value = pagina.proximoCursor
  } catch (err) {
    if (!leitura.valendo(vez)) return
    const lido = lerErroDoCadastro(err, t('pedidos.caixa.erroAoCarregar'))
    /* Cursor de outra consulta: a lista recomeça. */
    if (lido.codigo === 'CURSOR_INVALIDO') await carregar()
    else erro.value = lido.mensagem
  } finally {
    carregandoMais.value = false
  }
}

watch(aba, () => {
  itens.value = []
  void carregar()
})

/* --------------------------------------------------------------------- a configuração */

const configuracao = ref<ConfiguracaoOnline | null>(null)
const configAberta = ref(false)

async function carregarConfiguracao() {
  try {
    configuracao.value = await obterConfiguracaoOnline(parceiroQuery())
  } catch {
    configuracao.value = null
  }
}

onMounted(() => {
  void carregar()
  void carregarConfiguracao()
})

/* ------------------------------------------------------------------------------ a linha */

function quandoDaLinha(pedido: PedidoNaCaixa) {
  const escolhido = horarioEscolhido(pedido)
  if (escolhido) {
    return {
      dia: diaCurto(diaDoInstante(escolhido.inicio), intl.value),
      hora: horaDoInstante(escolhido.inicio),
    }
  }

  const preferencia = pedido.preferencia
  return {
    dia: preferencia ? diaCurto(preferencia.de, intl.value) : '',
    hora: t('pedidos.caixa.melhorHorario'),
  }
}

function tituloDaLinha(pedido: PedidoNaCaixa) {
  return `${pedido.pets.map((pet) => pet.nome).join(', ')} · ${pedido.servico.nome}`
}

function metaDaLinha(pedido: PedidoNaCaixa) {
  const canal = t(pedido.canal === 'APP' ? 'clinico.pedidos.canal.app' : 'pedidos.caixa.peloSite')
  return [pedido.quemPede, t(chaveDoMotivo(pedido.motivo)), canal].join(' · ')
}

/** O prazo, só nos que esperam: "até 14:30" no dia de hoje, o dia nos outros. */
function prazoDaLinha(pedido: PedidoNaCaixa) {
  const hora = horaDoInstante(pedido.responderAte)
  const dia = diaDoInstante(pedido.responderAte)
  const quando =
    dia === diaDoInstante(pedido.criadoEm) ? hora : `${diaCurto(dia, intl.value)} ${hora}`

  return pedido.prazo === 'ATRASADO'
    ? t('pedidos.caixa.prazo.atrasado', { quando })
    : t('pedidos.caixa.prazo.ate', { quando })
}

function desfechoDaLinha(pedido: PedidoNaCaixa) {
  if (pedido.status === 'ACEITO') {
    return t(
      pedido.respondidoPor === 'AUTOMATICO'
        ? 'pedidos.caixa.desfechoCurto.automatico'
        : 'pedidos.caixa.desfechoCurto.aceito',
    )
  }
  if (pedido.status === 'RECUSADO' && pedido.recusa) return t(chaveDaRecusa(pedido.recusa.motivo))

  return t(`pedidos.caixa.desfechoCurto.${pedido.status === 'DESISTIU' ? 'desistiu' : 'expirado'}`)
}

const fraseDoResumo = computed(() => {
  if (!jaCarregou.value || aba.value !== 'PENDENTES') return ''
  if (!itens.value.length) return t('clinico.pedidos.resumo.nenhum')

  const total = itens.value.length
  const atrasados = itens.value.filter((item) => item.prazo === 'ATRASADO').length
  const abertos = proximoCursor.value
    ? t('pedidos.caixa.maisDe', { n: total })
    : t('clinico.pedidos.resumo.abertos', { n: total }, total)

  return atrasados
    ? `${abertos} · ${t('clinico.pedidos.resumo.atrasados', { n: atrasados }, atrasados)}`
    : abertos
})

/* ----------------------------------------------------------------------------- responder */

const respostaAberta = ref(false)
const pedidoAberto = ref<string | null>(null)

function abrir(pedido: PedidoNaCaixa) {
  pedidoAberto.value = pedido.id
  respostaAberta.value = true
}

function aoResponder() {
  invalidarPendenciasDoPortal()
  void carregar()
}
</script>

<template>
  <UiPagina
    class="tela-pedidos"
    :titulo="t('clinico.pedidos.titulo')"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        type="button"
        icon="ph ph-sliders-horizontal"
        :label="t('clinico.pedidos.acoes.configurar')"
        @click="configAberta = true"
      />
    </template>

    <div class="pc">
      <p v-if="configuracao && !configuracao.ativo" class="pc__desligado ui-folha" role="status">
        <i class="ph ph-pause-circle" aria-hidden="true" />
        <span>{{ t('pedidos.caixa.desligado') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('pedidos.caixa.ligar')"
          @click="configAberta = true"
        />
      </p>

      <SelectButton
        :model-value="aba"
        :options="opcoesDeAba"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('pedidos.caixa.situacoes')"
        class="pc__abas"
        @update:model-value="trocarAba"
      />

      <p v-if="erro && jaCarregou" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('cadastro.tentarDeNovo')"
          @click="carregar"
        />
      </p>

      <ul v-if="carregando && !itens.length" class="ui-lista ui-folha" aria-busy="true">
        <li v-for="n in 3" :key="n" class="ui-linha">
          <Skeleton width="4rem" height="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="12rem" height="0.9rem" />
            <Skeleton width="16rem" height="0.8rem" />
          </span>
        </li>
      </ul>

      <div v-else-if="!itens.length" class="pc__vazio ui-folha">
        <strong>{{ t(`pedidos.caixa.vazio.${aba}`) }}</strong>
        <span v-if="aba === 'PENDENTES'">{{ t('clinico.pedidos.vazio.descricao') }}</span>
      </div>

      <ul v-else class="ui-lista ui-folha">
        <li
          v-for="pedido in itens"
          :key="pedido.id"
          class="ui-linha pc__linha"
          :class="{ 'pc__linha--aberta': respostaAberta && pedidoAberto === pedido.id }"
          @click="abrir(pedido)"
        >
          <span class="pc__quando" :class="{ 'pc__quando--sumiu': horarioSumiu(pedido) }">
            <span class="pc__dia">{{ quandoDaLinha(pedido).dia }}</span>
            <strong
              class="pc__hora ui-num"
              :class="{ 'pc__hora--janela': pedido.modo === 'MELHOR_HORARIO' }"
              >{{ quandoDaLinha(pedido).hora }}</strong
            >
          </span>

          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">
              {{ tituloDaLinha(pedido) }}
              <i
                v-if="horarioSumiu(pedido) && pedido.status === 'PENDENTE'"
                class="ph ph-calendar-x pc__sumiu"
                :title="t('clinico.pedidos.ocupado')"
                :aria-label="t('clinico.pedidos.ocupado')"
                role="img"
              />
            </strong>
            <span class="ui-linha__meta">{{ metaDaLinha(pedido) }}</span>
          </span>

          <span class="ui-linha__fim pc__fim">
            <span v-if="pedido.remarcacao" class="ui-selo">
              <i class="ph ph-arrows-clockwise" aria-hidden="true" />
              {{ t('pedidos.caixa.remarcacao') }}
            </span>
            <span
              v-if="pedido.status === 'PENDENTE'"
              class="ui-selo"
              :class="{
                'ui-selo--atencao': pedido.prazo === 'VENCENDO',
                'ui-selo--risco': pedido.prazo === 'ATRASADO',
              }"
            >
              <i class="ph ph-hourglass-medium" aria-hidden="true" />
              {{ prazoDaLinha(pedido) }}
            </span>
            <span v-else class="ui-selo" :class="{ 'ui-selo--ok': pedido.status === 'ACEITO' }">
              {{ desfechoDaLinha(pedido) }}
            </span>
            <Button
              type="button"
              size="small"
              :severity="pedido.status === 'PENDENTE' && podeRecusar ? undefined : 'secondary'"
              :outlined="!(pedido.status === 'PENDENTE' && podeRecusar)"
              :label="
                pedido.status === 'PENDENTE' && podeRecusar
                  ? t('pedidos.caixa.responder')
                  : t('pedidos.caixa.ver')
              "
              @click.stop="abrir(pedido)"
            />
          </span>
        </li>
      </ul>

      <Button
        v-if="proximoCursor"
        type="button"
        severity="secondary"
        outlined
        class="pc__mais"
        :label="t('pedidos.caixa.verMais')"
        :loading="carregandoMais"
        @click="carregarMais"
      />
    </div>

    <RespostaDoPedidoGaveta
      v-model:visible="respostaAberta"
      :pedido-id="pedidoAberto"
      :pode-aceitar="podeAceitar"
      :pode-recusar="podeRecusar"
      @respondido="aoResponder"
    />

    <ConfiguracaoOnlineGaveta
      v-model:visible="configAberta"
      :pode-editar="podeConfigurar"
      @salva="configuracao = $event"
    />
  </UiPagina>
</template>

<style scoped>
.pc {
  display: grid;
  gap: 16px;
}

.pc__abas {
  justify-self: start;
  max-width: 100%;
  overflow-x: auto;
}

.pc__desligado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.pc__desligado > span {
  flex: 1 1 18rem;
}

.pc__vazio {
  display: grid;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 14px;
}

.pc__vazio strong {
  color: var(--tinta);
}

.pc__linha {
  flex-wrap: wrap;
  cursor: pointer;
}

/* Com a gaveta aberta a lista estreita: o prazo e o botão descem em vez de espremer o título. */
.pc__linha > .ui-linha__texto {
  flex: 1 1 14rem;
  min-width: 12rem;
}

.pc__linha--aberta {
  background: color-mix(in oklab, var(--clinica-fundo) 35%, var(--superficie));
}

.pc__quando {
  display: grid;
  flex: 0 0 6.5rem;
  gap: 1px;
  min-width: 6.5rem;
}

.pc__hora--janela {
  font-size: 13.5px;
  white-space: nowrap;
}

.pc__dia {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pc__hora {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.pc__quando--sumiu .pc__hora {
  text-decoration: line-through;
  text-decoration-color: var(--risco-tinta);
}

.pc__sumiu {
  margin-inline-start: 6px;
  color: var(--risco-tinta);
  vertical-align: -1px;
}

.pc__fim {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-inline-start: auto;
}

.pc__mais {
  justify-self: center;
}
</style>
