<script setup lang="ts">
/**
 * Cópias do prontuário (E4-06c, PJ-0EK0TY; guia e4 10.2): os pedidos que chegam pelo app (o dono)
 * e os do balcão. Abertos por prazo, com o vencido em vermelho; encerrados à parte, sem ação.
 *
 * Cada linha leva uma ação só (gerar, acompanhar, baixar e entregar, ver); o resto mora na gaveta
 * do pedido. Quem entra: `copia.gerir` (o dono e o gestor). O pedido do balcão nasce na gaveta
 * "Registrar pedido".
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  listarPedidosDeCopia,
  pedidoAberto,
  type PedidoDeCopia,
} from '@/service/parceiro/copias-service'

import CopiaGaveta from './CopiaGaveta.vue'
import NovoPedidoDeCopiaGaveta from './NovoPedidoDeCopiaGaveta.vue'
import { useFrasesDaCopia } from './useFrasesDaCopia'

type Situacao = 'ABERTOS' | 'ENCERRADOS'

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaCopia()
const { store, parceiroQuery } = useParceiroPortal()

const podeEscrever = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))

const situacao = ref<Situacao>('ABERTOS')
const itens = ref<PedidoDeCopia[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')

const opcoesDeSituacao = computed(() => [
  { valor: 'ABERTOS', rotulo: t('copias.abertos') },
  { valor: 'ENCERRADOS', rotulo: t('copias.encerrados') },
])

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarPedidosDeCopia(
      { situacao: situacao.value, cursor: mais ? cursor.value : null },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('copias.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(situacao, () => void carregar())

function meta(item: PedidoDeCopia) {
  return [
    frases.quemPediu(item),
    t('copias.recebidoEm', { data: rotulos.data(item.recebidoEm) }),
    frases.periodo(item),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** O selo do prazo nos abertos; nos encerrados, o fim (entregue, recusado, excluído). */
function seloDe(item: PedidoDeCopia) {
  if (pedidoAberto(item.status)) {
    return {
      texto: t('copias.prazo', { dia: rotulos.dia(item.prazo) }),
      tom: item.vencido ? 'risco' : '',
    }
  }
  return { texto: t(`copias.status.${item.status}`), tom: item.status === 'ENTREGUE' ? 'ok' : '' }
}

function acaoDe(item: PedidoDeCopia) {
  if (item.status === 'GERANDO') return t('copias.acao.acompanhar')
  if (item.status === 'PRONTO') return t('copias.acao.entregar')
  if (pedidoAberto(item.status) && podeEscrever.value) return t('copias.acao.gerar')
  return t('copias.acao.ver')
}

const resumo = computed(() => {
  if (!lido.value || situacao.value !== 'ABERTOS') return ''
  const vencidos = itens.value.filter((item) => item.vencido).length
  if (vencidos) return t('copias.resumoVencidos', { n: vencidos }, vencidos)
  return itens.value.length
    ? t('copias.resumo', { n: itens.value.length }, itens.value.length)
    : t('copias.resumoEmDia')
})

/* ------------------------------------------------------------------------- as gavetas */

const aberto = ref<PedidoDeCopia | null>(null)
const gavetaAberta = ref(false)
const novoAberto = ref(false)
/** O recado do registro do balcão, mostrado no alto da gaveta do pedido. */
const recado = ref('')

function abrir(item: PedidoDeCopia, aviso = '') {
  recado.value = aviso
  aberto.value = item
  gavetaAberta.value = true
}

/** O pedido mudou na gaveta: a linha troca; o que encerrou sai dos abertos. */
function mudou(pedido: PedidoDeCopia) {
  recado.value = ''
  aberto.value = pedido
  const naLista = pedidoAberto(pedido.status) === (situacao.value === 'ABERTOS')
  itens.value = naLista
    ? itens.value.map((item) => (item.id === pedido.id ? pedido : item))
    : itens.value.filter((item) => item.id !== pedido.id)
  invalidarPendenciasDoPortal()
}

function registrado(pedido: PedidoDeCopia, jaExistia: boolean) {
  invalidarPendenciasDoPortal()
  if (situacao.value === 'ABERTOS') void carregar()
  else situacao.value = 'ABERTOS'
  /* A gaveta do pedido abre depois que a do registro saiu (uma gaveta por vez). */
  setTimeout(
    () => abrir(pedido, jaExistia ? t('copias.novo.jaExistia') : t('copias.novo.feito')),
    320,
  )
}
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <template #acoes>
      <Button
        v-if="podeEscrever"
        type="button"
        icon="ph ph-plus"
        :label="t('copias.novo.acao')"
        @click="novoAberto = true"
      />
    </template>

    <div class="cp">
      <div class="cp__filtros">
        <SelectButton
          v-model="situacao"
          :options="opcoesDeSituacao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('copias.filtro')"
        />
      </div>

      <p v-if="erro && lido" class="cp__erro" role="alert">{{ erro }}</p>

      <section class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="itens.length" class="ui-lista">
          <li v-for="item in itens" :key="item.id">
            <div class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo cp__nome">
                  <RouterLink :to="`/clinica/ficha/${item.pacienteId}`">{{
                    item.pacienteNome
                  }}</RouterLink>
                  <span
                    class="ui-selo"
                    :class="seloDe(item).tom ? `ui-selo--${seloDe(item).tom}` : ''"
                    >{{ seloDe(item).texto }}</span
                  >
                  <span
                    v-if="item.status === 'GERANDO' || item.status === 'PRONTO'"
                    class="ui-selo ui-selo--contorno"
                    >{{ t(`copias.status.${item.status}`) }}</span
                  >
                  <i
                    v-if="item.vinculoAnteriorComOutroDono && item.origem === 'BALCAO'"
                    class="ph ph-warning cp__alerta"
                    :title="t('copias.outroDono')"
                    :aria-label="t('copias.outroDono')"
                  />
                </strong>
                <span class="ui-linha__meta">{{ meta(item) }}</span>
              </span>
              <span class="ui-linha__fim">
                <Button
                  type="button"
                  size="small"
                  :severity="pedidoAberto(item.status) ? undefined : 'secondary'"
                  :outlined="!pedidoAberto(item.status)"
                  :label="acaoDe(item)"
                  @click="abrir(item)"
                />
              </span>
            </div>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-vazio cp__vazio">
          {{ situacao === 'ABERTOS' ? t('copias.vazio') : t('copias.vazioEncerrados') }}
        </p>
      </section>

      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="cp__mais"
        :label="t('copias.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>

    <template #sempre>
      <CopiaGaveta
        v-model:visible="gavetaAberta"
        :escolhido="aberto"
        :recado="recado"
        :pode-escrever="podeEscrever"
        @mudou="mudou"
      />
      <NovoPedidoDeCopiaGaveta v-model:visible="novoAberto" @registrado="registrado" />
    </template>
  </UiPagina>
</template>

<style scoped>
.cp {
  display: grid;
  gap: 16px;
}

.cp__filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.cp__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.cp__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.cp__nome a {
  color: var(--tinta);
  text-decoration: none;
}

.cp__nome a:hover,
.cp__nome a:focus-visible {
  text-decoration: underline;
}

.cp__alerta {
  color: var(--atencao-tinta);
  font-size: 16px;
}

.cp__mais {
  justify-self: start;
}
</style>
