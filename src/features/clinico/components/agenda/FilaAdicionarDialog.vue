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
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
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
const idTitulo = useId()
const idJanela = useId()
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

const opcoesDias = computed(() =>
  NOMES_DOS_DIAS.map((valor) => {
    const rotulo = formato.diaDaSemanaCurtoPorIndice(valor)

    return { valor, rotulo: rotulo.charAt(0).toLocaleUpperCase() + rotulo.slice(1) }
  }),
)

/** O dia aceito entra e sai da janela com um clique; `definirDias` mantém a ordem da semana. */
function alternarDia(dia: WeekdayIndex) {
  definirDias(
    diasAceitos.value.includes(dia)
      ? diasAceitos.value.filter((item) => item !== dia)
      : [...diasAceitos.value, dia],
  )
}

/** Guardados em ordem de semana, não de clique: é a ordem em que as janelas são lidas depois. */
function definirDias(dias: WeekdayIndex[]) {
  diasAceitos.value = [...dias].sort()
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
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(36rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    :dismissable-mask="true"
    :pt="{ footer: cadastrandoPaciente ? { style: { display: 'none' } } : {} }"
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.fila.adicionar')"
        :subtitulo="petEscolhido?.nome ?? ''"
        icone="ph ph-users"
      />
    </template>

    <PacienteNovoForm
      v-if="cadastrandoPaciente"
      @criado="aoCriarPaciente"
      @cancelar="cadastrandoPaciente = false"
    />

    <div v-else class="formulario clinic-scope">
      <ClinicField :rotulo="t('clinico.pacientes.colunaPaciente')" largo>
        <template #default="{ id }">
          <Select
            v-model="petEscolhidoId"
            :input-id="id"
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
                <span class="cadastrar__marca" aria-hidden="true"><i class="ph ph-user-plus" /></span>
                <span class="cadastrar__texto">
                  <strong>{{ t('clinico.paciente.novo.atalho') }}</strong>
                  <small>{{ t('clinico.paciente.novo.atalhoAjuda') }}</small>
                </span>
                <i class="ph ph-caret-right cadastrar__seta" aria-hidden="true" />
              </button>
            </template>
          </Select>
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.criar.tipo')">
        <template #default="{ id }">
          <Select
            v-model="tipoEscolhidoId"
            :input-id="id"
            :options="opcoesTipo"
            option-label="label"
            option-value="value"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.mover.profissional')">
        <template #default="{ id }">
          <Select
            v-model="profissionalEscolhidoId"
            :input-id="id"
            :options="opcoesProfissional"
            option-label="label"
            option-value="value"
            :placeholder="t('clinico.fila.qualquerProfissional')"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.fila.prioridadeRotulo')" largo>
        <ClinicToggleGroup
          v-model="prioridade"
          :opcoes="opcoesPrioridade"
          :rotulo="t('clinico.fila.prioridadeRotulo')"
        />
      </ClinicField>

      <!--
        A janela é o campo que faz a fila funcionar: é por ela que a vaga encontra o candidato.
        Nasce em segunda a sexta, horário comercial — o caso comum não deve custar dez cliques.
      -->
      <fieldset class="janela formulario__largo">
        <legend :id="idJanela" class="janela__titulo">{{ t('clinico.fila.janelas') }}</legend>

        <div class="janela__dias" role="group" :aria-labelledby="idJanela">
          <button
            v-for="dia in opcoesDias"
            :key="dia.valor"
            type="button"
            class="dia"
            :class="{ 'dia--ligado': diasAceitos.includes(dia.valor) }"
            :aria-pressed="diasAceitos.includes(dia.valor)"
            @click="alternarDia(dia.valor)"
          >
            <i v-if="diasAceitos.includes(dia.valor)" class="ph ph-check" aria-hidden="true" />
            {{ dia.rotulo }}
          </button>
        </div>

        <div class="janela__horas">
          <InputText
            v-model="inicio"
            type="time"
            class="janela__hora"
            :aria-label="t('clinico.agenda.criar.hora')"
          />
          <span aria-hidden="true">–</span>
          <InputText
            v-model="fim"
            type="time"
            class="janela__hora"
            :aria-label="t('clinico.agenda.bloqueio.ate')"
          />
        </div>
      </fieldset>

      <ClinicField :rotulo="t('clinico.prontuario.conduta.observacao')" largo>
        <template #default="{ id }">
          <InputText :id="id" v-model="observacao" fluid />
        </template>
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
        icon="ph ph-plus"
        :disabled="!podeSalvar"
        :loading="fila.salvando"
        @click="salvar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.formulario {
  display: grid;
  gap: 18px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.formulario__largo {
  grid-column: 1 / -1;
}

/*
 * O atalho do rodapé da lista. Mesma forma da criação de atendimento, e de propósito: é o mesmo
 * gesto, e duas aparências para a mesma porta fariam parecer que são coisas diferentes.
 */
.cadastrar {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 0;
  border-top: 1px solid var(--linha);
  background: var(--musgo-fundo);
  color: var(--musgo);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.cadastrar:hover {
  background: color-mix(in oklab, var(--musgo-fundo) 70%, var(--musgo));
}

.cadastrar:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: -2px;
}

.cadastrar__marca {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--musgo);
  color: var(--sobre-musgo);
  font-size: 15px;
}

.cadastrar__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.cadastrar__texto strong {
  font-size: 14px;
  font-weight: 600;
}

.cadastrar__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.cadastrar__seta {
  margin-inline-start: auto;
  font-size: 14px;
}

.janela {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.janela__titulo {
  margin-bottom: 7px;
  padding: 0;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 550;
}

.janela__dias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dia {
  display: inline-flex;
  min-width: 52px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border: 1px solid var(--linha-forte);
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
}

.dia:hover {
  background: var(--superficie-2);
}

.dia:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

/* Dia aceito: contorno, fundo e o visto — o estado sobrevive à escala de cinza. */
.dia--ligado,
.dia--ligado:hover {
  border-color: var(--clinica);
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-weight: 600;
}

.janela__horas {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta-3);
}

.janela__hora {
  max-width: 9rem;
}

@media (max-width: 620px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
