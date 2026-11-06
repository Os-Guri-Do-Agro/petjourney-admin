<script setup lang="ts">
/**
 * Anular um documento emitido (E4-06a, guia e4 8.2). O motivo fica no documento; o PDF deixa de
 * abrir e a verificação pública diz "anulado", sem o motivo. Documento de outro veterinário pede a
 * confirmação. Exige o CRMV conferido.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa } from '@/composables/useSeloDeAssinatura'
import {
  anularDocumento,
  MOTIVO_DE_ANULAR_MAX,
  MOTIVO_DE_ANULAR_MIN,
  type Documento,
} from '@/service/parceiro/documentos-service'

const props = defineProps<{ documento: Documento | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ anulado: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const motivo = ref('')
const confirmarOutro = ref(false)
const pedirConfirmacao = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = ''
  confirmarOutro.value = false
  pedirConfirmacao.value = false
  tentou.value = false
  erro.value = ''
})

const valido = computed(() => motivo.value.trim().length >= MOTIVO_DE_ANULAR_MIN)

async function anular() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || !props.documento) return
  if (pedirConfirmacao.value && !confirmarOutro.value) {
    erro.value = t('documentos.anular.confirmeOutro')
    return
  }
  salvando.value = true
  try {
    await anularDocumento(
      props.documento.id,
      {
        motivo: motivo.value.trim(),
        ...(confirmarOutro.value ? { confirmarOutroResponsavel: true } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('anulado')
  } catch (err) {
    const recusa = motivoDaRecusa(err)
    if (recusa) {
      erro.value = t(`documentos.selo.${recusa}`)
      return
    }
    const lido = lerErroDoCadastro(err, t('documentos.anular.erro'))
    if (lido.codigo === 'ATENDIMENTO_DE_OUTRO_PROFISSIONAL') {
      pedirConfirmacao.value = true
      erro.value = t('documentos.anular.confirmeOutro')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('documentos.anular.titulo')"
    icone="ph ph-prohibit"
  >
    <form id="anular-documento" class="eg" novalidate @submit.prevent="anular">
      <p class="eg__dica">{{ t('documentos.anular.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ad-motivo">{{ t('atendimento.anular.motivo') }}</label>
        <Textarea
          id="ad-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_DE_ANULAR_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('atendimento.anular.motivoDica', { min: MOTIVO_DE_ANULAR_MIN })
        }}</small>
      </section>
      <label v-if="pedirConfirmacao" class="adoc__confirmar" for="adoc-outro">
        <Checkbox v-model="confirmarOutro" input-id="adoc-outro" binary :disabled="salvando" />
        <span>{{ t('documentos.anular.outroResponsavel') }}</span>
      </label>
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
        :label="t('cadastro.voltar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="anular-documento"
        severity="danger"
        icon="ph ph-prohibit"
        :label="t('documentos.anular.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.adoc__confirmar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
</style>
