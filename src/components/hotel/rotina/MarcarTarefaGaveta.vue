<script setup lang="ts">
/**
 * Registrar uma tarefa da prancheta que não é o "Feito" de um toque (E7-05a, guia e7 42):
 *
 * - **Não feito**: recusou ou pulou, com o motivo obrigatório; "Outro" pede a observação.
 * - **Antes da hora** (409 `TAREFA_FORA_DA_JANELA`): "Foi feito antes da hora?" e manda de novo com
 *   `confirmarAntecipada`. Medicação antes da hora, mesmo 5 min, sempre pede.
 * - **Dose perto da anterior** (409 `TAREFA_INTERVALO_CURTO`): "A dose anterior foi às HH:mm.
 *   Confirmar mesmo assim?" e `confirmarIntervalo`.
 * - **Mais cedo**: o horário em que foi feito, até 12 h para trás.
 *
 * Quem fez vem da sessão e da ficha. O duplo toque leva a mesma Idempotency-Key.
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
  marcarTarefa,
  MOTIVOS_DA_TAREFA,
  OBSERVACAO_DA_TAREFA_MAX,
  type Marcacao,
  type MotivoDaTarefa,
  type TarefaDaPrancheta,
} from '@/service/parceiro/hotel-rotina-service'

export type PedidoDeMarcacao = {
  tarefa: TarefaDaPrancheta
  status: Marcacao['status']
  /** O 409 que trouxe a gaveta (antes da hora ou dose perto da anterior), com os detalhes. */
  confirmar?: {
    codigo: 'TAREFA_FORA_DA_JANELA' | 'TAREFA_INTERVALO_CURTO'
    detalhes: Record<string, unknown>
  }
}

const props = defineProps<{ pedido: PedidoDeMarcacao | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ marcada: []; recado: [texto: string, recarregar: boolean] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const AGORA = 'AGORA'
const MAIS_CEDO = 'MAIS_CEDO'

const status = ref<Marcacao['status']>('FEITA')
const motivo = ref<MotivoDaTarefa | null>(null)
const observacao = ref('')
const quando = ref<typeof AGORA | typeof MAIS_CEDO>(AGORA)
const executadaEm = ref<Date | null>(null)
const antecipada = ref(false)
const ultimaEm = ref('')
const confirmo = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const pedido = props.pedido
  status.value = pedido?.status ?? 'FEITA'
  motivo.value = null
  observacao.value = ''
  quando.value = AGORA
  executadaEm.value = null
  antecipada.value = pedido?.confirmar?.codigo === 'TAREFA_FORA_DA_JANELA'
  ultimaEm.value =
    pedido?.confirmar?.codigo === 'TAREFA_INTERVALO_CURTO'
      ? String(pedido.confirmar.detalhes.ultimaEm ?? '')
      : ''
  confirmo.value = false
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const naoFeita = computed(() => status.value !== 'FEITA')
const pedeObservacao = computed(() => naoFeita.value && motivo.value === 'OUTRO')

const opcoesDeStatus = computed(() => [
  { valor: 'RECUSADA', rotulo: t('rotinaDoHotel.tarefa.recusou') },
  { valor: 'PULADA', rotulo: t('rotinaDoHotel.tarefa.pulou') },
])
const opcoesDeMotivo = computed(() =>
  MOTIVOS_DA_TAREFA.map((valor) => ({ valor, rotulo: t(`rotinaDoHotel.motivo.${valor}`) })),
)
const opcoesDeQuando = computed(() => [
  { valor: AGORA, rotulo: t('rotinaDoHotel.tarefa.agora') },
  { valor: MAIS_CEDO, rotulo: t('rotinaDoHotel.tarefa.maisCedo') },
])

const dozeHorasAtras = () => new Date(Date.now() - 12 * 3600 * 1000)
const agora = () => new Date()

/** A hora da parede da casa, como a API escreveu (sem converter fuso). */
const hora = (iso: string) => iso.slice(11, 16)

const textoDoAviso = computed(() => {
  if (antecipada.value) return t('rotinaDoHotel.tarefa.antecipada')
  if (ultimaEm.value) return t('rotinaDoHotel.tarefa.intervalo', { hora: hora(ultimaEm.value) })
  return ''
})

const valido = computed(
  () =>
    (!naoFeita.value || Boolean(motivo.value)) &&
    (!pedeObservacao.value || observacao.value.trim().length > 0) &&
    (quando.value === AGORA || Boolean(executadaEm.value)) &&
    (!textoDoAviso.value || confirmo.value),
)

const titulo = computed(() => {
  const tarefa = props.pedido?.tarefa
  return tarefa ? `${t(`rotinaDoHotel.kind.${tarefa.kind}`)} · ${tarefa.pacienteNome}` : ''
})

async function registrar() {
  tentou.value = true
  erro.value = ''
  const pedido = props.pedido
  if (!pedido || !valido.value) return
  const corpo: Marcacao = {
    status: status.value,
    ...(naoFeita.value && motivo.value ? { motivo: motivo.value } : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
    ...(quando.value === MAIS_CEDO && executadaEm.value
      ? { executadaEm: instanteComOffset(executadaEm.value) }
      : {}),
    ...(antecipada.value && confirmo.value ? { confirmarAntecipada: true } : {}),
    ...(ultimaEm.value && confirmo.value ? { confirmarIntervalo: true } : {}),
  }
  salvando.value = true
  try {
    await marcarTarefa(pedido.tarefa.id, corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('marcada')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.tarefa.erro'))
    const detalhes = err instanceof ApiError ? err.detalhes : {}
    if (lido.codigo === 'TAREFA_FORA_DA_JANELA') {
      antecipada.value = true
      confirmo.value = false
      return
    }
    if (lido.codigo === 'TAREFA_INTERVALO_CURTO') {
      ultimaEm.value = String(detalhes.ultimaEm ?? '')
      confirmo.value = false
      return
    }
    if (lido.codigo === 'TAREFA_JA_REGISTRADA') {
      aberta.value = false
      emit(
        'recado',
        t('rotinaDoHotel.tarefa.jaRegistrada', {
          nome: String(detalhes.porNome ?? ''),
          hora: hora(String(detalhes.em ?? '')),
        }),
        true,
      )
      return
    }
    if (lido.codigo === 'TAREFA_ANIMAL_INTERNADO') {
      aberta.value = false
      emit('recado', t('rotinaDoHotel.tarefa.internado'), true)
      return
    }
    erro.value =
      lido.codigo === 'PROFISSIONAL_OBRIGATORIO' ? t('rotinaDoHotel.semFicha') : lido.mensagem
  } finally {
    salvando.value = false
  }
}

const rotuloDoConfirmar = computed(() => {
  if (status.value === 'FEITA') return t('rotinaDoHotel.tarefa.feito')
  return status.value === 'RECUSADA'
    ? t('rotinaDoHotel.tarefa.recusou')
    : t('rotinaDoHotel.tarefa.pulou')
})
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="titulo" icone="ph ph-list-checks">
    <form id="marcar-tarefa" class="eg" novalidate @submit.prevent="registrar">
      <p v-if="pedido" class="eg__dica">
        {{
          [pedido.tarefa.descricao, pedido.tarefa.acomodacaoNome, pedido.tarefa.hora]
            .filter(Boolean)
            .join(' · ')
        }}
      </p>

      <section v-if="textoDoAviso" class="eg__secao mt__confirmar">
        <p class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ textoDoAviso }}</span>
        </p>
        <label class="mt__marcar" for="mt-confirmo">
          <Checkbox v-model="confirmo" input-id="mt-confirmo" binary :disabled="salvando" />
          <span>{{ t('rotinaDoHotel.tarefa.confirmo') }}</span>
        </label>
      </section>

      <template v-if="naoFeita">
        <section class="eg__secao">
          <span id="mt-status" class="eg__rotulo">{{ t('rotinaDoHotel.tarefa.oQueHouve') }}</span>
          <SelectButton
            v-model="status"
            :options="opcoesDeStatus"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="mt-status"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="mt-motivo">{{ t('rotinaDoHotel.tarefa.porque') }}</label>
          <Select
            v-model="motivo"
            input-id="mt-motivo"
            :options="opcoesDeMotivo"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !motivo"
            :disabled="salvando"
          />
        </section>
      </template>

      <section class="eg__secao">
        <label class="eg__rotulo" for="mt-observacao">
          {{ t('rotinaDoHotel.tarefa.observacao') }}
          <span v-if="!pedeObservacao" class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="mt-observacao"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="OBSERVACAO_DA_TAREFA_MAX"
          :invalid="tentou && pedeObservacao && !observacao.trim()"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="mt-quando" class="eg__rotulo">{{ t('rotinaDoHotel.tarefa.quando') }}</span>
        <SelectButton
          v-model="quando"
          :options="opcoesDeQuando"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="mt-quando"
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
          aria-labelledby="mt-quando"
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
        form="marcar-tarefa"
        icon="ph ph-check"
        :label="rotuloDoConfirmar"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.mt__confirmar {
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  background: color-mix(in oklab, var(--atencao-fundo) 45%, transparent);
}

.mt__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
