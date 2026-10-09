<script setup lang="ts">
/**
 * Combinar as metas de um mês.
 *
 * Abre preenchido com a sugestão — os números do mês atual, no ritmo de hoje — e cada meta de
 * aplicação mostra, ao lado do campo, **de onde veio o número**: o mês atual, a média do trimestre e
 * os reforços que já vencem no mês planejado. Sugestão sem origem é número que ninguém defende; com
 * a origem escrita, a pessoa muda a meta sabendo do que está abrindo mão.
 *
 * O pedido de compra se refaz a cada número digitado e aparece no rodapé do diálogo: subir a meta de
 * V10 de 12 para 18 custa seis doses a mais, e é aqui, antes de combinar, que esse custo precisa
 * ser visto. O orçamento acompanha o pedido sozinho até alguém digitar nele.
 *
 * Toda meta sai com um toque (o "x" da linha) e volta pelo "Acrescentar meta" — inclusive vacina
 * que a sugestão deixou de fora e a meta da clínica inteira.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoEstoque } from '../../composables/useRotulosDoEstoque'
import {
  estoqueRepository,
  EstoqueRecusadoError,
  LIMITE_DE_DOSES,
  type MetaNova,
} from '../../data/repositories'
import type { PlanoDeEstoque, TipoDeMeta, Vacina } from '../../data/types'
import { custoDoPedido, type SugestaoDePlano } from '../../domain/metas-de-estoque'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  /** O mês que está sendo combinado, `YYYY-MM`. */
  mes: string
  /** A sugestão da tela — só faz sentido para o próximo mês; no mês em curso é nula. */
  sugestao: SugestaoDePlano | null
  /** O plano já gravado do mês, quando o diálogo abre para editar. */
  plano: PlanoDeEstoque | null
  vacinas: Vacina[]
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  salvo: [plano: PlanoDeEstoque]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoEstoque()
const clinico = useClinicoStore()

const ptDoOverlay = { overlay: { class: 'clinic-overlay hc-tema' } }

type Linha = { chave: string; tipo: TipoDeMeta; vacinaId: string | null; alvo: number | null }

const linhas = ref<Linha[]>([])
const criadoPor = ref<string | null>(null)
const salvando = ref(false)
const erro = ref('')
/** O orçamento segue o custo do pedido até alguém digitar nele. */
const orcamentoTocado = ref(false)

function chaveDe(tipo: TipoDeMeta, vacinaId: string | null) {
  return `${tipo}:${vacinaId ?? '*'}`
}

const opcoesQuem = computed(() =>
  clinico.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

watch(
  () => props.visivel,
  (visivel) => {
    if (!visivel) {
      return
    }

    const origem = props.plano?.metas ?? props.sugestao?.metas ?? []

    linhas.value = origem.map((meta) => ({
      chave: chaveDe(meta.tipo, meta.vacinaId),
      tipo: meta.tipo,
      vacinaId: meta.vacinaId,
      /* Orçamento é guardado em centavos; o campo trabalha em reais. */
      alvo: meta.tipo === 'compras' ? meta.alvo / 100 : meta.alvo,
    }))
    /* Editar um plano já combinado não deixa o orçamento se mexer sozinho: ele foi decidido. */
    orcamentoTocado.value = Boolean(props.plano)
    criadoPor.value =
      props.plano?.criadoPor &&
      opcoesQuem.value.some((item) => item.valor === props.plano?.criadoPor)
        ? props.plano.criadoPor
        : (opcoesQuem.value[0]?.valor ?? null)
    erro.value = ''
  },
  { immediate: true },
)

const aplicacoes = computed(() => linhas.value.filter((linha) => linha.tipo === 'aplicacoes'))
const daClinica = computed(() => linhas.value.filter((linha) => linha.tipo !== 'aplicacoes'))

function referencia(vacinaId: string | null) {
  if (!props.sugestao) {
    return null
  }

  if (vacinaId !== null) {
    return props.sugestao.referencias.find((item) => item.vacinaId === vacinaId) ?? null
  }

  /* A meta da clínica inteira soma as referências de todas as vacinas. */
  return props.sugestao.referencias.reduce(
    (soma, item) => ({
      ...soma,
      projecaoDoMesBase: soma.projecaoDoMesBase + item.projecaoDoMesBase,
      mediaDoTrimestre: Math.round((soma.mediaDoTrimestre + item.mediaDoTrimestre) * 10) / 10,
      reforcosNoMes: soma.reforcosNoMes + item.reforcosNoMes,
      sugestao: soma.sugestao + item.sugestao,
    }),
    {
      vacinaId: '*',
      nome: '',
      noMesBase: 0,
      projecaoDoMesBase: 0,
      mediaDoTrimestre: 0,
      reforcosNoMes: 0,
      sugestao: 0,
    },
  )
}

/** As metas como o repositório as recebe — o orçamento volta para centavos. */
const metas = computed<MetaNova[]>(() =>
  linhas.value
    .filter((linha) => linha.alvo !== null)
    .map((linha) => ({
      tipo: linha.tipo,
      vacinaId: linha.vacinaId,
      alvo: linha.tipo === 'compras' ? Math.round((linha.alvo ?? 0) * 100) : (linha.alvo ?? 0),
    })),
)

/** O pedido que estas metas custam, refeito a cada número. */
const pedido = computed(() =>
  props.visivel ? estoqueRepository.simularPedido(props.mes, metas.value) : [],
)
const custo = computed(() => custoDoPedido(pedido.value))
const dosesDoPedido = computed(() => pedido.value.reduce((soma, linha) => soma + linha.comprar, 0))

watch(custo, (valor) => {
  const orcamento = linhas.value.find((linha) => linha.tipo === 'compras')

  if (orcamento && !orcamentoTocado.value) {
    orcamento.alvo = valor / 100
  }
})

function remover(chave: string) {
  linhas.value = linhas.value.filter((linha) => linha.chave !== chave)
}

/**
 * O que ainda pode virar meta: as vacinas sem linha, a clínica inteira, e o teto de perdas e o
 * orçamento quando foram tirados.
 */
const opcoesDeNova = computed(() => {
  const presentes = new Set(linhas.value.map((linha) => linha.chave))
  const opcoes = props.vacinas
    .filter((vacina) => !presentes.has(chaveDe('aplicacoes', vacina.id)))
    .map((vacina) => ({
      valor: chaveDe('aplicacoes', vacina.id),
      rotulo: t('clinico.estoque.plano.novaAplicacao', { vacina: vacina.nome }),
    }))

  for (const [tipo, vacinaId, rotulo] of [
    ['aplicacoes', null, t('clinico.estoque.plano.novaTotal')],
    ['perdas', null, t('clinico.estoque.plano.novaPerdas')],
    ['compras', null, t('clinico.estoque.plano.novaCompras')],
  ] as const) {
    if (!presentes.has(chaveDe(tipo, vacinaId))) {
      opcoes.push({ valor: chaveDe(tipo, vacinaId), rotulo })
    }
  }

  return opcoes
})

const nova = ref<string | null>(null)

watch(nova, (chave) => {
  if (!chave) {
    return
  }

  const [tipo, alvo] = chave.split(':') as [TipoDeMeta, string]
  const vacinaId = alvo === '*' ? null : alvo
  const sugerido =
    tipo === 'compras'
      ? custo.value / 100
      : tipo === 'perdas'
        ? (props.sugestao?.metas.find((meta) => meta.tipo === 'perdas')?.alvo ?? 0)
        : (referencia(vacinaId)?.sugestao ?? 0)

  linhas.value = [...linhas.value, { chave, tipo, vacinaId, alvo: sugerido }]
  /* O Select volta para o texto de convite: ele é um botão de acrescentar, não um campo. */
  queueMicrotask(() => {
    nova.value = null
  })
})

const titulo = computed(() =>
  props.plano
    ? t('clinico.estoque.plano.tituloEditar', { mes: formato.mesPorExtenso(props.mes) })
    : t('clinico.estoque.plano.titulo', { mes: formato.mesPorExtenso(props.mes) }),
)

async function salvar() {
  if (!criadoPor.value) {
    return
  }

  salvando.value = true
  erro.value = ''

  try {
    const plano = await estoqueRepository.salvarPlano({
      mes: props.mes,
      metas: metas.value,
      baseadoEm: props.plano?.baseadoEm ?? props.sugestao?.mesBase ?? null,
      criadoPor: criadoPor.value,
    })

    emit('salvo', plano)
    emit('update:visivel', false)
  } catch (falha) {
    erro.value =
      falha instanceof EstoqueRecusadoError
        ? t(`clinico.estoque.recusa.${falha.kind}`)
        : t('clinico.estoque.erroAoSalvar')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(56rem, 96vw)' }"
    :dismissable-mask="!salvando"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="ph ph-flag" /></span>
        {{ titulo }}
      </h2>
    </template>

    <div class="plano clinic-scope">
      <p v-if="sugestao && !plano" class="plano__lede">
        {{
          t('clinico.estoque.plano.lede', {
            base: formato.mesPorExtenso(sugestao.mesBase),
            mes: formato.mesPorExtenso(mes),
          })
        }}
      </p>

      <!--
        Aplicações: uma linha por vacina, com as três referências antes do campo. A ordem da linha
        é a ordem da leitura — de onde vem, quanto sugere, quanto fica.
      -->
      <section v-if="aplicacoes.length > 0" class="plano__bloco">
        <h3 class="plano__titulo">{{ t('clinico.estoque.plano.aplicacoes') }}</h3>

        <div class="tabela" role="table" :aria-label="t('clinico.estoque.plano.aplicacoes')">
          <div class="tabela__linha tabela__linha--cabeca" role="row">
            <span role="columnheader">{{ t('clinico.vacinas.colunaVacina') }}</span>
            <template v-if="sugestao">
              <span role="columnheader" class="tabela__num">
                {{
                  t('clinico.estoque.plano.noRitmo', {
                    mes: formato.mesPorExtenso(sugestao.mesBase),
                  })
                }}
              </span>
              <span role="columnheader" class="tabela__num">
                {{ t('clinico.estoque.plano.media') }}
              </span>
              <span role="columnheader" class="tabela__num">
                {{ t('clinico.estoque.plano.reforcos', { mes: formato.mesPorExtenso(mes) }) }}
              </span>
            </template>
            <span role="columnheader" class="tabela__num tabela__num--fica">{{
              t('clinico.estoque.plano.meta')
            }}</span>
            <span role="columnheader"
              ><span class="sr-only">{{ t('clinico.comum.remover') }}</span></span
            >
          </div>

          <div
            v-for="linha in aplicacoes"
            :key="linha.chave"
            class="tabela__linha"
            :class="{ 'tabela__linha--sem-referencia': !sugestao }"
            role="row"
          >
            <span role="cell" class="tabela__nome">{{ rotulos.nomeDaMeta(linha, vacinas) }}</span>
            <template v-if="sugestao">
              <span role="cell" class="tabela__num">{{
                referencia(linha.vacinaId)?.projecaoDoMesBase ?? 0
              }}</span>
              <span role="cell" class="tabela__num">
                {{ formato.numero(referencia(linha.vacinaId)?.mediaDoTrimestre ?? 0, 1) }}
              </span>
              <span role="cell" class="tabela__num">{{
                referencia(linha.vacinaId)?.reforcosNoMes ?? 0
              }}</span>
            </template>
            <span role="cell" class="tabela__campo">
              <InputNumber
                v-model="linha.alvo"
                :min="0"
                :max="LIMITE_DE_DOSES"
                :aria-label="
                  t('clinico.estoque.plano.metaDe', { vacina: rotulos.nomeDaMeta(linha, vacinas) })
                "
                fluid
              />
            </span>
            <span role="cell">
              <Button
                icon="ph ph-x"
                severity="secondary"
                text
                rounded
                :aria-label="
                  t('clinico.estoque.plano.removerMeta', {
                    meta: rotulos.nomeDaMeta(linha, vacinas),
                  })
                "
                @click="remover(linha.chave)"
              />
            </span>
          </div>
        </div>
      </section>

      <section v-if="daClinica.length > 0" class="plano__bloco">
        <h3 class="plano__titulo">{{ t('clinico.estoque.plano.daClinica') }}</h3>

        <div class="plano__clinica">
          <div v-for="linha in daClinica" :key="linha.chave" class="plano__teto">
            <ClinicField
              :rotulo="
                linha.tipo === 'perdas'
                  ? t('clinico.estoque.plano.tetoDePerdas')
                  : t('clinico.estoque.plano.novaCompras')
              "
              :dica="
                linha.tipo === 'perdas'
                  ? sugestao
                    ? t('clinico.estoque.plano.perdasDica', {
                        base: formato.mesPorExtenso(sugestao.mesBase),
                        n: sugestao.perdasNoMesBase,
                        media: formato.numero(sugestao.mediaDePerdas, 1),
                      })
                    : t('clinico.estoque.metas.mede.perdas')
                  : t('clinico.estoque.plano.comprasDica', { valor: formato.moeda(custo) })
              "
            >
              <template #default="{ id, descrito }">
                <div class="plano__campo">
                  <InputNumber
                    v-if="linha.tipo === 'perdas'"
                    v-model="linha.alvo"
                    :input-id="id"
                    :min="0"
                    :max="LIMITE_DE_DOSES"
                    :prefix="`${t('clinico.estoque.plano.noMaximo')} `"
                    fluid
                    :aria-describedby="descrito"
                  />
                  <InputNumber
                    v-else
                    v-model="linha.alvo"
                    :input-id="id"
                    mode="currency"
                    currency="BRL"
                    locale="pt-BR"
                    :min="0"
                    fluid
                    :aria-describedby="descrito"
                    @input="orcamentoTocado = true"
                  />
                  <Button
                    icon="ph ph-x"
                    severity="secondary"
                    text
                    rounded
                    :aria-label="
                      t('clinico.estoque.plano.removerMeta', {
                        meta: rotulos.nomeDaMeta(linha, vacinas),
                      })
                    "
                    @click="remover(linha.chave)"
                  />
                </div>
              </template>
            </ClinicField>
          </div>
        </div>
      </section>

      <div class="plano__acrescentar">
        <Select
          v-model="nova"
          :options="opcoesDeNova"
          option-label="rotulo"
          option-value="valor"
          :placeholder="t('clinico.estoque.plano.acrescentar')"
          :aria-label="t('clinico.estoque.plano.acrescentar')"
          :disabled="opcoesDeNova.length === 0"
          class="plano__nova"
          :pt="ptDoOverlay"
        >
          <template #dropdownicon>
            <i class="ph ph-plus" aria-hidden="true" />
          </template>
        </Select>

        <ClinicField :rotulo="t('clinico.estoque.plano.quemCombina')" class="plano__quem">
          <template #default="{ id }">
            <Select
              v-model="criadoPor"
              :input-id="id"
              :options="opcoesQuem"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>
      </div>

      <!-- O custo da meta, visto antes de combinar. -->
      <p class="plano__pedido" role="status">
        <i class="ph ph-shopping-cart" aria-hidden="true" />
        <span v-if="dosesDoPedido > 0">
          {{
            t('clinico.estoque.plano.pedido', {
              mes: formato.mesPorExtenso(mes),
              doses: rotulos.doses(dosesDoPedido),
              valor: formato.moeda(custo),
            })
          }}
        </span>
        <span v-else>{{
          t('clinico.estoque.plano.semPedido', { mes: formato.mesPorExtenso(mes) })
        }}</span>
      </p>

      <Message v-if="erro" severity="error" :closable="false">{{ erro }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.comum.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="emit('update:visivel', false)"
      />
      <Button
        :label="t('clinico.estoque.plano.salvar', { mes: formato.mesPorExtenso(mes) })"
        icon="ph ph-check"
        class="clinic-acao-principal"
        :loading="salvando"
        :disabled="metas.length === 0 || !criadoPor"
        @click="salvar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.plano {
  display: grid;
  gap: var(--clinic-space-4);
}

.plano__lede {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.plano__bloco {
  display: grid;
  gap: var(--clinic-space-2);
}

.plano__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
}

/*
 * Grade e não `DataTable`: são seis linhas com um campo cada, e a tabela do PrimeVue traria
 * ordenação, seleção e paginação que aqui só atrapalham o Tab de um campo para o outro.
 */
.tabela {
  display: grid;
}

.tabela__linha {
  display: grid;
  align-items: center;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(4.5rem, 0.7fr)) 9rem 2.5rem;
  padding-block: 0.35rem;
  border-top: 1px solid var(--clinic-line-soft);
}

.tabela__linha--sem-referencia {
  grid-template-columns: minmax(0, 1fr) 9rem 2.5rem;
}

.tabela__linha--cabeca {
  padding-block: 0 0.35rem;
  border-top: none;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.tabela__nome {
  overflow: hidden;
  color: var(--clinic-text);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabela__num {
  color: var(--clinic-muted);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.plano__clinica {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.plano__campo {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-1, 0.25rem);
}

.plano__acrescentar {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.plano__nova {
  min-width: 15rem;
}

.plano__quem {
  min-width: 15rem;
}

.plano__pedido {
  display: flex;
  align-items: baseline;
  margin: 0;
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
  gap: 0.45rem;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.plano__pedido i {
  color: var(--clinic-accent-strong);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .tabela__linha {
    grid-template-columns: minmax(0, 1fr) 8rem 2.5rem;
  }

  .tabela__linha .tabela__num:not(.tabela__num--fica) {
    display: none;
  }
}
</style>
