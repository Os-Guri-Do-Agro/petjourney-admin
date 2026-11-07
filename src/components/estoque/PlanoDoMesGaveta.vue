<script setup lang="ts">
/**
 * Combinar as metas de um mês (E6-02, guia e6 15.2 e 16). Abre com o plano salvo ou, sem plano,
 * com a sugestão da API; cada meta de aplicação mostra **de onde veio o número** (o mês anterior no
 * ritmo de hoje, a média de 3 meses e os reforços que vencem no mês), com a que venceu em negrito.
 *
 * O pedido de compra que estas metas custam se refaz a cada número (simulação com debounce de
 * 400 ms; não grava nada) e o orçamento o acompanha até alguém digitar nele. Salvar substitui o
 * plano inteiro, com a `versao` que a gaveta abriu: se outra pessoa salvou no meio, a gaveta
 * reabre com o que está salvo e pede para refazer. Sem nenhuma meta, salvar apaga o plano.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  ALVO_MAX_DA_CLINICA,
  ALVO_MAX_POR_VACINA,
  COMPRAS_MAX_CENTAVOS,
  lerMetas,
  lerSugestao,
  METAS_MAX,
  salvarPlano,
  SIMULAR_DEBOUNCE_MS,
  simularPedido,
  type MetaNova,
  type PedidoDeCompra,
  type PlanoDeMetas,
  type ReferenciaDaSugestao,
  type SugestaoDeMetas,
  type TipoDeMeta,
} from '@/service/parceiro/estoque-service'

import { useRotulosDasMetas } from './useRotulosDasMetas'

const props = defineProps<{
  /** O mês combinado, `AAAA-MM` (o em curso ou o seguinte). */
  mes: string
  plano: PlanoDeMetas | null
  /** As vacinas ativas do catálogo da clínica, para acrescentar meta. */
  vacinas: { id: string; nome: string }[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [plano: PlanoDeMetas, limpo: boolean]; alterado: [] }>()

const { t, locale } = useI18n()
const rotulos = useRotulosDasMetas()
const { parceiroQuery } = useParceiroPortal()

type Linha = {
  chave: string
  tipo: TipoDeMeta
  vacinaId: string | null
  vacinaNome: string | null
  /** Doses; no orçamento, reais (o corpo vai em centavos). */
  alvo: number | null
}

const chaveDe = (tipo: TipoDeMeta, vacinaId: string | null) => `${tipo}:${vacinaId ?? '*'}`

const base = ref<PlanoDeMetas | null>(null)
const linhas = ref<Linha[]>([])
const daSugestao = ref(false)
const sugestao = ref<SugestaoDeMetas | null>(null)
const carregandoSugestao = ref(false)
const erroDaSugestao = ref(false)
const pedido = ref<PedidoDeCompra | null>(null)
const erroDoPedido = ref('')
const orcamentoTocado = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const aviso = ref('')
const indiceRecusado = ref<number | null>(null)

function linhasDe(
  metas: { tipo: TipoDeMeta; vacinaId: string | null; vacinaNome: string | null; alvo: number }[],
) {
  return metas.map((meta) => ({
    chave: chaveDe(meta.tipo, meta.vacinaId),
    tipo: meta.tipo,
    vacinaId: meta.vacinaId,
    vacinaNome: meta.vacinaNome,
    alvo: meta.tipo === 'COMPRAS' ? meta.alvo / 100 : meta.alvo,
  }))
}

function comecar(plano: PlanoDeMetas | null) {
  base.value = plano
  linhas.value = plano ? linhasDe(plano.metas) : []
  daSugestao.value = false
  /* O orçamento de um plano já combinado foi decidido: não se mexe sozinho. */
  orcamentoTocado.value = Boolean(plano?.metas.length)
  tentou.value = false
  erro.value = ''
  indiceRecusado.value = null
  /* Sem plano, ou com o plano esvaziado (que guarda a versão), parte da sugestão. */
  if (!plano?.metas.length && sugestao.value) {
    linhas.value = linhasDe(sugestao.value.metas)
    daSugestao.value = true
  }
}

watch(aberta, async (agora) => {
  if (!agora) return
  sugestao.value = null
  pedido.value = null
  erroDoPedido.value = ''
  aviso.value = ''
  erroDaSugestao.value = false
  comecar(props.plano)
  carregandoSugestao.value = true
  try {
    sugestao.value = await lerSugestao(props.mes, parceiroQuery())
    if (!linhas.value.length) comecar(base.value)
  } catch {
    erroDaSugestao.value = true
  } finally {
    carregandoSugestao.value = false
  }
})

const aplicacoes = computed(() => linhas.value.filter((linha) => linha.tipo === 'APLICACOES'))
const daClinica = computed(() => linhas.value.filter((linha) => linha.tipo !== 'APLICACOES'))

/** A referência da vacina; a da clínica inteira soma as de todas. */
function referencia(
  vacinaId: string | null,
): Omit<ReferenciaDaSugestao, 'vacinaId' | 'nome'> | null {
  const lista = sugestao.value?.referencias
  if (!lista) return null
  if (vacinaId) return lista.find((item) => item.vacinaId === vacinaId) ?? null
  return lista.reduce(
    (soma, item) => ({
      ...soma,
      projecaoDoMesBase: soma.projecaoDoMesBase + item.projecaoDoMesBase,
      mediaDoTrimestre: soma.mediaDoTrimestre + item.mediaDoTrimestre,
      reforcosNoMes: soma.reforcosNoMes + item.reforcosNoMes,
      sugestao: soma.sugestao + item.sugestao,
    }),
    {
      noMesBase: 0,
      projecaoDoMesBase: 0,
      mediaDoTrimestre: 0,
      reforcosNoMes: 0,
      sugestao: 0,
      origem: null as ReferenciaDaSugestao['origem'],
    },
  )
}

function referencias(vacinaId: string | null) {
  const ref = referencia(vacinaId)
  if (!ref || !sugestao.value) return []
  return [
    {
      chave: 'RITMO',
      texto: `${t('estoque.plano.noRitmo', { mes: rotulos.mes(sugestao.value.mesBase) })}: ${rotulos.numero(ref.projecaoDoMesBase)}`,
    },
    {
      chave: 'MEDIA',
      texto: `${t('estoque.plano.media')}: ${rotulos.numero(ref.mediaDoTrimestre, 1)}`,
    },
    {
      chave: 'REFORCOS',
      texto: `${t('estoque.plano.reforcos', { mes: rotulos.mes(props.mes) })}: ${rotulos.numero(ref.reforcosNoMes)}`,
    },
  ].map((item) => ({
    ...item,
    texto: item.texto.charAt(0).toLocaleUpperCase() + item.texto.slice(1),
    venceu: item.chave === ref.origem,
  }))
}

function maximo(linha: Linha) {
  if (linha.tipo === 'COMPRAS') return COMPRAS_MAX_CENTAVOS / 100
  return linha.vacinaId ? ALVO_MAX_POR_VACINA : ALVO_MAX_DA_CLINICA
}

/** As metas como o PUT e a simulação as recebem: o orçamento volta para centavos. */
const metas = computed<MetaNova[]>(() =>
  linhas.value.map((linha) => ({
    tipo: linha.tipo,
    vacinaId: linha.vacinaId,
    alvo: linha.tipo === 'COMPRAS' ? Math.round((linha.alvo ?? 0) * 100) : (linha.alvo ?? 0),
  })),
)

/* ------------------------------------------------------------------- o pedido simulado */

/** Só as metas de aplicação por vacina entram na conta: o resto não refaz a simulação. */
const metasDoPedido = computed(() =>
  metas.value.filter((meta) => meta.tipo === 'APLICACOES' && meta.vacinaId),
)
let espera: ReturnType<typeof setTimeout> | null = null
let rodada = 0

watch(
  /* Sem plano, espera a sugestão: simular as metas vazias de antes dela é uma chamada à toa. */
  () =>
    aberta.value && !(carregandoSugestao.value && !base.value?.metas.length)
      ? JSON.stringify(metasDoPedido.value)
      : null,
  (chave) => {
    if (espera) clearTimeout(espera)
    if (chave === null) return
    espera = setTimeout(() => void simular(), SIMULAR_DEBOUNCE_MS)
  },
)

onBeforeUnmount(() => {
  if (espera) clearTimeout(espera)
})

async function simular() {
  const minha = ++rodada
  try {
    const resposta = await simularPedido(props.mes, metasDoPedido.value, parceiroQuery())
    if (minha !== rodada) return
    pedido.value = resposta
    erroDoPedido.value = ''
  } catch (err) {
    if (minha !== rodada) return
    pedido.value = null
    erroDoPedido.value = lerErroDoCadastro(err, t('estoque.pedido.erro')).mensagem
  }
}

const dosesDoPedido = computed(() =>
  (pedido.value?.linhas ?? []).reduce((soma, linha) => soma + linha.comprar, 0),
)

watch(
  () => pedido.value?.custoTotalCentavos,
  (custo) => {
    if (custo === undefined || orcamentoTocado.value) return
    const orcamento = linhas.value.find((linha) => linha.tipo === 'COMPRAS')
    if (orcamento) orcamento.alvo = custo / 100
  },
)

/* ------------------------------------------------------------------- acrescentar e tirar */

function remover(chave: string) {
  linhas.value = linhas.value.filter((linha) => linha.chave !== chave)
}

const opcoesDeNova = computed(() => {
  if (linhas.value.length >= METAS_MAX) return []
  const presentes = new Set(linhas.value.map((linha) => linha.chave))
  const conhecidas = new Map<string, string>()
  for (const item of sugestao.value?.referencias ?? []) conhecidas.set(item.vacinaId, item.nome)
  for (const vacina of props.vacinas) conhecidas.set(vacina.id, vacina.nome)
  const opcoes = [...conhecidas]
    .filter(([id]) => !presentes.has(chaveDe('APLICACOES', id)))
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, nome]) => ({
      valor: chaveDe('APLICACOES', id),
      rotulo: t('estoque.plano.novaAplicacao', { vacina: nome }),
      nome,
    }))
  for (const [tipo, rotulo] of [
    ['APLICACOES', t('estoque.plano.novaTotal')],
    ['PERDAS', t('estoque.plano.novaPerdas')],
    ['COMPRAS', t('estoque.plano.novaCompras')],
  ] as const) {
    if (!presentes.has(chaveDe(tipo, null)))
      opcoes.push({ valor: chaveDe(tipo, null), rotulo, nome: '' })
  }
  return opcoes
})

const nova = ref<string | null>(null)

watch(nova, (chave) => {
  if (!chave) return
  const opcao = opcoesDeNova.value.find((item) => item.valor === chave)
  const [tipo, alvo] = chave.split(':') as [TipoDeMeta, string]
  const vacinaId = alvo === '*' ? null : alvo
  const sugerido =
    tipo === 'COMPRAS'
      ? (pedido.value?.custoTotalCentavos ?? 0) / 100
      : tipo === 'PERDAS'
        ? (sugestao.value?.metas.find((meta) => meta.tipo === 'PERDAS')?.alvo ?? 0)
        : (referencia(vacinaId)?.sugestao ?? 0)
  linhas.value = [
    ...linhas.value,
    { chave, tipo, vacinaId, vacinaNome: vacinaId ? (opcao?.nome ?? null) : null, alvo: sugerido },
  ]
  /* O Select é um botão de acrescentar, não um campo: volta para o convite. */
  queueMicrotask(() => {
    nova.value = null
  })
})

/* ------------------------------------------------------------------------------ salvar */

const valido = computed(() => linhas.value.every((linha) => typeof linha.alvo === 'number'))

async function recarregar() {
  const lidas = await lerMetas(parceiroQuery()).catch(() => null)
  if (!lidas) return
  const plano =
    lidas.atual.mes === props.mes
      ? lidas.atual.plano
      : lidas.proximo.mes === props.mes
        ? lidas.proximo.plano
        : null
  comecar(plano)
}

async function salvar() {
  tentou.value = true
  erro.value = ''
  aviso.value = ''
  indiceRecusado.value = null
  if (!valido.value) return
  salvando.value = true
  try {
    const plano = await salvarPlano(
      props.mes,
      {
        metas: metas.value,
        baseadoEm:
          base.value?.baseadoEm ?? (daSugestao.value ? sugestao.value?.mesBase : null) ?? null,
        versao: base.value?.versao ?? 0,
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('salvo', plano, metas.value.length === 0)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('estoque.plano.erro'))
    if (lido.codigo === 'PLANO_ALTERADO') {
      await recarregar()
      aviso.value = t('estoque.plano.alterado')
      emit('alterado')
      return
    }
    if (lido.codigo === 'META_MES_FORA_DA_JANELA') emit('alterado')
    const indice = err instanceof ApiError ? err.detalhes.indice : undefined
    indiceRecusado.value = typeof indice === 'number' ? indice : null
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

function invalida(linha: Linha) {
  return (
    (tentou.value && typeof linha.alvo !== 'number') ||
    (indiceRecusado.value !== null && linhas.value[indiceRecusado.value]?.chave === linha.chave)
  )
}

const titulo = computed(() =>
  props.plano?.metas.length
    ? t('estoque.plano.tituloEditar', { mes: rotulos.mes(props.mes) })
    : t('estoque.plano.titulo', { mes: rotulos.mes(props.mes) }),
)
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="titulo" icone="ph ph-flag" largura="44rem">
    <form id="plano-do-mes" class="eg" novalidate @submit.prevent="salvar">
      <p v-if="daSugestao && sugestao" class="eg__dica">
        {{
          t('estoque.plano.lede', {
            base: rotulos.mes(sugestao.mesBase),
            mes: rotulos.mes(mes),
          })
        }}
      </p>
      <p v-if="aviso" class="eg__aviso" role="status">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ aviso }}</span>
      </p>
      <p v-if="sugestao && sugestao.mesesComDado < 3" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('estoque.plano.poucosMeses', { n: sugestao.mesesComDado }) }}</span>
      </p>
      <p v-if="sugestao?.truncado && daSugestao" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('estoque.plano.truncado') }}</span>
      </p>
      <p v-if="erroDaSugestao" class="eg__aviso">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('estoque.plano.erroSugestao') }}</span>
      </p>

      <section v-if="aplicacoes.length" class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('estoque.plano.aplicacoes') }}</h3>
        <ul class="pg__lista">
          <li v-for="linha in aplicacoes" :key="linha.chave" class="pg__linha">
            <span class="pg__nome">
              <strong>{{ rotulos.nome(linha) }}</strong>
              <span v-if="referencias(linha.vacinaId).length" class="pg__refs">
                <span
                  v-for="item in referencias(linha.vacinaId)"
                  :key="item.chave"
                  :class="{ pg__venceu: item.venceu }"
                  >{{ item.texto }}</span
                >
              </span>
            </span>
            <InputNumber
              v-model="linha.alvo"
              :min="0"
              :max="maximo(linha)"
              :invalid="invalida(linha)"
              :aria-label="t('estoque.plano.metaDe', { vacina: rotulos.nome(linha) })"
              :disabled="salvando"
              class="pg__campo"
            />
            <Button
              type="button"
              icon="ph ph-x"
              severity="secondary"
              outlined
              rounded
              size="small"
              :aria-label="t('estoque.plano.removerMeta', { meta: rotulos.nome(linha) })"
              :disabled="salvando"
              @click="remover(linha.chave)"
            />
          </li>
        </ul>
      </section>

      <section v-if="daClinica.length" class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('estoque.plano.daClinica') }}</h3>
        <div v-for="linha in daClinica" :key="linha.chave" class="eg__secao">
          <label class="eg__rotulo" :for="`pg-${linha.tipo}`">{{
            linha.tipo === 'PERDAS'
              ? t('estoque.plano.tetoDePerdas')
              : t('estoque.plano.novaCompras')
          }}</label>
          <div class="pg__campo-linha">
            <InputNumber
              v-if="linha.tipo === 'PERDAS'"
              v-model="linha.alvo"
              :input-id="`pg-${linha.tipo}`"
              :min="0"
              :max="maximo(linha)"
              :prefix="`${t('estoque.plano.noMaximo')} `"
              :invalid="invalida(linha)"
              :disabled="salvando"
              fluid
            />
            <InputNumber
              v-else
              v-model="linha.alvo"
              :input-id="`pg-${linha.tipo}`"
              mode="currency"
              currency="BRL"
              :locale="INTL_LOCALE[locale as Locale]"
              :min="0"
              :max="maximo(linha)"
              :invalid="invalida(linha)"
              :disabled="salvando"
              fluid
              @input="orcamentoTocado = true"
            />
            <Button
              type="button"
              icon="ph ph-x"
              severity="secondary"
              outlined
              rounded
              size="small"
              :aria-label="t('estoque.plano.removerMeta', { meta: rotulos.nome(linha) })"
              :disabled="salvando"
              @click="remover(linha.chave)"
            />
          </div>
          <small class="eg__dica">{{
            linha.tipo === 'PERDAS'
              ? sugestao
                ? t('estoque.plano.perdasDica', {
                    base: rotulos.mes(sugestao.mesBase),
                    n: sugestao.perdasNoMesBase,
                    media: rotulos.numero(sugestao.mediaDePerdas, 1),
                  })
                : t('estoque.metas.mede.PERDAS')
              : pedido
                ? t('estoque.plano.comprasDica', {
                    valor: rotulos.dinheiro(pedido.custoTotalCentavos),
                  })
                : t('estoque.metas.mede.COMPRAS')
          }}</small>
        </div>
      </section>

      <p v-if="!linhas.length && !carregandoSugestao && base?.metas.length" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('estoque.plano.vazio', { mes: rotulos.mes(mes) }) }}</span>
      </p>

      <Select
        v-model="nova"
        :options="opcoesDeNova"
        option-label="rotulo"
        option-value="valor"
        filter
        :placeholder="t('estoque.plano.acrescentar')"
        :aria-label="t('estoque.plano.acrescentar')"
        :disabled="!opcoesDeNova.length || salvando"
        :loading="carregandoSugestao"
        class="pg__nova"
      >
        <template #dropdownicon>
          <i class="ph ph-plus" aria-hidden="true" />
        </template>
      </Select>

      <!-- O custo das metas, visto antes de combinar. -->
      <section v-if="pedido || erroDoPedido" class="eg__grupo pg__pedido" aria-live="polite">
        <p v-if="erroDoPedido" class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ erroDoPedido }}</span>
        </p>
        <template v-else-if="pedido">
          <p class="pg__total">
            <i class="ph ph-shopping-cart" aria-hidden="true" />
            <span>{{
              dosesDoPedido > 0
                ? t('estoque.plano.pedido', {
                    mes: rotulos.mes(mes),
                    doses: rotulos.doses(dosesDoPedido),
                    valor: rotulos.dinheiro(pedido.custoTotalCentavos),
                  })
                : t('estoque.plano.semPedido', { mes: rotulos.mes(mes) })
            }}</span>
          </p>
          <p v-if="pedido.vacinasSemCusto.length" class="eg__aviso">
            <i class="ph ph-info" aria-hidden="true" />
            <span>{{
              t('estoque.pedido.semCusto', {
                lista: pedido.vacinasSemCusto.map((item) => item.nome).join(', '),
              })
            }}</span>
          </p>
        </template>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="plano-do-mes"
        icon="ph ph-check"
        :label="t('estoque.plano.salvar', { mes: rotulos.mes(mes) })"
        :loading="salvando"
        :disabled="carregandoSugestao && !base?.metas.length"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pg__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pg__linha {
  display: grid;
  align-items: center;
  gap: 10px 12px;
  grid-template-columns: minmax(0, 1fr) 7.5rem auto;
  padding-block: 10px;
  border-top: 1px solid var(--linha);
}

.pg__linha:first-child {
  border-top: none;
  padding-top: 0;
}

.pg__nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.pg__nome strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.pg__refs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pg__venceu {
  color: var(--tinta);
  font-weight: 650;
}

.pg__campo :deep(.p-inputnumber-input) {
  width: 100%;
  text-align: end;
}

.pg__campo-linha {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pg__nova {
  justify-self: start;
  min-width: 16rem;
}

.pg__pedido {
  padding-top: 16px;
  border-top: 1px solid var(--linha);
}

.pg__total {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.pg__total i {
  margin-top: 3px;
  color: var(--tinta-2);
}
</style>
