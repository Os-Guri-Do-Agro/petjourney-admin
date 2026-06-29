<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { currentColors } from '@/theme/color-mode'

type ActivityStatus = 'overdue' | 'today' | 'next' | 'done'
type ActivitySource = 'agenda' | 'prontuario' | 'compartilhamento' | 'equipe'
type ActivityPriority = 'high' | 'attention' | 'normal'
type ActivityFilter = 'todos' | ActivityStatus | ActivitySource
type PageState = 'loading' | 'ready' | 'error'

type ActivityChecklistItem = {
  label: string
  done: boolean
}

type ClinicalActivity = {
  id: string
  title: string
  pet: string
  tutor: string
  due: string
  owner: string
  room: string
  status: ActivityStatus
  source: ActivitySource
  priority: ActivityPriority
  context: string
  nextAction: string
  checklist: ActivityChecklistItem[]
}

const router = useRouter()
const toast = useToast()
const pageState = ref<PageState>('ready')
const selectedFilter = ref<ActivityFilter>('todos')
const selectedActivityId = ref('act-luna-curativo')

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--activities-bg': colors.dashboard.bg,
    '--activities-card': colors.dashboard.surface,
    '--activities-surface': colors.dashboard.surfaceSoft,
    '--activities-line': colors.dashboard.line,
    '--activities-line-soft': colors.dashboard.lineSoft,
    '--activities-text': colors.dashboard.text,
    '--activities-muted': colors.dashboard.muted,
    '--activities-faint': colors.dashboard.faint,
    '--activities-primary': colors.vet.primary,
    '--activities-primary-soft': colors.vet.secondary,
    '--activities-primary-strong': colors.dashboard.primaryStrong,
    '--activities-success-bg': colors.dashboard.successBg,
    '--activities-success-text': colors.dashboard.successText,
    '--activities-warm-bg': colors.dashboard.warmBg,
    '--activities-warm-line': colors.dashboard.warmLine,
    '--activities-warm-text': colors.dashboard.warmText,
    '--activities-amber-bg': colors.dashboard.amberBg,
    '--activities-amber-text': colors.dashboard.amberText,
    '--activities-muted-pill-bg': colors.dashboard.mutedPillBg,
    '--activities-muted-pill-text': colors.dashboard.mutedPillText,
    '--activities-tutor': colors.tutor.primary,
    '--activities-shadow-rgb': colors.auth.shadowRgb,
  }
})

const activities = ref<ClinicalActivity[]>([
  {
    id: 'act-luna-curativo',
    title: 'Revisar foto do curativo',
    pet: 'Luna',
    tutor: 'Marina Alves',
    due: 'Hoje, 11:30',
    owner: 'Dra. Marina',
    room: 'Sala 2',
    status: 'today',
    source: 'prontuario',
    priority: 'high',
    context: 'Retorno pós-operatório com alergia grave a dipirona. Tutor anexou nova foto pela manhã.',
    nextAction: 'Comparar foto com evolução anterior e orientar troca de curativo.',
    checklist: [
      { label: 'Abrir foto anexada', done: true },
      { label: 'Registrar evolução SOAP', done: false },
      { label: 'Criar retorno em 7 dias', done: false },
    ],
  },
  {
    id: 'act-bidu-jejum',
    title: 'Confirmar jejum antes do exame',
    pet: 'Bidu',
    tutor: 'Renata Freitas',
    due: 'Atrasada desde 10:00',
    owner: 'Recepção',
    room: 'Exames',
    status: 'overdue',
    source: 'agenda',
    priority: 'high',
    context: 'Ultrassom abdominal agendado. Tutor ainda não confirmou preparo.',
    nextAction: 'Ligar para tutor e registrar confirmação na agenda.',
    checklist: [
      { label: 'Ligar para tutor', done: false },
      { label: 'Confirmar jejum', done: false },
      { label: 'Avisar sala de exames', done: false },
    ],
  },
  {
    id: 'act-bob-exame',
    title: 'Revisar exames respiratórios',
    pet: 'Bob',
    tutor: 'Paulo Mendes',
    due: 'Hoje, 16:00',
    owner: 'Dr. Rafael',
    room: 'Sala 1',
    status: 'today',
    source: 'compartilhamento',
    priority: 'attention',
    context: 'Compartilhamento temporário expira hoje. Exames prévios disponíveis para consulta.',
    nextAction: 'Registrar achados e anexar orientação ao compartilhamento.',
    checklist: [
      { label: 'Abrir compartilhamento', done: true },
      { label: 'Analisar raio-X anterior', done: false },
      { label: 'Anexar orientação em PDF', done: false },
    ],
  },
  {
    id: 'act-thor-vacina',
    title: 'Emitir próximo lembrete vacinal',
    pet: 'Thor',
    tutor: 'Rafael Lima',
    due: 'Amanhã, 09:00',
    owner: 'Recepção',
    room: 'Agenda',
    status: 'next',
    source: 'prontuario',
    priority: 'normal',
    context: 'Vacinação anual realizada sem intercorrência registrada.',
    nextAction: 'Atualizar carteirinha e criar lembrete de reforço.',
    checklist: [
      { label: 'Atualizar carteirinha', done: false },
      { label: 'Criar lembrete', done: false },
    ],
  },
  {
    id: 'act-equipe-sala',
    title: 'Preparar sala para cirurgia',
    pet: 'Nina',
    tutor: 'Bianca Torres',
    due: 'Qua, 07:40',
    owner: 'Equipe clínica',
    room: 'Sala cirúrgica',
    status: 'next',
    source: 'equipe',
    priority: 'high',
    context: 'Procedimento odontológico com anestesia. Checklist pré-operatório deve ficar pronto antes da chegada.',
    nextAction: 'Separar documentos, validar jejum e equipamentos.',
    checklist: [
      { label: 'Validar autorização assinada', done: false },
      { label: 'Checar exames pré-op', done: false },
      { label: 'Preparar monitorização', done: false },
    ],
  },
])

const filters: Array<{ value: ActivityFilter; label: string; icon: string }> = [
  { value: 'todos', label: 'Todas', icon: 'pi pi-inbox' },
  { value: 'overdue', label: 'Atrasadas', icon: 'pi pi-exclamation-circle' },
  { value: 'today', label: 'Hoje', icon: 'pi pi-calendar-clock' },
  { value: 'next', label: 'Próximas', icon: 'pi pi-clock' },
  { value: 'agenda', label: 'Agenda', icon: 'pi pi-calendar' },
  { value: 'prontuario', label: 'Prontuário', icon: 'pi pi-file-edit' },
  { value: 'compartilhamento', label: 'Compartilhamento', icon: 'pi pi-share-alt' },
]

const statusLabel: Record<ActivityStatus, string> = {
  overdue: 'Atrasada',
  today: 'Hoje',
  next: 'Próxima',
  done: 'Concluída',
}

const sourceLabel: Record<ActivitySource, string> = {
  agenda: 'Agenda',
  prontuario: 'Prontuário',
  compartilhamento: 'Compartilhamento',
  equipe: 'Equipe',
}

const filteredActivities = computed(() =>
  activities.value.filter((activity) => {
    if (selectedFilter.value === 'todos') {
      return activity.status !== 'done'
    }

    if (['overdue', 'today', 'next', 'done'].includes(selectedFilter.value)) {
      return activity.status === selectedFilter.value
    }

    return activity.source === selectedFilter.value
  }),
)

const selectedActivity = computed(
  () =>
    activities.value.find((activity) => activity.id === selectedActivityId.value) ??
    filteredActivities.value[0] ??
    null,
)

const activityGroups = computed(() => [
  {
    id: 'overdue',
    label: 'Atrasadas',
    detail: 'Exigem ação antes do próximo atendimento',
    items: filteredActivities.value.filter((activity) => activity.status === 'overdue'),
  },
  {
    id: 'today',
    label: 'Hoje',
    detail: 'Rotina clínica em andamento',
    items: filteredActivities.value.filter((activity) => activity.status === 'today'),
  },
  {
    id: 'next',
    label: 'Próximas',
    detail: 'Preparação e follow-up',
    items: filteredActivities.value.filter((activity) => activity.status === 'next'),
  },
])

function getFilterCount(filter: ActivityFilter) {
  if (filter === 'todos') {
    return activities.value.filter((activity) => activity.status !== 'done').length
  }

  if (['overdue', 'today', 'next', 'done'].includes(filter)) {
    return activities.value.filter((activity) => activity.status === filter).length
  }

  return activities.value.filter((activity) => activity.source === filter).length
}

function selectActivity(activity: ClinicalActivity) {
  selectedActivityId.value = activity.id
}

function retryActivities() {
  pageState.value = 'loading'

  window.setTimeout(() => {
    pageState.value = 'ready'
  }, 350)
}

function toggleChecklistItem(item: ActivityChecklistItem) {
  item.done = !item.done
}

function completeActivity() {
  if (!selectedActivity.value) {
    return
  }

  selectedActivity.value.status = 'done'
  toast.add({
    severity: 'success',
    summary: 'Atividade concluída',
    detail: `${selectedActivity.value.title} foi marcada como concluída.`,
    life: 3000,
  })
}

async function openSource() {
  if (!selectedActivity.value) {
    return
  }

  if (selectedActivity.value.source === 'agenda') {
    await router.push('/veterinario/agenda')
    return
  }

  if (selectedActivity.value.source === 'compartilhamento') {
    await router.push('/veterinario/compartilhamentos')
    return
  }

  await router.push('/veterinario/prontuarios')
}
</script>

<template>
  <main class="activities-page" :style="pageStyle">
    <section v-if="pageState === 'loading'" class="activities-state" role="status">
      <span class="state-spinner" aria-hidden="true" />
      <strong>Carregando atividades</strong>
      <p>Organizando pendências de agenda, prontuário, equipe e compartilhamentos.</p>
    </section>

    <section v-else-if="pageState === 'error'" class="activities-state activities-state--error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <strong>Não foi possível carregar as atividades</strong>
      <p>Confira sessão e permissões da clínica antes de tentar novamente.</p>
      <button class="activity-button activity-button--primary" type="button" @click="retryActivities">Tentar novamente</button>
    </section>

    <section v-else class="activities-workspace">
      <aside class="activity-inbox" aria-label="Filtros de atividades">
        <div class="panel-title">
          <div>
            <span class="activities-kicker">Central operacional</span>
            <h2>Fila de trabalho</h2>
          </div>
          <strong>{{ filteredActivities.length }}</strong>
        </div>

        <button
          v-for="filter in filters"
          :key="filter.value"
          class="inbox-filter"
          :class="{ 'inbox-filter--active': selectedFilter === filter.value }"
          type="button"
          @click="selectedFilter = filter.value"
        >
          <i :class="filter.icon" aria-hidden="true" />
          <span>{{ filter.label }}</span>
          <strong>{{ getFilterCount(filter.value) }}</strong>
        </button>
      </aside>

      <section class="activity-board" aria-label="Quadro de atividades">
        <article v-for="group in activityGroups" :key="group.id" class="activity-lane" :data-lane="group.id">
          <header class="lane-header">
            <div>
              <h2>{{ group.label }}</h2>
              <p>{{ group.detail }}</p>
            </div>
            <strong>{{ group.items.length }}</strong>
          </header>

          <div v-if="group.items.length === 0" class="empty-lane">
            <i class="pi pi-check-circle" aria-hidden="true" />
            <span>Nada por aqui</span>
          </div>

          <button
            v-for="activity in group.items"
            v-else
            :key="activity.id"
            class="activity-card"
            :class="{ 'activity-card--active': selectedActivity?.id === activity.id }"
            :data-priority="activity.priority"
            type="button"
            @click="selectActivity(activity)"
          >
            <span class="activity-card__top">
              <strong>{{ activity.title }}</strong>
              <span class="activity-pill" :data-status="activity.status">{{ statusLabel[activity.status] }}</span>
            </span>
            <small>{{ activity.pet }} - {{ activity.tutor }}</small>
            <span class="activity-card__meta">
              <span>{{ activity.due }}</span>
              <span>{{ sourceLabel[activity.source] }}</span>
            </span>
          </button>
        </article>
      </section>

      <aside v-if="selectedActivity" class="activity-detail" aria-label="Detalhe da atividade">
        <header>
          <span class="activities-kicker">{{ sourceLabel[selectedActivity.source] }}</span>
          <h2>{{ selectedActivity.title }}</h2>
          <p>{{ selectedActivity.context }}</p>
        </header>

        <dl class="activity-facts">
          <div>
            <dt>Pet</dt>
            <dd>{{ selectedActivity.pet }}</dd>
          </div>
          <div>
            <dt>Responsável</dt>
            <dd>{{ selectedActivity.owner }}</dd>
          </div>
          <div>
            <dt>Prazo</dt>
            <dd>{{ selectedActivity.due }}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>{{ selectedActivity.room }}</dd>
          </div>
        </dl>

        <section class="next-action-card" :data-priority="selectedActivity.priority">
          <i class="pi pi-bolt" aria-hidden="true" />
          <div>
            <strong>Próxima ação</strong>
            <p>{{ selectedActivity.nextAction }}</p>
          </div>
        </section>

        <section class="checklist-card">
          <div class="section-heading">
            <span class="activities-kicker">Checklist</span>
            <h3>Passos para concluir</h3>
          </div>

          <button
            v-for="item in selectedActivity.checklist"
            :key="item.label"
            class="checklist-item"
            :class="{ 'checklist-item--done': item.done }"
            type="button"
            @click="toggleChecklistItem(item)"
          >
            <i :class="item.done ? 'pi pi-check' : 'pi pi-circle'" aria-hidden="true" />
            {{ item.label }}
          </button>
        </section>

        <footer class="detail-actions">
          <button class="activity-button activity-button--primary" type="button" @click="completeActivity">
            Concluir atividade
          </button>
          <button class="activity-button activity-button--ghost" type="button" @click="openSource">
            Abrir origem
          </button>
        </footer>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.activities-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.45rem 1.6rem 2rem;
  background: var(--activities-bg);
  color: var(--activities-text);
}

.activities-workspace {
  display: grid;
  grid-template-columns: 17rem minmax(0, 1fr) minmax(20rem, 24rem);
  gap: 1rem;
  align-items: start;
}

.activity-inbox,
.activity-lane,
.activity-detail,
.next-action-card,
.checklist-card {
  border: 1px solid var(--activities-line);
  background: var(--activities-card);
}

.activity-inbox,
.activity-detail {
  position: sticky;
  top: 5.15rem;
  display: grid;
  gap: 0.8rem;
  padding: 0.95rem;
  border-radius: 1.1rem;
}

.activity-detail {
  max-height: calc(100vh - 6.5rem);
  overflow: auto;
}

.panel-title,
.lane-header,
.activity-card__top,
.activity-card__meta,
.detail-actions {
  display: flex;
  gap: 0.65rem;
}

.panel-title,
.lane-header,
.activity-card__top {
  align-items: flex-start;
  justify-content: space-between;
}

.activities-kicker {
  display: block;
  color: var(--activities-faint);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.panel-title h2,
.lane-header h2,
.activity-detail h2,
.section-heading h3 {
  margin: 0;
  color: var(--activities-text);
  font-weight: 700;
  letter-spacing: -0.035em;
}

.panel-title h2 {
  margin-top: 0.12rem;
  font-size: 1rem;
}

.panel-title > strong,
.lane-header > strong {
  display: grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--activities-primary) 16%, var(--activities-card));
  color: var(--activities-primary-strong);
}

.inbox-filter,
.activity-card,
.checklist-item,
.activity-button {
  border: 0;
  font: inherit;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.inbox-filter {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.58rem;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 0.65rem;
  border: 1px solid var(--activities-line);
  border-radius: 0.78rem;
  background: var(--activities-surface);
  color: var(--activities-muted);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: left;
}

.inbox-filter i {
  color: var(--activities-primary-strong);
  font-size: 0.82rem;
}

.inbox-filter--active {
  border-color: color-mix(in srgb, var(--activities-primary) 42%, var(--activities-line));
  background: color-mix(in srgb, var(--activities-primary-soft) 34%, var(--activities-card));
  color: var(--activities-primary-strong);
}

.activity-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(14rem, 1fr));
  gap: 0.85rem;
  min-width: 0;
}

.activity-lane {
  display: grid;
  align-content: start;
  gap: 0.72rem;
  min-width: 0;
  padding: 0.85rem;
  border-radius: 1.1rem;
}

.lane-header p,
.activity-detail p {
  margin: 0.18rem 0 0;
  color: var(--activities-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.activity-card {
  display: grid;
  gap: 0.45rem;
  width: 100%;
  padding: 0.82rem;
  border: 1px solid var(--activities-line);
  border-radius: 0.95rem;
  background: var(--activities-surface);
  color: inherit;
  text-align: left;
}

.activity-card:hover {
  transform: translateY(-1px);
}

.activity-card--active {
  border-color: color-mix(in srgb, var(--activities-primary) 50%, var(--activities-line));
  background: color-mix(in srgb, var(--activities-primary-soft) 24%, var(--activities-card));
}

.activity-card__top strong {
  color: var(--activities-text);
  font-size: 0.9rem;
  line-height: 1.25;
}

.activity-card small,
.activity-card__meta {
  color: var(--activities-muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.activity-card__meta {
  flex-wrap: wrap;
  color: var(--activities-faint);
}

.activity-pill {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  padding: 0.32rem 0.52rem;
  background: var(--activities-success-bg);
  color: var(--activities-success-text);
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.activity-pill[data-status='overdue'] {
  background: var(--activities-warm-bg);
  color: var(--activities-warm-text);
}

.activity-pill[data-status='today'] {
  background: var(--activities-amber-bg);
  color: var(--activities-amber-text);
}

.empty-lane {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 1.35rem 0.75rem;
  border: 1px dashed var(--activities-line);
  border-radius: 0.9rem;
  color: var(--activities-faint);
  font-size: 0.82rem;
  font-weight: 700;
}

.activity-detail h2 {
  margin-top: 0.18rem;
  font-size: 1.35rem;
  line-height: 1.15;
}

.activity-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border: 1px solid var(--activities-line);
  border-radius: 0.95rem;
  overflow: hidden;
}

.activity-facts div {
  padding: 0.78rem;
  background: var(--activities-surface);
  box-shadow: 1px 0 0 var(--activities-line-soft), 0 1px 0 var(--activities-line-soft);
}

.activity-facts dt,
.activity-facts dd {
  margin: 0;
}

.activity-facts dt {
  color: var(--activities-faint);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.activity-facts dd {
  margin-top: 0.22rem;
  color: var(--activities-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.next-action-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.72rem;
  padding: 0.85rem;
  border-radius: 0.95rem;
}

.next-action-card i {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 0.72rem;
  background: var(--activities-success-bg);
  color: var(--activities-success-text);
}

.next-action-card[data-priority='high'] {
  border-color: var(--activities-warm-line);
  background: var(--activities-warm-bg);
}

.next-action-card[data-priority='high'] i {
  background: color-mix(in srgb, var(--activities-warm-text) 14%, var(--activities-card));
  color: var(--activities-warm-text);
}

.checklist-card {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  border-radius: 0.95rem;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.3rem;
  padding: 0 0.65rem;
  border: 1px solid var(--activities-line-soft);
  border-radius: 0.72rem;
  background: var(--activities-surface);
  color: var(--activities-muted);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: left;
}

.checklist-item i {
  color: var(--activities-faint);
}

.checklist-item--done {
  color: var(--activities-success-text);
  text-decoration: line-through;
}

.checklist-item--done i {
  color: var(--activities-success-text);
}

.detail-actions {
  flex-wrap: wrap;
}

.activity-button {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  justify-content: center;
  padding: 0 0.9rem;
  border-radius: 0.78rem;
  font-size: 0.82rem;
  font-weight: 800;
}

.activity-button--primary {
  background: linear-gradient(135deg, var(--activities-primary), var(--activities-primary-strong));
  color: var(--activities-card);
}

.activity-button--ghost {
  border: 1px solid var(--activities-line);
  background: var(--activities-card);
  color: var(--activities-muted);
}

.activities-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  padding: 3rem 1rem;
  border: 1px dashed var(--activities-line);
  border-radius: 1rem;
  background: var(--activities-surface);
  text-align: center;
}

.activities-state i {
  color: var(--activities-primary);
  font-size: 1.45rem;
}

.activities-state strong {
  color: var(--activities-text);
}

.activities-state p {
  max-width: 28rem;
  margin: 0;
  color: var(--activities-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.activities-state--error i {
  color: var(--activities-warm-text);
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--activities-line);
  border-top-color: var(--activities-primary);
  border-radius: 999px;
  animation: activities-spin 800ms linear infinite;
}

@keyframes activities-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .activities-workspace {
    grid-template-columns: 16rem minmax(0, 1fr);
  }

  .activity-detail {
    position: static;
    grid-column: 1 / -1;
    max-height: none;
  }
}

@media (max-width: 980px) {
  .activities-workspace,
  .activity-board {
    grid-template-columns: 1fr;
  }

  .activity-inbox {
    position: static;
  }
}

@media (max-width: 760px) {
  .activities-page {
    padding: 1rem;
  }

  .activity-facts {
    grid-template-columns: 1fr;
  }

  .detail-actions,
  .activity-button {
    width: 100%;
  }
}
</style>
