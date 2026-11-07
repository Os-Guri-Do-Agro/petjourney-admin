<script setup lang="ts">
/**
 * Acrescentar um serviço durante a estadia (E7-04a, guia e7 27): o serviço à venda, a quantidade e
 * a observação, com a versão da RESERVA (outra pessoa no meio: `RESERVA_ALTERADA`, a gaveta relê).
 * O preço novo entra pelo de hoje; a diferença só aparece para quem vê dinheiro.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerCasa, type KindDeServico } from '@/service/parceiro/hotel-casa-service'
import {
  acrescentarServico,
  QUANTIDADE_MAX,
  TEXTO_MAX,
} from '@/service/parceiro/hotel-estadia-service'
import { lerReserva } from '@/service/parceiro/hotel-reservas-service'

const props = defineProps<{ hospedagemId: string; reservaId: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [recado: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const veDinheiro = computed(() => store.temPermissao('hotel.valores'))

const servicos = ref<KindDeServico[]>([])
const servico = ref<KindDeServico | null>(null)
const quantidade = ref<number | null>(1)
const observacao = ref('')
const versao = ref(0)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

async function ler() {
  const [casa, reserva] = await Promise.all([
    lerCasa(parceiroQuery()),
    lerReserva(props.reservaId, parceiroQuery()),
  ])
  servicos.value = casa.servicos.filter((s) => s.ativo).map((s) => s.kind)
  versao.value = reserva.versao
}

watch(aberta, async (agora) => {
  if (!agora) return
  servico.value = null
  quantidade.value = 1
  observacao.value = ''
  tentou.value = false
  erro.value = ''
  await ler().catch(
    (err) => (erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem),
  )
})

const opcoes = computed(() =>
  servicos.value.map((valor) => ({ valor, rotulo: rotulos.servico(valor) })),
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!servico.value || !quantidade.value) return
  salvando.value = true
  try {
    const feita = await acrescentarServico(
      props.hospedagemId,
      {
        versao: versao.value,
        servico: servico.value,
        quantidade: quantidade.value,
        ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit(
      'salvo',
      feita.diferenca && veDinheiro.value
        ? t('reservasDoHotel.editar.reprecificada', {
            antes: rotulos.dinheiro(feita.diferenca.antesCentavos),
            depois: rotulos.dinheiro(feita.diferenca.depoisCentavos),
          })
        : t('estadiaDoHotel.servico.feito'),
    )
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.mensagem
    if (lido.codigo === 'RESERVA_ALTERADA') void ler()
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('estadiaDoHotel.servico.titulo')"
    icone="ph ph-sparkle"
  >
    <form id="servico-da-estadia" class="eg" novalidate @submit.prevent="salvar">
      <div class="eg__linha">
        <div class="eg__secao">
          <label class="eg__rotulo" for="se-servico">{{ t('reservasDoHotel.nova.servico') }}</label>
          <Select
            v-model="servico"
            input-id="se-servico"
            :options="opcoes"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !servico"
            :disabled="salvando"
          />
        </div>
        <div class="eg__secao">
          <label class="eg__rotulo" for="se-qtd">{{ t('reservasDoHotel.nova.quantidade') }}</label>
          <InputNumber
            v-model="quantidade"
            input-id="se-qtd"
            :min="1"
            :max="QUANTIDADE_MAX"
            show-buttons
            :invalid="tentou && !quantidade"
            :disabled="salvando"
          />
        </div>
      </div>
      <section class="eg__secao">
        <label class="eg__rotulo" for="se-obs"
          >{{ t('estadiaDoHotel.checkin.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
        >
        <Textarea
          id="se-obs"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="TEXTO_MAX"
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
        form="servico-da-estadia"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
