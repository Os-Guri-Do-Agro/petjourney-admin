<script setup lang="ts">
/**
 * Um adendo ao atendimento finalizado (E4-01, guia e4 5.5). Interno por padrão; "para o
 * responsável" pede também `resumo.liberar`, vai até 2000 caracteres e republica o resumo já
 * liberado (no app, depois das orientações, com a data). É assim que se corrige uma orientação
 * depois de finalizar.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa } from '@/composables/useSeloDeAssinatura'
import {
  ADENDO_PARA_O_RESPONSAVEL_MAX,
  criarAdendo,
  type Adendo,
} from '@/service/parceiro/atendimentos-service'

const props = defineProps<{ atendimentoId: string; podeParaOResponsavel: boolean }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ criado: [adendo: Adendo] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const texto = ref('')
const paraOResponsavel = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  texto.value = ''
  paraOResponsavel.value = false
  tentou.value = false
  erro.value = ''
})

/* Só o adendo para o responsável tem teto no guia (2000); o interno, o servidor confere. */
const maximo = computed(() => (paraOResponsavel.value ? ADENDO_PARA_O_RESPONSAVEL_MAX : undefined))
const valido = computed(() => {
  const limpo = texto.value.trim()
  return limpo.length > 0 && (!maximo.value || limpo.length <= maximo.value)
})

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    const adendo = await criarAdendo(
      props.atendimentoId,
      { texto: texto.value.trim(), paraOResponsavel: paraOResponsavel.value },
      parceiroQuery(),
    )
    aberta.value = false
    emit('criado', adendo)
  } catch (err) {
    const motivo = motivoDaRecusa(err)
    erro.value = motivo
      ? t(`atendimento.selo.${motivo}`)
      : lerErroDoCadastro(err, t('atendimento.adendo.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.adendo.titulo')"
    icone="ph ph-note"
  >
    <form id="adendo-atendimento" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('atendimento.adendo.dica') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ad-texto">{{ t('atendimento.adendo.texto') }}</label>
        <Textarea
          id="ad-texto"
          v-model="texto"
          rows="5"
          auto-resize
          :maxlength="maximo"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small v-if="maximo" class="eg__dica ui-num"
          >{{ texto.trim().length }} / {{ maximo }}</small
        >
      </section>

      <label v-if="podeParaOResponsavel" class="ad__para" for="ad-para">
        <ToggleSwitch v-model="paraOResponsavel" input-id="ad-para" :disabled="salvando" />
        <span>
          <strong>{{ t('atendimento.adendo.paraOResponsavel') }}</strong>
          <small>{{ t('atendimento.adendo.paraOResponsavelDica') }}</small>
        </span>
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
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="adendo-atendimento"
        icon="ph ph-check"
        :label="t('atendimento.adendo.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ad__para {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.ad__para span {
  display: grid;
  gap: 2px;
}

.ad__para strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ad__para small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}
</style>
