<script setup lang="ts">
/**
 * Dar entrada numa caixa de vacina.
 *
 * Até aqui, lote só existia se a semente o plantasse: a clínica que comprava não tinha onde dizer
 * que a caixa chegou, e o frasco novo não aparecia no diálogo de aplicação. Este é o caminho.
 *
 * O formulário segue a ordem em que a caixa é aberta no balcão — **o que é, de que lote, até quando,
 * quantas, quanto custou** — e chega preenchido com o que dá para adivinhar sem errar: o fornecedor
 * e o custo do último lote da mesma vacina, e a quantidade que o pedido de compra mandou comprar.
 *
 * Duas recusas moram no repositório e não só aqui: **código repetido** (é a chave que liga a dose
 * ao frasco — duas caixas com o mesmo código somariam as aplicações de uma no saldo da outra) e
 * **validade passada** (frasco vencido volta para o fornecedor, não entra na geladeira).
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDateField from '../base/ClinicDateField.vue'
import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoEstoque } from '../../composables/useRotulosDoEstoque'
import {
  diasDeValidade,
  estoqueRepository,
  EstoqueRecusadoError,
  LIMITE_DE_DOSES,
} from '../../data/repositories'
import type { LoteDeVacina, Vacina } from '../../data/types'
import { addDays } from '../../domain/clinic-time'
import { JANELA_DE_VALIDADE_EM_DIAS, type LoteNoEstoque } from '../../domain/estoque-vacinas'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    visivel: boolean
    vacinas: Vacina[]
    /** Os lotes da geladeira — é deles que saem o fornecedor e o custo sugeridos. */
    lotes: LoteNoEstoque[]
    /** Vacina já escolhida, quando o diálogo abre de uma linha. */
    vacinaInicial?: string | null
    /** Doses sugeridas, quando o diálogo abre do pedido de compra. */
    quantidadeInicial?: number | null
  }>(),
  { vacinaInicial: null, quantidadeInicial: null },
)

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  recebido: [lote: LoteDeVacina]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoEstoque()
const clinico = useClinicoStore()

const ptDoOverlay = { overlay: { class: 'clinic-overlay hc-tema' } }

const vacinaId = ref<string | null>(null)
const codigo = ref('')
const validade = ref('')
const quantidade = ref<number | null>(null)
/** Em reais na tela; vira centavos na gravação. */
const custo = ref<number | null>(null)
const fornecedor = ref('')
const notaFiscal = ref('')
const recebidoEm = ref('')
const recebidoPor = ref<string | null>(null)
const tentouSalvar = ref(false)
const salvando = ref(false)
const erro = ref('')

const hoje = computed(() => clinicClock.today())
const amanha = computed(() => addDays(hoje.value, 1))

const opcoesVacina = computed(() =>
  props.vacinas.map((vacina) => ({ valor: vacina.id, rotulo: vacina.nome })),
)

const opcoesFornecedor = computed(() => estoqueRepository.fornecedores())

const opcoesQuemRecebe = computed(() =>
  clinico.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

/** O lote mais recente da vacina escolhida: o preço e o fornecedor da última compra. */
const ultimoLote = computed(
  () =>
    [...props.lotes]
      .filter((lote) => lote.vacinaId === vacinaId.value)
      .sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm))[0] ?? null,
)

/*
 * Trocar a vacina refaz o que veio dela — mas só o que ninguém digitou. Apagar o custo que a pessoa
 * acabou de corrigir porque ela mudou de V10 para V4 seria a tela desfazendo trabalho.
 */
const custoTocado = ref(false)
const fornecedorTocado = ref(false)

watch(vacinaId, () => {
  if (!custoTocado.value) {
    custo.value = ultimoLote.value ? ultimoLote.value.custoUnitario / 100 : null
  }

  if (!fornecedorTocado.value) {
    fornecedor.value = ultimoLote.value?.fornecedor ?? ''
  }
})

watch(
  () => props.visivel,
  (visivel) => {
    if (!visivel) {
      return
    }

    custoTocado.value = false
    fornecedorTocado.value = false
    vacinaId.value = props.vacinaInicial ?? props.vacinas[0]?.id ?? null
    codigo.value = ''
    validade.value = ''
    quantidade.value =
      props.quantidadeInicial && props.quantidadeInicial > 0 ? props.quantidadeInicial : null
    custo.value = ultimoLote.value ? ultimoLote.value.custoUnitario / 100 : null
    fornecedor.value = ultimoLote.value?.fornecedor ?? ''
    notaFiscal.value = ''
    recebidoEm.value = hoje.value
    recebidoPor.value = opcoesQuemRecebe.value[0]?.valor ?? null
    tentouSalvar.value = false
    erro.value = ''
  },
  { immediate: true },
)

const custoEmCentavos = computed(() =>
  custo.value === null ? null : Math.round(custo.value * 100),
)

const totalDaNota = computed(() =>
  quantidade.value && custoEmCentavos.value !== null
    ? quantidade.value * custoEmCentavos.value
    : null,
)

/** Validade curta: o lote já nasce na lista de "usar primeiro", e a recepção precisa saber. */
const validadeCurta = computed(() => {
  if (!validade.value || validade.value <= hoje.value) {
    return null
  }

  const dias = diasDeValidade(validade.value)

  return dias <= JANELA_DE_VALIDADE_EM_DIAS ? dias : null
})

const erroCodigo = computed(() =>
  tentouSalvar.value && !codigo.value.trim() ? t('clinico.estoque.receber.erros.codigo') : '',
)

const erroValidade = computed(() => {
  if (!tentouSalvar.value) {
    return ''
  }

  if (!validade.value) {
    return t('clinico.estoque.receber.erros.validade')
  }

  return validade.value <= hoje.value ? t('clinico.estoque.recusa.validade-passada') : ''
})

const erroQuantidade = computed(() =>
  tentouSalvar.value && !quantidade.value ? t('clinico.estoque.receber.erros.quantidade') : '',
)

const completo = computed(
  () =>
    Boolean(vacinaId.value) &&
    Boolean(codigo.value.trim()) &&
    Boolean(validade.value) &&
    validade.value > hoje.value &&
    Boolean(quantidade.value) &&
    custoEmCentavos.value !== null &&
    Boolean(recebidoEm.value) &&
    Boolean(recebidoPor.value),
)

async function receber() {
  tentouSalvar.value = true
  erro.value = ''

  if (!completo.value || !vacinaId.value || !recebidoPor.value) {
    return
  }

  salvando.value = true

  try {
    const lote = await estoqueRepository.receberLote({
      vacinaId: vacinaId.value,
      codigo: codigo.value,
      fornecedor: fornecedor.value,
      recebidoEm: recebidoEm.value,
      validade: validade.value,
      quantidade: quantidade.value ?? 0,
      custoUnitario: custoEmCentavos.value ?? 0,
      notaFiscal: notaFiscal.value,
      recebidoPor: recebidoPor.value,
    })

    emit('recebido', lote)
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
    :style="{ width: 'min(40rem, 94vw)' }"
    :dismissable-mask="!salvando"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="ph ph-package" /></span>
        {{ t('clinico.estoque.receber.titulo') }}
      </h2>
    </template>

    <form class="receber clinic-scope" @submit.prevent="receber">
      <div class="receber__linha receber__linha--larga">
        <ClinicField :rotulo="t('clinico.vacinas.colunaVacina')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="vacinaId"
              :input-id="id"
              :options="opcoesVacina"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.vacinas.lote')"
          obrigatorio
          :dica="t('clinico.estoque.receber.codigoDica')"
          :erro="erroCodigo"
        >
          <template #default="{ id, descrito }">
            <InputText
              :id="id"
              v-model="codigo"
              class="receber__codigo"
              autocomplete="off"
              fluid
              :aria-describedby="descrito"
            />
          </template>
        </ClinicField>
      </div>

      <div class="receber__linha">
        <ClinicField :rotulo="t('clinico.vacinas.validadeLote')" obrigatorio :erro="erroValidade">
          <template #default="{ id, descrito }">
            <ClinicDateField
              v-model="validade"
              :input-id="id"
              :min="amanha"
              :aria-describedby="descrito"
              :invalido="Boolean(erroValidade)"
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.estoque.receber.quantidade')"
          obrigatorio
          :erro="erroQuantidade"
        >
          <template #default="{ id, descrito }">
            <InputNumber
              v-model="quantidade"
              :input-id="id"
              :min="1"
              :max="LIMITE_DE_DOSES"
              fluid
              :aria-describedby="descrito"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.estoque.receber.custo')" obrigatorio>
          <template #default="{ id }">
            <InputNumber
              v-model="custo"
              :input-id="id"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              fluid
              @input="custoTocado = true"
            />
          </template>
        </ClinicField>
      </div>

      <!--
        A validade curta é dita na hora, e não descoberta depois: o lote entra direto na lista de
        "usar primeiro", e quem recebe pode recusar a caixa enquanto o entregador está na porta.
      -->
      <p v-if="validadeCurta !== null" class="receber__aviso" role="status">
        <i class="ph ph-hourglass" aria-hidden="true" />
        {{ t('clinico.estoque.receber.validadeCurta', { dias: validadeCurta }) }}
      </p>

      <div class="receber__linha receber__linha--larga">
        <ClinicField :rotulo="t('clinico.estoque.receber.fornecedor')">
          <template #default="{ id }">
            <!--
              Editável: o fornecedor novo se digita; o conhecido se escolhe. Três grafias do mesmo
              distribuidor partiriam o histórico de compra em três.
            -->
            <Select
              v-model="fornecedor"
              :input-id="id"
              :options="opcoesFornecedor"
              editable
              fluid
              :pt="ptDoOverlay"
              @change="fornecedorTocado = true"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.estoque.receber.notaFiscal')">
          <template #default="{ id }">
            <InputText :id="id" v-model="notaFiscal" autocomplete="off" fluid />
          </template>
        </ClinicField>
      </div>

      <div class="receber__linha receber__linha--metade">
        <ClinicField :rotulo="t('clinico.estoque.receber.recebidoEm')" obrigatorio>
          <template #default="{ id }">
            <ClinicDateField v-model="recebidoEm" :input-id="id" :max="hoje" />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.estoque.receber.quemConferiu')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="recebidoPor"
              :input-id="id"
              :options="opcoesQuemRecebe"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>
      </div>

      <p v-if="totalDaNota !== null" class="receber__total">
        {{
          t('clinico.estoque.receber.total', {
            doses: rotulos.doses(quantidade ?? 0),
            valor: formato.moeda(totalDaNota),
          })
        }}
      </p>

      <Message v-if="erro" severity="error" :closable="false">{{ erro }}</Message>
    </form>

    <template #footer>
      <Button
        :label="t('clinico.comum.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="emit('update:visivel', false)"
      />
      <Button
        :label="t('clinico.estoque.receber.confirmar')"
        icon="ph ph-check"
        class="clinic-acao-principal"
        :loading="salvando"
        @click="receber"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.receber {
  display: grid;
  gap: var(--clinic-space-3);
}

.receber__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.receber__linha--larga {
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
}

.receber__linha--metade {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* O código é copiado do frasco: maiúsculas e número tabular ajudam a conferir dígito a dígito. */
.receber__codigo {
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}

.receber__aviso,
.receber__total {
  display: flex;
  align-items: baseline;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.receber__aviso i {
  color: var(--clinic-attention-text);
}

.receber__total {
  color: var(--clinic-text);
  font-weight: 650;
}

@media (max-width: 620px) {
  .receber__linha,
  .receber__linha--larga,
  .receber__linha--metade {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
