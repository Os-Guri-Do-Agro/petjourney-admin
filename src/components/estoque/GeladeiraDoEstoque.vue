<script setup lang="ts">
/**
 * A geladeira pela API (E6-01, guia e6 2): as vacinas que a clínica guarda (tem lote ou mínimo
 * próprio), com o saldo que aplica hoje contra o mínimo, a situação e quanto tempo dura; e os lotes,
 * o vencido com dose primeiro (descarte pendente), com a validade e o saldo.
 *
 * As ações moram na linha: receber lote da vacina, o mínimo (DONO e GESTOR), dar baixa, descartar o
 * vencido e corrigir o lote. Custo e valor só para quem vê dinheiro (o campo nem vem para os outros).
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { lerPacote } from '@/service/parceiro/catalogos-service'
import {
  lerGeladeira,
  type Geladeira,
  type LoteDoEstoque,
  type VacinaNaGeladeira,
} from '@/service/parceiro/estoque-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'
import { formatCentavosToBrl } from '@/utils/format/money'

import BaixaGaveta from './BaixaGaveta.vue'
import CorrigirLoteGaveta from './CorrigirLoteGaveta.vue'
import MinimoGaveta from './MinimoGaveta.vue'
import ReceberLoteGaveta from './ReceberLoteGaveta.vue'

const emit = defineEmits<{ resumo: [texto: string] }>()

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const escreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const movimenta = computed(() => escreve.value && store.temPermissao('estoque.movimentar'))
const planeja = computed(() => escreve.value && store.temPermissao('estoque.planejar'))
const veCusto = computed(
  () => store.temPermissao('estoque.planejar') || store.temPermissao('financeiro.ler'),
)

const geladeira = ref<Geladeira | null>(null)
const catalogo = ref<{ id: string; nome: string; fabricante: string | null }[]>([])
const profissionais = ref<Profissional[]>([])
const carregando = ref(false)
const erro = ref('')
const recado = ref('')

async function carregar() {
  carregando.value = true
  try {
    geladeira.value = await lerGeladeira(parceiroQuery())
    erro.value = ''
    emit('resumo', resumo.value)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estoque.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  void carregar()
  if (!movimenta.value) return
  const [pacote, lista] = await Promise.all([
    lerPacote(parceiroQuery()).catch(() => null),
    listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(() => []),
  ])
  catalogo.value = (pacote?.vacinas ?? [])
    .filter((v) => v.ativo)
    .map((v) => ({ id: v.id, nome: v.nome, fabricante: v.fabricante ?? null }))
  profissionais.value = lista
})

defineExpose({ carregar })

function dinheiro(centavos: number | undefined) {
  return typeof centavos === 'number'
    ? formatCentavosToBrl(centavos, INTL_LOCALE[locale.value as Locale])
    : ''
}

const resumo = computed(() => {
  const ind = geladeira.value?.indicadores
  if (!ind) return ''
  const partes = [t('estoque.resumo.doses', { n: ind.dosesEmEstoque }, ind.dosesEmEstoque)]
  if (ind.vacinasAbaixoDoMinimo)
    partes.push(
      t('estoque.resumo.abaixo', { n: ind.vacinasAbaixoDoMinimo }, ind.vacinasAbaixoDoMinimo),
    )
  if (ind.dosesVencendo)
    partes.push(t('estoque.resumo.vencendo', { n: ind.dosesVencendo }, ind.dosesVencendo))
  if (ind.dosesVencidas)
    partes.push(t('estoque.resumo.vencidas', { n: ind.dosesVencidas }, ind.dosesVencidas))
  if (typeof ind.valorParadoCentavos === 'number')
    partes.push(t('estoque.resumo.parado', { valor: dinheiro(ind.valorParadoCentavos) }))
  return partes.join(' · ')
})

/* ----------------------------------------------------------------------------- vacinas */

function tomDaVacina(vacina: VacinaNaGeladeira) {
  if (vacina.zerado && vacina.abaixoDoMinimo) return 'risco'
  if (vacina.abaixoDoMinimo) return 'atencao'
  if (vacina.pertoDeVencer) return 'atencao'
  return 'ok'
}

function situacaoDaVacina(vacina: VacinaNaGeladeira) {
  if (vacina.zerado && vacina.abaixoDoMinimo) return t('estoque.situacao.zerada')
  return t(`estoque.situacao.${vacina.situacao}`)
}

function metaDaVacina(vacina: VacinaNaGeladeira) {
  return [
    t('estoque.saldoMinimo', { saldo: vacina.saldo, minimo: vacina.minimo }),
    vacina.coberturaEmDias === null
      ? t('estoque.semConsumo')
      : t('estoque.cobertura', { n: vacina.coberturaEmDias }, vacina.coberturaEmDias),
    vacina.dosesVencidas
      ? t('estoque.descartePendente', { n: vacina.dosesVencidas }, vacina.dosesVencidas)
      : '',
    vacina.fabricante ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ------------------------------------------------------------------------------- lotes */

const TOM_DO_LOTE: Record<LoteDoEstoque['situacao'], string> = {
  VENCIDO: 'risco',
  VENCENDO: 'atencao',
  ATIVO: '',
  ESGOTADO: 'contorno',
}

function validadeDoLote(lote: LoteDoEstoque) {
  if (lote.diasParaVencer < 0) return t('estoque.lote.venceu', { dia: rotulos.dia(lote.validade) })
  if (lote.diasParaVencer === 0) return t('estoque.lote.venceHoje')
  return t(
    'estoque.lote.vence',
    { dia: rotulos.dia(lote.validade), n: lote.diasParaVencer },
    lote.diasParaVencer,
  )
}

function metaDoLote(lote: LoteDoEstoque) {
  return [
    t('estoque.lote.saldo', { saldo: lote.saldo, recebidas: lote.quantidadeRecebida }),
    validadeDoLote(lote),
    lote.fornecedor ?? '',
    typeof lote.valorParadoCentavos === 'number' && lote.saldo
      ? t('estoque.lote.valor', { valor: dinheiro(lote.valorParadoCentavos) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const lotesComDose = computed(() =>
  (geladeira.value?.lotes ?? []).filter((l) => l.situacao !== 'ESGOTADO'),
)
const esgotados = computed(() =>
  (geladeira.value?.lotes ?? []).filter((l) => l.situacao === 'ESGOTADO'),
)
const esgotadosAbertos = ref(false)

/* -------------------------------------------------------------------------- as gavetas */

const receberAberta = ref(false)
const vacinaParaReceber = ref<string | null>(null)
const baixaAberta = ref(false)
const descartar = ref(false)
const corrigirAberta = ref(false)
const minimoAberta = ref(false)
const lote = ref<LoteDoEstoque | null>(null)
const vacina = ref<VacinaNaGeladeira | null>(null)

/** O catálogo da gaveta: as que a clínica guarda primeiro (o nome que ela já usa). */
const vacinasParaReceber = computed(() => {
  const guardadas = (geladeira.value?.vacinas ?? []).map((v) => ({
    id: v.vacinaId,
    nome: v.nome,
    fabricante: v.fabricante,
  }))
  const ids = new Set(guardadas.map((v) => v.id))
  return [...guardadas, ...catalogo.value.filter((v) => !ids.has(v.id))]
})

function receber(vacinaId: string | null) {
  vacinaParaReceber.value = vacinaId
  receberAberta.value = true
}

function baixar(item: LoteDoEstoque, paraDescartar: boolean) {
  lote.value = item
  descartar.value = paraDescartar
  baixaAberta.value = true
}

function corrigir(item: LoteDoEstoque) {
  lote.value = item
  corrigirAberta.value = true
}

function ajustarMinimo(item: VacinaNaGeladeira) {
  vacina.value = item
  minimoAberta.value = true
}

function mudou(texto: string) {
  recado.value = texto
  invalidarPendenciasDoPortal()
  void carregar()
}
</script>

<template>
  <div class="gl">
    <p v-if="recado" class="gl__recado" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      {{ recado }}
    </p>
    <p v-if="erro && geladeira" class="gl__erro" role="alert">{{ erro }}</p>

    <section class="ui-folha ui-cartao" aria-labelledby="gl-vacinas" :aria-busy="carregando">
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-snowflake" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="gl-vacinas" class="ui-cartao__titulo">{{ t('estoque.vacinas') }}</h2>
          <p class="ui-cartao__descricao">{{ t('estoque.vacinasDescricao') }}</p>
        </span>
        <Button
          v-if="movimenta"
          type="button"
          size="small"
          icon="ph ph-plus"
          :label="t('estoque.receber.acao')"
          @click="receber(null)"
        />
      </header>
      <ul v-if="geladeira?.vacinas.length" class="ui-lista">
        <li v-for="item in geladeira.vacinas" :key="item.vacinaId" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo gl__nome">
              {{ item.nome }}
              <span class="ui-selo" :class="`ui-selo--${tomDaVacina(item)}`">{{
                situacaoDaVacina(item)
              }}</span>
            </strong>
            <span class="ui-linha__meta">{{ metaDaVacina(item) }}</span>
          </span>
          <span v-if="movimenta || planeja" class="ui-linha__fim gl__acoes">
            <Button
              v-if="planeja"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('estoque.minimo.acao')"
              @click="ajustarMinimo(item)"
            />
            <Button
              v-if="movimenta"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-plus"
              :label="t('estoque.receber.lote')"
              @click="receber(item.vacinaId)"
            />
          </span>
        </li>
      </ul>
      <p v-else-if="geladeira" class="gl__nota">{{ t('estoque.vazio') }}</p>
    </section>

    <section v-if="geladeira?.lotes.length" class="ui-folha ui-cartao" aria-labelledby="gl-lotes">
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-package" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="gl-lotes" class="ui-cartao__titulo">{{ t('estoque.lotes') }}</h2>
          <p class="ui-cartao__descricao">{{ t('estoque.lotesDescricao') }}</p>
        </span>
      </header>
      <ul v-if="lotesComDose.length" class="ui-lista">
        <li
          v-for="item in lotesComDose"
          :key="item.id"
          class="ui-linha"
          :class="{ 'ui-marca ui-marca--risco': item.situacao === 'VENCIDO' }"
        >
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo gl__nome">
              {{ item.vacina.nome }} · {{ item.codigo }}
              <span
                v-if="item.situacao !== 'ATIVO'"
                class="ui-selo"
                :class="TOM_DO_LOTE[item.situacao] ? `ui-selo--${TOM_DO_LOTE[item.situacao]}` : ''"
                >{{ t(`estoque.lote.situacao.${item.situacao}`) }}</span
              >
            </strong>
            <span class="ui-linha__meta">{{ metaDoLote(item) }}</span>
          </span>
          <span v-if="movimenta" class="ui-linha__fim gl__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :aria-label="t('estoque.corrigir.de', { codigo: item.codigo })"
              @click="corrigir(item)"
            />
            <Button
              v-if="item.situacao === 'VENCIDO'"
              type="button"
              size="small"
              severity="danger"
              outlined
              icon="ph ph-trash"
              :label="t('estoque.baixa.descartar')"
              @click="baixar(item, true)"
            />
            <Button
              v-else
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('estoque.baixa.acao')"
              @click="baixar(item, false)"
            />
          </span>
        </li>
      </ul>
      <template v-if="esgotados.length">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          class="gl__mais"
          :icon="esgotadosAbertos ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          :label="t('estoque.lote.esgotados', { n: esgotados.length })"
          :aria-expanded="esgotadosAbertos"
          @click="esgotadosAbertos = !esgotadosAbertos"
        />
        <ul v-show="esgotadosAbertos" class="ui-lista gl__esgotados">
          <li v-for="item in esgotados" :key="item.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.vacina.nome }} · {{ item.codigo }}</strong>
              <span class="ui-linha__meta">{{ metaDoLote(item) }}</span>
            </span>
          </li>
        </ul>
      </template>
      <p v-if="geladeira.truncado" class="gl__nota">{{ t('estoque.truncado') }}</p>
    </section>

    <ReceberLoteGaveta
      v-model:visible="receberAberta"
      :vacinas="vacinasParaReceber"
      :profissionais="profissionais"
      :vacina-inicial="vacinaParaReceber"
      @recebido="
        (novo) =>
          mudou(
            t(
              'estoque.receber.feito',
              { codigo: novo.codigo, n: novo.quantidadeRecebida },
              novo.quantidadeRecebida,
            ),
          )
      "
    />
    <BaixaGaveta
      v-model:visible="baixaAberta"
      :lote="lote"
      :descartar="descartar"
      @baixada="
        (baixa) =>
          mudou(
            t(
              'estoque.baixa.feita',
              { n: baixa.quantidade, saldo: baixa.saldoDoLote },
              baixa.quantidade,
            ),
          )
      "
    />
    <CorrigirLoteGaveta
      v-model:visible="corrigirAberta"
      :lote="lote"
      :ve-custo="veCusto"
      @corrigido="mudou(t('estoque.corrigir.feito'))"
    />
    <MinimoGaveta
      v-model:visible="minimoAberta"
      :vacina="vacina"
      @definido="mudou(t('estoque.minimo.feito'))"
    />
  </div>
</template>

<style scoped>
.gl {
  display: grid;
  gap: 20px;
}

.gl__recado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.gl__recado i {
  color: var(--ok-tinta);
}

.gl__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.gl__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.gl__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.gl__nota {
  margin: 0;
  padding: 0 24px 14px;
  color: var(--tinta-2);
  font-size: 14px;
}

.gl__mais {
  justify-self: start;
  margin: 4px 24px 16px;
}

.gl__esgotados {
  opacity: 0.8;
}
</style>
