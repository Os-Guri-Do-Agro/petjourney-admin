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
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaAvisos from './AgendaAvisos.vue'
import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
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
const idTitulo = useId()
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

/** O fim e a duração, embaixo da hora — a duração segue o tipo só quando o tipo muda. */
const janela = computed(() =>
  completo.value
    ? `${t('clinico.agenda.tabela.ate', { hora: formato.hora(fimIso.value) })} · ${formato.duracao(duracao.value)}`
    : '',
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
    class="clinic-dialog hc-tema agenda-dialogo"
    :style="{ width: 'min(40rem, 94vw)' }"
    :aria-labelledby="idTitulo"
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.agenda.editar.titulo')"
        :subtitulo="formato.dataLonga(data)"
        icone="ph ph-pencil-simple"
      />
    </template>

    <form v-if="appointment" class="formulario clinic-scope" @submit.prevent="confirmar">
      <!--
        Paciente fixo, com a mesma cara do painel do atendimento. Está aqui para confirmar **em
        quem** se está mexendo — a caixa cobre o cartão que originou o clique.
      -->
      <div class="paciente formulario__largo">
        <ClinicPatientHeader :pet="pet" :tutor="tutor" compacto />
        <p class="paciente__nota">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('clinico.agenda.editar.pacienteFixo') }}
        </p>
      </div>

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

      <!--
        Lista, não escolha única: um atendimento pode ocupar duas salas (centro cirúrgico e
        recuperação). Um `Select` aqui apagaria a segunda sem avisar, na primeira edição de
        qualquer coisa — inclusive de quem só veio corrigir a observação.
      -->
      <ClinicField :rotulo="t('clinico.agenda.criar.sala')">
        <template #default="{ id }">
          <MultiSelect
            v-model="roomIds"
            :input-id="id"
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

      <ClinicField :rotulo="t('clinico.prontuario.conduta.observacao')" largo>
        <template #default="{ id }">
          <Textarea :id="id" v-model="observacao" auto-resize rows="2" fluid />
        </template>
      </ClinicField>

      <AgendaAvisos v-if="conflitos.length > 0" class="formulario__largo" :conflitos="conflitos" />

      <section v-if="alternativas.length > 0" class="alternativas formulario__largo">
        <h3 class="formulario__subtitulo">{{ t('clinico.agenda.criar.alternativas') }}</h3>
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

      <!-- O resumo do que muda, logo acima do botão que o confirma. -->
      <section v-if="mudancas.length > 0" class="mudancas formulario__largo">
        <h3 class="formulario__subtitulo">{{ t('clinico.agenda.editar.mudancas') }}</h3>
        <dl class="mudancas__lista">
          <div v-for="linha in mudancas" :key="linha.chave" class="mudanca">
            <dt>{{ linha.rotulo }}</dt>
            <dd>
              <s>{{ linha.de }}</s>
              <i class="ph ph-arrow-right" aria-hidden="true" />
              <strong>{{ linha.para }}</strong>
            </dd>
          </div>
        </dl>
      </section>

      <p v-if="appointment.linkedGroupId" class="ligado formulario__largo">
        <i class="ph ph-link" aria-hidden="true" />
        {{ t('clinico.agenda.editar.grupoLigado') }}
      </p>

      <ClinicField v-if="avisavel" :rotulo="t('clinico.agenda.mover.mensagem')" largo>
        <template #default="{ id }">
          <Textarea :id="id" v-model="mensagem" rows="3" auto-resize fluid />
        </template>
      </ClinicField>
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
.formulario {
  display: grid;
  gap: 18px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.formulario__largo {
  grid-column: 1 / -1;
}

.formulario__subtitulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.paciente {
  display: grid;
  gap: 8px;
}

.paciente__nota {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.opcao {
  display: grid;
  gap: 1px;
}

.opcao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.alternativas,
.mudancas {
  display: grid;
  gap: 8px;
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

/* De → para, numa folha clara: o que se decide sem ver a grade. */
.mudancas__lista {
  display: grid;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.mudanca {
  display: grid;
  align-items: baseline;
  gap: 4px 16px;
  padding: 10px 14px;
  grid-template-columns: 9rem minmax(0, 1fr);
}

.mudanca + .mudanca {
  border-top: 1px solid var(--linha);
}

.mudanca dt {
  color: var(--tinta-2);
  font-size: 13px;
}

.mudanca dd {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin: 0;
  font-size: 14px;
}

.mudanca s {
  color: var(--tinta-3);
}

.mudanca i {
  color: var(--tinta-3);
  font-size: 13px;
}

.mudanca strong {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.ligado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

@media (max-width: 620px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }

  .mudanca {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
