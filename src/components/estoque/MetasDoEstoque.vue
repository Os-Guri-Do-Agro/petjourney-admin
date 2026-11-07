<script setup lang="ts">
/**
 * As metas do estoque pela API (E6-02, PJ-ZXGZ7P, guia e6 15 e 16): o trabalho do começo e do fim
 * do mês. O mês em curso contra o combinado (situação, ritmo e placar são do servidor), o próximo
 * mês com o plano ou o convite para fazê-lo, o pedido de compra que ele custa e os meses fechados,
 * recolhidos.
 *
 * Planejar, a sugestão e o pedido levam custo: só DONO e GESTOR (`estoque.planejar`). Quem não vê
 * dinheiro recebe as metas sem a de compras e o placar já sem ela (a API decide; aqui não se conta).
 * O pedido sai da simulação com as metas do próximo mês, ou da sugestão enquanto não há plano; o
 * texto copiado é o da API, agrupado por fornecedor e sem preço.
 */
import Button from 'primevue/button'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerPacote } from '@/service/parceiro/catalogos-service'
import {
  lerMetas,
  lerSugestao,
  simularPedido,
  type LinhaDoPedido,
  type Metas,
  type PedidoDeCompra,
  type PlanoDeMetas,
} from '@/service/parceiro/estoque-service'

import PlanoDoMesGaveta from './PlanoDoMesGaveta.vue'
import ProgressoDasMetas from './ProgressoDasMetas.vue'
import { useRotulosDasMetas } from './useRotulosDasMetas'

const { t } = useI18n()
const rotulos = useRotulosDasMetas()
const cadastro = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const planeja = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('estoque.planejar'),
)

const metas = ref<Metas | null>(null)
const carregando = ref(false)
const erro = ref('')
const recado = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    metas.value = await lerMetas(parceiroQuery())
    if (planeja.value) void carregarPedido()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estoque.metas.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

const vacinas = ref<{ id: string; nome: string }[]>([])

onMounted(async () => {
  void carregar()
  if (!planeja.value) return
  const pacote = await lerPacote(parceiroQuery()).catch(() => null)
  vacinas.value = (pacote?.vacinas ?? [])
    .filter((v) => v.ativo)
    .map((v) => ({ id: v.id, nome: v.nome }))
})

const atual = computed(() => metas.value?.atual ?? null)
const proximo = computed(() => metas.value?.proximo ?? null)
/* O plano esvaziado (`metas: []`, o "limpar") continua existindo na API; na tela é sem plano. */
const temPlanoAtual = computed(() => Boolean(atual.value?.plano?.metas.length))
const planoDoProximo = computed(() =>
  proximo.value?.plano?.metas.length ? proximo.value.plano : null,
)

const descricaoDoAtual = computed(() => {
  if (!atual.value) return ''
  const n = atual.value.diasRestantes
  const emCurso = t('estoque.metas.emCurso', { n }, n)
  const placar = atual.value.placar
  return placar.total > 0
    ? `${emCurso} · ${t('estoque.metas.placar', { bem: placar.bem, total: placar.total })}`
    : emCurso
})

const descricaoDoProximo = computed(() => {
  if (!proximo.value || !atual.value) return ''
  const plano = planoDoProximo.value
  if (plano) {
    return plano.atualizadoEm
      ? t('estoque.metas.combinadoEm', { data: cadastro.data(plano.atualizadoEm) })
      : ''
  }
  return planeja.value
    ? t('estoque.metas.semPlanoProximo', { base: rotulos.mes(atual.value.mes) })
    : t('estoque.metas.semPlanoProximoLeitura')
})

/* ------------------------------------------------------------------------- o pedido */

const pedido = ref<PedidoDeCompra | null>(null)
const pedidoDoPlano = ref(false)
const carregandoPedido = ref(false)
const erroDoPedido = ref('')

async function carregarPedido() {
  const mes = proximo.value?.mes
  if (!mes) return
  erroDoPedido.value = ''
  carregandoPedido.value = true
  try {
    const plano = planoDoProximo.value
    const fonte = plano ? plano.metas : (await lerSugestao(mes, parceiroQuery())).metas
    pedido.value = await simularPedido(
      mes,
      fonte.map((meta) => ({ tipo: meta.tipo, vacinaId: meta.vacinaId, alvo: meta.alvo })),
      parceiroQuery(),
    )
    /* A descrição muda junto com as linhas, nunca antes delas. */
    pedidoDoPlano.value = Boolean(plano)
  } catch (err) {
    pedido.value = null
    erroDoPedido.value = lerErroDoCadastro(err, t('estoque.pedido.erro')).mensagem
  } finally {
    carregandoPedido.value = false
  }
}

const aComprar = computed(() => (pedido.value?.linhas ?? []).filter((linha) => linha.comprar > 0))
const dosesAComprar = computed(() =>
  aComprar.value.reduce((soma, linha) => soma + linha.comprar, 0),
)

function metaDaLinha(linha: LinhaDoPedido) {
  return [
    linha.fornecedor ?? t('estoque.pedido.semFornecedor'),
    linha.semCusto
      ? ''
      : t('estoque.pedido.custoLinha', {
          valor: rotulos.dinheiro(linha.custoEstimadoCentavos),
          unitario: rotulos.dinheiro(linha.custoUnitarioCentavos),
        }),
    t('estoque.pedido.conta', { conta: linha.conta }),
  ]
    .filter(Boolean)
    .join(' · ')
}

const copiado = ref(false)
let apagarCopiado: ReturnType<typeof setTimeout> | null = null

async function copiar() {
  if (!pedido.value?.texto) return
  try {
    await navigator.clipboard.writeText(pedido.value.texto)
    copiado.value = true
    if (apagarCopiado) clearTimeout(apagarCopiado)
    apagarCopiado = setTimeout(() => (copiado.value = false), 2000)
  } catch {
    erroDoPedido.value = t('estoque.pedido.erro')
  }
}

onBeforeUnmount(() => {
  if (apagarCopiado) clearTimeout(apagarCopiado)
})

/* ----------------------------------------------------------------------- planejar */

const gavetaAberta = ref(false)
const mesDaGaveta = ref('')
const planoDaGaveta = computed<PlanoDeMetas | null>(() => {
  if (!metas.value) return null
  if (mesDaGaveta.value === metas.value.atual.mes) return metas.value.atual.plano
  if (mesDaGaveta.value === metas.value.proximo.mes) return metas.value.proximo.plano
  return null
})

function planejar(mes: string) {
  recado.value = ''
  mesDaGaveta.value = mes
  gavetaAberta.value = true
}

function salvo(_plano: PlanoDeMetas, limpo: boolean) {
  recado.value = limpo
    ? t('estoque.metas.limpas', { mes: rotulos.mes(mesDaGaveta.value) })
    : t('estoque.metas.salvas', { mes: rotulos.mes(mesDaGaveta.value) })
  void carregar()
}

/* ------------------------------------------------------------------------ histórico */

const historicoAberto = ref<string | null>(null)
</script>

<template>
  <div class="mt">
    <p v-if="recado" class="mt__recado" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      {{ recado }}
    </p>
    <p v-if="erro" class="mt__erro" role="alert">{{ erro }}</p>

    <template v-if="metas && atual && proximo">
      <!-- O mês em curso: o combinado contra o ritmo de hoje. -->
      <section class="ui-folha ui-cartao" aria-labelledby="mt-atual" :aria-busy="carregando">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-target" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="mt-atual" class="ui-cartao__titulo">
              {{ t('estoque.metas.doMes', { mes: rotulos.mes(atual.mes) }) }}
            </h2>
            <p class="ui-cartao__descricao">{{ descricaoDoAtual }}</p>
          </span>
          <span v-if="planeja" class="ui-cartao__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :icon="temPlanoAtual ? 'ph ph-pencil-simple' : 'ph ph-flag'"
              :label="
                temPlanoAtual
                  ? t('estoque.metas.editar')
                  : t('estoque.metas.combinar', { mes: rotulos.mes(atual.mes) })
              "
              @click="planejar(atual.mes)"
            />
          </span>
        </header>
        <ProgressoDasMetas v-if="atual.progresso.length" :progresso="atual.progresso" em-curso />
        <p v-else-if="!temPlanoAtual" class="mt__nota">{{ t('estoque.metas.semPlanoAtual') }}</p>
      </section>

      <!-- O próximo mês: o plano, ou o convite para fazê-lo com os números deste. -->
      <section class="ui-folha ui-cartao" aria-labelledby="mt-proximo">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-flag" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="mt-proximo" class="ui-cartao__titulo">
              {{ t('estoque.metas.doMes', { mes: rotulos.mes(proximo.mes) }) }}
            </h2>
            <p v-if="descricaoDoProximo" class="ui-cartao__descricao">{{ descricaoDoProximo }}</p>
          </span>
          <span v-if="planeja" class="ui-cartao__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :icon="planoDoProximo ? 'ph ph-pencil-simple' : 'ph ph-flag'"
              :label="
                planoDoProximo
                  ? t('estoque.metas.editar')
                  : t('estoque.metas.planejar', { mes: rotulos.mes(proximo.mes) })
              "
              @click="planejar(proximo.mes)"
            />
          </span>
        </header>
        <ul v-if="planoDoProximo" class="ui-lista">
          <li v-for="meta in planoDoProximo.metas" :key="meta.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ rotulos.nome(meta) }}</strong>
              <span class="ui-linha__meta">{{ rotulos.oQueMede(meta.tipo) }}</span>
            </span>
            <span class="ui-linha__fim mt__alvo ui-num">{{
              rotulos.valor(meta.tipo, meta.alvo)
            }}</span>
          </li>
        </ul>
      </section>

      <!--
        O pedido mora junto do mês que ele abastece. Sem plano, sai da sugestão, e a descrição diz
        isso, para ninguém comprar por uma meta que ainda não foi combinada sem saber.
      -->
      <section
        v-if="planeja"
        class="ui-folha ui-cartao"
        aria-labelledby="mt-pedido"
        :aria-busy="carregandoPedido"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-shopping-cart" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="mt-pedido" class="ui-cartao__titulo">
              {{ t('estoque.pedido.titulo', { mes: rotulos.mes(proximo.mes) }) }}
            </h2>
            <p class="ui-cartao__descricao">
              {{ pedidoDoPlano ? t('estoque.pedido.peloPlano') : t('estoque.pedido.pelaSugestao') }}
            </p>
          </span>
          <span v-if="aComprar.length && pedido?.texto" class="ui-cartao__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :icon="copiado ? 'ph ph-check' : 'ph ph-copy'"
              :label="copiado ? t('estoque.pedido.copiado') : t('estoque.pedido.copiar')"
              @click="copiar"
            />
          </span>
        </header>
        <p v-if="erroDoPedido" class="mt__nota mt__nota--erro" role="alert">{{ erroDoPedido }}</p>
        <template v-else-if="pedido">
          <ul v-if="aComprar.length" class="ui-lista">
            <li v-for="linha in aComprar" :key="linha.vacinaId" class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ linha.nome }}</strong>
                <span class="ui-linha__meta">{{ metaDaLinha(linha) }}</span>
              </span>
              <span class="ui-linha__fim mt__alvo ui-num">{{ rotulos.doses(linha.comprar) }}</span>
            </li>
          </ul>
          <p v-else class="mt__nota">
            {{ t('estoque.pedido.vazio', { mes: rotulos.mes(proximo.mes) }) }}
          </p>
          <p v-if="pedido.vacinasSemCusto.length" class="mt__nota">
            <i class="ph ph-info" aria-hidden="true" />
            {{
              t('estoque.pedido.semCusto', {
                lista: pedido.vacinasSemCusto.map((item) => item.nome).join(', '),
              })
            }}
          </p>
          <p v-if="pedido.truncado" class="mt__nota">{{ t('estoque.pedido.truncado') }}</p>
          <p v-if="aComprar.length" class="ui-cartao__pe mt__total">
            <i class="ph ph-shopping-cart" aria-hidden="true" />
            <span class="ui-num">{{
              t('estoque.pedido.total', {
                doses: rotulos.doses(dosesAComprar),
                valor: rotulos.dinheiro(pedido.custoTotalCentavos),
              })
            }}</span>
          </p>
        </template>
      </section>

      <!-- Meses fechados: recolhidos, abertos um de cada vez. -->
      <section v-if="metas.historico.length" class="ui-folha ui-cartao" aria-labelledby="mt-hist">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
            <i class="ph ph-clock-counter-clockwise" />
          </span>
          <span class="ui-cartao__titulos">
            <h2 id="mt-hist" class="ui-cartao__titulo">{{ t('estoque.metas.historico') }}</h2>
            <p v-if="metas.truncado" class="ui-cartao__descricao">
              {{ t('estoque.metas.historicoTruncado') }}
            </p>
          </span>
        </header>
        <ul class="ui-lista">
          <li v-for="mes in metas.historico" :key="mes.mes" class="mt__mes">
            <div class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo mt__nome-do-mes">{{
                  rotulos.mes(mes.mes, true)
                }}</strong>
              </span>
              <span class="ui-linha__fim mt__fim">
                <span
                  class="ui-selo"
                  :class="mes.placar.bem === mes.placar.total ? 'ui-selo--ok' : 'ui-selo--contorno'"
                  >{{
                    t('estoque.metas.placarFechado', {
                      bem: mes.placar.bem,
                      total: mes.placar.total,
                    })
                  }}</span
                >
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  rounded
                  :icon="historicoAberto === mes.mes ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                  :aria-label="rotulos.mes(mes.mes, true)"
                  :aria-expanded="historicoAberto === mes.mes"
                  @click="historicoAberto = historicoAberto === mes.mes ? null : mes.mes"
                />
              </span>
            </div>
            <ProgressoDasMetas
              v-if="historicoAberto === mes.mes"
              :progresso="mes.progresso"
              :em-curso="false"
              class="mt__aberto"
            />
          </li>
        </ul>
      </section>
    </template>

    <PlanoDoMesGaveta
      v-if="planeja"
      v-model:visible="gavetaAberta"
      :mes="mesDaGaveta"
      :plano="planoDaGaveta"
      :vacinas="vacinas"
      @salvo="salvo"
      @alterado="carregar"
    />
  </div>
</template>

<style scoped>
.mt {
  display: grid;
  gap: 20px;
}

.mt__recado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.mt__recado i {
  color: var(--ok-tinta);
}

.mt__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.mt__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.mt__nota {
  padding: 4px 10px 14px;
}

.mt__nota i {
  margin-inline-end: 4px;
  vertical-align: -2px;
}

.mt__nota--erro {
  color: var(--risco-tinta);
}

.mt__alvo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.mt__total {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mt__mes {
  border-top: 1px solid var(--linha);
}

.mt__mes:first-child {
  border-top: none;
}

.mt__nome-do-mes::first-letter {
  text-transform: uppercase;
}

.mt__fim {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.mt__aberto {
  padding-bottom: 8px;
}
</style>
