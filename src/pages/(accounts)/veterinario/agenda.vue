<script setup lang="ts">
import { computed, ref } from 'vue'

import { currentColors } from '@/theme/color-mode'

type AppointmentStatus = 'confirmado' | 'pendente' | 'em-sala' | 'concluido' | 'cancelado'
type AppointmentType = 'consulta' | 'vacina' | 'retorno' | 'exame' | 'cirurgia'
type AppointmentPriority = 'normal' | 'attention' | 'high'
type AgendaState = 'loading' | 'ready' | 'error'
type ViewMode = 'dia' | 'semana' | 'mes'

type Appointment = {
  id: string
  pet: string
  species: string
  breed: string
  age: string
  tutor: string
  tutorPhone: string
  professional: string
  type: AppointmentType
  status: AppointmentStatus
  priority: AppointmentPriority
  day: string
  dateLabel: string
  time: string
  duration: number
  complaint: string
  clinicalNote: string
  alerts: string[]
  sharedAccess: string
  nextAction: string
}

const selectedMode = ref<ViewMode>('semana')
const selectedStatus = ref<AppointmentStatus | 'todos'>('todos')
const agendaState = ref<AgendaState>('ready')
const selectedAppointmentId = ref<string | null>(null)
const detailsModalOpen = ref(false)
const successMessage = ref('')

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--agenda-bg': colors.dashboard.bg,
    '--agenda-card': colors.dashboard.surface,
    '--agenda-surface': colors.dashboard.surfaceSoft,
    '--agenda-line': colors.dashboard.line,
    '--agenda-line-soft': colors.dashboard.lineSoft,
    '--agenda-text': colors.dashboard.text,
    '--agenda-muted': colors.dashboard.muted,
    '--agenda-faint': colors.dashboard.faint,
    '--agenda-primary': colors.vet.primary,
    '--agenda-primary-soft': colors.vet.secondary,
    '--agenda-primary-strong': colors.dashboard.primaryStrong,
    '--agenda-primary-deep': colors.dashboard.primaryDeep,
    '--agenda-success-bg': colors.dashboard.successBg,
    '--agenda-success-text': colors.dashboard.successText,
    '--agenda-warm': colors.dashboard.warm,
    '--agenda-warm-bg': colors.dashboard.warmBg,
    '--agenda-warm-soft': colors.dashboard.warmSoft,
    '--agenda-warm-line': colors.dashboard.warmLine,
    '--agenda-warm-text': colors.dashboard.warmText,
    '--agenda-amber': colors.dashboard.amber,
    '--agenda-amber-bg': colors.dashboard.amberBg,
    '--agenda-amber-text': colors.dashboard.amberText,
    '--agenda-muted-pill-bg': colors.dashboard.mutedPillBg,
    '--agenda-muted-pill-text': colors.dashboard.mutedPillText,
    '--agenda-shadow-rgb': colors.auth.shadowRgb,
  }
})

const days = [
  { label: 'Seg', number: '29', date: '2026-06-29', active: true },
  { label: 'Ter', number: '30', date: '2026-06-30', active: false },
  { label: 'Qua', number: '01', date: '2026-07-01', active: false },
  { label: 'Qui', number: '02', date: '2026-07-02', active: false },
  { label: 'Sex', number: '03', date: '2026-07-03', active: false },
  { label: 'Sáb', number: '04', date: '2026-07-04', active: false },
]

const miniCalendarDays = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
]

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']

const weekdays = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

const viewModes: Array<{ value: ViewMode; label: string }> = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
]

const appointments = ref<Appointment[]>([
  {
    id: 'apt-luna',
    pet: 'Luna',
    species: 'Canina',
    breed: 'SRD',
    age: '7 anos',
    tutor: 'Marina Alves',
    tutorPhone: '(11) 98422-1030',
    professional: 'Dra. Marina Alves',
    type: 'retorno',
    status: 'em-sala',
    priority: 'high',
    day: '2026-06-29',
    dateLabel: 'Seg, 29 jun',
    time: '09:30',
    duration: 45,
    complaint: 'Retorno pós-operatório e revisão de curativo.',
    clinicalNote: 'Tutor relata melhora de apetite. Avaliar cicatrização antes de liberar alta parcial.',
    alerts: ['Alergia a dipirona', 'Revisar ferida cirúrgica'],
    sharedAccess: 'Prontuário completo autorizado até 04 jul.',
    nextAction: 'Registrar evolução e orientar retorno em 7 dias.',
  },
  {
    id: 'apt-thor',
    pet: 'Thor',
    species: 'Felina',
    breed: 'Siamês',
    age: '3 anos',
    tutor: 'Rafael Lima',
    tutorPhone: '(11) 97741-8200',
    professional: 'Dr. Rafael Lima',
    type: 'vacina',
    status: 'confirmado',
    priority: 'normal',
    day: '2026-06-29',
    dateLabel: 'Seg, 29 jun',
    time: '10:15',
    duration: 30,
    complaint: 'Atualização de protocolo anual.',
    clinicalNote: 'Conferir carteirinha, peso atual e reação vacinal anterior.',
    alerts: ['Trazer carteirinha'],
    sharedAccess: 'Vacinas e peso autorizados por 24h.',
    nextAction: 'Aplicar vacina e emitir próximo lembrete.',
  },
  {
    id: 'apt-caco',
    pet: 'Caco',
    species: 'Canina',
    breed: 'Shih-tzu',
    age: '5 anos',
    tutor: 'João Pires',
    tutorPhone: '(11) 94422-8801',
    professional: 'Dra. Carla Souza',
    type: 'consulta',
    status: 'confirmado',
    priority: 'attention',
    day: '2026-06-29',
    dateLabel: 'Seg, 29 jun',
    time: '13:00',
    duration: 60,
    complaint: 'Coceira persistente e lesões na pele.',
    clinicalNote: 'Histórico de dermatite. Considerar raspado cutâneo se lesões ativas persistirem.',
    alerts: ['Dermatite recorrente'],
    sharedAccess: 'Consultas, medicamentos e diário do tutor.',
    nextAction: 'Abrir atendimento SOAP e avaliar necessidade de exame.',
  },
  {
    id: 'apt-mel',
    pet: 'Mel',
    species: 'Canina',
    breed: 'Golden Retriever',
    age: '4 anos',
    tutor: 'Carla Souza',
    tutorPhone: '(11) 96620-3321',
    professional: 'Dra. Carla Souza',
    type: 'consulta',
    status: 'pendente',
    priority: 'attention',
    day: '2026-06-30',
    dateLabel: 'Ter, 30 jun',
    time: '09:00',
    duration: 45,
    complaint: 'Avaliação de otite recorrente.',
    clinicalNote: 'Confirmar se houve uso recente de antibiótico antes da prescrição.',
    alerts: ['Confirmação pendente'],
    sharedAccess: 'Histórico recente compartilhado pelo tutor.',
    nextAction: 'Confirmar presença e preparar ficha de anamnese.',
  },
  {
    id: 'apt-bob',
    pet: 'Bob',
    species: 'Canina',
    breed: 'Bulldog Francês',
    age: '6 anos',
    tutor: 'Paulo Mendes',
    tutorPhone: '(11) 98114-0098',
    professional: 'Dra. Marina Alves',
    type: 'exame',
    status: 'confirmado',
    priority: 'high',
    day: '2026-06-30',
    dateLabel: 'Ter, 30 jun',
    time: '11:30',
    duration: 30,
    complaint: 'Coleta para controle respiratório.',
    clinicalNote: 'Paciente braquicefálico. Evitar estresse térmico e acompanhar saturação.',
    alerts: ['Braquicefálico', 'Atenção à saturação'],
    sharedAccess: 'Exames e diagnósticos ativos.',
    nextAction: 'Coletar exame e criar atividade de revisão.',
  },
  {
    id: 'apt-nina',
    pet: 'Nina',
    species: 'Canina',
    breed: 'Poodle',
    age: '9 anos',
    tutor: 'Bianca Torres',
    tutorPhone: '(11) 95501-3377',
    professional: 'Dra. Marina Alves',
    type: 'cirurgia',
    status: 'confirmado',
    priority: 'high',
    day: '2026-07-01',
    dateLabel: 'Qua, 01 jul',
    time: '08:00',
    duration: 120,
    complaint: 'Procedimento odontológico com anestesia.',
    clinicalNote: 'Checar jejum, exames pré-operatórios e autorização assinada.',
    alerts: ['Jejum obrigatório', 'Exames pré-op'],
    sharedAccess: 'Documentos e exames autorizados.',
    nextAction: 'Validar checklist cirúrgico antes da entrada.',
  },
  {
    id: 'apt-lola',
    pet: 'Lola',
    species: 'Felina',
    breed: 'SRD',
    age: '2 anos',
    tutor: 'Aline Castro',
    tutorPhone: '(11) 98871-5520',
    professional: 'Dr. Rafael Lima',
    type: 'retorno',
    status: 'concluido',
    priority: 'normal',
    day: '2026-07-01',
    dateLabel: 'Qua, 01 jul',
    time: '14:00',
    duration: 40,
    complaint: 'Revisão após tratamento gastrointestinal.',
    clinicalNote: 'Sem vômitos há 5 dias. Manter acompanhamento alimentar.',
    alerts: ['Registrar peso'],
    sharedAccess: 'Consultas e medicamentos.',
    nextAction: 'Finalizar evolução clínica.',
  },
  {
    id: 'apt-pingo',
    pet: 'Pingo',
    species: 'Canina',
    breed: 'Pinscher',
    age: '8 anos',
    tutor: 'Marta Reis',
    tutorPhone: '(11) 97662-1120',
    professional: 'Dr. Rafael Lima',
    type: 'vacina',
    status: 'confirmado',
    priority: 'normal',
    day: '2026-07-02',
    dateLabel: 'Qui, 02 jul',
    time: '10:45',
    duration: 30,
    complaint: 'Vacina anual e avaliação rápida.',
    clinicalNote: 'Conferir histórico de reação vacinal.',
    alerts: ['Sem alertas críticos'],
    sharedAccess: 'Vacinas autorizadas.',
    nextAction: 'Atualizar carteirinha digital.',
  },
  {
    id: 'apt-aurora',
    pet: 'Aurora',
    species: 'Felina',
    breed: 'Persa',
    age: '11 anos',
    tutor: 'Helena Cruz',
    tutorPhone: '(11) 94122-0091',
    professional: 'Dra. Carla Souza',
    type: 'consulta',
    status: 'pendente',
    priority: 'attention',
    day: '2026-07-02',
    dateLabel: 'Qui, 02 jul',
    time: '12:00',
    duration: 60,
    complaint: 'Perda de peso e apatia.',
    clinicalNote: 'Paciente idosa. Revisar exames anteriores e orientar investigação.',
    alerts: ['Paciente sênior', 'Perda de peso'],
    sharedAccess: 'Histórico e exames liberados por 72h.',
    nextAction: 'Confirmar presença e reservar janela para exame.',
  },
  {
    id: 'apt-simba',
    pet: 'Simba',
    species: 'Felina',
    breed: 'Maine Coon',
    age: '4 anos',
    tutor: 'Lucas Neves',
    tutorPhone: '(11) 99550-2100',
    professional: 'Dra. Marina Alves',
    type: 'retorno',
    status: 'confirmado',
    priority: 'normal',
    day: '2026-07-03',
    dateLabel: 'Sex, 03 jul',
    time: '09:30',
    duration: 45,
    complaint: 'Retorno cardiológico.',
    clinicalNote: 'Verificar aderência ao tratamento contínuo.',
    alerts: ['Tratamento ativo'],
    sharedAccess: 'Medicamentos e consultas.',
    nextAction: 'Registrar ausculta e conduta.',
  },
  {
    id: 'apt-bidu',
    pet: 'Bidu',
    species: 'Canina',
    breed: 'Beagle',
    age: '6 anos',
    tutor: 'Renata Freitas',
    tutorPhone: '(11) 93002-8841',
    professional: 'Dr. Rafael Lima',
    type: 'exame',
    status: 'pendente',
    priority: 'high',
    day: '2026-07-03',
    dateLabel: 'Sex, 03 jul',
    time: '11:00',
    duration: 40,
    complaint: 'Ultrassom abdominal.',
    clinicalNote: 'Tutor ainda não confirmou jejum. Necessário checar antes do exame.',
    alerts: ['Jejum não confirmado'],
    sharedAccess: 'Exames e diário do tutor.',
    nextAction: 'Ligar para tutor antes das 18h.',
  },
  {
    id: 'apt-frida',
    pet: 'Frida',
    species: 'Canina',
    breed: 'Dachshund',
    age: '2 anos',
    tutor: 'Sofia Martins',
    tutorPhone: '(11) 98021-6420',
    professional: 'Dra. Carla Souza',
    type: 'vacina',
    status: 'confirmado',
    priority: 'normal',
    day: '2026-07-04',
    dateLabel: 'Sáb, 04 jul',
    time: '08:30',
    duration: 30,
    complaint: 'Vacina e check-up rápido.',
    clinicalNote: 'Sem intercorrências registradas.',
    alerts: ['Sem alertas críticos'],
    sharedAccess: 'Vacinas autorizadas.',
    nextAction: 'Atualizar próxima dose.',
  },
])

const typeLabel: Record<AppointmentType, string> = {
  consulta: 'Consulta',
  vacina: 'Vacina',
  retorno: 'Retorno',
  exame: 'Exame',
  cirurgia: 'Cirurgia',
}

const statusLabel: Record<AppointmentStatus, string> = {
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  'em-sala': 'Em sala',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const statusOptions: Array<{ value: AppointmentStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'em-sala', label: 'Em sala' },
  { value: 'concluido', label: 'Concluídos' },
]

const filteredAppointments = computed(() =>
  appointments.value.filter((appointment) => selectedStatus.value === 'todos' || appointment.status === selectedStatus.value),
)

const selectedAppointment = computed(
  () => appointments.value.find((appointment) => appointment.id === selectedAppointmentId.value) ?? null,
)

const summary = computed(() => ({
  total: filteredAppointments.value.length,
  pending: filteredAppointments.value.filter((appointment) => appointment.status === 'pendente').length,
  high: filteredAppointments.value.filter((appointment) => appointment.priority === 'high').length,
  next:
    filteredAppointments.value.find((appointment) => appointment.status === 'em-sala') ??
    filteredAppointments.value.find((appointment) => appointment.status === 'confirmado') ??
    null,
}))

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getGridStyle(appointment: Appointment) {
  const dayIndex = days.findIndex((day) => day.date === appointment.day)
  const timeParts = appointment.time.split(':')
  const hour = Number(timeParts[0] ?? 0)
  const minute = Number(timeParts[1] ?? 0)
  const startHour = Number(timeSlots[0]?.split(':')[0] ?? 8)
  const rowStart = (hour - startHour) * 4 + Math.floor(minute / 15) + 1
  const rowSpan = Math.max(3, Math.round(appointment.duration / 15))

  return {
    gridColumn: `${dayIndex + 1}`,
    gridRow: `${rowStart} / span ${rowSpan}`,
  }
}

function selectAppointment(appointment: Appointment) {
  selectedAppointmentId.value = appointment.id
  detailsModalOpen.value = true
}

function closeDetailsModal() {
  detailsModalOpen.value = false
}

function setAppointmentStatus(status: AppointmentStatus) {
  if (!selectedAppointment.value) {
    return
  }

  selectedAppointment.value.status = status
  successMessage.value = `Atendimento de ${selectedAppointment.value.pet} atualizado para ${statusLabel[status]}.`
}

function clearFilters() {
  selectedStatus.value = 'todos'
}

function retryAgenda() {
  agendaState.value = 'loading'

  window.setTimeout(() => {
    agendaState.value = 'ready'
  }, 350)
}
</script>

<template>
  <main id="agenda" class="agenda-page" :style="pageStyle">
    <section class="agenda-hero">
      <div class="agenda-hero__copy">
        <span class="agenda-kicker">Agenda clínica</span>
        <h1>Agenda do veterinário</h1>
        <p>
          Organize atendimentos, salas e profissionais da semana. Clique em qualquer card do calendário para abrir
          dados clínicos, tutor, autorização compartilhada e ações rápidas.
        </p>
      </div>

      <div class="agenda-hero__actions">
        <button class="agenda-button agenda-button--primary" type="button">
          <i class="pi pi-plus" aria-hidden="true" />
          Novo atendimento
        </button>
        <button class="agenda-button agenda-button--ghost" type="button" @click="retryAgenda">
          <i class="pi pi-refresh" aria-hidden="true" />
          Recarregar
        </button>
      </div>
    </section>

    <section class="agenda-summary" aria-label="Resumo da agenda">
      <article class="summary-card">
        <span>Atendimentos</span>
        <strong>{{ summary.total }}</strong>
        <small>Semana atual</small>
      </article>
      <article class="summary-card" data-tone="attention">
        <span>Pendentes</span>
        <strong>{{ summary.pending }}</strong>
        <small>Confirmação ou preparo</small>
      </article>
      <article class="summary-card" data-tone="danger">
        <span>Alta atenção</span>
        <strong>{{ summary.high }}</strong>
        <small>Alertas clínicos</small>
      </article>
      <article class="summary-card summary-card--wide">
        <span>Próximo foco</span>
        <strong>{{ summary.next?.time ?? '--:--' }}</strong>
        <small>{{ summary.next ? `${summary.next.pet} - ${typeLabel[summary.next.type]}` : 'Sem próximo atendimento' }}</small>
      </article>
    </section>

    <section class="agenda-workspace">
      <aside class="agenda-sidebar" aria-label="Filtros da agenda">
        <div class="side-card">
          <div class="side-card__header">
            <strong>Junho 2026</strong>
            <div class="side-card__arrows" aria-hidden="true">
              <span class="pi pi-angle-left" />
              <span class="pi pi-angle-right" />
            </div>
          </div>

          <div class="mini-calendar" aria-label="Calendário de junho">
            <span v-for="(weekday, index) in weekdays" :key="`${weekday}-${index}`" class="mini-calendar__weekday">
              {{ weekday }}
            </span>
            <button
              v-for="day in miniCalendarDays"
              :key="day"
              class="mini-calendar__day"
              :class="{ 'mini-calendar__day--active': day === '29', 'mini-calendar__day--has-event': ['1', '8', '13', '24'].includes(day) }"
              type="button"
            >
              {{ day }}
            </button>
          </div>
        </div>
      </aside>

      <section class="calendar-panel" aria-label="Calendário semanal">
        <div class="calendar-toolbar">
          <div>
            <span class="agenda-kicker">29 jun - 4 jul</span>
            <h2>Semana clínica</h2>
          </div>

          <div class="toolbar-actions" role="group" aria-label="Modo de visualização">
            <button
              v-for="mode in viewModes"
              :key="mode.value"
              class="view-button"
              :class="{ 'view-button--active': selectedMode === mode.value }"
              type="button"
              @click="selectedMode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>

        <div class="status-filters" aria-label="Filtros por status">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            class="status-filter"
            :class="{ 'status-filter--active': selectedStatus === option.value }"
            type="button"
            @click="selectedStatus = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <div v-if="successMessage" class="feedback-card" role="status">
          <i class="pi pi-check-circle" aria-hidden="true" />
          {{ successMessage }}
        </div>

        <div v-if="agendaState === 'loading'" class="agenda-state" role="status">
          <span class="state-spinner" aria-hidden="true" />
          <strong>Carregando agenda</strong>
          <p>Buscando atendimentos, salas e permissões do período.</p>
        </div>

        <div v-else-if="agendaState === 'error'" class="agenda-state agenda-state--error" role="alert">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          <strong>Não foi possível carregar a agenda</strong>
          <p>Tente novamente. Se o problema continuar, confira sessão e permissões da clínica.</p>
          <button class="agenda-button agenda-button--primary" type="button" @click="retryAgenda">Tentar novamente</button>
        </div>

        <div v-else-if="filteredAppointments.length === 0" class="agenda-state">
          <i class="pi pi-calendar-times" aria-hidden="true" />
          <strong>Nenhum atendimento encontrado</strong>
          <p>Não há atendimentos para os filtros atuais.</p>
          <button class="agenda-button agenda-button--ghost" type="button" @click="clearFilters">Limpar filtros</button>
        </div>

        <div v-else class="week-calendar">
          <div class="calendar-hours" aria-hidden="true">
            <span v-for="slot in timeSlots" :key="slot">{{ slot }}</span>
          </div>

          <div class="calendar-grid">
            <div class="calendar-days">
              <div v-for="day in days" :key="day.date" class="calendar-day" :class="{ 'calendar-day--active': day.active }">
                <span>{{ day.label }}</span>
                <strong>{{ day.number }}</strong>
              </div>
            </div>

            <div class="calendar-body">
              <div v-for="day in days" :key="`column-${day.date}`" class="calendar-column" />
              <span v-for="line in 8" :key="`line-${line}`" class="calendar-line" />

              <button
                v-for="appointment in filteredAppointments"
                :key="appointment.id"
                class="appointment-card"
                :class="[
                  `appointment-card--${appointment.priority}`,
                  `appointment-card--${appointment.type}`,
                  {
                    'appointment-card--compact': appointment.duration <= 30,
                    'appointment-card--selected': selectedAppointmentId === appointment.id,
                  },
                ]"
                type="button"
                :style="getGridStyle(appointment)"
                @click="selectAppointment(appointment)"
              >
                <span class="appointment-card__time">{{ appointment.time }}</span>
                <strong>{{ appointment.pet }} - {{ typeLabel[appointment.type] }}</strong>
              </button>
            </div>
          </div>
        </div>
      </section>

    </section>

    <div v-if="detailsModalOpen && selectedAppointment" class="details-modal" role="presentation" @click.self="closeDetailsModal">
      <section
        class="details-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`Detalhes do atendimento de ${selectedAppointment.pet}`"
      >
        <div class="details-dialog__header">
          <div class="details-dialog__identity">
            <span class="pet-avatar" :data-tone="selectedAppointment.priority">
              {{ getInitials(selectedAppointment.pet) }}
            </span>
            <div>
              <span class="agenda-kicker">Atendimento selecionado</span>
              <h2>{{ selectedAppointment.pet }}</h2>
              <p>{{ selectedAppointment.species }} - {{ selectedAppointment.breed }} - {{ selectedAppointment.age }}</p>
            </div>
          </div>

          <button class="modal-close" type="button" aria-label="Fechar detalhes" @click="closeDetailsModal">
            <i class="pi pi-times" aria-hidden="true" />
          </button>
        </div>

        <div class="detail-tags">
          <span class="agenda-pill" :data-tone="selectedAppointment.priority">
            {{ selectedAppointment.priority === 'high' ? 'Alta atenção' : selectedAppointment.priority === 'attention' ? 'Atenção' : 'Rotina' }}
          </span>
          <span class="agenda-pill" :data-status="selectedAppointment.status">{{ statusLabel[selectedAppointment.status] }}</span>
        </div>

        <dl class="detail-list">
          <div>
            <dt>Horário</dt>
            <dd>{{ selectedAppointment.dateLabel }}, {{ selectedAppointment.time }} - {{ selectedAppointment.duration }} min</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{{ typeLabel[selectedAppointment.type] }}</dd>
          </div>
          <div>
            <dt>Profissional</dt>
            <dd>{{ selectedAppointment.professional }}</dd>
          </div>
          <div>
            <dt>Tutor</dt>
            <dd>{{ selectedAppointment.tutor }} - {{ selectedAppointment.tutorPhone }}</dd>
          </div>
        </dl>

        <section class="detail-section">
          <h3>Queixa e contexto</h3>
          <p>{{ selectedAppointment.complaint }}</p>
          <p>{{ selectedAppointment.clinicalNote }}</p>
        </section>

        <section class="detail-section">
          <h3>Alertas clínicos</h3>
          <div class="alert-list">
            <span v-for="alert in selectedAppointment.alerts" :key="alert">
              <i class="pi pi-info-circle" aria-hidden="true" />
              {{ alert }}
            </span>
          </div>
        </section>

        <section class="detail-section detail-section--shared">
          <h3>Acesso autorizado</h3>
          <p>{{ selectedAppointment.sharedAccess }}</p>
        </section>

        <section class="detail-section">
          <h3>Próxima ação</h3>
          <p>{{ selectedAppointment.nextAction }}</p>
        </section>

        <div class="details-actions">
          <button class="agenda-button agenda-button--primary" type="button" @click="setAppointmentStatus('em-sala')">
            <i class="pi pi-file-edit" aria-hidden="true" />
            Abrir atendimento
          </button>
          <button class="agenda-button agenda-button--ghost" type="button" @click="setAppointmentStatus('concluido')">
            Marcar concluído
          </button>
          <button class="agenda-button agenda-button--ghost" type="button" @click="setAppointmentStatus('pendente')">
            Marcar pendente
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.agenda-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.45rem 1.6rem 2rem;
  background: var(--agenda-bg);
  color: var(--agenda-text);
}

.agenda-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
}

.agenda-kicker {
  display: block;
  color: var(--agenda-faint);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.agenda-hero h1 {
  margin: 0.35rem 0 0;
  color: var(--agenda-text);
  font-size: clamp(1.8rem, 2.8vw, 2.45rem);
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: -0.06em;
}

.agenda-hero p {
  max-width: 44rem;
  margin: 0.68rem 0 0;
  color: var(--agenda-muted);
  font-size: 0.94rem;
  line-height: 1.55;
}

.agenda-hero__actions,
.toolbar-actions,
.status-filters,
.details-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.agenda-button,
.view-button,
.status-filter {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
  padding: 0 0.9rem;
  border: 0;
  border-radius: 0.78rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.agenda-button:hover,
.view-button:hover,
.status-filter:hover,
.appointment-card:hover {
  transform: translateY(-1px);
}

.agenda-button--primary {
  background: linear-gradient(135deg, var(--agenda-primary), var(--agenda-primary-strong));
  color: var(--agenda-card);
  font-weight: 600;
}

.agenda-button--ghost,
.view-button,
.status-filter {
  border: 1px solid var(--agenda-line);
  background: var(--agenda-card);
  color: var(--agenda-text);
}

.agenda-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.35rem;
}

.summary-card,
.side-card,
.calendar-panel,
.details-dialog {
  border: 1px solid var(--agenda-line);
  background: var(--agenda-card);
}

.summary-card {
  display: grid;
  gap: 0.42rem;
  min-height: 7rem;
  padding: 1rem;
  border-radius: 1.05rem;
}

.summary-card span {
  color: var(--agenda-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.summary-card strong {
  color: var(--agenda-text);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.055em;
}

.summary-card small {
  width: fit-content;
  padding: 0.3rem 0.58rem;
  border-radius: 999px;
  background: var(--agenda-success-bg);
  color: var(--agenda-success-text);
  font-size: 0.7rem;
  font-weight: 600;
}

.summary-card[data-tone='attention'] small {
  background: var(--agenda-amber-bg);
  color: var(--agenda-amber-text);
}

.summary-card[data-tone='danger'] small {
  background: var(--agenda-warm-bg);
  color: var(--agenda-warm-text);
}

.agenda-workspace {
  display: grid;
  grid-template-columns: 14rem minmax(0, 1fr);
  gap: 1.2rem;
  align-items: start;
  margin-top: 1.35rem;
}

.agenda-sidebar {
  display: grid;
  gap: 0.85rem;
}

.side-card {
  padding: 0.95rem;
  border-radius: 1rem;
}

.side-card strong {
  color: var(--agenda-text);
  font-size: 0.92rem;
  font-weight: 600;
}

.side-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.side-card__arrows {
  display: flex;
  gap: 0.35rem;
  color: var(--agenda-faint);
  font-size: 0.78rem;
}

.mini-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
  margin-top: 0.85rem;
}

.mini-calendar__weekday,
.mini-calendar__day {
  display: grid;
  min-height: 1.85rem;
  place-items: center;
  border-radius: 0.62rem;
  color: var(--agenda-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.mini-calendar__day {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.mini-calendar__day--active {
  background: var(--agenda-primary);
  color: white;
}

.mini-calendar__day--has-event:not(.mini-calendar__day--active) {
  color: var(--agenda-primary-strong);
}

.view-button--active,
.status-filter--active {
  border-color: color-mix(in srgb, var(--agenda-primary) 42%, var(--agenda-line));
  background: color-mix(in srgb, var(--agenda-primary-soft) 38%, var(--agenda-card));
  color: var(--agenda-primary-strong);
}

.calendar-panel {
  min-width: 0;
  padding: 1rem;
  border-radius: 1.25rem;
}

.calendar-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.calendar-toolbar h2 {
  margin: 0.18rem 0 0;
  color: var(--agenda-text);
  font-size: 1.22rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.045em;
}

.view-button,
.status-filter {
  min-height: 2.08rem;
  padding-inline: 0.72rem;
  font-size: 0.76rem;
}

.status-filters {
  margin-top: 0.85rem;
}

.feedback-card {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.85rem;
  padding: 0.76rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--agenda-primary) 30%, var(--agenda-line));
  border-radius: 0.9rem;
  background: var(--agenda-success-bg);
  color: var(--agenda-success-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.agenda-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
  padding: 3rem 1rem;
  border: 1px dashed var(--agenda-line);
  border-radius: 1rem;
  background: var(--agenda-surface);
  text-align: center;
}

.agenda-state i {
  color: var(--agenda-primary);
  font-size: 1.45rem;
}

.agenda-state strong {
  color: var(--agenda-text);
}

.agenda-state p {
  max-width: 28rem;
  margin: 0;
  color: var(--agenda-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.agenda-state--error i {
  color: var(--agenda-warm-text);
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--agenda-line);
  border-top-color: var(--agenda-primary);
  border-radius: 999px;
  animation: agenda-spin 800ms linear infinite;
}

.week-calendar {
  display: grid;
  grid-template-columns: 4.3rem minmax(0, 1fr);
  margin-top: 1rem;
}

.calendar-hours {
  display: grid;
  grid-template-rows: 3.5rem repeat(8, 4.25rem);
  padding-top: 3.5rem;
}

.calendar-hours span {
  color: var(--agenda-faint);
  font-size: 0.72rem;
  font-weight: 600;
}

.calendar-grid {
  min-width: 0;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(6, minmax(6rem, 1fr));
  border: 1px solid var(--agenda-line);
  border-bottom: 0;
  border-radius: 1rem 1rem 0 0;
  overflow: hidden;
}

.calendar-day {
  display: grid;
  gap: 0.28rem;
  min-height: 3.5rem;
  place-items: center;
  background: var(--agenda-card);
  box-shadow: 1px 0 0 var(--agenda-line);
}

.calendar-day span {
  color: var(--agenda-faint);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.calendar-day strong {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border-radius: 999px;
  color: var(--agenda-text);
  font-size: 0.9rem;
}

.calendar-day--active strong {
  background: var(--agenda-primary);
  color: white;
}

.calendar-body {
  position: relative;
  display: grid;
  min-height: 34rem;
  grid-template-columns: repeat(6, minmax(6rem, 1fr));
  grid-template-rows: repeat(32, 1.0625rem);
  border: 1px solid var(--agenda-line);
  border-radius: 0 0 1rem 1rem;
  background: var(--agenda-card);
  overflow: hidden;
}

.calendar-column {
  grid-row: 1 / -1;
  border-right: 1px solid var(--agenda-line-soft);
}

.calendar-line {
  grid-column: 1 / -1;
  height: 1px;
  background: var(--agenda-line-soft);
}

.calendar-line:nth-of-type(8n + 1) {
  background: var(--agenda-line);
}

.appointment-card {
  z-index: 1;
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 0.12rem;
  min-width: 0;
  overflow: hidden;
  margin: 0.18rem;
  padding: 0.46rem 0.56rem;
  border: 1px solid var(--agenda-line);
  border-radius: 0.72rem;
  background: var(--agenda-success-bg);
  color: var(--agenda-text);
  text-align: left;
  cursor: pointer;
}

.appointment-card--attention {
  border-color: color-mix(in srgb, var(--agenda-amber) 42%, var(--agenda-line));
  background: var(--agenda-amber-bg);
}

.appointment-card--high {
  border-color: var(--agenda-warm-line);
  background: var(--agenda-warm-bg);
}

.appointment-card--cirurgia {
  min-height: 4rem;
}

.appointment-card--compact {
  gap: 0.06rem;
  padding-block: 0.34rem;
}

.appointment-card--selected {
  border-color: var(--agenda-primary);
  outline: 2px solid color-mix(in srgb, var(--agenda-primary) 42%, transparent);
  outline-offset: 1px;
}

.appointment-card__time {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--agenda-primary-strong);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.appointment-card strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--agenda-text);
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.12;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.details-modal {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgb(31 47 43 / 0.34);
  backdrop-filter: blur(8px);
}

.details-dialog {
  display: grid;
  gap: 0.95rem;
  width: min(58rem, 100%);
  max-height: min(44rem, calc(100vh - 3rem));
  overflow: auto;
  padding: 1.2rem;
  border-radius: 1.25rem;
  box-shadow: 0 24px 70px rgb(var(--agenda-shadow-rgb) / 0.18);
}

.details-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.details-dialog__identity {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  min-width: 0;
}

.modal-close {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--agenda-line);
  border-radius: 0.75rem;
  background: var(--agenda-surface);
  color: var(--agenda-muted);
  cursor: pointer;
}

.modal-close:hover {
  color: var(--agenda-text);
  background: var(--agenda-card);
}

.pet-avatar {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 1rem;
  background: var(--agenda-success-bg);
  color: var(--agenda-primary-strong);
  font-size: 0.9rem;
  font-weight: 700;
}

.pet-avatar[data-tone='high'] {
  background: var(--agenda-warm-bg);
  color: var(--agenda-warm-text);
}

.pet-avatar[data-tone='attention'] {
  background: var(--agenda-amber-bg);
  color: var(--agenda-amber-text);
}

.details-dialog h2 {
  margin: 0.15rem 0 0;
  color: var(--agenda-text);
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.045em;
}

.details-dialog p {
  margin: 0;
  color: var(--agenda-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.detail-tags,
.alert-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.agenda-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  background: var(--agenda-success-bg);
  color: var(--agenda-success-text);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}

.agenda-pill[data-tone='high'],
.agenda-pill[data-status='pendente'],
.agenda-pill[data-status='em-sala'] {
  background: var(--agenda-warm-bg);
  color: var(--agenda-warm-text);
}

.agenda-pill[data-tone='attention'] {
  background: var(--agenda-amber-bg);
  color: var(--agenda-amber-text);
}

.detail-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0.85rem;
  border: 1px solid var(--agenda-line);
  border-radius: 0.95rem;
  background: var(--agenda-surface);
}

.detail-list div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.detail-list dt {
  color: var(--agenda-faint);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.detail-list dd {
  margin: 0;
  color: var(--agenda-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.detail-section {
  display: grid;
  gap: 0.48rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--agenda-line-soft);
}

.detail-section h3 {
  margin: 0;
  color: var(--agenda-text);
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.detail-section--shared {
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--agenda-primary) 24%, var(--agenda-line));
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--agenda-primary-soft) 20%, var(--agenda-card));
}

.alert-list span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  background: var(--agenda-amber-bg);
  color: var(--agenda-amber-text);
  font-size: 0.72rem;
  font-weight: 700;
}

.details-actions .agenda-button {
  flex: 1 1 9rem;
}

@keyframes agenda-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1380px) {
  .agenda-workspace {
    grid-template-columns: 14rem minmax(0, 1fr);
  }
}

@media (max-width: 1040px) {
  .agenda-hero,
  .calendar-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .agenda-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agenda-workspace {
    grid-template-columns: 1fr;
  }

  .agenda-sidebar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .agenda-page {
    padding: 1rem;
  }

  .agenda-summary,
  .agenda-sidebar {
    grid-template-columns: 1fr;
  }

  .week-calendar {
    grid-template-columns: 1fr;
    overflow-x: auto;
  }

  .calendar-hours {
    display: none;
  }

  .calendar-grid {
    min-width: 42rem;
  }
}
</style>

