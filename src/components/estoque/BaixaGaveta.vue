<script setup lang="ts">
/**
 * Dar baixa num lote (E6-01a, guia e6 5): quebra e temperatura pedem quantas doses saíram; a
 * contagem pede quantas se acharam (a baixa é a diferença); o vencimento, só no lote vencido, leva
 * o saldo inteiro ("Descartar" abre assim). O dia é o de hoje na clínica, gravado pela API.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  darBaixa,
  DOSES_MAX,
  MOTIVOS_DA_BAIXA,
  OBSERVACAO_DA_BAIXA_MAX,
  type Baixa,
  type LoteDoEstoque,
  type MotivoDaBaixa,
  type NovaBaixa,
} from '@/service/parceiro/estoque-service'

const props = defineProps<{ lote: LoteDoEstoque | null; descartar: boolean }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ baixada: [baixa: Baixa] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const motivo = ref<MotivoDaBaixa>('QUEBRA')
const quantidade = ref<number | null>(null)
const contadas = ref<number | null>(null)
const observacao = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const vencido = computed(() => props.lote?.situacao === 'VENCIDO')

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = props.descartar || vencido.value ? 'VENCIMENTO' : 'QUEBRA'
  quantidade.value = null
  contadas.value = null
  observacao.value = ''
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

/* O vencimento só vale no lote vencido; no vencido, só ele faz sentido. */
const opcoes = computed(() =>
  MOTIVOS_DA_BAIXA.filter(
    (valor) => (valor === 'VENCIMENTO') === vencido.value || valor === 'CONTAGEM',
  ).map((valor) => ({ valor, rotulo: t(`estoque.baixa.motivo.${valor}`) })),
)

const valido = computed(() => {
  if (motivo.value === 'CONTAGEM') return typeof contadas.value === 'number'
  if (motivo.value === 'VENCIMENTO') return true
  return typeof quantidade.value === 'number' && quantidade.value >= 1
})

async function baixar() {
  tentou.value = true
  erro.value = ''
  if (!props.lote || !valido.value) return
  const corpo: NovaBaixa = {
    motivo: motivo.value,
    ...(motivo.value === 'CONTAGEM'
      ? { contadas: contadas.value! }
      : motivo.value === 'VENCIMENTO'
        ? {}
        : { quantidade: quantidade.value! }),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
  }
  salvando.value = true
  try {
    const baixa = await darBaixa(props.lote.id, corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('baixada', baixa)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estoque.baixa.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="
      lote
        ? t(descartar ? 'estoque.baixa.descartarTitulo' : 'estoque.baixa.titulo', {
            codigo: lote.codigo,
          })
        : ''
    "
    icone="ph ph-minus-circle"
  >
    <form id="baixa-lote" class="eg" novalidate @submit.prevent="baixar">
      <p v-if="lote" class="eg__dica">
        {{ t('estoque.baixa.dica', { vacina: lote.vacina.nome, saldo: lote.saldo }, lote.saldo) }}
      </p>

      <section v-if="!descartar" class="eg__secao">
        <span id="bx-motivo" class="eg__rotulo">{{ t('estoque.baixa.porque') }}</span>
        <SelectButton
          v-model="motivo"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="bx-motivo"
          :disabled="salvando"
        />
      </section>

      <section v-if="motivo === 'CONTAGEM'" class="eg__secao">
        <label class="eg__rotulo" for="bx-contadas">{{ t('estoque.baixa.contadas') }}</label>
        <InputNumber
          v-model="contadas"
          input-id="bx-contadas"
          :min="0"
          :max="DOSES_MAX"
          :locale="locale"
          :invalid="tentou && contadas === null"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('estoque.baixa.contadasDica') }}</small>
      </section>
      <section v-else-if="motivo !== 'VENCIMENTO'" class="eg__secao">
        <label class="eg__rotulo" for="bx-quantidade">{{ t('estoque.baixa.quantidade') }}</label>
        <InputNumber
          v-model="quantidade"
          input-id="bx-quantidade"
          :min="1"
          :max="lote?.saldo ?? DOSES_MAX"
          :locale="locale"
          :invalid="tentou && !quantidade"
          :disabled="salvando"
        />
      </section>
      <p v-else class="eg__aviso">
        <i class="ph ph-trash" aria-hidden="true" />
        <span>{{
          t('estoque.baixa.vencimentoDica', { n: lote?.saldo ?? 0 }, lote?.saldo ?? 0)
        }}</span>
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="bx-observacao">
          {{ t('estoque.baixa.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="bx-observacao"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="OBSERVACAO_DA_BAIXA_MAX"
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
        form="baixa-lote"
        :severity="motivo === 'VENCIMENTO' ? 'danger' : undefined"
        icon="ph ph-check"
        :label="
          motivo === 'VENCIMENTO' ? t('estoque.baixa.descartar') : t('estoque.baixa.confirmar')
        "
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
