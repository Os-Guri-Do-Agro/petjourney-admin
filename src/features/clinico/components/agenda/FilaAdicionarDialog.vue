<script setup lang="ts">
/**
 * Entrada na fila de espera.
 *
 * A ponta que faltava para o ciclo fechar. Sem ela, a fila só nascia do dataset: quando a
 * agenda estava cheia, a recepção não tinha para onde mandar o responsável, e "eu te aviso se
 * abrir" virava promessa sem registro.
 *
 * O campo que decide tudo é a **janela** — os dias e horários que a pessoa aceita. É por ela
 * que o sistema sabe quem cabe numa vaga que acabou de vagar; sem janela, a fila é uma lista de
 * nomes e alguém tem que ligar para todos.
 *
 * Por isso a janela nasce preenchida com o horário comercial de segunda a sexta: a maioria
 * aceita qualquer coisa, e obrigar a marcar dez caixas para o caso comum faria a recepção
 * pular a fila e anotar num papel.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import PacienteNovoForm from '../pacientes/PacienteNovoForm.vue'
import type { Pet, WaitlistPriority, WaitlistWindow, WeekdayIndex } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useFilaStore } from '../../stores/fila'
import { useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    visivel: boolean
    /** Pré-seleção vinda da agenda, quando não houve horário bom. */
    petId?: string | null
    typeId?: string | null
    professionalId?: string | null
  }>(),
  { petId: null, typeId: null, professionalId: null },
)

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  adicionado: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const fila = useFilaStore()
const formato = useClinicFormat()

const DIAS_UTEIS: WeekdayIndex[] = [1, 2, 3, 4, 5]

/**
 * O mesmo diálogo trocando de conteúdo, como na criação de atendimento.
 *
 * O paciente que não está na lista é tão comum aqui quanto lá: a fila costuma nascer da ligação
 * em que a agenda estava cheia — e quem liga com bicho novo é justamente quem não tem horário.
 * Sem esta porta, a recepção fechava o diálogo, ia à tela de pacientes, cadastrava e voltava para
 * refazer a janela de dias e horários do zero.
 */
const cadastrandoPaciente = ref(false)

/* Prefixo 'escolhido' porque o nome cru colidiria com a prop de pré-seleção de mesmo nome. */
const petEscolhidoId = ref<string | null>(null)
const tipoEscolhidoId = ref<string | null>(null)
const profissionalEscolhidoId = ref<string | null>(null)
const prioridade = ref<WaitlistPriority>('normal')
const diasAceitos = ref<WeekdayIndex[]>([...DIAS_UTEIS])
const inicio = ref('08:00')
const fim = ref('19:00')
const observacao = ref('')

const aberto = computed({
  get: () => props.visivel,
  set: (valor: boolean) => emit('update:visivel', valor),
})

const opcoesPet = computed(() =>
  clinico.pets.map((pet) => ({
    value: pet.id,
    label: `${pet.nome} · ${clinico.tutor(pet.tutorId)?.nome ?? ''}`,
  })),
)

const opcoesTipo = computed(() =>
  clinico.tipos.map((tipo) => ({ value: tipo.id, label: tipo.nome })),
)

const opcoesProfissional = computed(() => [
  { value: null, label: t('clinico.fila.qualquerProfissional') },
  ...clinico.profissionais.map((prof) => ({ value: prof.id, label: prof.nome })),
])

const opcoesPrioridade = computed(() =>
  (['normal', 'preferencial', 'urgente'] as const).map((valor) => ({
    valor,
    rotulo: formato.prioridadeDaFila(valor),
    tom: valor === 'urgente' ? ('risco' as const) : valor === 'preferencial' ? ('atencao' as const) : ('neutro' as const),
  })),
)

const NOMES_DOS_DIAS: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6]

function alternarDia(dia: WeekdayIndex) {
  diasAceitos.value = diasAceitos.value.includes(dia)
    ? diasAceitos.value.filter((item) => item !== dia)
    : [...diasAceitos.value, dia].sort()
}

/** Uma janela por dia aceito: é a forma que o domínio já usa para cruzar com a vaga. */
const janelas = computed<WaitlistWindow[]>(() =>
  diasAceitos.value.map((weekday) => ({ weekday, inicio: inicio.value, fim: fim.value })),
)

const petEscolhido = computed(() => (petEscolhidoId.value ? clinico.pet(petEscolhidoId.value) : null))

const podeSalvar = computed(
  () => Boolean(petEscolhidoId.value && tipoEscolhidoId.value) && diasAceitos.value.length > 0 && inicio.value < fim.value,
)

watch(
  () => props.visivel,
  (visivel) => {
    if (!visivel) {
      return
    }

    /* Reabrir limpo, mas honrando o que a agenda já sabia. */
    cadastrandoPaciente.value = false
    petEscolhidoId.value = props.petId
    tipoEscolhidoId.value = props.typeId ?? clinico.tipos[0]?.id ?? null
    profissionalEscolhidoId.value = props.professionalId
    prioridade.value = 'normal'
    diasAceitos.value = [...DIAS_UTEIS]
    inicio.value = '08:00'
    fim.value = '19:00'
    observacao.value = ''
  },
)

/** Cadastrado, já entra escolhido: ninguém procuraria de novo na lista o que acabou de criar. */
function aoCriarPaciente(pet: Pet) {
  petEscolhidoId.value = pet.id
  cadastrandoPaciente.value = false
}

async function salvar() {
  const pet = petEscolhido.value

  if (!pet || !tipoEscolhidoId.value) {
    return
  }

  const criada = await fila.adicionar({
    petId: pet.id,
    tutorId: pet.tutorId,
    typeId: tipoEscolhidoId.value,
    professionalId: profissionalEscolhidoId.value,
    prioridade: prioridade.value,
    janelas: janelas.value,
    observacao: observacao.value.trim(),
  })

  if (criada) {
    aberto.value = false
    emit('adicionado')
  }
}
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(34rem, 94vw)' }"
    :header="t('clinico.fila.adicionar')"
    :dismissable-mask="true"
    :pt="{ footer: cadastrandoPaciente ? { style: { display: 'none' } } : {} }"
  >
    <PacienteNovoForm
      v-if="cadastrandoPaciente"
      @criado="aoCriarPaciente"
      @cancelar="cadastrandoPaciente = false"
    />

    <div v-else class="entrada clinic-scope">
      <ClinicField :rotulo="t('clinico.pacientes.colunaPaciente')">
        <Select
          v-model="petEscolhidoId"
          :options="opcoesPet"
          option-label="label"
          option-value="value"
          filter
          fluid
          :placeholder="t('clinico.pacientes.buscar')"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        >
          <template #footer>
            <button type="button" class="cadastrar" @click="cadastrandoPaciente = true">
              <span class="cadastrar__marca" aria-hidden="true"><i class="pi pi-user-plus" /></span>
              <span class="cadastrar__texto">
                <strong>{{ t('clinico.paciente.novo.atalho') }}</strong>
                <small>{{ t('clinico.paciente.novo.atalhoAjuda') }}</small>
              </span>
              <i class="pi pi-arrow-right cadastrar__seta" aria-hidden="true" />
            </button>
          </template>
        </Select>
      </ClinicField>

      <div class="entrada__par">
        <ClinicField :rotulo="t('clinico.agenda.criar.tipo')">
          <Select
            v-model="tipoEscolhidoId"
            :options="opcoesTipo"
            option-label="label"
            option-value="value"
            fluid
          />
        </ClinicField>

        <ClinicField :rotulo="t('clinico.agenda.mover.profissional')">
          <Select
            v-model="profissionalEscolhidoId"
            :options="opcoesProfissional"
            option-label="label"
            option-value="value"
            fluid
          />
        </ClinicField>
      </div>

      <ClinicField :rotulo="t('clinico.fila.prioridade')">
        <ClinicToggleGroup
          v-model="prioridade"
          :opcoes="opcoesPrioridade"
          :rotulo="t('clinico.fila.prioridade')"
        />
      </ClinicField>

      <!--
        A janela é o campo que faz a fila funcionar: é por ela que a vaga encontra o candidato.
        Nasce em segunda a sexta, horário comercial — o caso comum não deve custar dez cliques.
      -->
      <ClinicField :rotulo="t('clinico.fila.janelas')">
        <div class="janela">
          <div class="janela__dias" role="group" :aria-label="t('clinico.fila.janelas')">
            <button
              v-for="dia in NOMES_DOS_DIAS"
              :key="dia"
              type="button"
              class="janela__dia clinic-focusable"
              :class="{ 'janela__dia--ativo': diasAceitos.includes(dia) }"
              :aria-pressed="diasAceitos.includes(dia)"
              @click="alternarDia(dia)"
            >
              {{ formato.diaDaSemanaCurtoPorIndice(dia) }}
            </button>
          </div>

          <div class="janela__horas">
            <InputText v-model="inicio" type="time" class="janela__hora" />
            <span aria-hidden="true">–</span>
            <InputText v-model="fim" type="time" class="janela__hora" />
          </div>
        </div>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.criar.observacao')">
        <InputText v-model="observacao" fluid />
      </ClinicField>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="aberto = false"
      />
      <Button
        :label="t('clinico.fila.adicionar')"
        icon="pi pi-plus"
        :disabled="!podeSalvar"
        :loading="fila.salvando"
        @click="salvar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
/*
 * O atalho do rodapé da lista.
 *
 * Mesma forma da criação de atendimento, e de propósito: é o mesmo gesto, e duas aparências para
 * a mesma porta fariam parecer que são coisas diferentes.
 */
.cadastrar {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 0;
  border-top: 1px solid var(--clinic-line-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.cadastrar:hover,
.cadastrar:focus-visible {
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
}

.cadastrar__marca {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  flex: none;
  border-radius: 999px;
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
  place-items: center;
}

.cadastrar:hover .cadastrar__marca,
.cadastrar:focus-visible .cadastrar__marca {
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
}

.cadastrar__marca i {
  font-size: 0.78rem;
}

.cadastrar__texto {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.cadastrar__texto strong {
  font-size: var(--clinic-font-base);
  font-weight: 750;
}

.cadastrar__texto small {
  font-size: var(--clinic-font-label);
  opacity: 0.8;
}

.cadastrar__seta {
  margin-left: auto;
  font-size: 0.72rem;
}

.entrada {
  display: grid;
  gap: var(--clinic-space-3);
}

.entrada__par {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: var(--clinic-space-3);
}

.janela {
  display: grid;
  gap: var(--clinic-space-2);
}

.janela__dias {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.janela__dia {
  min-width: 2.6rem;
  min-height: var(--clinic-hit-target);
  padding: 0 0.4rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-transform: capitalize;
}

/* Dia aceito ganha contorno e fundo: o estado precisa sobreviver à escala de cinza. */
.janela__dia--ativo {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.janela__horas {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-faint);
}

.janela__hora {
  max-width: 8rem;
}
</style>
