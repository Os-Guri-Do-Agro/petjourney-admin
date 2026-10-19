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
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import AgendaAvisos from './AgendaAvisos.vue'
import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
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

const idTitulo = useId()

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

/**
 * O que a busca da lista também enxerga: o responsável e o telefone.
 *
 * A recepção procura como o telefone toca — "é o cachorro da Rita", "final 1188" —, e a busca
 * global já achava assim. Só pelo nome do animal, o paciente certo parecia não existir.
 */
function textoDeBusca(tutorId: string): string {
  const tutor = clinico.tutor(tutorId)

  if (!tutor) {
    return ''
  }

  return [tutor.nome, tutor.telefone, tutor.telefone?.replace(/\D/g, '')]
    .filter(Boolean)
    .join(' ')
}

const opcoesPacientes = computed(() =>
  clinico.pets
    .map((item) => ({
      valor: item.id,
      rotulo: item.nome,
      detalhe: [formato.especie(item.especie), clinico.tutor(item.tutorId)?.nome]
        .filter(Boolean)
        .join(' · '),
      busca: textoDeBusca(item.tutorId),
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

/** A janela por extenso, embaixo da hora: é o que a recepção lê em voz alta no telefone. */
const janela = computed(() =>
  completo.value
    ? `${t('clinico.agenda.tabela.ate', { hora: formato.hora(fimIso.value) })} · ${formato.duracao(duracao.value)}`
    : '',
)

const rotuloDoBotao = computed(() =>
  gravidade.value === null
    ? t('clinico.agenda.criar.agendar')
    : t('clinico.agenda.criar.agendarMesmoAssim'),
)

/**
 * Onde a hora começa ao abrir: no início do expediente, ou — hoje, com o dia já andando — no
 * próximo passo da agenda. Abrir às 17h30 com "08:00" preenchido marcava no passado quem não
 * conferisse a hora.
 */
function primeiroHorario(): number {
  const expediente = clockToMinutes(agenda.dia?.expediente?.inicio ?? '09:00')
  const agora = clinicClock.now()

  if (agora.date !== props.data) {
    return expediente
  }

  const passo = clinico.clinic?.slotMinutos ?? 15

  return Math.max(expediente, Math.ceil(agora.minutes / passo) * passo)
}

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

    hora.value = minutesToClock(props.minutoInicial ?? primeiroHorario())
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
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(40rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="encaixe ? t('clinico.agenda.criar.tituloEncaixe') : t('clinico.agenda.criar.titulo')"
        :subtitulo="formato.dataLonga(data)"
        :icone="encaixe ? 'ph ph-lightning' : 'ph ph-calendar-plus'"
        :tom="encaixe ? 'atencao' : 'clinica'"
      >
        <span v-if="encaixe" class="ui-selo ui-selo--atencao">
          {{ t('clinico.agenda.criar.encaixe') }}
        </span>
      </AgendaDialogoTopo>
    </template>

    <PacienteNovoForm
      v-if="cadastrandoPaciente"
      @criado="aoCriarPaciente"
      @cancelar="cadastrandoPaciente = false"
    />

    <form v-else class="formulario clinic-scope" @submit.prevent="confirmar">
      <ClinicField :rotulo="t('clinico.agenda.criar.paciente')" largo>
        <template #default="{ id }">
          <Select
            v-model="petId"
            :input-id="id"
            filter
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesPacientes"
            :filter-fields="['rotulo', 'busca']"
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
              O atalho fica no rodapé da lista aberta: é exatamente onde o olho está no momento em
              que a busca não devolve o paciente. Tem faixa própria e parece um botão — texto solto
              no fim de sessenta nomes não se encontra.
            -->
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
            v-model="typeId"
            :input-id="id"
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

      <ClinicField :rotulo="t('clinico.agenda.criar.hora')" :dica="janela">
        <template #default="{ id, descrito }">
          <InputText :id="id" v-model="hora" type="time" fluid :aria-describedby="descrito" />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.mover.profissional')">
        <template #default="{ id }">
          <Select
            v-model="professionalId"
            :input-id="id"
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
            v-model="roomId"
            :input-id="id"
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

      <ClinicField :rotulo="t('clinico.prontuario.conduta.observacao')" largo>
        <template #default="{ id }">
          <Textarea :id="id" v-model="observacao" auto-resize rows="2" fluid />
        </template>
      </ClinicField>

      <!-- O conflito aparece enquanto se escolhe, não ao salvar. -->
      <AgendaAvisos v-if="conflitos.length > 0" class="formulario__largo" :conflitos="conflitos" />

      <!--
        Sem horário que sirva, a fila de espera é a saída — e ela precisa estar **aqui**, no
        momento em que a recepção descobre que não tem vaga. Mandar procurar outra tela é como o
        fluxo se perdia: a pessoa desligava o telefone com um "eu te aviso" que não virava registro.
      -->
      <section v-if="semHorarioBom" class="sem-vaga formulario__largo">
        <div class="sem-vaga__texto">
          <strong>{{ t('clinico.agenda.criar.semVagaTitulo') }}</strong>
          <p>{{ t('clinico.agenda.criar.semVagaDescricao') }}</p>
        </div>
        <Button
          :label="t('clinico.fila.adicionar')"
          icon="ph ph-users"
          size="small"
          severity="secondary"
          outlined
          @click="emit('entrarNaFila', { petId, typeId, professionalId })"
        />
      </section>

      <section v-if="alternativas.length > 0" class="alternativas formulario__largo">
        <h3 class="alternativas__titulo">{{ t('clinico.agenda.criar.alternativas') }}</h3>
        <div class="alternativas__lista">
          <button
            v-for="sugestao in alternativas"
            :key="`${sugestao.professionalId}-${sugestao.inicio}`"
            type="button"
            class="alternativa"
            @click="usarAlternativa(sugestao.inicio, sugestao.professionalId)"
          >
            <strong class="ui-hora">{{ formato.hora(sugestao.inicio) }}</strong>
            <small>{{ clinico.profissional(sugestao.professionalId)?.nome }}</small>
          </button>
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
/* Os campos em duas colunas, com respiro: paciente e observação ocupam a linha inteira. */
.formulario {
  display: grid;
  gap: 18px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.formulario__largo {
  grid-column: 1 / -1;
}

.opcao {
  display: grid;
  gap: 1px;
}

.opcao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/*
 * O atalho do rodapé da lista de pacientes: faixa própria, rótulo à esquerda, seta à direita e o
 * fundo que acende no hover — é uma porta, e precisa parecer uma.
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

.sem-vaga {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--atencao-fundo);
}

.sem-vaga__texto {
  flex: 1 1 16rem;
}

.sem-vaga strong {
  color: var(--atencao-tinta);
  font-size: 14px;
  font-weight: 600;
}

.sem-vaga p {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.alternativas {
  display: grid;
  gap: 8px;
}

.alternativas__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.alternativas__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Hora em cima, profissional embaixo: a sugestão lê como um horário, não como um rótulo. */
.alternativa {
  display: grid;
  min-height: 44px;
  justify-items: start;
  gap: 1px;
  padding: 6px 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.alternativa:hover {
  border-color: var(--clinica);
  background: var(--clinica-fundo);
}

.alternativa:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

.alternativa small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

@media (max-width: 620px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
