<script setup lang="ts">
/**
 * Anular uma aplicação (E4-04, guia e4 3.5): nada se apaga, a dose fica riscada no histórico e a
 * anterior daquela vacina volta a cobrar. No app, a vacina e o lembrete saem e o responsável é
 * avisado. O horário da próxima dose fica na agenda: depois de anular, a tela oferece abri-lo.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  anularAplicacao,
  MOTIVO_DA_ANULACAO_MAX,
  MOTIVO_DA_ANULACAO_MIN,
  type Aplicacao,
} from '@/service/parceiro/vacinacao-service'

const props = defineProps<{ aplicacao: Aplicacao | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ anulada: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const motivo = ref('')
const salvando = ref(false)
const tentou = ref(false)
const erro = ref('')
/** Anulada agora, com o horário da próxima dose ainda na agenda. */
const horarioQueFicou = ref<{ id: string; dia: string } | null>(null)

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = ''
  tentou.value = false
  erro.value = ''
  horarioQueFicou.value = null
})

const valido = computed(() => motivo.value.trim().length >= MOTIVO_DA_ANULACAO_MIN)

async function anular() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || !props.aplicacao) return
  salvando.value = true
  try {
    const anulada = await anularAplicacao(props.aplicacao.id, motivo.value.trim(), parceiroQuery())
    emit('anulada')
    const proxima = anulada.agendamentoProxima
    if (proxima && proxima.status !== 'CANCELADO') {
      horarioQueFicou.value = { id: proxima.id, dia: proxima.inicio.slice(0, 10) }
    } else {
      aberta.value = false
    }
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value =
      lido.codigo === 'APLICACAO_ALTERADA'
        ? t('vacinas.anular.alterada')
        : lido.codigo === 'APLICACAO_JA_ANULADA'
          ? t('vacinas.anular.jaAnulada')
          : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('vacinas.anular.titulo')"
    icone="ph ph-prohibit"
  >
    <div v-if="horarioQueFicou" class="eg">
      <p class="eg__dica">{{ t('vacinas.anular.feita') }}</p>
      <p class="eg__dica">{{ t('vacinas.anular.horarioFicou') }}</p>
      <RouterLink
        class="p-button p-component p-button-secondary p-button-outlined"
        :to="{
          path: '/clinica/agenda',
          query: { data: horarioQueFicou.dia, horario: horarioQueFicou.id },
        }"
      >
        {{ t('vacinas.anular.abrirHorario') }}
      </RouterLink>
    </div>

    <form v-else id="anular-aplicacao" class="eg" novalidate @submit.prevent="anular">
      <p class="eg__dica">{{ t('vacinas.anular.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="anular-motivo">{{ t('vacinas.anular.motivo') }}</label>
        <Textarea
          id="anular-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_DA_ANULACAO_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('vacinas.anular.motivoDica', { min: MOTIVO_DA_ANULACAO_MIN })
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
        :label="horarioQueFicou ? t('vacinas.anular.fechar') : t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        v-if="!horarioQueFicou"
        type="submit"
        form="anular-aplicacao"
        severity="danger"
        icon="ph ph-prohibit"
        :label="t('vacinas.anular.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
