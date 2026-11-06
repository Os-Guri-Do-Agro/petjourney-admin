<script setup lang="ts">
/**
 * Cancelar a receita assinada (E4-03, guia e4 6.3). O motivo fica na receita, com quem e quando.
 * O PDF deixa de abrir, na clínica e no app; nada do app é apagado sozinho (P6). Receita que outro
 * veterinário assinou pede a confirmação. Exige o CRMV conferido.
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
  cancelarReceita,
  MOTIVO_DO_CANCELAMENTO_MAX,
  MOTIVO_DO_CANCELAMENTO_MIN,
  type Receita,
} from '@/service/parceiro/receitas-service'

const props = defineProps<{ receita: Receita | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ cancelada: [receita: Receita] }>()

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

const valido = computed(() => motivo.value.trim().length >= MOTIVO_DO_CANCELAMENTO_MIN)

async function cancelar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || !props.receita) return
  if (pedirConfirmacao.value && !confirmarOutro.value) {
    erro.value = t('atendimento.receita.cancelar.confirmeOutro')
    return
  }
  salvando.value = true
  try {
    const cancelada = await cancelarReceita(
      props.receita.id,
      {
        motivo: motivo.value.trim(),
        ...(confirmarOutro.value ? { confirmarOutroResponsavel: true } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('cancelada', cancelada)
  } catch (err) {
    const recusa = motivoDaRecusa(err)
    if (recusa) {
      erro.value = t(`settings.identidade.selo.${recusa}`)
      return
    }
    const lido = lerErroDoCadastro(err, t('atendimento.receita.cancelar.erro'))
    if (lido.codigo === 'ATENDIMENTO_DE_OUTRO_PROFISSIONAL') {
      pedirConfirmacao.value = true
      erro.value = t('atendimento.receita.cancelar.confirmeOutro')
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
    :titulo="t('atendimento.receita.cancelar.titulo')"
    icone="ph ph-prohibit"
  >
    <form id="cancelar-receita" class="eg" novalidate @submit.prevent="cancelar">
      <p class="eg__dica">{{ t('atendimento.receita.cancelar.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="cr-motivo">{{ t('atendimento.anular.motivo') }}</label>
        <Textarea
          id="cr-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_DO_CANCELAMENTO_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('atendimento.anular.motivoDica', { min: MOTIVO_DO_CANCELAMENTO_MIN })
        }}</small>
      </section>
      <label v-if="pedirConfirmacao" class="cr__confirmar" for="cr-outro">
        <Checkbox v-model="confirmarOutro" input-id="cr-outro" binary :disabled="salvando" />
        <span>{{ t('atendimento.receita.cancelar.outroResponsavel') }}</span>
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
        form="cancelar-receita"
        severity="danger"
        icon="ph ph-prohibit"
        :label="t('atendimento.receita.cancelar.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.cr__confirmar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
</style>
