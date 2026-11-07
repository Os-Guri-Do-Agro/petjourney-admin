<script setup lang="ts">
/**
 * Corrigir o lote (E6-01a, guia e6 4): só o fornecedor, a nota e o custo. Código, validade e
 * quantidade não se editam (a quantidade se acerta pela contagem). O custo só para quem vê o custo
 * (`estoque.planejar` ou `financeiro.ler`): a enfermagem manda só fornecedor e nota. Esvaziar limpa.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  corrigirLote,
  CUSTO_MAX_CENTAVOS,
  type CorrecaoDoLote,
  type LoteDoEstoque,
} from '@/service/parceiro/estoque-service'

const props = defineProps<{ lote: LoteDoEstoque | null; veCusto: boolean }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ corrigido: [lote: LoteDoEstoque] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const fornecedor = ref('')
const notaFiscal = ref('')
const custoReais = ref<number | null>(null)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora || !props.lote) return
  fornecedor.value = props.lote.fornecedor ?? ''
  notaFiscal.value = props.lote.notaFiscal ?? ''
  custoReais.value =
    typeof props.lote.custoUnitarioCentavos === 'number'
      ? props.lote.custoUnitarioCentavos / 100
      : null
  erro.value = ''
})

async function salvar() {
  const lote = props.lote
  if (!lote) return
  erro.value = ''
  const corpo: CorrecaoDoLote = {}
  const novoFornecedor = fornecedor.value.trim() || null
  const novaNota = notaFiscal.value.trim() || null
  if (novoFornecedor !== lote.fornecedor) corpo.fornecedor = novoFornecedor
  if (novaNota !== lote.notaFiscal) corpo.notaFiscal = novaNota
  if (props.veCusto && custoReais.value !== null) {
    const centavos = Math.round(custoReais.value * 100)
    if (centavos !== lote.custoUnitarioCentavos) corpo.custoUnitarioCentavos = centavos
  }
  if (!Object.keys(corpo).length) {
    aberta.value = false
    return
  }
  salvando.value = true
  try {
    const corrigido = await corrigirLote(lote.id, corpo, parceiroQuery())
    aberta.value = false
    emit('corrigido', corrigido)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="lote ? t('estoque.corrigir.titulo', { codigo: lote.codigo }) : ''"
    icone="ph ph-pencil-simple"
  >
    <form id="corrigir-lote" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('estoque.corrigir.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="cl-fornecedor">{{ t('estoque.fornecedor') }}</label>
        <InputText id="cl-fornecedor" v-model="fornecedor" :disabled="salvando" />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="cl-nota">{{ t('estoque.notaFiscal') }}</label>
        <InputText id="cl-nota" v-model="notaFiscal" :disabled="salvando" />
      </section>
      <section v-if="veCusto" class="eg__secao">
        <label class="eg__rotulo" for="cl-custo">{{ t('estoque.receber.custo') }}</label>
        <InputNumber
          v-model="custoReais"
          input-id="cl-custo"
          mode="currency"
          currency="BRL"
          :locale="locale"
          :min="0"
          :max="CUSTO_MAX_CENTAVOS / 100"
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
        form="corrigir-lote"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
