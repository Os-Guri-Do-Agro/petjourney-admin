<script setup lang="ts">
/**
 * Anular um ato (E4-01, guia e4 5.8): nada se apaga, o ato fica na linha do tempo com a marca de
 * anulado. No rascunho basta escrever no prontuário; no registro finalizado, é preciso poder
 * finalizar.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  anularAto,
  MOTIVO_MAX,
  MOTIVO_MIN,
  type Ato,
} from '@/service/parceiro/atendimentos-service'

const props = defineProps<{ ato: { id: string; descricao: string } | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ anulado: [ato: Ato] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

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

const valido = computed(() => motivo.value.trim().length >= MOTIVO_MIN)

async function anular() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || !props.ato) return
  salvando.value = true
  try {
    const ato = await anularAto(props.ato.id, motivo.value.trim(), parceiroQuery())
    aberta.value = false
    emit('anulado', ato)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('atendimento.atos.erroAnular'))
    erro.value = lido.codigo === 'ATO_JA_ANULADO' ? t('atendimento.atos.jaAnulado') : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.atos.anularTitulo')"
    icone="ph ph-prohibit"
  >
    <form id="anular-ato" class="eg" novalidate @submit.prevent="anular">
      <p class="eg__dica">{{ t('atendimento.atos.anularDica', { ato: ato?.descricao ?? '' }) }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="aat-motivo">{{ t('atendimento.anular.motivo') }}</label>
        <Textarea
          id="aat-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('atendimento.anular.motivoDica', { min: MOTIVO_MIN })
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
        form="anular-ato"
        severity="danger"
        icon="ph ph-prohibit"
        :label="t('atendimento.atos.anular')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
