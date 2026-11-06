<script setup lang="ts">
/**
 * A previsão de alta (E5-01, guia e5 4): o dia e a hora, depois de agora e até 60 dias da
 * entrada; "sem previsão" limpa (`null`). Vencida, ela acende a urgência no mapa.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  instanteComOffset,
  mudarPrevisaoDeAlta,
  type Internacao,
} from '@/service/parceiro/internacao-service'

const props = defineProps<{ internacao: Internacao | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ mudou: [internacao: Internacao] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const quando = ref<Date | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const atual = props.internacao?.altaPrevistaEm
  quando.value = atual ? new Date(atual) : null
  tentou.value = false
  erro.value = ''
})

const agora = () => new Date()
const limite = computed(() => {
  const entrada = props.internacao ? new Date(props.internacao.entradaEm) : new Date()
  return new Date(entrada.getTime() + 60 * 24 * 3600 * 1000)
})

async function gravar(valor: Date | null) {
  if (!props.internacao) return
  tentou.value = true
  erro.value = ''
  salvando.value = true
  try {
    const mudada = await mudarPrevisaoDeAlta(
      props.internacao.id,
      valor ? instanteComOffset(valor) : null,
      parceiroQuery(),
    )
    aberta.value = false
    emit('mudou', mudada)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

function salvar() {
  tentou.value = true
  if (!quando.value) return
  void gravar(quando.value)
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.previsao')"
    icone="ph ph-calendar-check"
    largura="34rem"
  >
    <form id="previsao-form" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('internacao.previsaoDica') }}</p>
      <section class="eg__secao">
        <DatePicker
          v-model="quando"
          inline
          show-time
          hour-format="24"
          :step-minute="15"
          :min-date="agora()"
          :max-date="limite"
          :aria-label="t('internacao.previsao')"
          :invalid="tentou && !quando"
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
        v-if="internacao?.altaPrevistaEm"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-x"
        :label="t('internacao.semPrevisao')"
        :disabled="salvando"
        @click="gravar(null)"
      />
      <Button
        type="submit"
        form="previsao-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
