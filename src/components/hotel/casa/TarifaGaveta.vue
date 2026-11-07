<script setup lang="ts">
/**
 * Uma tabela de preço (E7-01, guia e7 4): a diária de cada porte, em reais na tela e em centavos
 * no corpo, e o percentual do segundo animal da mesma casa. Mudar a tabela em uso vale para os
 * orçamentos novos (a reserva congela o dela). Criar aceita o duplo toque (Idempotency-Key).
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarTarifa,
  DIARIA_MAX_CENTAVOS,
  editarTarifa,
  NOME_MAX,
  NOME_VALIDO,
  PORTES,
  type PorteDaCasa,
  type TarifaDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import { useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{ tarifa: TarifaDaCasa | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const nome = ref('')
const diarias = ref<Record<PorteDaCasa, number | null>>({
  MINI: null,
  PEQUENO: null,
  MEDIO: null,
  GRANDE: null,
  GIGANTE: null,
})
const acompanhante = ref<number | null>(50)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const erroNoNome = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const tarifa = props.tarifa
  nome.value = tarifa?.nome ?? ''
  for (const porte of PORTES) {
    diarias.value[porte] = tarifa ? tarifa.diariaPorPorte[porte] / 100 : null
  }
  acompanhante.value = tarifa?.acompanhantePercentual ?? 50
  tentou.value = false
  erro.value = ''
  erroNoNome.value = ''
  chaveador.concluir()
})

const nomeValido = computed(() => {
  const limpo = nome.value.trim()
  return limpo.length > 0 && limpo.length <= NOME_MAX && NOME_VALIDO.test(limpo)
})

const valido = computed(
  () =>
    nomeValido.value &&
    PORTES.every((porte) => typeof diarias.value[porte] === 'number') &&
    typeof acompanhante.value === 'number',
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  erroNoNome.value = ''
  if (!valido.value) return
  const corpo = {
    nome: nome.value.trim(),
    diariaPorPorte: Object.fromEntries(
      PORTES.map((porte) => [porte, Math.round(diarias.value[porte]! * 100)]),
    ) as Record<PorteDaCasa, number>,
    acompanhantePercentual: acompanhante.value!,
  }
  salvando.value = true
  try {
    if (props.tarifa) await editarTarifa(props.tarifa.id, corpo, parceiroQuery())
    else await criarTarifa(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'NOME_EM_USO') erroNoNome.value = lido.mensagem
    else erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="tarifa ? t('casaDoHotel.tarifa.editar') : t('casaDoHotel.tarifa.nova')"
    icone="ph ph-currency-circle-dollar"
  >
    <form id="tarifa-da-casa" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="tf-nome">{{ t('casaDoHotel.tarifa.nome') }}</label>
        <InputText
          id="tf-nome"
          v-model="nome"
          :maxlength="NOME_MAX"
          :placeholder="t('casaDoHotel.tarifa.nomeDica')"
          :invalid="(tentou && !nomeValido) || Boolean(erroNoNome)"
          :disabled="salvando"
        />
        <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('casaDoHotel.tarifa.diarias') }}</h3>
        <div class="eg__linha">
          <div v-for="porte in PORTES" :key="porte" class="eg__secao">
            <label class="eg__rotulo" :for="`tf-${porte}`">{{ rotulos.porte(porte) }}</label>
            <InputNumber
              v-model="diarias[porte]"
              :input-id="`tf-${porte}`"
              mode="currency"
              currency="BRL"
              :locale="rotulos.intl()"
              :min="0"
              :max="DIARIA_MAX_CENTAVOS / 100"
              :invalid="tentou && diarias[porte] === null"
              :disabled="salvando"
            />
          </div>
        </div>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="tf-acompanhante">{{
          t('casaDoHotel.tarifa.acompanhante')
        }}</label>
        <InputNumber
          v-model="acompanhante"
          input-id="tf-acompanhante"
          :min="0"
          :max="100"
          suffix=" %"
          :invalid="tentou && acompanhante === null"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('casaDoHotel.tarifa.acompanhanteDica') }}</small>
      </section>

      <p v-if="tarifa" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('casaDoHotel.tarifa.daquiEmDiante') }}</span>
      </p>

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
        form="tarifa-da-casa"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
