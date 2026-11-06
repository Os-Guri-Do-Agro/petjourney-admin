<script setup lang="ts">
/**
 * "Já falei com a família" (E4-05b, guia e4 7b.1): a nota interna do contato apaga o alerta até a
 * próxima dose que faltar. Nunca vai ao app do responsável.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { NOTA_MAX, registrarContato } from '@/service/parceiro/adesao-service'

const props = defineProps<{ tratamento: { tratamentoId: string; medicamento: string } | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrado: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const nota = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  nota.value = ''
  tentou.value = false
  erro.value = ''
})

const valida = computed(() => nota.value.trim().length > 0)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valida.value || !props.tratamento) return
  salvando.value = true
  try {
    await registrarContato(props.tratamento.tratamentoId, nota.value.trim(), parceiroQuery())
    aberta.value = false
    emit('registrado')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('adesao.contato.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('clinico.adesao.alerta.registrarContato')"
    icone="ph ph-phone-call"
  >
    <form id="contato-adesao" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">
        {{ t('adesao.contato.dica', { remedio: tratamento?.medicamento ?? '' }) }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ca-nota">{{ t('clinico.adesao.alerta.nota') }}</label>
        <Textarea
          id="ca-nota"
          v-model="nota"
          rows="3"
          auto-resize
          :maxlength="NOTA_MAX"
          :placeholder="t('clinico.adesao.alerta.notaPlaceholder')"
          :invalid="tentou && !valida"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('adesao.contato.soNaClinica') }}</small>
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
        form="contato-adesao"
        icon="ph ph-check"
        :label="t('clinico.adesao.alerta.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
