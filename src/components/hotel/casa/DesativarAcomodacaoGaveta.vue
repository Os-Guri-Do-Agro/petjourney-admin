<script setup lang="ts">
/**
 * Tirar uma acomodação de operação (E7-01, guia e7 5): o motivo é obrigatório e o "outro motivo"
 * pede o detalhe. Quem tem `hotel.rotina` desativa (a baia quebrada às 3 da manhã); reativar e
 * apagar são de quem edita a casa. Hospedada agora (`ACOMODACAO_OCUPADA`) ou com reserva por
 * chegar (`ACOMODACAO_COM_RESERVAS`): a mensagem da API diz o que fazer antes.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  desativarAcomodacao,
  MOTIVOS_DE_INATIVA,
  type AcomodacaoDaCasa,
  type MotivoDeInativa,
} from '@/service/parceiro/hotel-casa-service'

import { useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{ acomodacao: AcomodacaoDaCasa | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ desativada: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()

const motivo = ref<MotivoDeInativa | null>(null)
const detalhe = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = null
  detalhe.value = ''
  tentou.value = false
  erro.value = ''
})

const opcoes = computed(() =>
  MOTIVOS_DE_INATIVA.map((valor) => ({ valor, rotulo: rotulos.motivo(valor) })),
)

const valido = computed(
  () => Boolean(motivo.value) && (motivo.value !== 'OUTRO' || detalhe.value.trim().length > 0),
)

async function desativar() {
  tentou.value = true
  erro.value = ''
  if (!props.acomodacao || !valido.value) return
  salvando.value = true
  try {
    await desativarAcomodacao(
      props.acomodacao.id,
      {
        motivo: motivo.value!,
        ...(detalhe.value.trim() ? { detalhe: detalhe.value.trim() } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('desativada')
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
    :titulo="acomodacao ? t('casaDoHotel.desativar.titulo', { nome: acomodacao.nome }) : ''"
    icone="ph ph-wrench"
  >
    <form id="desativar-acomodacao" class="eg" novalidate @submit.prevent="desativar">
      <p class="eg__dica">{{ t('casaDoHotel.desativar.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="de-motivo">{{ t('casaDoHotel.desativar.motivo') }}</label>
        <Select
          v-model="motivo"
          input-id="de-motivo"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !motivo"
          :disabled="salvando"
        />
      </section>
      <section v-if="motivo" class="eg__secao">
        <label class="eg__rotulo" for="de-detalhe">
          {{ t('casaDoHotel.desativar.detalhe') }}
          <span v-if="motivo !== 'OUTRO'" class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="de-detalhe"
          v-model="detalhe"
          rows="2"
          auto-resize
          :invalid="tentou && motivo === 'OUTRO' && !detalhe.trim()"
          :disabled="salvando"
        />
        <small v-if="motivo === 'OUTRO'" class="eg__dica">{{
          t('casaDoHotel.desativar.detalheDica')
        }}</small>
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
        form="desativar-acomodacao"
        icon="ph ph-wrench"
        :label="t('casaDoHotel.desativar.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
