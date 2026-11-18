<script setup lang="ts">
/**
 * Anular uma aplicação (E4-04, guia e4 3.5): nada se apaga, a dose fica riscada no histórico e a
 * anterior daquela vacina volta a cobrar. No app, a vacina e o lembrete saem e o responsável é
 * avisado. O horário da próxima dose fica na agenda: depois de anular, a tela oferece abri-lo.
 *
 * `corrigir` (o "Apagar e registrar de novo" da gaveta "Editar registro", N42): vacina, dose, data e
 * lote não se editam, a correção é anular e registrar a certa. A gaveta diz isso antes, e depois de
 * anular leva à ficha com a gaveta de aplicar já aberta na mesma vacina.
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

const props = defineProps<{
  aplicacao: Pick<Aplicacao, 'id'> | null
  /** Anular para registrar a certa em seguida (o "Editar registro"). */
  corrigir?: boolean
  /** Qual dose, numa linha (a vacina e o dia), para não anular a errada. */
  sobre?: string
  /** Para o "Registrar a dose certa" depois de corrigir. */
  pacienteId?: string
  vacinaId?: string
}>()
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
/** Anulada agora para corrigir: falta registrar a certa. */
const corrigida = ref(false)
const feita = computed(() => Boolean(horarioQueFicou.value) || corrigida.value)

/* Com a gaveta aberta, outro item da lista troca o conteúdo (não só o abrir). */
watch([aberta, () => props.aplicacao?.id] as const, ([agora]) => {
  if (!agora) return
  motivo.value = ''
  tentou.value = false
  erro.value = ''
  horarioQueFicou.value = null
  corrigida.value = false
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
    }
    if (props.corrigir) corrigida.value = true
    else if (!horarioQueFicou.value) aberta.value = false
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
    :titulo="corrigir ? t('vacinas.corrigir.titulo') : t('vacinas.anular.titulo')"
    :icone="corrigir ? 'ph ph-pencil-simple' : 'ph ph-prohibit'"
  >
    <div v-if="feita" class="eg">
      <p class="eg__dica">
        {{ corrigida ? t('vacinas.corrigir.feita') : t('vacinas.anular.feita') }}
      </p>
      <Button
        v-if="corrigida && pacienteId"
        :as="RouterLink"
        :to="{
          path: `/clinica/ficha/${pacienteId}`,
          query: vacinaId ? { aplicar: 'vacina', vacina: vacinaId } : { aplicar: 'vacina' },
        }"
        icon="ph ph-syringe"
        :label="t('vacinas.corrigir.registrar')"
      />
      <template v-if="horarioQueFicou">
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
      </template>
    </div>

    <form v-else id="anular-aplicacao" class="eg" novalidate @submit.prevent="anular">
      <p v-if="sobre" class="aa__sobre">{{ sobre }}</p>
      <p class="eg__dica">{{ corrigir ? t('vacinas.corrigir.dica') : t('vacinas.anular.dica') }}</p>
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
        :label="feita ? t('vacinas.anular.fechar') : t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        v-if="!feita"
        type="submit"
        form="anular-aplicacao"
        severity="danger"
        icon="ph ph-prohibit"
        :label="corrigir ? t('vacinas.corrigir.confirmar') : t('vacinas.anular.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
/* Qual dose: a vacina e o dia, em cima de tudo, para não anular a errada. */
.aa__sobre {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}
</style>
