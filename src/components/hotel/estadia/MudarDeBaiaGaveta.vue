<script setup lang="ts">
/**
 * Mudar o hóspede de baia (E7-04b, guia e7 41): a nova acomodação (livre no resto da estadia) e o
 * motivo. A reserva guarda uma baia só, e a grade mostra a nova para a estadia inteira; o orçamento
 * nunca é recalculado. Baia de outra tarifa dá `BAIA_DE_OUTRA_TARIFA`: quem vê dinheiro pode manter o
 * orçamento (cortesia). O responsável é avisado pelo app depois da mudança.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  MOTIVO_DA_BAIA_MAX,
  MOTIVO_DA_BAIA_MIN,
  mudarDeBaia,
} from '@/service/parceiro/hotel-estadia-service'
import {
  lerMapa,
  type ReservaDetalhe,
  type VagaDoMapa,
} from '@/service/parceiro/hotel-reservas-service'

const props = defineProps<{ reserva: ReservaDetalhe }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ feito: [recado: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const veDinheiro = computed(() => store.temPermissao('hotel.valores'))

const vagas = ref<VagaDoMapa[]>([])
const acomodacaoId = ref<string | null>(null)
const motivo = ref('')
const manter = ref(false)
const outraTarifa = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

watch(aberta, async (agora) => {
  if (!agora) return
  acomodacaoId.value = null
  motivo.value = ''
  manter.value = false
  outraTarifa.value = false
  tentou.value = false
  erro.value = ''
  const hoje = iso(new Date())
  const saida = props.reserva.saidaPrevista.slice(0, 10)
  try {
    vagas.value = (
      await lerMapa(
        {
          entradaData: hoje,
          saidaData: saida > hoje ? saida : iso(new Date(Date.now() + 86_400_000)),
          pacienteId: props.reserva.pacienteId,
          ocupantes: props.reserva.acompanhantePacienteId ? 2 : 1,
        },
        parceiroQuery(),
      )
    ).vagas
  } catch {
    vagas.value = []
  }
})

const opcoes = computed(() =>
  vagas.value
    .filter((v) => v.acomodacaoId !== props.reserva.acomodacaoId)
    .map((v) => ({
      valor: v.acomodacaoId,
      rotulo: v.impedimentos.length
        ? `${v.nome} · ${v.impedimentos.map(rotulos.impedimento).join(', ')}`
        : v.nome,
      impedida: v.impedimentos.length > 0,
    })),
)

const motivoValido = computed(() => {
  const n = motivo.value.trim().length
  return n >= MOTIVO_DA_BAIA_MIN && n <= MOTIVO_DA_BAIA_MAX
})

async function mudar() {
  tentou.value = true
  erro.value = ''
  if (!acomodacaoId.value || !motivoValido.value) return
  salvando.value = true
  try {
    const feita = await mudarDeBaia(
      props.reserva.id,
      {
        acomodacaoId: acomodacaoId.value,
        motivo: motivo.value.trim(),
        versao: props.reserva.versao,
        ...(manter.value ? { manterOrcamento: true } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('feito', t('estadiaDoHotel.baia.feito', { nome: feita.acomodacaoNome }))
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.mensagem
    if (lido.codigo === 'BAIA_DE_OUTRA_TARIFA') outraTarifa.value = true
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('estadiaDoHotel.baia.titulo')"
    icone="ph ph-arrows-left-right"
  >
    <form id="mudar-de-baia" class="eg" novalidate @submit.prevent="mudar">
      <p class="eg__dica">
        {{ t('estadiaDoHotel.baia.dica', { atual: reserva.acomodacao.nome }) }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="mb-baia">{{ t('estadiaDoHotel.baia.para') }}</label>
        <Select
          v-model="acomodacaoId"
          input-id="mb-baia"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          option-disabled="impedida"
          :invalid="tentou && !acomodacaoId"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="mb-motivo">{{ t('estadiaDoHotel.baia.motivo') }}</label>
        <Textarea
          id="mb-motivo"
          v-model="motivo"
          rows="2"
          auto-resize
          :maxlength="MOTIVO_DA_BAIA_MAX"
          :invalid="tentou && !motivoValido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('reservasDoHotel.motivoMinimo', { min: MOTIVO_DA_BAIA_MIN })
        }}</small>
      </section>
      <label v-if="outraTarifa && veDinheiro" class="mb__chave">
        <Checkbox v-model="manter" binary :disabled="salvando" />
        <span>{{ t('estadiaDoHotel.baia.manter') }}</span>
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
        form="mudar-de-baia"
        icon="ph ph-arrows-left-right"
        :label="t('estadiaDoHotel.baia.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.mb__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
