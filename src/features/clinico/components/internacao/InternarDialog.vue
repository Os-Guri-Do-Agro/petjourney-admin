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
      rotulo: [pet.nome, clinico.tutor(pet.tutorId)?.nome].filter(Boolean).join(' · '),
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
    :style="{ width: 'min(40rem, 96vw)' }"
    dismissable-mask
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="ph ph-bed" /></span>
        {{ t('clinico.internacao.internar.titulo') }}
      </h2>
    </template>

    <div v-if="leito" class="internar clinic-scope">
      <p class="internar__leito ui-poco">
        <span class="ui-ladrilho ui-ladrilho--g" aria-hidden="true"><i class="ph ph-bed" /></span>
        <span class="internar__leito-texto">
          <strong class="ui-num">{{ leito.nome }}</strong>
          <span>{{ t(`clinico.internacao.leitoKind.${leito.kind}`) }}</span>
        </span>
      </p>

      <ClinicField
        class="internar__largo"
        :rotulo="t('clinico.internacao.internar.paciente')"
        obrigatorio
      >
        <template #default="{ id }">
          <!--
            `input-id`, não `id`: é o que liga o rótulo ao controle (o `id` caía no invólucro e o
            leitor de tela anunciava "Escolha o paciente" em vez de "Paciente"). A lista não passa
            da largura do diálogo: o nome longo quebra em vez de empurrar a caixa para fora.
          -->
          <Select
            v-model="petId"
            :input-id="id"
            :options="opcoesDePaciente"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('clinico.internacao.internar.escolhaPaciente')"
            :filter-placeholder="t('clinico.internacao.internar.buscarPaciente')"
            filter
            fluid
            :pt="{
              overlay: { class: 'clinic-overlay', style: 'max-width: min(37rem, 92vw)' },
              option: { style: 'white-space: normal' },
            }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.internacao.internar.responsavelClinico')" obrigatorio>
        <template #default="{ id }">
          <Select
            v-model="responsavelId"
            :input-id="id"
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
            v-model="pesoKg"
            :input-id="id"
            :min-fraction-digits="1"
            :max-fraction-digits="2"
            suffix=" kg"
            fluid
          />
        </template>
      </ClinicField>

      <ClinicToggleGroup
        v-model="gravidade"
        class="internar__largo"
        :opcoes="opcoesDeGravidade"
        :rotulo="t('clinico.internacao.internar.gravidade')"
      />

      <p v-if="aviso" class="internar__aviso internar__largo" role="status">
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
/* Dois campos por linha em tela larga; o leito, o paciente, o estado e o aviso atravessam as duas. */
.internar {
  display: grid;
  gap: 16px 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.internar__largo,
.internar__leito {
  grid-column: 1 / -1;
}

/* O leito já vem escolhido: ele abre o formulário como o lugar para onde o paciente vai. */
.internar__leito {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0;
  padding: 12px 14px;
}

.internar__leito-texto {
  display: grid;
  gap: 1px;
}

.internar__leito strong {
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.1;
}

.internar__leito-texto span {
  color: var(--tinta-2);
  font-size: 13px;
}

.internar__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklab, var(--atencao) 25%, transparent);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.internar__aviso i {
  margin-top: 2px;
  font-size: 16px;
}

@media (width <= 560px) {
  .internar {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
