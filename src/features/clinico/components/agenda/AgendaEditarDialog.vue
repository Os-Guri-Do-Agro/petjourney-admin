<script setup lang="ts">
/**
 * Edição de um atendimento que já existe.
 *
 * Até aqui a agenda sabia **criar**, **mover** e **cancelar**. Faltava corrigir: tipo errado,
 * sala errada, observação desatualizada não tinham caminho nenhum, e a saída de quem estava no
 * balcão era cancelar e criar de novo — que manda aviso de cancelamento para um responsável que
 * não teve nada cancelado e parte o histórico do paciente em dois registros.
 *
 * Três decisões que este formulário toma:
 *
 * - **O paciente não se edita.** Ele aparece no topo, fixo. Trocar quem é atendido não é editar
 *   este atendimento, é criar outro — outro tutor, outro histórico, outro telefone. Um `Select`
 *   ali seria o engano que nenhuma tela desfaz depois.
 * - **A mensagem só aparece quando há o que avisar.** Corrigir o tipo de "Consulta" para
 *   "Retorno" não interessa a quem vai vir; mudar a hora, sim. Campo de aviso que aparece sempre
 *   vira campo que se ignora sempre.
 * - **Nada bloqueia, como no resto da agenda.** Sobreposição e sala ocupada seguem salváveis; o
 *   que muda é o texto do botão, que passa a nomear a consequência.
 *
 * A duração segue o tipo **quando o tipo muda**, e só então. Um card que alguém redimensionou na
 * grade para 45 min não volta sozinho para os 30 do catálogo só porque a caixa foi aberta.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicPatientHeader from '../base/ClinicPatientHeader.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Appointment } from '../../data/types'
import { clockToMinutes, minutesToClock } from '../../domain/clinic-time'
import { ordenarConflitos, severidadeMaxima } from '../../domain/conflicts'
import { buscarAlternativas } from '../../domain/slots'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ appointment: Appointment | null }>()

const emit = defineEmits<{
  /** A mensagem viaja junto e vira comprovante lá fora — ela não morre com a caixa. */
  salvar: [
    dados: {
      typeId: string
      professionalId: string
      roomIds: string[]
      inicio: string
      fim: string
      observacao: string
    },
    mensagem: string,
  ]
  fechar: []
}>()

const { t } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const typeId = ref<string | null>(null)
const professionalId = ref<string | null>(null)
const roomIds = ref<string[]>([])
const hora = ref('09:00')
const duracao = ref(30)
const observacao = ref('')
const mensagem = ref('')

const aberto = computed({
  get: () => props.appointment !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const pet = computed(() => (props.appointment ? clinico.pet(props.appointment.petId) : null))
const tutor = computed(() => (props.appointment ? clinico.tutor(props.appointment.tutorId) : null))
const tipo = computed(() => (typeId.value ? clinico.tipo(typeId.value) : null))

/** O dia não se edita aqui: mudar de dia é remarcar, e remarcar tem caixa própria. */
const data = computed(() =>
  props.appointment ? clinicClock.dateOf(props.appointment.inicio) : clinicClock.today(),
)

const minutoInicio = computed(() => clockToMinutes(hora.value))
const inicioIso = computed(() => clinicClock.toIso(data.value, minutoInicio.value))
const fimIso = computed(() => clinicClock.toIso(data.value, minutoInicio.value + duracao.value))

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
    .map((sala) => ({ valor: sala.id, rotulo: sala.nome }))
})

const completo = computed(() => Boolean(typeId.value && professionalId.value && hora.value))

/**
 * Conflitos do **candidato**, não do atendimento salvo.
 *
 * O `id` vai junto de propósito: sem ele o detector encontra o próprio atendimento no dia e
 * acusa que ele se sobrepõe a si mesmo — toda edição abriria com um aviso falso.
 */
const conflitos = computed(() => {
  const appointment = props.appointment

  if (!appointment || !completo.value) {
    return []
  }

  return ordenarConflitos(
    agenda.conflitosDe({
      id: appointment.id,
      petId: appointment.petId,
      professionalId: professionalId.value as string,
      roomIds: roomIds.value,
      typeId: typeId.value as string,
      inicio: inicioIso.value,
      fim: fimIso.value,
      linkedGroupId: appointment.linkedGroupId,
    }),
  )
})

const gravidade = computed(() => severidadeMaxima(conflitos.value))

/** Alternativas só quando há choque de horário — igual à criação, pela mesma razão. */
const alternativas = computed(() => {
  const contexto = agenda.contextoDeConflito
  const appointment = props.appointment

  if (!contexto || !appointment || !completo.value) {
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
      petId: appointment.petId,
      typeId: typeId.value as string,
      duracaoMinutos: duracao.value,
      professionalIds: professionalId.value ? [professionalId.value] : [],
      roomIds: roomIds.value,
      preferenciaMinutos: minutoInicio.value,
      data: data.value,
    },
    contexto,
    4,
  )
})

function nomesDasSalas(ids: string[]) {
  return ids.map((id) => clinico.sala(id)?.nome ?? id).join(' + ')
}

/**
 * O que muda, em "de → para".
 *
 * Existe porque salvar uma edição é decidir sem ver a grade: a caixa cobre o card. Sem este
 * resumo, quem mexeu em três campos e foi interrompido por um telefonema volta sem saber o que
 * já tinha mexido — e o botão "Salvar" fica com a mesma cara nos dois casos.
 */
const mudancas = computed(() => {
  const appointment = props.appointment

  if (!appointment) {
    return []
  }

  const linhas: { chave: string; rotulo: string; de: string; para: string }[] = []

  if (typeId.value !== appointment.typeId) {
    linhas.push({
      chave: 'tipo',
      rotulo: t('clinico.agenda.criar.tipo'),
      de: clinico.tipo(appointment.typeId)?.nome ?? '—',
      para: tipo.value?.nome ?? '—',
    })
  }

  if (inicioIso.value !== appointment.inicio || fimIso.value !== appointment.fim) {
    linhas.push({
      chave: 'horario',
      rotulo: t('clinico.agenda.criar.hora'),
      de: formato.intervalo(appointment.inicio, appointment.fim),
      para: formato.intervalo(inicioIso.value, fimIso.value),
    })
  }

  if (professionalId.value !== appointment.professionalId) {
    linhas.push({
      chave: 'profissional',
      rotulo: t('clinico.agenda.mover.profissional'),
      de: clinico.profissional(appointment.professionalId)?.nome ?? '—',
      para: professionalId.value
        ? (clinico.profissional(professionalId.value)?.nome ?? '—')
        : '—',
    })
  }

  /** Comparação por conjunto: a mesma cirurgia listada em outra ordem não é uma mudança. */
  if ([...roomIds.value].sort().join(',') !== [...appointment.roomIds].sort().join(',')) {
    linhas.push({
      chave: 'sala',
      rotulo: t('clinico.agenda.criar.sala'),
      de: nomesDasSalas(appointment.roomIds) || t('clinico.agenda.semSala'),
      para: nomesDasSalas(roomIds.value) || t('clinico.agenda.semSala'),
    })
  }

  if (observacao.value.trim() !== (appointment.observacao ?? '').trim()) {
    linhas.push({
      chave: 'observacao',
      rotulo: t('clinico.prontuario.conduta.observacao'),
      de: appointment.observacao?.trim() || '—',
      para: observacao.value.trim() || '—',
    })
  }

  return linhas
})

/**
 * Só horário e profissional produzem aviso.
 *
 * É o recorte do que o responsável precisa saber para não bater na porta na hora errada nem
 * procurar por quem não vai atender. Tipo, sala e observação são registro interno.
 */
const avisavel = computed(() =>
  mudancas.value.some((linha) => linha.chave === 'horario' || linha.chave === 'profissional'),
)

const rotuloDoBotao = computed(() => {
  if (gravidade.value !== null) {
    return t('clinico.agenda.editar.salvarMesmoAssim')
  }

  return avisavel.value
    ? t('clinico.agenda.editar.salvarEAvisar')
    : t('clinico.agenda.editar.salvar')
})

/** Abrir precisa refletir o atendimento como ele está agora, não o da vez passada. */
watch(
  () => props.appointment,
  (appointment) => {
    if (!appointment) {
      return
    }

    typeId.value = appointment.typeId
    professionalId.value = appointment.professionalId
    roomIds.value = [...appointment.roomIds]
    observacao.value = appointment.observacao ?? ''
    mensagem.value = ''

    const inicioMin = clinicClock.minutesOf(appointment.inicio)

    hora.value = minutesToClock(inicioMin)
    duracao.value = Math.max(clinicClock.minutesOf(appointment.fim) - inicioMin, 10)
  },
  { immediate: true },
)

/**
 * O texto nasce preenchido no instante em que passa a haver o que avisar, e some junto com o
 * motivo — quem mudou a hora e voltou atrás não fica com um rascunho órfão para apagar.
 */
watch([avisavel, inicioIso, professionalId], () => {
  if (!avisavel.value) {
    mensagem.value = ''

    return
  }

  mensagem.value = t('clinico.agenda.editar.mensagemPadrao', {
    paciente: pet.value?.nome ?? '',
    data: formato.dataCurta(data.value),
    hora: formato.hora(inicioIso.value),
  })
})

/**
 * Trocar o tipo troca a duração e revisa as salas: consultório não serve para cirurgia.
 *
 * Feito na mão, no `@update:model-value`, e não num `watch(typeId)` — o watcher também dispararia
 * ao semear o formulário, e a abertura da caixa reescreveria a duração de um card que alguém
 * tinha redimensionado de propósito.
 */
function trocarTipo(novo: string) {
  typeId.value = novo
  duracao.value = clinico.tipo(novo)?.duracaoMinutos ?? duracao.value

  const permitidas = opcoesSalas.value.map((opcao) => opcao.valor)
  const sobreviventes = roomIds.value.filter((id) => permitidas.includes(id))

  if (sobreviventes.length > 0) {
    roomIds.value = sobreviventes

    return
  }

  const padrao = professionalId.value
    ? clinico.profissional(professionalId.value)?.salaPadraoId
    : null

  const escolhida = permitidas.includes(padrao ?? '') ? padrao : permitidas[0]

  roomIds.value = escolhida ? [escolhida] : []
}

function usarAlternativa(inicio: string, profissionalSugerido: string) {
  hora.value = minutesToClock(clinicClock.minutesOf(inicio))
  professionalId.value = profissionalSugerido
}

function confirmar() {
  if (!completo.value || mudancas.value.length === 0 || agenda.salvando) {
    return
  }

  emit(
    'salvar',
    {
      typeId: typeId.value as string,
      professionalId: professionalId.value as string,
      roomIds: [...roomIds.value],
      inicio: inicioIso.value,
      fim: fimIso.value,
      observacao: observacao.value.trim(),
    },
    avisavel.value ? mensagem.value : '',
  )
}
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(40rem, 94vw)' }"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="pi pi-pencil" /></span>
        {{ t('clinico.agenda.editar.titulo') }}
      </h2>
    </template>

    <form v-if="appointment" class="editar clinic-scope" @submit.prevent="confirmar">
      <!--
        Paciente fixo, com a mesma cara do drawer. Está aqui para confirmar **em quem** se está
        mexendo — a caixa cobre o card que originou o clique.
      -->
      <div class="editar__paciente">
        <ClinicPatientHeader :pet="pet" :tutor="tutor" compacto />
        <p class="editar__nota">{{ t('clinico.agenda.editar.pacienteFixo') }}</p>
      </div>

      <p class="editar__dia">{{ formato.dataLonga(data) }}</p>

      <div class="editar__linha">
        <ClinicField :rotulo="t('clinico.agenda.criar.tipo')">
          <template #default="{ id }">
            <Select
              :input-id="id"
              :model-value="typeId"
              fluid
              option-label="rotulo"
              option-value="valor"
              :options="opcoesTipos"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
              @update:model-value="trocarTipo"
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

      <div class="editar__linha">
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

        <!--
          Lista, não escolha única: um atendimento pode ocupar duas salas (centro cirúrgico e
          recuperação). Um `Select` aqui apagaria a segunda sem avisar, na primeira edição de
          qualquer coisa — inclusive de quem só veio corrigir a observação.
        -->
        <ClinicField :rotulo="t('clinico.agenda.criar.sala')">
          <template #default="{ id }">
            <MultiSelect
              :input-id="id"
              v-model="roomIds"
              fluid
              display="chip"
              option-label="rotulo"
              option-value="valor"
              :options="opcoesSalas"
              :placeholder="t('clinico.agenda.criar.semSala')"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>
      </div>

      <p class="editar__janela clinic-value">
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

      <!-- O resumo do que muda, logo acima do botão que o confirma. -->
      <section v-if="mudancas.length > 0" class="mudancas">
        <h4 class="clinic-label">{{ t('clinico.agenda.editar.mudancas') }}</h4>
        <ul class="mudancas__lista">
          <li v-for="linha in mudancas" :key="linha.chave" class="mudanca">
            <span class="clinic-label">{{ linha.rotulo }}</span>
            <span class="mudanca__valores">
              <s>{{ linha.de }}</s>
              <i class="pi pi-arrow-right" aria-hidden="true" />
              <strong>{{ linha.para }}</strong>
            </span>
          </li>
        </ul>
      </section>

      <p v-if="appointment.linkedGroupId" class="editar__ligado">
        <i class="pi pi-link" aria-hidden="true" />
        {{ t('clinico.agenda.editar.grupoLigado') }}
      </p>

      <label v-if="avisavel" class="editar__campo">
        <span class="clinic-label">{{ t('clinico.agenda.mover.mensagem') }}</span>
        <Textarea v-model="mensagem" rows="3" auto-resize fluid />
      </label>
    </form>

    <template #footer>
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('fechar')"
      />
      <Button
        :severity="gravidade === 'blocking' ? 'danger' : gravidade ? 'warn' : 'primary'"
        :disabled="!completo || mudancas.length === 0 || agenda.salvando"
        :loading="agenda.salvando"
        :label="rotuloDoBotao"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.editar {
  display: grid;
  gap: var(--clinic-space-3);
}

.editar__paciente {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.editar__nota {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.editar__dia {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.editar__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 40rem) {
  .editar__linha {
    grid-template-columns: 1fr;
  }
}

.editar__janela {
  margin: 0;
  color: var(--clinic-text);
}

.editar__ligado,
.editar__campo {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
}

.editar__ligado {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.opcao {
  display: grid;
  gap: 0.1rem;
}

.opcao small {
  color: var(--clinic-muted);
}

.alternativas,
.mudancas {
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
  gap: 0.1rem;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  font-weight: inherit;
  text-align: start;
}

.alternativa small {
  color: var(--clinic-muted);
}

.mudancas__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  list-style: none;
}

.mudanca {
  display: grid;
  gap: 0.1rem;
}

.mudanca__valores {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.mudanca__valores s {
  color: var(--clinic-muted);
}

.mudanca__valores i {
  color: var(--clinic-muted);
  font-size: 0.75rem;
}
</style>
