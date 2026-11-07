<script setup lang="ts">
/**
 * Receber lote (E6-01a, guia e6 3): a vacina, o código do frasco, a validade, quantas **doses**
 * (não frascos), o custo por dose, e o que ajuda a conferir (fornecedor, nota, quem conferiu, o dia
 * em que chegou). O código vai em maiúsculas e é único por vacina. O duplo toque devolve o mesmo
 * lote (Idempotency-Key).
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  CODIGO_DO_LOTE,
  CODIGO_MAX,
  CUSTO_MAX_CENTAVOS,
  DOSES_MAX,
  listarFornecedores,
  receberLote,
  RECEBIDO_DIAS_PARA_TRAS,
  type LoteDoEstoque,
} from '@/service/parceiro/estoque-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{
  vacinas: { id: string; nome: string; fabricante: string | null }[]
  profissionais: Profissional[]
  vacinaInicial: string | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ recebido: [lote: LoteDoEstoque] }>()

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const HOJE = 'HOJE'
const OUTRO = 'OUTRO'

const vacinaId = ref<string | null>(null)
const codigo = ref('')
const validade = ref<Date | null>(null)
const recebido = ref<typeof HOJE | typeof OUTRO>(HOJE)
const recebidoEm = ref<Date | null>(null)
const quantidade = ref<number | null>(null)
const custoReais = ref<number | null>(null)
const fornecedor = ref('')
const fornecedores = ref<string[]>([])
const sugestoes = ref<string[]>([])
const notaFiscal = ref('')
const conferidoPor = ref<string | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const erroNoCodigo = ref('')

watch(aberta, async (agora) => {
  if (!agora) return
  vacinaId.value = props.vacinaInicial
  codigo.value = ''
  validade.value = null
  recebido.value = HOJE
  recebidoEm.value = null
  quantidade.value = null
  custoReais.value = null
  fornecedor.value = ''
  notaFiscal.value = ''
  conferidoPor.value = store.eu?.profissional?.ativo ? store.eu.profissional.id : null
  tentou.value = false
  erro.value = ''
  erroNoCodigo.value = ''
  chaveador.concluir()
  if (!fornecedores.value.length)
    fornecedores.value = (
      await listarFornecedores(parceiroQuery()).catch(() => ({ itens: [] }))
    ).itens
})

const opcoesDeVacina = computed(() =>
  props.vacinas.map((v) => ({
    valor: v.id,
    rotulo: v.fabricante ? `${v.nome} · ${v.fabricante}` : v.nome,
  })),
)
const opcoesDeRecebido = computed(() => [
  { valor: HOJE, rotulo: t('estoque.receber.hoje') },
  { valor: OUTRO, rotulo: t('estoque.receber.outroDia') },
])
const opcoesDePessoas = computed(() =>
  props.profissionais.filter((p) => p.ativo).map((p) => ({ valor: p.id, rotulo: p.nome })),
)

function buscarFornecedor(evento: { query: string }) {
  const q = evento.query.trim().toLocaleLowerCase()
  sugestoes.value = fornecedores.value.filter((item) => item.toLocaleLowerCase().includes(q))
}

const hoje = new Date()
const minimoDoRecebido = new Date(hoje.getTime() - RECEBIDO_DIAS_PARA_TRAS * 86_400_000)

function iso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

const valido = computed(
  () =>
    Boolean(vacinaId.value) &&
    CODIGO_DO_LOTE.test(codigo.value.trim()) &&
    Boolean(validade.value) &&
    (recebido.value === HOJE || Boolean(recebidoEm.value)) &&
    typeof quantidade.value === 'number' &&
    quantidade.value >= 1 &&
    typeof custoReais.value === 'number',
)

async function receber() {
  tentou.value = true
  erro.value = ''
  erroNoCodigo.value = ''
  if (!valido.value) return
  const corpo = {
    vacinaId: vacinaId.value!,
    codigo: codigo.value.trim().toUpperCase(),
    validade: iso(validade.value!),
    ...(recebido.value === OUTRO && recebidoEm.value ? { recebidoEm: iso(recebidoEm.value) } : {}),
    quantidade: quantidade.value!,
    custoUnitarioCentavos: Math.round(custoReais.value! * 100),
    ...(fornecedor.value.trim() ? { fornecedor: fornecedor.value.trim() } : {}),
    ...(notaFiscal.value.trim() ? { notaFiscal: notaFiscal.value.trim() } : {}),
    ...(conferidoPor.value ? { conferidoPorProfissionalId: conferidoPor.value } : {}),
  }
  salvando.value = true
  try {
    const lote = await receberLote(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('recebido', lote)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('estoque.receber.erro'))
    if (lido.codigo === 'LOTE_DUPLICADO') erroNoCodigo.value = lido.mensagem
    else erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('estoque.receber.titulo')"
    icone="ph ph-package"
    largura="36rem"
  >
    <form id="receber-lote" class="eg" novalidate @submit.prevent="receber">
      <section class="eg__secao">
        <label class="eg__rotulo" for="rl-vacina">{{ t('estoque.vacina') }}</label>
        <Select
          v-model="vacinaId"
          input-id="rl-vacina"
          :options="opcoesDeVacina"
          option-label="rotulo"
          option-value="valor"
          filter
          :invalid="tentou && !vacinaId"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="rl-codigo">{{ t('estoque.receber.codigo') }}</label>
          <InputText
            id="rl-codigo"
            v-model="codigo"
            :maxlength="CODIGO_MAX"
            :invalid="(tentou && !CODIGO_DO_LOTE.test(codigo.trim())) || Boolean(erroNoCodigo)"
            :disabled="salvando"
          />
          <small v-if="erroNoCodigo" class="eg__invalido">{{ erroNoCodigo }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="rl-quantidade">{{ t('estoque.receber.doses') }}</label>
          <InputNumber
            v-model="quantidade"
            input-id="rl-quantidade"
            :min="1"
            :max="DOSES_MAX"
            :locale="locale"
            :invalid="tentou && !quantidade"
            :disabled="salvando"
          />
        </section>
      </div>
      <small class="eg__dica rl__dica">{{ t('estoque.receber.dosesDica') }}</small>

      <section class="eg__secao">
        <span id="rl-validade" class="eg__rotulo">{{ t('estoque.validade') }}</span>
        <DatePicker
          v-model="validade"
          inline
          :min-date="hoje"
          aria-labelledby="rl-validade"
          :invalid="tentou && !validade"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="rl-custo">{{ t('estoque.receber.custo') }}</label>
        <InputNumber
          v-model="custoReais"
          input-id="rl-custo"
          mode="currency"
          currency="BRL"
          :locale="locale"
          :min="0"
          :max="CUSTO_MAX_CENTAVOS / 100"
          :invalid="tentou && custoReais === null"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="rl-fornecedor">
            {{ t('estoque.fornecedor') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <AutoComplete
            v-model="fornecedor"
            input-id="rl-fornecedor"
            :suggestions="sugestoes"
            :disabled="salvando"
            @complete="buscarFornecedor"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="rl-nota">
            {{ t('estoque.notaFiscal') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText id="rl-nota" v-model="notaFiscal" :disabled="salvando" />
        </section>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="rl-conferiu">{{ t('estoque.receber.conferiu') }}</label>
        <Select
          v-model="conferidoPor"
          input-id="rl-conferiu"
          :options="opcoesDePessoas"
          option-label="rotulo"
          option-value="valor"
          show-clear
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="rl-recebido" class="eg__rotulo">{{ t('estoque.receber.quando') }}</span>
        <SelectButton
          v-model="recebido"
          :options="opcoesDeRecebido"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="rl-recebido"
          :disabled="salvando"
        />
        <DatePicker
          v-if="recebido === OUTRO"
          v-model="recebidoEm"
          inline
          :min-date="minimoDoRecebido"
          :max-date="hoje"
          aria-labelledby="rl-recebido"
          :invalid="tentou && !recebidoEm"
          :disabled="salvando"
        />
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
        form="receber-lote"
        icon="ph ph-check"
        :label="t('estoque.receber.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rl__dica {
  margin-top: -14px;
}
</style>
