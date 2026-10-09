<script setup lang="ts">
/**
 * Registrar uma dose que a clínica não aplicou.
 *
 * O filhote chega com a primeira V10 do pet shop; o adulto, com a antirrábica da campanha. A
 * dose existe, e o protocolo precisa dela para saber em que ponto o animal está — mas ela entra
 * **dizendo o que é**:
 *
 * - **Sem lote.** O campo nem aparece. A clínica não sabe de que frasco saiu, e pedir o código
 *   convida a copiar de memória uma rastreabilidade que ninguém garante.
 * - **Com a procedência.** "Vi o comprovante" e "só o relato" são coisas diferentes, e a
 *   diferença aparece nos dois lados — na carteira da clínica e na do app. A dose conta para o
 *   protocolo nos dois casos: revacinar ou não é decisão do veterinário, não do formulário.
 * - **Com quem transcreveu.** Não há aplicador da casa para responder pela linha; quem responde
 *   é quem a registrou, e o nome fica.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDateField from '../base/ClinicDateField.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import { useRotulosDaVacina } from '../../composables/useRotulosDaVacina'
import { AplicacaoRecusadaError, vacinaRepository } from '../../data/repositories'
import type { AplicacaoVacina, ISODate, Pet, ProcedenciaExterna } from '../../data/types'
import { dosesDaSerie, tipoDeSerie, type PlanoVacinal } from '../../domain/protocolo-vacinal'
import { vacinasDaEspecie } from '../../domain/vacinacao'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    visivel: boolean
    pet: Pet
    plano: PlanoVacinal
    /** Aberto da ficha do paciente: leva o acabamento da Visão geral (`ficha/ficha.css`). */
    ficha?: boolean
  }>(),
  { ficha: false },
)

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  registrada: [aplicacao: AplicacaoVacina]
}>()

const { t } = useI18n()
const rotulos = useRotulosDaVacina()
const clinico = useClinicoStore()

/* Na ficha, o diálogo e as listas teleportadas levam os tokens da Visão geral. */
const classeDoTema = computed(() => (props.ficha ? 'hc-tema ficha-tema' : ''))
const ptDoOverlay = computed(() => ({
  overlay: { class: ['clinic-overlay', classeDoTema.value].filter(Boolean).join(' ') },
}))

const vacinaId = ref<string | null>(null)
const aplicadaEm = ref<ISODate>('')
const dose = ref(1)
const local = ref('')
const aplicador = ref('')
const procedencia = ref<ProcedenciaExterna>('comprovante')
const registradaPor = ref<string | null>(null)
const observacao = ref('')
const tentouSalvar = ref(false)
const salvando = ref(false)
const erro = ref('')

const hoje = computed(() => clinicClock.today())
const catalogo = computed(() => vacinasDaEspecie(vacinaRepository.catalogo(), props.pet.especie))
const vacina = computed(() => catalogo.value.find((item) => item.id === vacinaId.value) ?? null)

const opcoesVacina = computed(() =>
  catalogo.value.map((item) => ({ valor: item.id, rotulo: item.nome })),
)

/**
 * O tamanho da série: o da série que já existe no registro, ou o da idade **na data da dose**.
 *
 * A data manda, e não hoje: a V10 que o filhote tomou com sete semanas abriu uma série de filhote,
 * mesmo que ele seja registrado aqui com dezessete.
 */
const total = computed(() => {
  if (!vacina.value) {
    return 1
  }

  const existente = props.plano.vacinas.find((item) => item.vacina.id === vacina.value!.id)

  if (existente && existente.aplicadasNaSerie > 0) {
    return existente.total
  }

  return dosesDaSerie(
    vacina.value,
    tipoDeSerie(props.pet.nascimento, aplicadaEm.value || hoje.value),
  )
})

const opcoesDose = computed(() =>
  Array.from({ length: total.value }, (_, indice) => ({
    valor: indice + 1,
    rotulo: rotulos.numero({ numero: indice + 1, total: total.value, tipo: 'serie' }),
  })),
)

const opcoesProcedencia = computed(() => [
  {
    valor: 'comprovante' as ProcedenciaExterna,
    rotulo: t('clinico.vacinas.externa.procedencia.comprovante'),
  },
  {
    valor: 'relato' as ProcedenciaExterna,
    rotulo: t('clinico.vacinas.externa.procedencia.relato'),
  },
])

const opcoesQuemRegistra = computed(() =>
  clinico.profissionais.map((item) => ({ valor: item.id, rotulo: item.nome })),
)

watch(total, (valor) => {
  if (dose.value > valor) {
    dose.value = valor
  }
})

watch(
  () => props.visivel,
  (visivel) => {
    if (!visivel) {
      return
    }

    vacinaId.value =
      props.plano.vacinas.find((item) => item.aplicadasNaSerie === 0)?.vacina.id ??
      catalogo.value[0]?.id ??
      null
    aplicadaEm.value = ''
    dose.value = 1
    local.value = ''
    aplicador.value = ''
    procedencia.value = 'comprovante'
    registradaPor.value = clinico.profissionais.find((item) => item.ativo)?.id ?? null
    observacao.value = ''
    tentouSalvar.value = false
    erro.value = ''
  },
  { immediate: true },
)

const erroData = computed(() => {
  if (!tentouSalvar.value) {
    return ''
  }

  if (!aplicadaEm.value) {
    return t('clinico.vacinas.externa.erros.data')
  }

  return aplicadaEm.value > hoje.value ? t('clinico.vacinas.externa.erros.futuro') : ''
})

const erroLocal = computed(() =>
  tentouSalvar.value && !local.value.trim() ? t('clinico.vacinas.externa.erros.local') : '',
)

const completo = computed(
  () =>
    Boolean(vacina.value) &&
    Boolean(aplicadaEm.value) &&
    aplicadaEm.value <= hoje.value &&
    Boolean(local.value.trim()) &&
    Boolean(registradaPor.value),
)

async function registrar() {
  tentouSalvar.value = true
  erro.value = ''

  if (!completo.value || !vacina.value || !registradaPor.value) {
    return
  }

  salvando.value = true

  try {
    const aplicacao = await vacinaRepository.registrarExterna({
      petId: props.pet.id,
      vacinaId: vacina.value.id,
      aplicadaEm: aplicadaEm.value,
      dose: dose.value,
      dosesNaSerie: total.value,
      local: local.value,
      aplicador: aplicador.value,
      procedencia: procedencia.value,
      registradaPor: registradaPor.value,
      observacao: observacao.value,
    })

    emit('registrada', aplicacao)
    emit('update:visivel', false)
  } catch (falha) {
    erro.value =
      falha instanceof AplicacaoRecusadaError
        ? t(`clinico.vacinas.aplicar.recusa.${falha.kind}`)
        : t('clinico.vacinas.aplicar.erros.salvar')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :class="classeDoTema"
    :style="{ width: 'min(38rem, 94vw)' }"
    :dismissable-mask="!salvando"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="ph ph-map-pin" /></span>
        {{ t('clinico.vacinas.externa.titulo') }}
      </h2>
    </template>

    <form class="externa clinic-scope" @submit.prevent="registrar">
      <p class="externa__ajuda">{{ t('clinico.vacinas.externa.ajuda', { pet: pet.nome }) }}</p>

      <div class="externa__linha externa__linha--vacina">
        <ClinicField :rotulo="t('clinico.vacinas.colunaVacina')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="vacinaId"
              :input-id="id"
              :options="opcoesVacina"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.vacinas.dose')">
          <template #default="{ id }">
            <Select
              v-model="dose"
              :input-id="id"
              :options="opcoesDose"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>
      </div>

      <div class="externa__linha">
        <ClinicField :rotulo="t('clinico.vacinas.externa.quando')" obrigatorio :erro="erroData">
          <template #default="{ id, descrito }">
            <ClinicDateField
              v-model="aplicadaEm"
              :input-id="id"
              :max="hoje"
              :aria-describedby="descrito"
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.vacinas.externa.onde')"
          obrigatorio
          :dica="t('clinico.vacinas.externa.ondeDica')"
          :erro="erroLocal"
        >
          <template #default="{ id, descrito }">
            <InputText :id="id" v-model="local" fluid :aria-describedby="descrito" />
          </template>
        </ClinicField>
      </div>

      <ClinicField :rotulo="t('clinico.vacinas.externa.procedencia.titulo')" obrigatorio>
        <ClinicToggleGroup
          v-model="procedencia"
          :opcoes="opcoesProcedencia"
          :rotulo="t('clinico.vacinas.externa.procedencia.titulo')"
        />
      </ClinicField>

      <p class="externa__consequencia">
        <i
          :class="procedencia === 'relato' ? 'ph ph-warning-circle' : 'ph ph-seal-check'"
          aria-hidden="true"
        />
        {{ t(`clinico.vacinas.externa.procedencia.consequencia.${procedencia}`) }}
      </p>

      <div class="externa__linha">
        <ClinicField :rotulo="t('clinico.vacinas.externa.aplicador')">
          <template #default="{ id }">
            <InputText :id="id" v-model="aplicador" fluid />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.vacinas.externa.quemRegistra')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="registradaPor"
              :input-id="id"
              :options="opcoesQuemRegistra"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>
      </div>

      <ClinicField :rotulo="t('clinico.vacinas.aplicar.observacao')">
        <template #default="{ id }">
          <InputText :id="id" v-model="observacao" fluid />
        </template>
      </ClinicField>

      <p class="externa__semLote">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('clinico.vacinas.externa.semLoteExplicacao') }}
      </p>

      <Message v-if="erro" severity="error" :closable="false">{{ erro }}</Message>
    </form>

    <template #footer>
      <Button
        :label="t('clinico.comum.cancelar')"
        :severity="ficha ? undefined : 'secondary'"
        :outlined="!ficha"
        :class="{ 'hc-pilula': ficha }"
        :disabled="salvando"
        @click="emit('update:visivel', false)"
      />
      <Button
        :label="t('clinico.vacinas.externa.confirmar')"
        icon="ph ph-check"
        :class="ficha ? 'hc-pilula hc-pilula--cheia' : 'clinic-acao-principal'"
        :loading="salvando"
        :disabled="!completo"
        @click="registrar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.externa {
  display: grid;
  gap: var(--clinic-space-3);
}

.externa__ajuda {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.externa__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.externa__linha--vacina {
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
}

.externa__consequencia,
.externa__semLote {
  display: flex;
  align-items: baseline;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.externa__consequencia {
  margin-top: calc(var(--clinic-space-2) * -1);
}

@media (max-width: 620px) {
  .externa__linha,
  .externa__linha--vacina {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
