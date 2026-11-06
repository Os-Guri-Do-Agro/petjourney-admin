<script setup lang="ts">
/**
 * Registrar uma dose que não é o "dei" de um toque (E5-02b, guia e5 14.3):
 *
 * - **Pulei** e **recusou** são coisas diferentes (o gato que cospe não é a dose que ninguém deu):
 *   o motivo é obrigatório, e "outro" pede a observação. Na bomba de fluido, "pulei" pede só a
 *   observação.
 * - A dose **adiantada** (mais de 30 min antes) volta com 409 e pede a confirmação e a observação.
 * - A dose **dobrada** (a anterior do mesmo fármaco há menos de meio intervalo) pede a confirmação
 *   com a hora da anterior.
 * - "Mais cedo" registra depois do fato, até 12 h para trás.
 *
 * Quem deu vem do login. O duplo toque leva a mesma Idempotency-Key.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import { instanteComOffset } from '@/service/parceiro/internacao-service'
import {
  MOTIVOS_DA_NAO_DADA,
  OBSERVACAO_DA_DOSE_MAX,
  registrarDose,
  type DoseRegistrada,
  type MotivoDaNaoDada,
  type Registro,
} from '@/service/parceiro/plantao-da-internacao-service'

export type PedidoDeRegistro = {
  doseId: string
  titulo: string
  previstaPara: string
  conferencia: boolean
  status: Registro['status']
  /** O 409 que trouxe a gaveta (a dose adiantada ou dobrada), com os detalhes dele. */
  confirmar?: {
    codigo: 'DOSE_FORA_DA_JANELA' | 'INTERVALO_CURTO_ENTRE_DOSES'
    detalhes: Record<string, unknown>
  }
}

const props = defineProps<{ pedido: PedidoDeRegistro | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrada: [dose: DoseRegistrada] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const AGORA = 'AGORA'
const MAIS_CEDO = 'MAIS_CEDO'

const motivo = ref<MotivoDaNaoDada | null>(null)
const observacao = ref('')
const quando = ref<typeof AGORA | typeof MAIS_CEDO>(AGORA)
const executadaEm = ref<Date | null>(null)
const antecipada = ref(false)
const intervalo = ref<{ outraEm: string } | null>(null)
const confirmo = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const pedido = props.pedido
  motivo.value = null
  observacao.value = ''
  quando.value = AGORA
  executadaEm.value = null
  antecipada.value = pedido?.confirmar?.codigo === 'DOSE_FORA_DA_JANELA'
  intervalo.value =
    pedido?.confirmar?.codigo === 'INTERVALO_CURTO_ENTRE_DOSES'
      ? { outraEm: String(pedido.confirmar.detalhes.outraEm ?? '') }
      : null
  confirmo.value = false
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const naoDada = computed(() => props.pedido?.status !== 'FEITA')
/** Pulei e recusou pedem motivo, menos na bomba de fluido (só a observação). */
const pedeMotivo = computed(() => naoDada.value && !props.pedido?.conferencia)
const pedeObservacao = computed(
  () =>
    antecipada.value ||
    motivo.value === 'OUTRO' ||
    (naoDada.value && Boolean(props.pedido?.conferencia)),
)

const opcoesDeMotivo = computed(() =>
  MOTIVOS_DA_NAO_DADA.map((valor) => ({ valor, rotulo: t(`internacao.dose.motivo.${valor}`) })),
)
const opcoesDeQuando = computed(() => [
  { valor: AGORA, rotulo: t('internacao.internar.agora') },
  { valor: MAIS_CEDO, rotulo: t('internacao.internar.maisCedo') },
])

const dozeHorasAtras = () => new Date(Date.now() - 12 * 3600 * 1000)
const agora = () => new Date()

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

const textoDoAviso = computed(() => {
  if (antecipada.value) return t('internacao.dose.antecipada')
  if (intervalo.value?.outraEm)
    return t('internacao.dose.intervalo', { hora: hora(intervalo.value.outraEm) })
  return ''
})

const valido = computed(
  () =>
    (!pedeMotivo.value || Boolean(motivo.value)) &&
    (!pedeObservacao.value || observacao.value.trim().length > 0) &&
    (quando.value === AGORA || Boolean(executadaEm.value)) &&
    (!textoDoAviso.value || confirmo.value),
)

async function registrar() {
  tentou.value = true
  erro.value = ''
  const pedido = props.pedido
  if (!pedido || !valido.value) return
  const corpo: Registro = {
    status: pedido.status,
    ...(pedeMotivo.value && motivo.value ? { motivo: motivo.value } : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
    ...(quando.value === MAIS_CEDO && executadaEm.value
      ? { executadaEm: instanteComOffset(executadaEm.value) }
      : {}),
    ...(antecipada.value && confirmo.value ? { confirmarAntecipada: true } : {}),
    ...(intervalo.value && confirmo.value ? { confirmarIntervalo: true } : {}),
  }
  salvando.value = true
  try {
    const feita = await registrarDose(pedido.doseId, corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('registrada', feita)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('internacao.dose.erro'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'DOSE_FORA_DA_JANELA') {
      antecipada.value = true
      confirmo.value = false
      return
    }
    if (lido.codigo === 'INTERVALO_CURTO_ENTRE_DOSES') {
      intervalo.value = { outraEm: String(detalhes.outraEm ?? '') }
      confirmo.value = false
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

const rotuloDoConfirmar = computed(() => {
  const pedido = props.pedido
  if (!pedido) return ''
  if (pedido.status === 'FEITA')
    return pedido.conferencia ? t('internacao.dose.conferi') : t('internacao.dose.dei')
  return pedido.status === 'RECUSADA' ? t('internacao.dose.recusou') : t('internacao.dose.pulei')
})
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="pedido?.titulo ?? ''" icone="ph ph-syringe">
    <form id="registrar-dose" class="eg" novalidate @submit.prevent="registrar">
      <p v-if="pedido" class="eg__dica">
        {{ t('internacao.dose.prevista', { hora: hora(pedido.previstaPara) }) }}
      </p>

      <section v-if="textoDoAviso" class="eg__secao rd__confirmar">
        <p class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ textoDoAviso }}</span>
        </p>
        <label class="rd__marcar" for="rd-confirmo">
          <Checkbox v-model="confirmo" input-id="rd-confirmo" binary :disabled="salvando" />
          <span>{{ t('internacao.dose.confirmo') }}</span>
        </label>
      </section>

      <section v-if="pedeMotivo" class="eg__secao">
        <label class="eg__rotulo" for="rd-motivo">{{ t('internacao.dose.porque') }}</label>
        <Select
          v-model="motivo"
          input-id="rd-motivo"
          :options="opcoesDeMotivo"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !motivo"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="rd-observacao">
          {{ t('internacao.dose.observacao') }}
          <span v-if="!pedeObservacao" class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="rd-observacao"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="OBSERVACAO_DA_DOSE_MAX"
          :invalid="tentou && pedeObservacao && !observacao.trim()"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="rd-quando" class="eg__rotulo">{{ t('internacao.dose.quando') }}</span>
        <SelectButton
          v-model="quando"
          :options="opcoesDeQuando"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="rd-quando"
          :disabled="salvando"
        />
        <DatePicker
          v-if="quando === MAIS_CEDO"
          v-model="executadaEm"
          inline
          show-time
          hour-format="24"
          :step-minute="5"
          :min-date="dozeHorasAtras()"
          :max-date="agora()"
          aria-labelledby="rd-quando"
          :invalid="tentou && !executadaEm"
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
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="registrar-dose"
        icon="ph ph-check"
        :label="rotuloDoConfirmar"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rd__confirmar {
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  background: color-mix(in oklab, var(--atencao-fundo) 45%, transparent);
}

.rd__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
