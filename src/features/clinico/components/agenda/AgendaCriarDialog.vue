<script setup lang="ts">
/**
 * Criação de atendimento — e de encaixe, que é o mesmo formulário com a marca ligada.
 *
 * Três coisas que este formulário faz e um formulário genérico não faria:
 *
 * - **O conflito aparece enquanto se escolhe, não ao salvar.** Trocar profissional ou hora
 *   recalcula os avisos na hora. Descobrir a sobreposição depois de apertar "Agendar" é
 *   descobrir na frente do responsável que já está no telefone.
 * - **Nada bloqueia.** Sobreposição, sala ocupada e até dia fechado seguem agendáveis — o que
 *   muda é o texto do botão, que passa a nomear a consequência. Regra que proíbe vira regra
 *   contornada no papel, e a clínica encaixa a emergência de qualquer jeito.
 * - **Quando há sobreposição, a caixa sugere horários livres.** É a diferença entre "não pode" e
 *   "pode às 15:30" — e é a informação que a recepção precisa para responder na hora.
 *
 * O tipo de atendimento manda na duração e nas salas compatíveis: escolher "Cirurgia" muda os
 * dois sem ninguém digitar nada.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import ClinicField from '../base/ClinicField.vue'
import PacienteNovoForm from '../pacientes/PacienteNovoForm.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { ISODate, Pet } from '../../data/types'
import { clockToMinutes, minutesToClock } from '../../domain/clinic-time'
import { ordenarConflitos, severidadeMaxima } from '../../domain/conflicts'
import { buscarAlternativas } from '../../domain/slots'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  /** Encaixe entra pelo mesmo formulário, com a marca já ligada e o aviso de carga esperado. */
  encaixe: boolean
  data: ISODate
  /** Sugestões vindas do clique numa faixa vazia da grade; ausentes quando veio do botão. */
  /** Sugestão de partida; a escolha do formulário vive em `professionalId`. */
  sugestaoProfissional?: string | null
  minutoInicial?: number | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  criado: []
  /** Sem horário: a recepção manda o responsável para a fila sem trocar de tela. */
  entrarNaFila: [
    sugestao: { petId: string | null; typeId: string | null; professionalId: string | null },
  ]
}>()

const { t, locale } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

/**
 * O diálogo tem dois conteúdos, não dois modais.
 *
 * Cadastrar paciente no meio do agendamento é caso comum — alguém liga, o bicho não está na base.
 * Empilhar um segundo modal esconderia o contexto do agendamento e faria o "fechar" voltar dois
 * passos em vez de um.
 */
const cadastrandoPaciente = ref(false)

const petId = ref<string | null>(null)
const typeId = ref<string | null>(null)
const professionalId = ref<string | null>(null)
const roomId = ref<string | null>(null)
const hora = ref('09:00')
const observacao = ref('')
const enviando = ref(false)

const tipo = computed(() => (typeId.value ? clinico.tipo(typeId.value) : null))
const pet = computed(() => (petId.value ? clinico.pet(petId.value) : null))

const duracao = computed(() => tipo.value?.duracaoMinutos ?? 30)

const opcoesPacientes = computed(() =>
  clinico.pets
    .map((item) => ({
      valor: item.id,
      rotulo: item.nome,
      detalhe: [formato.especie(item.especie), clinico.tutor(item.tutorId)?.nome]
        .filter(Boolean)
        .join(' · '),
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, INTL_LOCALE[locale.value as Locale])),
)

const opcoesTipos = computed(() =>
  clinico.tipos.map((item) => ({
    valor: item.id,
    rotulo: item.nome,
    detalhe: formato.duracao(item.duracaoMinutos),
  })),
)

const opcoesProfissionais = computed(() =>
  clinico.profissionais.map((item) => ({
    valor: item.id,
    rotulo: item.nome,
    detalhe: item.especialidade,
  })),
)

/** Só as salas que o tipo aceita; lista vazia no tipo significa qualquer sala. */
const opcoesSalas = computed(() => {
  const compativeis = tipo.value?.salasCompativeis ?? []

  return clinico.salas
    .filter((sala) => compativeis.length === 0 || compativeis.includes(sala.kind))
    .map((sala) => ({ valor: sala.id, rotulo: sala.nome, detalhe: '' }))
})

const minutoInicio = computed(() => clockToMinutes(hora.value))
const inicioIso = computed(() => clinicClock.toIso(props.data, minutoInicio.value))
const fimIso = computed(() => clinicClock.toIso(props.data, minutoInicio.value + duracao.value))

const completo = computed(() =>
  Boolean(petId.value && typeId.value && professionalId.value && hora.value),
)

const conflitos = computed(() => {
  if (!completo.value || !pet.value) {
    return []
  }

  return ordenarConflitos(
    agenda.conflitosDe({
      petId: pet.value.id,
      professionalId: professionalId.value as string,
      roomIds: roomId.value ? [roomId.value] : [],
      typeId: typeId.value as string,
      inicio: inicioIso.value,
      fim: fimIso.value,
      linkedGroupId: null,
    }),
  )
})

const gravidade = computed(() => severidadeMaxima(conflitos.value))

/**
 * Há choque **e** nenhuma alternativa livre: é literalmente "não tenho horário".
 *
 * A distinção importa. Com alternativa, a resposta é outro horário; sem nenhuma, a única
 * resposta honesta é a fila de espera — e é aí que ela precisa aparecer.
 */
const semHorarioBom = computed(
  () =>
    completo.value &&
    alternativas.value.length === 0 &&
    conflitos.value.some(
      (conflito) =>
        conflito.kind === 'professional-overlap' || conflito.kind === 'room-overlap',
    ),
)

/**
 * Alternativas só quando há choque de horário. Sugerir outro horário para quem não tem conflito
 * seria dizer "tem certeza?" a cada agendamento normal.
 */
const alternativas = computed(() => {
  const contexto = agenda.contextoDeConflito

  if (!contexto || !completo.value || !pet.value) {
    return []
  }

  const temChoque = conflitos.value.some(
    (conflito) =>
      conflito.kind === 'professional-overlap' ||
      conflito.kind === 'room-overlap' ||
      conflito.kind === 'pet-double-book',
  )

  if (!temChoque) {
    return []
  }

  return buscarAlternativas(
    {
      petId: pet.value.id,
      typeId: typeId.value as string,
      duracaoMinutos: duracao.value,
      professionalIds: professionalId.value ? [professionalId.value] : [],
      roomIds: roomId.value ? [roomId.value] : [],
      preferenciaMinutos: minutoInicio.value,
      data: props.data,
    },
    contexto,
    4,
  )
})

const rotuloDoBotao = computed(() =>
  gravidade.value === null
    ? t('clinico.agenda.criar.agendar')
    : t('clinico.agenda.criar.agendarMesmoAssim'),
)

/** Reabrir precisa começar limpo — formulário que guarda a escolha da vez passada agenda errado. */
watch(
  () => props.visivel,
  (aberto) => {
    if (!aberto) {
      return
    }

    petId.value = null
    observacao.value = ''
    cadastrandoPaciente.value = false
    typeId.value = clinico.tipos[0]?.id ?? null
    professionalId.value = props.sugestaoProfissional ?? clinico.profissionais[0]?.id ?? null

    const expediente = agenda.dia?.expediente?.inicio ?? '09:00'
    hora.value = minutesToClock(props.minutoInicial ?? clockToMinutes(expediente))
  },
)

/** Trocar o tipo troca a sala: consultório não serve para cirurgia. */
watch(typeId, () => {
  const doProfissional = professionalId.value
    ? clinico.profissional(professionalId.value)?.salaPadraoId
    : null

  const permitida = opcoesSalas.value.find((opcao) => opcao.valor === doProfissional)

  roomId.value = permitida?.valor ?? opcoesSalas.value[0]?.valor ?? null
})

/** O paciente recém-cadastrado já entra escolhido: ninguém o procuraria de novo na lista. */
function aoCriarPaciente(pet: Pet) {
  petId.value = pet.id
  cadastrandoPaciente.value = false
}

function usarAlternativa(inicio: string, profissionalSugerido: string) {
  hora.value = minutesToClock(clinicClock.minutesOf(inicio))
  professionalId.value = profissionalSugerido
}

async function confirmar() {
  if (!completo.value || !pet.value || enviando.value) {
    return
  }

  enviando.value = true

  try {
    const criado = await agenda.criar({
      petId: pet.value.id,
      tutorId: pet.value.tutorId,
      professionalId: professionalId.value as string,
      roomIds: roomId.value ? [roomId.value] : [],
      typeId: typeId.value as string,
      inicio: inicioIso.value,
      fim: fimIso.value,
      encaixe: props.encaixe,
      observacao: observacao.value.trim(),
      origem: props.encaixe ? 'encaixe' : 'recepcao',
    })

    if (criado) {
      emit('criado')
      emit('update:visivel', false)
    }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(40rem, 94vw)' }"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i :class="encaixe ? 'pi pi-bolt' : 'pi pi-calendar-plus'" /></span>
        {{ encaixe ? t('clinico.agenda.criar.tituloEncaixe') : t('clinico.agenda.criar.titulo') }}
      </h2>
    </template>

    <PacienteNovoForm
      v-if="cadastrandoPaciente"
      @criado="aoCriarPaciente"
      @cancelar="cadastrandoPaciente = false"
    />

    <form v-else class="criar clinic-scope" @submit.prevent="confirmar">
      <p class="criar__dia">
        {{ formato.dataLonga(data) }}
        <span v-if="encaixe" class="criar__marca">{{ t('clinico.agenda.criar.encaixe') }}</span>
      </p>

      <ClinicField :rotulo="t('clinico.agenda.criar.paciente')">
        <template #default="{ id }">
          <Select
            :input-id="id"
            v-model="petId"
            filter
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesPacientes"
            :filter-placeholder="t('clinico.agenda.criar.buscarPaciente')"
            :placeholder="t('clinico.agenda.criar.escolhaPaciente')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          >
            <template #option="{ option }">
              <span class="opcao">
                <strong>{{ option.rotulo }}</strong>
                <small>{{ option.detalhe }}</small>
              </span>
            </template>

            <!--
              O atalho fica no rodapé da lista aberta: é exatamente onde o olho está no momento
              em que a busca não devolve o paciente.

              **E parece um botão.** Na primeira versão era texto em cor de acento sobre fundo
              transparente, no fim de uma lista de sessenta nomes — a mesma forma de um rodapé
              decorativo. Quem não sabia que ele existia não o encontrava, e quem sabia ainda
              precisava procurar. Agora tem faixa própria, ícone em disco e a seta que diz que
              leva a algum lugar.
            -->
            <template #footer>
              <Button class="cadastrar" text fluid @click="cadastrandoPaciente = true">
                <span class="cadastrar__marca" aria-hidden="true"><i class="pi pi-user-plus" /></span>
                <span class="cadastrar__texto">
                  <strong>{{ t('clinico.paciente.novo.atalho') }}</strong>
                  <small>{{ t('clinico.paciente.novo.atalhoAjuda') }}</small>
                </span>
                <i class="pi pi-arrow-right cadastrar__seta" aria-hidden="true" />
              </Button>
            </template>
          </Select>
        </template>
      </ClinicField>

      <div class="criar__linha">
        <ClinicField :rotulo="t('clinico.agenda.criar.tipo')">
          <template #default="{ id }">
            <Select
              :input-id="id"
              v-model="typeId"
              fluid
              option-label="rotulo"
              option-value="valor"
              :options="opcoesTipos"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            >
              <template #option="{ option }">
                <span class="opcao">
                  <strong>{{ option.rotulo }}</strong>
                  <small>{{ option.detalhe }}</small>
                </span>
              </template>
            </Select>
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.agenda.criar.hora')">
          <template #default="{ id }">
            <InputText :id="id" v-model="hora" type="time" fluid />
          </template>
        </ClinicField>
      </div>

      <div class="criar__linha">
        <ClinicField :rotulo="t('clinico.agenda.mover.profissional')">
          <template #default="{ id }">
            <Select
              :input-id="id"
              v-model="professionalId"
              fluid
              option-label="rotulo"
              option-value="valor"
              :options="opcoesProfissionais"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.agenda.criar.sala')">
          <template #default="{ id }">
            <Select
              :input-id="id"
              v-model="roomId"
              fluid
              show-clear
              option-label="rotulo"
              option-value="valor"
              :options="opcoesSalas"
              :placeholder="t('clinico.agenda.criar.semSala')"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>
      </div>

      <!-- A janela por extenso: é o que a recepção lê em voz alta no telefone. -->
      <p v-if="completo" class="criar__janela clinic-value">
        {{ formato.intervalo(inicioIso, fimIso) }} · {{ formato.duracao(duracao) }}
      </p>

      <ClinicField :rotulo="t('clinico.prontuario.conduta.observacao')">
        <template #default="{ id }">
          <Textarea :id="id" v-model="observacao" auto-resize rows="2" fluid />
        </template>
      </ClinicField>

      <ClinicAlertChip
        v-for="(conflito, indice) in conflitos"
        :key="`${conflito.kind}-${indice}`"
        :severidade="conflito.severity === 'blocking' ? 'risco' : 'atencao'"
        :rotulo="formato.conflito(conflito)"
      />

      <!--
        Sem horário que sirva, a fila de espera é a saída — e ela precisa estar **aqui**, no
        momento em que a recepção descobre que não tem vaga. Mandar procurar outra tela é como
        o fluxo se perdia: a pessoa desligava o telefone com um "eu te aviso" que não virava
        registro nenhum.
      -->
      <section v-if="semHorarioBom" class="sem-vaga">
        <div>
          <strong>{{ t('clinico.agenda.criar.semVagaTitulo') }}</strong>
          <p>{{ t('clinico.agenda.criar.semVagaDescricao') }}</p>
        </div>
        <Button
          :label="t('clinico.fila.adicionar')"
          icon="pi pi-users"
          size="small"
          severity="secondary"
          outlined
          @click="emit('entrarNaFila', { petId, typeId, professionalId })"
        />
      </section>

      <section v-if="alternativas.length > 0" class="alternativas">
        <h4 class="clinic-label">{{ t('clinico.agenda.criar.alternativas') }}</h4>
        <div class="alternativas__lista">
          <Button
            v-for="sugestao in alternativas"
            :key="`${sugestao.professionalId}-${sugestao.inicio}`"
            class="alternativa"
            severity="secondary"
            outlined
            size="small"
            @click="usarAlternativa(sugestao.inicio, sugestao.professionalId)"
          >
            <strong class="clinic-value">{{ formato.hora(sugestao.inicio) }}</strong>
            <small>{{ clinico.profissional(sugestao.professionalId)?.nome }}</small>
          </Button>
        </div>
      </section>
    </form>

    <template v-if="!cadastrandoPaciente" #footer>
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('update:visivel', false)"
      />
      <Button
        :severity="gravidade === 'blocking' ? 'danger' : 'primary'"
        :disabled="!completo || enviando"
        :loading="enviando"
        :label="rotuloDoBotao"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.criar {
  display: grid;
  gap: var(--clinic-space-3);
}

.criar__dia {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.criar__dia::first-letter {
  text-transform: uppercase;
}

.criar__marca {
  padding: 0.1rem 0.45rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.criar__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.criar__janela {
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-sunken);
  color: var(--clinic-text);
  font-weight: 700;
}

.opcao {
  display: grid;
  gap: 0.05rem;
}

/*
 * Faixa própria no rodapé da lista, e não botão centralizado: o rótulo alinha à esquerda, a seta
 * vai para a direita e o fundo inverte no hover. O seletor repete as classes do botão para vencer
 * o estilo de botão de texto do tema.
 */
.cadastrar.p-button.p-button-text {
  justify-content: flex-start;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 0;
  border-top: 1px solid var(--clinic-line-strong);
  border-radius: 0;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-base);
  font-weight: inherit;
  text-align: start;
}

.cadastrar.p-button.p-button-text:not(:disabled):hover,
.cadastrar.p-button.p-button-text:focus-visible {
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
  margin-inline-start: auto;
  font-size: 0.72rem;
}

.opcao small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.sem-vaga {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
}

.sem-vaga strong {
  color: var(--clinic-attention-text);
  font-weight: 750;
}

.sem-vaga p {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.alternativas {
  display: grid;
  gap: var(--clinic-space-2);
}

.alternativas__lista {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

/* Hora em cima, profissional embaixo: a sugestão lê como um horário, não como um rótulo. */
.alternativa.p-button {
  display: grid;
  justify-items: start;
  gap: 0.05rem;
  padding: 0.4rem 0.7rem;
  font-weight: inherit;
  text-align: start;
}

.alternativa small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

@media (max-width: 620px) {
  .criar__linha {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
