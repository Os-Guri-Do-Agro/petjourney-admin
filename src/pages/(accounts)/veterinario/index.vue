<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { getAuthUser } from '@/service/auth/auth-session'
import { currentColors } from '@/theme/color-mode'

type AppointmentPriority = 'high' | 'attention' | 'normal'

const user = computed(() => getAuthUser())
const firstName = computed(() => user.value?.nome?.split(' ')[0] ?? 'veterinário')

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--brand-navy': colors.primary,
    '--brand-cream': colors.secondary,
    '--white-warm': colors.white,
    '--profile-primary': colors.vet.primary,
    '--profile-secondary': colors.vet.secondary,
    '--clinical-muted': colors.internacao,
    '--soft-border': colors.brown,
    '--attention': colors.orange,
    '--danger-soft': colors.red,
    '--success-soft': colors.success,
    '--dashboard-bg': colors.dashboard.bg,
    '--dashboard-card': colors.dashboard.surface,
    '--dashboard-surface': colors.dashboard.surfaceSoft,
    '--dashboard-line': colors.dashboard.line,
    '--dashboard-line-soft': colors.dashboard.lineSoft,
    '--dashboard-text': colors.dashboard.text,
    '--dashboard-muted': colors.dashboard.muted,
    '--dashboard-faint': colors.dashboard.faint,
    '--dashboard-primary': colors.vet.primary,
    '--dashboard-primary-soft': colors.vet.secondary,
    '--dashboard-primary-strong': colors.dashboard.primaryStrong,
    '--dashboard-primary-deep': colors.dashboard.primaryDeep,
    '--dashboard-success-bg': colors.dashboard.successBg,
    '--dashboard-success-text': colors.dashboard.successText,
    '--dashboard-warm': colors.dashboard.warm,
    '--dashboard-warm-bg': colors.dashboard.warmBg,
    '--dashboard-warm-soft': colors.dashboard.warmSoft,
    '--dashboard-warm-line': colors.dashboard.warmLine,
    '--dashboard-warm-text': colors.dashboard.warmText,
    '--dashboard-amber': colors.dashboard.amber,
    '--dashboard-amber-bg': colors.dashboard.amberBg,
    '--dashboard-amber-text': colors.dashboard.amberText,
    '--dashboard-shadow-rgb': colors.auth.shadowRgb,
  }
})

const metrics = [
  {
    label: 'Consultas hoje',
    value: '8',
    detail: '3 próximas até 12h',
    trend: '+2 vs. ontem',
    tone: 'success',
  },
  {
    label: 'Atendidos',
    value: '5',
    detail: '2 prontuários completos',
    trend: '62% do dia',
    tone: 'success',
  },
  {
    label: 'Pendências',
    value: '6',
    detail: '4 exigem revisão clínica',
    trend: '2 urgentes',
    tone: 'attention',
  },
  {
    label: 'Em atenção',
    value: '3',
    detail: 'risco, alergia ou retorno',
    trend: 'prioridade alta',
    tone: 'danger',
  },
]

const appointments: Array<{
  time: string
  duration: string
  pet: string
  species: string
  tutor: string
  type: string
  status: string
  room: string
  priority: AppointmentPriority
  note: string
}> = [
  {
    time: '09:30',
    duration: '45 min',
    pet: 'Luna',
    species: 'Canina',
    tutor: 'Marina Alves',
    type: 'Retorno',
    status: 'Em sala',
    room: 'Sala 2',
    priority: 'high',
    note: 'Evolução pós-operatória e revisão de curativo.',
  },
  {
    time: '10:15',
    duration: '30 min',
    pet: 'Thor',
    species: 'Felina',
    tutor: 'Rafael Lima',
    type: 'Vacina',
    status: 'Confirmado',
    room: 'Sala 1',
    priority: 'normal',
    note: 'Carteirinha e protocolo anual.',
  },
  {
    time: '11:00',
    duration: '50 min',
    pet: 'Mel',
    species: 'Canina',
    tutor: 'Carla Souza',
    type: 'Consulta',
    status: 'Triagem',
    room: 'Sala 3',
    priority: 'attention',
    note: 'Queixa dermatológica recorrente.',
  },
  {
    time: '14:20',
    duration: '40 min',
    pet: 'Bob',
    species: 'Canina',
    tutor: 'Paulo Mendes',
    type: 'Exame',
    status: 'Pendente',
    room: 'Lab',
    priority: 'normal',
    note: 'Coleta e avaliação de exames recentes.',
  },
]

const attentionPatients = [
  {
    pet: 'Luna',
    tutor: 'Marina Alves',
    reason: 'Revisar evolução pós-operatória antes da alta.',
    tag: 'Retorno crítico',
    risk: 'Alto',
    lastSeen: 'Hoje, 09:30',
  },
  {
    pet: 'Nina',
    tutor: 'Bianca Torres',
    reason: 'Exame laboratorial aguardando conduta.',
    tag: 'Exame pendente',
    risk: 'Médio',
    lastSeen: 'Ontem, 17:10',
  },
  {
    pet: 'Bob',
    tutor: 'Paulo Mendes',
    reason: 'Histórico de alergia antes da prescrição.',
    tag: 'Atenção',
    risk: 'Médio',
    lastSeen: 'Segunda-feira',
  },
]

const statusClassByPriority: Record<AppointmentPriority, string> = {
  high: 'appointment-row--high',
  attention: 'appointment-row--attention',
  normal: 'appointment-row--normal',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getMetricIcon(tone: string) {
  const iconByTone: Record<string, string> = {
    success: 'pi pi-calendar',
    attention: 'pi pi-exclamation-triangle',
    danger: 'pi pi-heart',
  }

  return iconByTone[tone] ?? 'pi pi-check'
}
</script>

<template>
  <main id="dashboard" class="dashboard-page" :style="pageStyle">
    <section class="dashboard-hero">
      <div class="dashboard-hero__copy">
        <span class="dashboard-kicker">Visão geral</span>
        <h1>Boa tarde, {{ firstName }}</h1>
        <p>
          Rotina clínica, agenda e pendências organizadas para o seu dia. Você tem
          <strong>3 atendimentos</strong> nas próximas horas.
        </p>

        <div class="dashboard-actions">
          <button class="dashboard-button dashboard-button--primary" type="button">
            <i class="pi pi-plus" aria-hidden="true" />
            Novo atendimento
          </button>
          <button class="dashboard-button dashboard-button--ghost" type="button">
            Buscar paciente
          </button>
        </div>
      </div>

      <article class="next-card" aria-label="Próximo atendimento">
        <div class="next-card__header">
          <span>Próximo atendimento</span>
          <strong>em 18 min</strong>
        </div>
        <p class="next-card__time">09:30</p>
        <div class="next-card__patient">
          <span>L</span>
          <div>
            <strong>Luna</strong>
            <small>Retorno - Canina - Sala 2</small>
          </div>
        </div>
        <button class="dashboard-button next-card__button" type="button">
          <i class="pi pi-file-edit" aria-hidden="true" />
          Abrir prontuário
        </button>
      </article>
    </section>

    <section class="dashboard-metrics" aria-label="Métricas principais">
      <article v-for="metric in metrics" :key="metric.label" class="metric-tile" :data-tone="metric.tone">
        <div class="metric-tile__header">
          <span>{{ metric.label }}</span>
          <i :class="getMetricIcon(metric.tone)" aria-hidden="true" />
        </div>
        <strong>{{ metric.value }}</strong>
        <p>{{ metric.detail }}</p>
        <small>{{ metric.trend }}</small>
      </article>
    </section>

    <section class="dashboard-panels">
      <article id="agenda" class="dashboard-panel dashboard-panel--agenda">
        <div class="panel-heading">
          <div>
            <span class="dashboard-kicker">Agenda</span>
            <h2>Atendimentos de hoje</h2>
          </div>
          <RouterLink class="dashboard-button dashboard-button--ghost dashboard-button--sm" to="/veterinario/agenda">
            <i class="pi pi-calendar" aria-hidden="true" />
            Ver calendário
          </RouterLink>
        </div>

        <div class="appointment-list">
          <article
            v-for="appointment in appointments.slice(0, 3)"
            :key="`${appointment.time}-${appointment.pet}`"
            class="appointment-row"
            :class="statusClassByPriority[appointment.priority]"
          >
            <div class="appointment-row__time">
              <strong>{{ appointment.time }}</strong>
              <span>Duração: {{ appointment.duration }}</span>
            </div>
            <span class="dashboard-avatar" :data-tone="appointment.priority">
              {{ getInitials(appointment.pet) }}
            </span>
            <div class="appointment-row__body">
              <div class="appointment-row__title">
                <strong>{{ appointment.pet }}</strong>
                <small>{{ appointment.species }} - {{ appointment.type }}</small>
              </div>
              <p>{{ appointment.note }}</p>
            </div>
            <div class="appointment-row__meta">
              <span class="dashboard-pill" :data-tone="appointment.priority">{{ appointment.status }}</span>
              <strong>{{ appointment.room }}</strong>
              <small>Tutor: {{ appointment.tutor }}</small>
            </div>
          </article>
        </div>
      </article>

      <aside id="pacientes" class="dashboard-panel dashboard-panel--risk">
        <div class="panel-heading">
          <div>
            <span class="dashboard-kicker">Risco clínico</span>
            <h2>Pacientes em atenção</h2>
          </div>
        </div>

        <div class="risk-list">
          <article v-for="patient in attentionPatients" :key="patient.pet" class="risk-row">
            <div class="risk-row__header">
              <span class="dashboard-avatar" :data-tone="patient.risk === 'Alto' ? 'high' : 'attention'">
                {{ getInitials(patient.pet) }}
              </span>
              <div>
                <div class="risk-row__title">
                  <strong>{{ patient.pet }}</strong>
                  <small>Tutora: {{ patient.tutor }}</small>
                </div>
              </div>
              <span class="dashboard-pill" :data-tone="patient.risk === 'Alto' ? 'high' : 'attention'">
                {{ patient.risk }}
              </span>
            </div>
            <p>{{ patient.reason }}</p>
            <footer>
              <span>{{ patient.tag }}</span>
              <small>{{ patient.lastSeen }}</small>
            </footer>
          </article>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.vet-dashboard {
  min-height: calc(100vh - 4.5rem);
  background: #f6f8fb;
  color: var(--brand-navy);
}

.vet-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem;
  border-right: 1px solid #edf0f4;
  background: #fff;
  color: var(--brand-navy);
  overflow: hidden;
}

.sidebar-header {
  display: grid;
  gap: 0.75rem;
}

.brand-block {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
  color: inherit;
  text-decoration: none;
}

.brand-logo {
  display: block;
  object-fit: contain;
}

.brand-logo--sidebar {
  width: min(9rem, 100%);
  max-height: 2.65rem;
}

.brand-logo--mark {
  width: 2.5rem;
  height: 2.5rem;
}

.brand-logo--header {
  width: 9.25rem;
  max-height: 2.75rem;
}

.brand-context {
  padding: 0.32rem 0.58rem;
  border: 1px solid color-mix(in srgb, var(--profile-secondary) 58%, white);
  border-radius: 999px;
  color: var(--clinical-muted);
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2.25rem;
  border: 1px solid #edf0f4;
  border-radius: 0.9rem;
  background: #f8fafc;
  color: var(--brand-navy);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.sidebar-toggle .pi {
  font-size: 0.86rem;
}

.brand-eyebrow,
.section-kicker,
.topbar__date {
  display: block;
  color: var(--profile-primary);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.brand-block strong {
  display: block;
  margin-top: 0.125rem;
  font-size: 1rem;
}

.sidebar-nav {
  display: grid;
  gap: 0.45rem;
}

.sidebar-link {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.78rem;
  border-radius: 1rem;
  color: var(--clinical-muted);
  font-size: 0.92rem;
  font-weight: 600;
  text-decoration: none;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.sidebar-link:hover,
.sidebar-link--active {
  background: color-mix(in srgb, var(--profile-secondary) 26%, white);
  color: var(--profile-primary);
}

.sidebar-link__icon {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: #f4f7f8;
  color: var(--clinical-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.sidebar-link__icon .pi {
  font-size: 0.92rem;
}

.sidebar-link--active .sidebar-link__icon {
  background: color-mix(in srgb, var(--profile-primary) 18%, white);
  color: var(--profile-primary);
}

.sidebar-link__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-card {
  margin-top: auto;
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 1.5rem;
  background: #f8fafc;
}

.vet-dashboard--collapsed .profile-card {
  justify-items: center;
  padding: 0.65rem;
}

.profile-card__avatar,
.pet-avatar {
  display: grid;
  width: 2.625rem;
  height: 2.625rem;
  place-items: center;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--profile-secondary) 44%, white);
  color: var(--brand-navy);
  font-size: 0.82rem;
  font-weight: 600;
}

.profile-card p {
  margin: 0;
  font-weight: 600;
}

.profile-card span,
.profile-card small {
  color: var(--clinical-muted);
  font-size: 0.78rem;
  word-break: break-word;
}

.dashboard-shell {
  display: grid;
  gap: 1rem;
  min-width: 0;
  padding: 1rem;
}

.topbar {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1rem;
  border: 1px solid #edf0f4;
  border-radius: 1rem;
  background: #fff;
}

.topbar__brand {
  display: flex;
  gap: 1rem;
  align-items: center;
  min-width: 0;
}

.topbar h1 {
  margin: 0.1rem 0 0;
  font-size: clamp(1.45rem, 2.2vw, 2rem);
  letter-spacing: -0.04em;
}

.topbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.icon-button,
.primary-action,
.secondary-action,
.logout-action,
.card-heading button,
.next-appointment button,
.quick-actions button,
.profile-link {
  min-height: 2.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.9rem;
  border: 0;
  border-radius: 999px;
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  gap: 0.45rem;
  white-space: nowrap;
}

.icon-button .pi,
.primary-action .pi,
.secondary-action .pi,
.logout-action .pi,
.card-heading button .pi,
.next-appointment button .pi {
  font-size: 0.86rem;
}

.primary-action {
  background: var(--profile-primary);
  color: white;
}

.secondary-action,
.card-heading button {
  border: 1px solid color-mix(in srgb, var(--profile-secondary) 70%, transparent);
  background: rgb(255 255 255 / 0.74);
  color: var(--brand-navy);
}

.logout-action {
  border: 1px solid color-mix(in srgb, var(--danger-soft) 42%, white);
  background: color-mix(in srgb, var(--danger-soft) 18%, white);
  color: var(--brand-navy);
}

.secondary-action--light {
  background: rgb(255 255 255 / 0.12);
  color: white;
}

.icon-button {
  width: auto;
  padding: 0;
  padding-inline: 1rem;
  border: 1px solid color-mix(in srgb, var(--profile-secondary) 70%, transparent);
  background: white;
  color: var(--brand-navy);
}

.dashboard-intro,
.dashboard-card,
.metric-card {
  border: 1px solid #edf0f4;
  background: #fff;
}

.dashboard-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 17rem;
  gap: 1rem;
  padding: 1rem;
  border-radius: 1.15rem;
  align-items: center;
}

.dashboard-intro h2 {
  margin: 0.3rem 0 0;
  font-size: clamp(1.55rem, 2.4vw, 2.25rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.dashboard-intro p {
  margin: 0.45rem 0 0;
  color: var(--clinical-muted);
  line-height: 1.5;
}

.next-appointment {
  min-height: 9.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--profile-secondary) 54%, white);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--profile-secondary) 22%, white);
  color: var(--brand-navy);
}

.next-appointment__label {
  color: var(--profile-primary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.next-appointment strong {
  font-size: 3.45rem;
  line-height: 1;
  letter-spacing: -0.08em;
}

.next-appointment p {
  margin: 0;
  color: var(--brand-navy);
  font-size: 1.05rem;
  font-weight: 600;
}

.next-appointment span {
  color: var(--clinical-muted);
}

.next-appointment button {
  width: 100%;
  background: var(--profile-primary);
  color: white;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.metric-card {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 1.15rem;
}

.metric-card span,
.metric-card p {
  color: var(--clinical-muted);
}

.metric-card strong {
  font-size: 2.05rem;
  line-height: 1;
  letter-spacing: -0.05em;
}

.metric-card small {
  width: fit-content;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--profile-secondary) 40%, white);
  color: var(--brand-navy);
  font-weight: 600;
}

.metric-card[data-tone='attention'] small {
  background: color-mix(in srgb, var(--attention) 58%, white);
}

.metric-card[data-tone='danger'] small {
  background: color-mix(in srgb, var(--danger-soft) 38%, white);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(20rem, 0.8fr);
  gap: 1rem;
}

.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24rem;
  gap: 1rem;
}

.dashboard-card {
  padding: 1rem;
  border-radius: 1.35rem;
}

.card-heading {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.card-heading h3 {
  margin: 0.15rem 0 0;
  font-size: 1.16rem;
  letter-spacing: -0.035em;
}

.appointment-list,
.risk-list,
.task-list {
  display: grid;
  gap: 0.7rem;
}

.appointment-card {
  display: grid;
  grid-template-columns: 4.6rem minmax(0, 1fr) 7.8rem;
  gap: 0.85rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--soft-border) 45%, transparent);
  border-radius: 1rem;
  background: white;
}

.appointment-card--high {
  border-color: color-mix(in srgb, var(--danger-soft) 52%, white);
  background: color-mix(in srgb, var(--danger-soft) 7%, white);
}

.appointment-card--attention {
  border-color: color-mix(in srgb, var(--attention) 60%, white);
  background: color-mix(in srgb, var(--attention) 8%, white);
}

.appointment-card__time strong,
.appointment-card__title strong {
  display: block;
  color: var(--brand-navy);
  font-weight: 600;
}

.appointment-card__time strong {
  font-size: 1.15rem;
}

.appointment-card__time span,
.appointment-card__title p,
.appointment-card__note,
.appointment-card__meta small {
  color: var(--clinical-muted);
  font-size: 0.84rem;
}

.appointment-card__title {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.appointment-card__note {
  margin: 0.55rem 0 0;
  line-height: 1.5;
}

.appointment-card__meta {
  display: grid;
  justify-items: end;
  gap: 0.25rem;
  text-align: right;
}

.appointment-card__meta span,
.risk-badge,
.task-card span {
  width: fit-content;
  padding: 0.28rem 0.62rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--profile-secondary) 42%, white);
  color: var(--brand-navy);
  font-size: 0.72rem;
  font-weight: 600;
}

.risk-panel {
  background: #fff;
  color: var(--brand-navy);
}

.risk-panel .section-kicker,
.risk-panel h3 {
  color: var(--brand-navy);
}

.risk-card {
  padding: 0.95rem;
  border: 1px solid color-mix(in srgb, var(--profile-secondary) 46%, white);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--profile-secondary) 14%, white);
}

.risk-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}

.pet-avatar--light {
  background: #fff;
  color: var(--profile-primary);
}

.risk-card strong {
  display: block;
  color: var(--brand-navy);
}

.risk-card p,
.risk-card footer,
.risk-card__header p {
  color: var(--clinical-muted);
  font-size: 0.86rem;
  line-height: 1.55;
}

.risk-card footer {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
}

.risk-card footer span {
  color: var(--attention);
  font-weight: 600;
}

.risk-badge {
  background: var(--attention);
}

.task-card {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--soft-border) 45%, transparent);
  border-radius: 1.25rem;
  background: white;
}

.task-card--urgent {
  border-color: color-mix(in srgb, var(--danger-soft) 52%, white);
  background: color-mix(in srgb, var(--danger-soft) 7%, white);
}

.task-card--high {
  border-color: color-mix(in srgb, var(--attention) 60%, white);
  background: color-mix(in srgb, var(--attention) 8%, white);
}

.task-card strong {
  display: block;
  font-weight: 600;
}

.task-card p,
.task-card small {
  color: var(--clinical-muted);
  font-size: 0.84rem;
}

.task-card > div:last-child {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
  text-align: right;
}

.quick-actions__grid {
  display: grid;
  gap: 0.75rem;
}

.quick-actions button,
.profile-link {
  width: 100%;
  justify-content: space-between;
  border: 1px solid color-mix(in srgb, var(--profile-secondary) 55%, transparent);
  background: white;
  color: var(--brand-navy);
}

.quick-actions button span {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
}

.quick-actions button .pi {
  color: var(--profile-primary);
  font-size: 0.95rem;
}

.quick-actions button::after,
.profile-link::after {
  content: '>';
}

.profile-link {
  margin-top: 1rem;
  background: var(--profile-primary);
  color: white;
}

@media (max-width: 1180px) {
  .vet-dashboard {
    grid-template-columns: 1fr;
  }

  .vet-sidebar {
    position: static;
    height: auto;
  }

  .sidebar-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .profile-card {
    margin-top: 0;
  }

  .hero-panel,
  .dashboard-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .dashboard-shell {
    padding: 1rem;
  }

  .topbar,
  .card-heading,
  .task-card {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .appointment-card {
    grid-template-columns: 1fr;
  }

  .appointment-card__meta,
  .task-card > div:last-child {
    justify-items: start;
    text-align: left;
  }
}

@media (max-width: 560px) {
  .sidebar-nav,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .hero-panel h2 {
    font-size: 2.15rem;
  }
}

.dashboard-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.45rem 1.6rem 2rem;
  background: var(--dashboard-bg);
  color: var(--dashboard-text);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20.5rem;
  gap: 1.55rem;
  align-items: stretch;
}

.dashboard-kicker {
  display: block;
  color: var(--dashboard-faint);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.dashboard-hero h1 {
  margin: 0.35rem 0 0;
  color: var(--dashboard-text);
  font-size: clamp(1.7rem, 2.4vw, 2.18rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.055em;
}

.dashboard-hero p {
  max-width: 38rem;
  margin: 0.65rem 0 0;
  color: var(--dashboard-muted);
  font-size: 0.94rem;
  line-height: 1.55;
}

.dashboard-hero p strong {
  color: var(--dashboard-primary-strong);
}

.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.05rem;
}

.dashboard-button {
  display: inline-flex;
  min-height: 2.55rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 0.78rem;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.dashboard-button:hover {
  transform: translateY(-1px);
}

.dashboard-button .pi {
  display: block;
  flex: 0 0 auto;
  font-size: 0.85rem;
  line-height: 1;
}

.dashboard-button--primary {
  background: linear-gradient(
    135deg,
    var(--dashboard-primary),
    var(--dashboard-primary-strong)
  );
  color: var(--dashboard-card);
  font-weight: 600;
}

.dashboard-button--ghost {
  border: 1px solid var(--dashboard-line);
  background: var(--dashboard-card);
  color: var(--dashboard-text);
}

.dashboard-button--sm {
  min-height: 2.25rem;
  padding-inline: 0.8rem;
}

.next-card {
  position: relative;
  min-height: 10rem;
  overflow: hidden;
  padding: 1.25rem;
  border-radius: 1.25rem;
  background: linear-gradient(
    150deg,
    var(--dashboard-primary),
    var(--dashboard-primary-strong) 68%,
    var(--dashboard-primary-deep)
  );
  color: var(--dashboard-card);
}

.next-card__header,
.next-card__patient,
.next-card__button,
.next-card__time {
  position: relative;
}

.next-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.next-card__header span {
  color: color-mix(in srgb, var(--dashboard-card) 84%, transparent);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.next-card__header strong {
  padding: 0.24rem 0.58rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dashboard-card) 18%, transparent);
  font-size: 0.68rem;
}

.dashboard-hero .next-card__time {
  margin: 0.75rem 0 0;
  color: var(--dashboard-card);
  font-size: 3rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.06em;
}

.next-card__patient {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.55rem;
}

.next-card__patient > span {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  border-radius: 0.72rem;
  background: color-mix(in srgb, var(--dashboard-card) 20%, transparent);
  font-weight: 600;
}

.next-card__patient strong {
  display: block;
  color: var(--dashboard-card);
  font-size: 0.98rem;
  font-weight: 600;
}

.next-card__patient small {
  display: block;
  color: color-mix(in srgb, var(--dashboard-card) 82%, transparent);
  font-weight: 600;
}

.next-card__button {
  width: 100%;
  margin-top: 1rem;
  background: var(--dashboard-card);
  color: var(--dashboard-primary-deep);
  line-height: 1;
}

.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.35rem;
}

.metric-tile,
.dashboard-panel {
  border: 1px solid var(--dashboard-line);
  background: var(--dashboard-card);
}

.metric-tile {
  min-height: 7.65rem;
  padding: 1.1rem;
  border-radius: 1.05rem;
}

.metric-tile__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.metric-tile__header span {
  color: var(--dashboard-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.metric-tile__header i {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: var(--dashboard-success-bg);
  color: var(--dashboard-primary);
}

.metric-tile[data-tone='attention'] .metric-tile__header i {
  background: var(--dashboard-amber-bg);
  color: var(--dashboard-amber);
}

.metric-tile[data-tone='danger'] .metric-tile__header i {
  background: var(--dashboard-warm-bg);
  color: var(--dashboard-warm);
}

.metric-tile strong {
  display: block;
  margin-top: 0.55rem;
  color: var(--dashboard-text);
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.055em;
}

.metric-tile p {
  margin: 0.45rem 0 0;
  color: var(--dashboard-muted);
  font-size: 0.78rem;
}

.metric-tile small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.7rem;
  padding: 0.3rem 0.58rem;
  border-radius: 999px;
  background: var(--dashboard-success-bg);
  color: var(--dashboard-success-text);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
}

.metric-tile[data-tone='attention'] small,
.metric-tile[data-tone='danger'] small {
  background: var(--dashboard-warm-bg);
  color: var(--dashboard-warm-text);
}

.dashboard-panels {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(19rem, 1fr);
  gap: 1.35rem;
  margin-top: 1.35rem;
}

.dashboard-panel {
  padding: 1.05rem;
  border-radius: 1.25rem;
}

.panel-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.panel-heading h2 {
  margin: 0.18rem 0 0;
  color: var(--dashboard-text);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.appointment-list,
.risk-list {
  display: grid;
  gap: 0.7rem;
}

.appointment-row {
  display: grid;
  grid-template-columns: 5.6rem 2.3rem minmax(0, 1fr) 7.8rem;
  column-gap: 1rem;
  row-gap: 0.75rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border: 1px solid var(--dashboard-line);
  border-radius: 0.95rem;
  background: var(--dashboard-surface);
}

.appointment-row--high {
  border-color: var(--dashboard-warm-line);
  background: var(--dashboard-warm-soft);
}

.appointment-row--attention {
  border-color: color-mix(in srgb, var(--dashboard-amber) 42%, var(--dashboard-line));
  background: color-mix(in srgb, var(--dashboard-amber-bg) 42%, var(--dashboard-card));
}

.appointment-row__time strong,
.appointment-row__body strong,
.appointment-row__meta strong,
.risk-row strong {
  color: var(--dashboard-text);
  font-weight: 600;
}

.appointment-row__time {
  display: grid;
  gap: 0.3rem;
  align-content: center;
}

.appointment-row__time strong {
  font-size: 0.95rem;
  line-height: 1.1;
}

.appointment-row__time span,
.appointment-row__body small,
.appointment-row__body p,
.appointment-row__meta small,
.risk-row small,
.risk-row p {
  color: var(--dashboard-muted);
  font-size: 0.76rem;
}

.appointment-row__title,
.risk-row__title {
  display: grid;
  gap: 0.18rem;
}

.appointment-row__title strong,
.risk-row__title strong {
  display: block;
  line-height: 1.2;
}

.appointment-row__title small,
.risk-row__title small {
  display: block;
  line-height: 1.25;
}

.appointment-row__body p {
  margin: 0.48rem 0 0;
  line-height: 1.45;
}

.appointment-row__meta {
  display: grid;
  justify-items: end;
  gap: 0.4rem;
  align-content: center;
  text-align: right;
}

.dashboard-avatar {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  place-items: center;
  border-radius: 0.72rem;
  background: var(--dashboard-success-bg);
  color: var(--dashboard-primary-strong);
  font-size: 0.8rem;
  font-weight: 600;
}

.dashboard-avatar[data-tone='high'] {
  background: var(--dashboard-warm-bg);
  color: var(--dashboard-warm);
}

.dashboard-avatar[data-tone='attention'] {
  background: var(--dashboard-amber-bg);
  color: var(--dashboard-amber-text);
}

.dashboard-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 0.28rem 0.58rem;
  border-radius: 999px;
  background: var(--dashboard-success-bg);
  color: var(--dashboard-success-text);
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
}

.dashboard-pill[data-tone='high'] {
  background: var(--dashboard-warm-bg);
  color: var(--dashboard-warm-text);
}

.dashboard-pill[data-tone='attention'] {
  background: var(--dashboard-amber-bg);
  color: var(--dashboard-amber-text);
}

.risk-row {
  padding: 0.95rem;
  border: 1px solid var(--dashboard-line);
  border-radius: 0.95rem;
  background: var(--dashboard-surface);
}

.risk-row__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.85rem;
  align-items: start;
}

.risk-row p {
  margin: 0.8rem 0 0;
  line-height: 1.55;
}

.risk-row footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.8rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--dashboard-line-soft);
}

.risk-row footer span {
  color: var(--dashboard-warm-text);
  font-size: 0.72rem;
  font-weight: 600;
}

@media (max-width: 1180px) {
  .dashboard-hero,
  .dashboard-panels {
    grid-template-columns: 1fr;
  }

  .next-card {
    width: min(100%, 24rem);
  }
}

@media (max-width: 920px) {
  .dashboard-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .appointment-row {
    grid-template-columns: 5.6rem 2.3rem minmax(0, 1fr);
  }

  .appointment-row__meta {
    grid-column: 3;
    justify-items: start;
    text-align: left;
  }
}

@media (max-width: 620px) {
  .dashboard-page {
    padding: 1rem;
  }

  .dashboard-metrics,
  .appointment-row {
    grid-template-columns: 1fr;
  }

  .appointment-row__meta {
    grid-column: auto;
  }
}
</style>
