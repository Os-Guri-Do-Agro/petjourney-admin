<script setup lang="ts">
/**
 * Registro de vacinação, dentro do atendimento.
 *
 * Fecha o beat que o roteiro de demonstração pede — "atende, prescreve, **vacina**" — e que até
 * aqui não existia: vacina era tipo de agendamento e evento de histórico, nunca um registro.
 *
 * Três campos que parecem burocracia e não são:
 *
 * - **Lote e validade** — é o que a farmacovigilância rastreia se houver reação adversa num
 *   lote inteiro, e o que a companhia aérea confere no balcão. Sem eles o comprovante não serve
 *   para viagem, que é quando ele é pedido.
 * - **Dose da série** — filhote toma três de V10 com 28 dias entre elas; adulto toma uma por
 *   ano. É essa distinção que decide se a clínica chama de volta no mês que vem ou no ano que
 *   vem, e é dela que sai a recorrência.
 *
 * A próxima dose é calculada e mostrada **antes** de gravar: quem aplica confere a data que vai
 * sair na carteira, em vez de descobri-la depois.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { vacinaRepository } from '../../data/repositories'
import type { AplicacaoVacina, Encounter, Pet } from '../../data/types'
import { addDays } from '../../domain/clinic-time'
import { proximaDose, vacinasDaEspecie } from '../../domain/vacinacao'
import { clinicClock } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  somenteLeitura: boolean
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const aplicadas = ref<AplicacaoVacina[]>([])
const salvando = ref(false)

const vacinaId = ref<string | null>(null)
const lote = ref('')
const validadeLote = ref(addDays(clinicClock.today(), 365))
const dose = ref(1)

const catalogo = computed(() =>
  props.pet ? vacinasDaEspecie(vacinaRepository.catalogo(), props.pet.especie) : [],
)

const opcoes = computed(() =>
  catalogo.value.map((vacina) => ({
    value: vacina.id,
    label: `${vacina.nome} · ${vacina.fabricante}`,
  })),
)

const escolhida = computed(() => catalogo.value.find((item) => item.id === vacinaId.value) ?? null)

/** Doses possíveis da série escolhida. V10 oferece 1, 2 e 3; antirrábica, só 1. */
const opcoesDeDose = computed(() =>
  Array.from({ length: escolhida.value?.dosesNaSerie ?? 1 }, (_, indice) => ({
    value: indice + 1,
    label: t('clinico.vacinas.doseDeTotal', {
      dose: indice + 1,
      total: escolhida.value?.dosesNaSerie ?? 1,
    }),
  })),
)

/** A data que vai para a carteira, mostrada antes de gravar. */
const proxima = computed(() =>
  escolhida.value ? proximaDose(escolhida.value, dose.value, clinicClock.today()) : null,
)

const podeRegistrar = computed(
  () => !props.somenteLeitura && Boolean(vacinaId.value) && lote.value.trim().length > 0,
)

async function carregar() {
  if (props.pet) {
    aplicadas.value = await vacinaRepository.doPaciente(props.pet.id)
  }
}

onMounted(carregar)

async function registrar() {
  if (!podeRegistrar.value || !props.pet || !vacinaId.value) {
    return
  }

  salvando.value = true

  try {
    await vacinaRepository.registrar({
      petId: props.pet.id,
      vacinaId: vacinaId.value,
      professionalId: props.encounter.professionalId,
      lote: lote.value,
      validadeLote: validadeLote.value,
      dose: dose.value,
      via: 'subcutanea',
      observacao: '',
    })

    lote.value = ''
    vacinaId.value = null
    dose.value = 1
    await carregar()
  } finally {
    salvando.value = false
  }
}

function nomeDaVacina(id: string) {
  return vacinaRepository.catalogo().find((item) => item.id === id)?.nome ?? id
}
</script>

<template>
  <section class="vacinacao">
    <header class="vacinacao__topo">
      <h4 class="clinic-label">{{ t('clinico.vacinas.registrar') }}</h4>
    </header>

    <div v-if="!somenteLeitura" class="formulario">
      <ClinicField :rotulo="t('clinico.vacinas.colunaVacina')">
        <Select
          v-model="vacinaId"
          :options="opcoes"
          option-label="label"
          option-value="value"
          fluid
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        />
      </ClinicField>

      <ClinicField :rotulo="t('clinico.vacinas.lote')">
        <InputText v-model="lote" fluid placeholder="L2026-014" />
      </ClinicField>

      <ClinicField :rotulo="t('clinico.vacinas.validadeLote')">
        <InputText v-model="validadeLote" type="date" fluid />
      </ClinicField>

      <ClinicField :rotulo="t('clinico.vacinas.dose')">
        <Select
          v-model="dose"
          :options="opcoesDeDose"
          option-label="label"
          option-value="value"
          fluid
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        />
      </ClinicField>

      <Button
        :label="t('clinico.vacinas.registrar')"
        icon="pi pi-plus"
        size="small"
        :disabled="!podeRegistrar"
        :loading="salvando"
        class="formulario__salvar"
        @click="registrar"
      />
    </div>

    <!--
      A data do reforço aparece **antes** de gravar. É o que a clínica vai cobrar daqui a um ano
      (ou daqui a 28 dias, se a série estiver aberta), e conferir depois é conferir tarde.
    -->
    <p v-if="proxima" class="proxima">
      <i class="pi pi-calendar" aria-hidden="true" />
      {{ t('clinico.vacinas.proximaEm', { data: formato.dataCurta(proxima) }) }}
    </p>

    <div v-if="aplicadas.length > 0" class="carteira">
      <span class="clinic-label">{{ t('clinico.documentos.vacinacao.titulo') }}</span>

      <ul class="carteira__lista">
        <li v-for="aplicacao in aplicadas" :key="aplicacao.id">
          <span class="carteira__data clinic-value">
            {{ formato.dataCurta(clinicClock.dateOf(aplicacao.aplicadaEm)) }}
          </span>
          <span class="carteira__nome">{{ nomeDaVacina(aplicacao.vacinaId) }}</span>
          <span class="carteira__lote">
            {{ t('clinico.vacinas.lote') }} {{ aplicacao.lote }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.vacinacao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.formulario {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) auto;
  align-items: end;
  gap: var(--clinic-space-3);
}

.formulario__salvar {
  margin-bottom: 1px;
}

@media (max-width: 900px) {
  .formulario {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  }
}

.proxima {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.carteira {
  display: grid;
  gap: var(--clinic-space-2);
  padding-top: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line);
}

.carteira__lista {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.carteira__lista li {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--clinic-space-3);
  font-size: var(--clinic-font-label);
}

.carteira__nome {
  font-weight: 700;
}

.carteira__lote,
.carteira__data {
  color: var(--clinic-faint);
}
</style>
