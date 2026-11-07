<script setup lang="ts">
/**
 * Um serviço da casa (E7-01, guia e7 8): um por tipo (o segundo dá `SERVICO_DUPLICADO`), o preço em
 * reais na tela e centavos no corpo, e se cobra por diária ou uma vez por estadia. O tipo não muda
 * depois de criado.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  criarServico,
  editarServico,
  KINDS_DE_SERVICO,
  PRECO_MAX_CENTAVOS,
  type KindDeServico,
  type ServicoDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import { useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{
  servico: ServicoDaCasa | null
  /** Os tipos que a casa já tem: não voltam na escolha. */
  existentes: KindDeServico[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()

const kind = ref<KindDeServico | null>(null)
const preco = ref<number | null>(null)
const porDiaria = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  kind.value = props.servico?.kind ?? null
  preco.value =
    typeof props.servico?.precoCentavos === 'number' ? props.servico.precoCentavos / 100 : null
  porDiaria.value = props.servico?.porDiaria ?? false
  tentou.value = false
  erro.value = ''
})

const opcoesDeKind = computed(() =>
  KINDS_DE_SERVICO.filter((k) => !props.existentes.includes(k)).map((valor) => ({
    valor,
    rotulo: rotulos.servico(valor),
  })),
)
const opcoesDeCobranca = computed(() => [
  { valor: true, rotulo: t('casaDoHotel.servico.porDiaria') },
  { valor: false, rotulo: t('casaDoHotel.servico.porEstadia') },
])

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!kind.value || preco.value === null) return
  const precoCentavos = Math.round(preco.value * 100)
  salvando.value = true
  try {
    if (props.servico)
      await editarServico(
        props.servico.id,
        { precoCentavos, porDiaria: porDiaria.value },
        parceiroQuery(),
      )
    else
      await criarServico(
        { kind: kind.value, precoCentavos, porDiaria: porDiaria.value },
        parceiroQuery(),
      )
    aberta.value = false
    emit('salvo')
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
    :titulo="servico ? t('casaDoHotel.servico.editar') : t('casaDoHotel.servico.novo')"
    icone="ph ph-sparkle"
  >
    <form id="servico-da-casa" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="sv-kind">{{ t('casaDoHotel.servico.qual') }}</label>
        <p v-if="servico" id="sv-kind" class="sv__fixo">{{ rotulos.servico(servico.kind) }}</p>
        <Select
          v-else
          v-model="kind"
          input-id="sv-kind"
          :options="opcoesDeKind"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !kind"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="sv-preco">{{ t('casaDoHotel.servico.preco') }}</label>
        <InputNumber
          v-model="preco"
          input-id="sv-preco"
          mode="currency"
          currency="BRL"
          :locale="rotulos.intl()"
          :min="0"
          :max="PRECO_MAX_CENTAVOS / 100"
          :invalid="tentou && preco === null"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <span id="sv-cobranca" class="eg__rotulo">{{ t('casaDoHotel.servico.cobranca') }}</span>
        <SelectButton
          v-model="porDiaria"
          :options="opcoesDeCobranca"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="sv-cobranca"
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
        form="servico-da-casa"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.sv__fixo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}
</style>
