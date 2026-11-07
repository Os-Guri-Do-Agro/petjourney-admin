<script setup lang="ts">
/**
 * Uma ação que só pede o porquê (E7-02b, guia e7 30): anular o comprovante errado (10 a 300) ou
 * dispensar uma exigência para um animal. A gaveta escreve o motivo e chama a ação que recebeu; a
 * mensagem da API, se recusar, fica aqui dentro.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'

const props = withDefaults(
  defineProps<{
    titulo: string
    icone: string
    dica: string
    rotulo: string
    confirmar: string
    acao: (motivo: string) => Promise<unknown>
    min?: number
    max?: number
  }>(),
  { min: 1, max: 300 },
)
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ feito: [] }>()

const { t } = useI18n()

const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = ''
  tentou.value = false
  erro.value = ''
})

const valido = computed(() => {
  const n = motivo.value.trim().length
  return n >= props.min && n <= props.max
})

async function enviar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    await props.acao(motivo.value.trim())
    aberta.value = false
    emit('feito')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="titulo" :icone="icone">
    <form id="motivo-da-reserva" class="eg" novalidate @submit.prevent="enviar">
      <p class="eg__dica">{{ dica }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="mo-motivo">{{ rotulo }}</label>
        <Textarea
          id="mo-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="max"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small v-if="min > 1" class="eg__dica">{{
          t('reservasDoHotel.motivoMinimo', { min })
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
        form="motivo-da-reserva"
        :icon="icone"
        :label="confirmar"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
