<script setup lang="ts">
/**
 * Internar um paciente num leito livre.
 *
 * O leito já vem escolhido — o fluxo começa no mapa, clicando no lugar vazio, e não numa lista de
 * pacientes. É a ordem em que a pergunta nasce na clínica: existe vaga, e agora quem vai para ela.
 *
 * O aviso de compatibilidade é conselho, não trava. Pôr um gato num leito geral é ruim e às vezes
 * é a única opção às 3 da manhã; bloquear obrigaria a recepção a mentir na tela para registrar a
 * verdade, e um sistema em que se mente para trabalhar deixa de ser o registro de nada.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { GravidadeClinica, Leito } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  leito: Leito | null
  salvando: boolean
  /** Pacientes que já ocupam algum leito — não podem ser internados de novo. */
  jaInternados: string[]
}>()

const emit = defineEmits<{
  fechar: []
  confirmar: [
    entrada: {
      petId: string
      tutorId: string
      responsavelId: string
      motivo: string
      diagnostico: string
      gravidade: GravidadeClinica
      pesoEntradaKg: number
    },
  ]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()

const petId = ref('')
const responsavelId = ref('')
const motivo = ref('')
const diagnostico = ref('')
const gravidade = ref<GravidadeClinica>('estavel')
const pesoKg = ref<number | null>(null)

const visivel = computed({
  get: () => props.leito !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

watch(
  () => props.leito,
  () => {
    petId.value = ''
    responsavelId.value = clinico.profissionais.find((item) => item.ativo)?.id ?? ''
    motivo.value = ''
    diagnostico.value = ''
    gravidade.value = 'estavel'
    pesoKg.value = null
  },
)

const opcoesDePaciente = computed(() =>
  clinico.pets
    .filter((pet) => !props.jaInternados.includes(pet.id))
    .map((pet) => ({
      valor: pet.id,
      rotulo: `${pet.nome} — ${clinico.tutor(pet.tutorId)?.nome ?? ''}`,
    })),
)

const opcoesDeProfissional = computed(() =>
  clinico.profissionais
    .filter((profissional) => profissional.ativo)
    .map((profissional) => ({ valor: profissional.id, rotulo: profissional.nome })),
)

const opcoesDeGravidade = computed(() => [
  { valor: 'estavel' as const, rotulo: t('clinico.internacao.gravidade.estavel'), tom: 'ok' as const },
  {
    valor: 'atencao' as const,
    rotulo: t('clinico.internacao.gravidade.atencao'),
    tom: 'atencao' as const,
  },
  {
    valor: 'critico' as const,
    rotulo: t('clinico.internacao.gravidade.critico'),
    tom: 'risco' as const,
  },
])

const paciente = computed(() => (petId.value ? clinico.pet(petId.value) : null))

/* O peso do cadastro é ponto de partida, e o campo continua editável: internação começa na balança. */
watch(paciente, (valor) => {
  pesoKg.value = valor?.pesoKg ?? null
})

/**
 * Conselho de compatibilidade entre espécie e tipo de leito.
 *
 * Só o que muda desfecho: felino em leito de cão, e crítico fora da UTI havendo UTI. O resto
 * viraria ruído, e ruído é o que faz o aviso útil deixar de ser lido.
 */
const aviso = computed(() => {
  const leito = props.leito
  const pet = paciente.value

  if (!leito || !pet) {
    return ''
  }

  if (pet.especie === 'felina' && leito.kind === 'geral') {
    return t('clinico.internacao.internar.avisoFelino')
  }

  if (gravidade.value === 'critico' && leito.kind !== 'uti') {
    return t('clinico.internacao.internar.avisoCritico')
  }

  return ''
})

const podeConfirmar = computed(
  () =>
    petId.value.length > 0 &&
    responsavelId.value.length > 0 &&
    motivo.value.trim().length > 0 &&
    (pesoKg.value ?? 0) > 0 &&
    !props.salvando,
)

function confirmar() {
  const pet = paciente.value

  if (!podeConfirmar.value || !pet) {
    return
  }

  emit('confirmar', {
    petId: pet.id,
    tutorId: pet.tutorId,
    responsavelId: responsavelId.value,
    motivo: motivo.value,
    diagnostico: diagnostico.value,
    gravidade: gravidade.value,
    pesoEntradaKg: pesoKg.value ?? 0,
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(34rem, 96vw)' }"
    :header="t('clinico.internacao.internar.titulo')"
    dismissable-mask
  >
    <div v-if="leito" class="internar clinic-scope">
      <p class="internar__leito">
        <strong class="clinic-value">{{ leito.nome }}</strong>
        <span>{{ t(`clinico.internacao.leitoKind.${leito.kind}`) }}</span>
      </p>

      <ClinicField :rotulo="t('clinico.internacao.internar.paciente')" obrigatorio>
        <template #default="{ id }">
          <Select
            :id="id"
            v-model="petId"
            :options="opcoesDePaciente"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('clinico.internacao.internar.escolhaPaciente')"
            :filter-placeholder="t('clinico.internacao.internar.buscarPaciente')"
            filter
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.internacao.internar.responsavelClinico')" obrigatorio>
        <template #default="{ id }">
          <Select
            :id="id"
            v-model="responsavelId"
            :options="opcoesDeProfissional"
            option-label="rotulo"
            option-value="valor"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.internacao.internar.motivo')" obrigatorio>
        <template #default="{ id }">
          <InputText
            :id="id"
            v-model="motivo"
            :placeholder="t('clinico.internacao.internar.motivoExemplo')"
            fluid
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.internacao.internar.diagnostico')">
        <template #default="{ id }">
          <InputText
            :id="id"
            v-model="diagnostico"
            :placeholder="t('clinico.internacao.internar.diagnosticoExemplo')"
            fluid
          />
        </template>
      </ClinicField>

      <ClinicField
        :rotulo="t('clinico.internacao.internar.peso')"
        :dica="t('clinico.internacao.internar.pesoDica')"
        obrigatorio
      >
        <template #default="{ id }">
          <InputNumber
            :id="id"
            v-model="pesoKg"
            :min-fraction-digits="1"
            :max-fraction-digits="2"
            suffix=" kg"
            fluid
          />
        </template>
      </ClinicField>

      <ClinicToggleGroup
        v-model="gravidade"
        :opcoes="opcoesDeGravidade"
        :rotulo="t('clinico.internacao.internar.gravidade')"
      />

      <p v-if="aviso" class="internar__aviso" role="status">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ aviso }}
      </p>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.internacao.internar.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('clinico.internacao.internar.confirmar')"
        icon="ph ph-check"
        :disabled="!podeConfirmar"
        :loading="salvando"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.internar {
  display: grid;
  gap: var(--clinic-space-4);
}

.internar__leito {
  display: flex;
  align-items: baseline;
  margin: 0;
  gap: var(--clinic-space-3);
}

.internar__leito strong {
  font-size: var(--clinic-font-title);
  font-weight: 750;
}

.internar__leito span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.internar__aviso {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px dashed var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}
</style>
