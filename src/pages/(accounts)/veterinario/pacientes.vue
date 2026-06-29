<script setup lang="ts">
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'

import { currentColors } from '@/theme/color-mode'

type PatientSpecies = 'cao' | 'gato' | 'ave' | 'exotico' | 'outro'
type PatientRisk = 'high' | 'medium' | 'ok'
type PatientState = 'loading' | 'ready' | 'error'
type PatientFilter = 'todos' | 'atencao' | 'pendencias' | 'retorno'
type SegmentFilter = 'todos' | 'pequenos' | 'aves-exoticos' | 'caninos' | 'felinos'
type SortMode = 'retorno' | 'nome' | 'risco'

type Patient = {
  id: string
  pet: string
  species: PatientSpecies
  breed: string
  tutor: string
  lastVisit: string
  nextReturn: string
  nextReturnSort: string
  risk: PatientRisk
  tag: string
}

type SortOption = {
  value: SortMode
  label: string
  detail: string
  icon: string
}

type SegmentOption = {
  value: SegmentFilter
  label: string
  detail: string
  icon: string
}

type SelectInstance = {
  hide?: () => void
  overlayVisible?: boolean
}

const toast = useToast()
const pageState = ref<PatientState>('ready')
const searchQuery = ref('')
const selectedFilter = ref<PatientFilter>('todos')
const selectedSegment = ref<SegmentFilter>('todos')
const selectedSort = ref<SortMode>('retorno')
const segmentSelectRef = ref<SelectInstance | null>(null)
const sortSelectRef = ref<SelectInstance | null>(null)

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--patients-bg': colors.dashboard.bg,
    '--patients-card': colors.dashboard.surface,
    '--patients-surface': colors.dashboard.surfaceSoft,
    '--patients-line': colors.dashboard.line,
    '--patients-line-soft': colors.dashboard.lineSoft,
    '--patients-text': colors.dashboard.text,
    '--patients-muted': colors.dashboard.muted,
    '--patients-faint': colors.dashboard.faint,
    '--patients-primary': colors.vet.primary,
    '--patients-primary-soft': colors.vet.secondary,
    '--patients-primary-strong': colors.dashboard.primaryStrong,
    '--patients-success-bg': colors.dashboard.successBg,
    '--patients-success-text': colors.dashboard.successText,
    '--patients-warm-bg': colors.dashboard.warmBg,
    '--patients-warm-soft': colors.dashboard.warmSoft,
    '--patients-warm-line': colors.dashboard.warmLine,
    '--patients-warm-text': colors.dashboard.warmText,
    '--patients-amber-bg': colors.dashboard.amberBg,
    '--patients-amber-text': colors.dashboard.amberText,
    '--patients-shadow-rgb': colors.auth.shadowRgb,
  }
})

const patients: Patient[] = [
  {
    id: 'luna',
    pet: 'Luna',
    species: 'cao',
    breed: 'Golden Retriever',
    tutor: 'Marina Alves',
    lastVisit: '22 jun 2026',
    nextReturn: 'Hoje, 09:30',
    nextReturnSort: '2026-06-29T09:30:00',
    risk: 'high',
    tag: 'Vacina pendente',
  },
  {
    id: 'thor',
    pet: 'Thor',
    species: 'gato',
    breed: 'SRD',
    tutor: 'Rafael Lima',
    lastVisit: '10 jun 2026',
    nextReturn: '30 jun, 10:15',
    nextReturnSort: '2026-06-30T10:15:00',
    risk: 'ok',
    tag: 'Vacinação ok',
  },
  {
    id: 'mel',
    pet: 'Mel',
    species: 'cao',
    breed: 'Poodle',
    tutor: 'Bianca Torres',
    lastVisit: '18 jun 2026',
    nextReturn: '30 jun, 11:00',
    nextReturnSort: '2026-06-30T11:00:00',
    risk: 'medium',
    tag: 'Vacinação ok',
  },
  {
    id: 'bob',
    pet: 'Bob',
    species: 'cao',
    breed: 'Labrador',
    tutor: 'Paulo Mendes',
    lastVisit: '12 jun 2026',
    nextReturn: '30 jun, 11:45',
    nextReturnSort: '2026-06-30T11:45:00',
    risk: 'medium',
    tag: 'Alergia registrada',
  },
  {
    id: 'nina',
    pet: 'Nina',
    species: 'cao',
    breed: 'Bulldog',
    tutor: 'Bianca Torres',
    lastVisit: '28 jun 2026',
    nextReturn: '01 jul, 08:00',
    nextReturnSort: '2026-07-01T08:00:00',
    risk: 'high',
    tag: 'Pós-cirúrgico',
  },
  {
    id: 'simba',
    pet: 'Simba',
    species: 'gato',
    breed: 'Persa',
    tutor: 'Diego Faria',
    lastVisit: '05 jun 2026',
    nextReturn: '03 jul, 09:30',
    nextReturnSort: '2026-07-03T09:30:00',
    risk: 'ok',
    tag: 'Vacinação ok',
  },
  {
    id: 'aurora',
    pet: 'Aurora',
    species: 'ave',
    breed: 'Calopsita',
    tutor: 'Helena Castro',
    lastVisit: '20 jun 2026',
    nextReturn: '02 jul, 12:00',
    nextReturnSort: '2026-07-02T12:00:00',
    risk: 'ok',
    tag: 'Vacinação ok',
  },
  {
    id: 'frida',
    pet: 'Frida',
    species: 'exotico',
    breed: 'Coelho',
    tutor: 'André Pires',
    lastVisit: '25 jun 2026',
    nextReturn: '04 jul, 08:30',
    nextReturnSort: '2026-07-04T08:30:00',
    risk: 'medium',
    tag: 'Reforço em breve',
  },
]

const filterOptions: Array<{ value: PatientFilter; label: string; count?: number }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'atencao', label: 'Em atenção' },
  { value: 'pendencias', label: 'Pendências' },
  { value: 'retorno', label: 'Retorno próximo' },
]

const segmentOptions: SegmentOption[] = [
  { value: 'todos', label: 'Todos os pets', detail: 'Base completa da clínica', icon: 'pi pi-sitemap' },
  { value: 'pequenos', label: 'Pequenos animais', detail: 'Caninos e felinos', icon: 'pi pi-heart' },
  { value: 'aves-exoticos', label: 'Aves e exóticos', detail: 'Aves, coelhos, répteis e outros', icon: 'pi pi-star' },
  { value: 'caninos', label: 'Caninos', detail: 'Refinar para cães', icon: 'pi pi-sparkles' },
  { value: 'felinos', label: 'Felinos', detail: 'Refinar para gatos', icon: 'pi pi-heart' },
]

const sortOptions: SortOption[] = [
  { value: 'retorno', label: 'Ordenar por retorno', detail: 'Próximos atendimentos primeiro', icon: 'pi pi-calendar-clock' },
  { value: 'nome', label: 'Ordenar por nome', detail: 'A-Z por nome do pet', icon: 'pi pi-sort-alpha-down' },
  { value: 'risco', label: 'Ordenar por risco', detail: 'Alta atenção no topo', icon: 'pi pi-shield' },
]

const filterSelectPt = computed(() => {
  const colors = currentColors.value

  return {
    overlay: {
      class: 'patients-select-overlay',
      style: {
        '--pj-select-card': colors.dashboard.surface,
        '--pj-select-line': colors.dashboard.line,
        '--pj-select-text': colors.dashboard.text,
        '--pj-select-muted': colors.dashboard.muted,
        '--pj-select-faint': colors.dashboard.faint,
        '--pj-select-primary': colors.vet.primary,
        '--pj-select-primary-soft': colors.vet.secondary,
        '--pj-select-primary-strong': colors.dashboard.primaryStrong,
        '--pj-select-shadow-rgb': colors.auth.shadowRgb,
      },
    },
    list: {
      class: 'patients-select-list',
    },
    option: {
      class: 'patients-select-option',
    },
  }
})

const riskLabel: Record<PatientRisk, string> = {
  high: 'Risco alto',
  medium: 'Risco médio',
  ok: 'Em dia',
}

const riskWeight: Record<PatientRisk, number> = {
  high: 0,
  medium: 1,
  ok: 2,
}

const speciesLabel: Record<PatientSpecies, string> = {
  cao: 'Canina',
  gato: 'Felina',
  ave: 'Ave',
  exotico: 'Exótica',
  outro: 'Outra espécie',
}

const speciesIcon: Record<PatientSpecies, string> = {
  cao: 'pi pi-sparkles',
  gato: 'pi pi-heart',
  ave: 'pi pi-send',
  exotico: 'pi pi-star',
  outro: 'pi pi-ellipsis-h',
}

const summary = computed(() => ({
  total: 248,
  attention: patients.filter((patient) => patient.risk !== 'ok').length,
}))

const selectedSegmentOption = computed(
  () => segmentOptions.find((option) => option.value === selectedSegment.value) ?? segmentOptions[0],
)

const selectedSortOption = computed(
  () => sortOptions.find((option) => option.value === selectedSort.value) ?? sortOptions[0],
)

const visiblePatients = computed(() => {
  const normalizedSearch = searchQuery.value.trim().toLocaleLowerCase('pt-BR')

  return [...patients]
    .filter((patient) => {
      const matchesFilter =
        selectedFilter.value === 'todos' ||
        (selectedFilter.value === 'atencao' && patient.risk !== 'ok') ||
        (selectedFilter.value === 'pendencias' && hasPendingCare(patient)) ||
        (selectedFilter.value === 'retorno' && hasUpcomingReturn(patient))

      const matchesSegment = matchesPatientSegment(patient)

      const searchableText = `${patient.pet} ${patient.tutor} ${patient.breed} ${speciesLabel[patient.species]}`.toLocaleLowerCase('pt-BR')

      return matchesFilter && matchesSegment && (!normalizedSearch || searchableText.includes(normalizedSearch))
    })
    .sort((current, next) => {
      if (selectedSort.value === 'nome') {
        return current.pet.localeCompare(next.pet, 'pt-BR')
      }

      if (selectedSort.value === 'risco') {
        return riskWeight[current.risk] - riskWeight[next.risk]
      }

      return current.nextReturnSort.localeCompare(next.nextReturnSort)
    })
})

function getInitial(name: string) {
  return name.slice(0, 1).toUpperCase()
}

function hasPendingCare(patient: Patient) {
  return patient.risk !== 'ok' || !patient.tag.toLocaleLowerCase('pt-BR').includes('ok')
}

function hasUpcomingReturn(patient: Patient) {
  return patient.nextReturnSort <= '2026-07-01T23:59:59'
}

function matchesPatientSegment(patient: Patient) {
  if (selectedSegment.value === 'todos') {
    return true
  }

  if (selectedSegment.value === 'pequenos') {
    return patient.species === 'cao' || patient.species === 'gato'
  }

  if (selectedSegment.value === 'aves-exoticos') {
    return patient.species === 'ave' || patient.species === 'exotico' || patient.species === 'outro'
  }

  if (selectedSegment.value === 'caninos') {
    return patient.species === 'cao'
  }

  return patient.species === 'gato'
}

function getFilterCount(filter: PatientFilter) {
  if (filter === 'todos') {
    return patients.length
  }

  if (filter === 'pendencias') {
    return patients.filter(hasPendingCare).length
  }

  if (filter === 'retorno') {
    return patients.filter(hasUpcomingReturn).length
  }

  return summary.value.attention
}

function clearFilters() {
  searchQuery.value = ''
  selectedFilter.value = 'todos'
  selectedSegment.value = 'todos'
  selectedSort.value = 'retorno'
}

function closeSelect(select: SelectInstance | null) {
  if (!select) {
    return
  }

  if (typeof select.hide === 'function') {
    select.hide()
    return
  }

  select.overlayVisible = false
}

function handleSegmentSelectShow() {
  closeSelect(sortSelectRef.value)
}

function handleSortSelectShow() {
  closeSelect(segmentSelectRef.value)
}

function retryPatients() {
  pageState.value = 'loading'

  window.setTimeout(() => {
    pageState.value = 'ready'
  }, 350)
}

function registerNewPatient() {
  toast.add({
    severity: 'success',
    summary: 'Novo paciente',
    detail: 'Fluxo de novo paciente preparado para integração com cadastro.',
    life: 3000,
  })
}
</script>

<template>
  <main class="patients-page" :style="pageStyle">
    <section class="patients-toolbar">
      <div class="patients-heading">
        <span class="patients-kicker">Base clínica</span>
        <div class="patients-heading__title">
          <h1>Pacientes</h1>
          <strong>{{ summary.total }} cadastrados</strong>
        </div>
      </div>

      <div class="patients-actions">
        <label class="patients-search" for="patients-search">
          <i class="pi pi-search" aria-hidden="true" />
          <input id="patients-search" v-model="searchQuery" type="search" placeholder="Buscar pet ou tutor..." />
        </label>

        <button class="patients-button patients-button--primary" type="button" @click="registerNewPatient">
          <i class="pi pi-plus" aria-hidden="true" />
          Novo paciente
        </button>
      </div>
    </section>

    <section class="patients-filters" aria-label="Filtros de pacientes">
      <div class="filter-group">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          class="filter-chip"
          :class="{ 'filter-chip--active': selectedFilter === option.value }"
          type="button"
          @click="selectedFilter = option.value"
        >
          {{ option.label }}
          <span v-if="option.value !== 'todos'">- {{ getFilterCount(option.value) }}</span>
        </button>
      </div>

      <div class="filter-selects" aria-label="Escopo e ordenação de pacientes">
        <div class="select-control select-control--segment">
          <Select
            ref="segmentSelectRef"
            v-model="selectedSegment"
            input-id="patients-segment"
            :options="segmentOptions"
            option-label="label"
            option-value="value"
            append-to="body"
            aria-label="Filtrar por segmento de atendimento"
            class="patients-filter-select w-full"
            :pt="filterSelectPt"
            @show="handleSegmentSelectShow"
          >
            <template #value>
              <div class="filter-select-value">
                <i :class="selectedSegmentOption?.icon" aria-hidden="true" />
                <span>{{ selectedSegmentOption?.label }}</span>
              </div>
            </template>

            <template #option="slotProps">
              <div class="filter-select-option">
                <span class="filter-select-option__icon">
                  <i :class="slotProps.option.icon" aria-hidden="true" />
                </span>
                <span class="filter-select-option__line">
                  <strong>{{ slotProps.option.label }}</strong>
                  <small>{{ slotProps.option.detail }}</small>
                </span>
              </div>
            </template>
          </Select>
        </div>

        <div class="select-control select-control--sort">
          <Select
            ref="sortSelectRef"
            v-model="selectedSort"
            input-id="patients-sort"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            append-to="body"
            aria-label="Ordenação de pacientes"
            class="patients-filter-select w-full"
            :pt="filterSelectPt"
            @show="handleSortSelectShow"
          >
            <template #value>
              <div class="filter-select-value">
                <i :class="selectedSortOption?.icon" aria-hidden="true" />
                <span>{{ selectedSortOption?.label }}</span>
              </div>
            </template>

            <template #option="slotProps">
              <div class="filter-select-option">
                <span class="filter-select-option__icon">
                  <i :class="slotProps.option.icon" aria-hidden="true" />
                </span>
                <span class="filter-select-option__line">
                  <strong>{{ slotProps.option.label }}</strong>
                  <small>{{ slotProps.option.detail }}</small>
                </span>
              </div>
            </template>
          </Select>
        </div>
      </div>
    </section>

    <section v-if="pageState === 'loading'" class="patients-state" role="status">
      <span class="state-spinner" aria-hidden="true" />
      <strong>Carregando pacientes</strong>
      <p>Buscando pets, tutores e alertas clínicos autorizados.</p>
    </section>

    <section v-else-if="pageState === 'error'" class="patients-state patients-state--error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <strong>Não foi possível carregar os pacientes</strong>
      <p>Confira sessão, vínculo com a clínica e permissões de acesso antes de tentar novamente.</p>
      <button class="patients-button patients-button--primary" type="button" @click="retryPatients">Tentar novamente</button>
    </section>

    <section v-else-if="visiblePatients.length === 0" class="patients-state">
      <i class="pi pi-search" aria-hidden="true" />
      <strong>Nenhum paciente encontrado</strong>
      <p>Não encontramos pets ou tutores para a busca e filtros selecionados.</p>
      <button class="patients-button patients-button--ghost" type="button" @click="clearFilters">Limpar filtros</button>
    </section>

    <section v-else class="patients-grid" aria-label="Lista de pacientes">
      <article v-for="patient in visiblePatients" :key="patient.id" class="patient-card">
        <header class="patient-card__header">
          <span class="patient-avatar" :data-tone="patient.risk">
            {{ getInitial(patient.pet) }}
          </span>

          <div class="patient-card__identity">
            <strong>{{ patient.pet }}</strong>
            <small>
              <i :class="speciesIcon[patient.species]" aria-hidden="true" />
              {{ speciesLabel[patient.species] }} - {{ patient.breed }}
            </small>
          </div>

          <span class="risk-pill" :data-tone="patient.risk">{{ riskLabel[patient.risk] }}</span>
        </header>

        <dl class="patient-card__details">
          <div>
            <dt>Tutora</dt>
            <dd>{{ patient.tutor }}</dd>
          </div>
          <div>
            <dt>Última visita</dt>
            <dd>{{ patient.lastVisit }}</dd>
          </div>
          <div>
            <dt>Próximo retorno</dt>
            <dd :class="{ 'patient-card__return--urgent': patient.risk === 'high' }">{{ patient.nextReturn }}</dd>
          </div>
        </dl>

        <footer class="patient-card__footer">
          <span class="clinical-tag" :data-tone="patient.risk">{{ patient.tag }}</span>
          <button type="button">Ver prontuário <i class="pi pi-angle-right" aria-hidden="true" /></button>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.patients-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.45rem 1.6rem 2rem;
  background: var(--patients-bg);
  color: var(--patients-text);
}

.patients-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
}

.patients-kicker {
  display: block;
  color: var(--patients-faint);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.patients-heading__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.7rem;
  margin-top: 0.22rem;
}

.patients-heading h1 {
  margin: 0;
  color: var(--patients-text);
  font-size: clamp(1.9rem, 3vw, 2.5rem);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.06em;
}

.patients-heading strong {
  color: var(--patients-faint);
  font-size: 0.9rem;
  font-weight: 600;
}

.patients-actions,
.patients-filters,
.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.patients-actions {
  align-items: center;
  justify-content: flex-end;
  min-width: min(100%, 31rem);
}

.patients-search {
  display: inline-flex;
  width: min(20rem, 34vw);
  min-width: 15rem;
  height: 3rem;
  align-items: center;
  gap: 0.72rem;
  padding: 0 1rem;
  border: 1px solid var(--patients-line);
  border-radius: 0.98rem;
  background: var(--patients-card);
  color: var(--patients-faint);
  box-shadow: 0 10px 30px rgb(var(--patients-shadow-rgb) / 0.04);
}

.patients-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--patients-text);
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  outline: none;
}

.patients-search input::placeholder {
  color: var(--patients-faint);
}

.patients-button,
.filter-chip {
  display: inline-flex;
  min-height: 2.8rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 0.95rem;
  border-radius: 0.86rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
}

.patients-button,
.filter-chip {
  border: 0;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.patients-button:hover,
.filter-chip:hover,
.patient-card:hover {
  transform: translateY(-1px);
}

.patients-button--primary {
  min-width: 10rem;
  background: linear-gradient(135deg, var(--patients-primary), var(--patients-primary-strong));
  color: var(--patients-card);
  font-weight: 600;
  box-shadow: 0 16px 30px rgb(var(--patients-shadow-rgb) / 0.12);
}

.patients-button--ghost,
.filter-chip {
  border: 1px solid var(--patients-line);
  background: var(--patients-card);
  color: var(--patients-muted);
}

.patients-filters {
  align-items: center;
  justify-content: space-between;
  margin-top: 1.18rem;
}

.filter-chip {
  min-height: 2.5rem;
  padding-inline: 0.9rem;
}

.filter-chip--active {
  border-color: color-mix(in srgb, var(--patients-primary) 42%, var(--patients-line));
  background: var(--patients-primary);
  color: white;
}

.filter-chip:not(.filter-chip--active):has(span) {
  color: var(--patients-warm-text);
}

.filter-chip span {
  color: inherit;
}

.filter-selects {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.select-control {
  width: 13.75rem;
  flex: 0 0 auto;
}

.select-control--segment {
  width: 11.75rem;
}

.select-control :deep(.patients-filter-select) {
  min-height: 2.5rem;
  border: 1px solid var(--patients-line);
  border-radius: 0.82rem;
  background: var(--patients-card);
  color: var(--patients-muted);
  box-shadow: none;
}

.select-control :deep(.patients-filter-select:not(.p-disabled).p-focus),
.select-control :deep(.patients-filter-select:not(.p-disabled):hover) {
  border-color: color-mix(in srgb, var(--patients-primary) 34%, var(--patients-line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--patients-primary) 14%, transparent);
}

.select-control :deep(.p-select-label) {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  padding: 0 0.65rem 0 0.78rem;
  color: var(--patients-muted);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
}

.select-control :deep(.p-select-dropdown) {
  display: flex;
  width: 2.2rem;
  align-items: center;
  justify-content: center;
  color: var(--patients-faint);
}

:global(.patients-select-overlay) {
  overflow: hidden;
  width: min(23rem, calc(100vw - 2rem));
  max-width: min(23rem, calc(100vw - 2rem));
  margin-top: 0.45rem;
  border: 1px solid var(--pj-select-line);
  border-radius: 0.9rem;
  background: var(--pj-select-card);
  color: var(--pj-select-text);
  box-shadow: 0 18px 42px rgb(var(--pj-select-shadow-rgb) / 0.16);
}

:global(.patients-select-list) {
  padding: 0.35rem;
  background: var(--pj-select-card);
}

:global(.patients-select-option) {
  min-height: 2.65rem;
  max-width: 100%;
  border-radius: 0.72rem;
  background: transparent;
  color: var(--pj-select-text);
}

:global(.patients-select-option:hover),
:global(.patients-select-option.p-focus),
:global(.patients-select-option.p-select-option-selected) {
  background: color-mix(in srgb, var(--pj-select-primary) 22%, var(--pj-select-card)) !important;
  color: var(--pj-select-text);
}

:global(.patients-select-option:hover) .filter-select-option__line strong,
:global(.patients-select-option.p-focus) .filter-select-option__line strong,
:global(.patients-select-option.p-select-option-selected) .filter-select-option__line strong {
  color: var(--pj-select-text) !important;
}

:global(.patients-select-option:hover) .filter-select-option__line small,
:global(.patients-select-option.p-focus) .filter-select-option__line small,
:global(.patients-select-option.p-select-option-selected) .filter-select-option__line small {
  color: var(--pj-select-muted) !important;
}

.filter-select-value {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.48rem;
}

.filter-select-value i {
  flex: 0 0 auto;
  color: var(--patients-primary-strong);
  font-size: 0.76rem;
}

.filter-select-value span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-select-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.2rem 0;
}

.filter-select-option__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--pj-select-primary-soft, var(--patients-primary-soft)) 26%, var(--pj-select-card, var(--patients-card)));
  color: var(--pj-select-primary-strong, var(--patients-primary-strong));
}

.filter-select-option__icon i {
  font-size: 0.78rem;
}

.filter-select-option__line {
  display: block;
  flex: 1 1 auto;
  width: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--pj-select-text, var(--patients-text));
  font-size: 0.84rem;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-select-option__line strong {
  color: var(--pj-select-text, var(--patients-text));
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.15;
}

.filter-select-option__line small {
  color: var(--pj-select-faint, var(--patients-faint));
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
}

.filter-select-option__line small::before {
  content: ' - ';
  color: var(--pj-select-faint, var(--patients-faint));
}

.patients-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(15.5rem, 1fr));
  gap: 1.25rem;
  margin-top: 1.35rem;
}

.patient-card {
  display: grid;
  gap: 1.15rem;
  min-width: 0;
  padding: 1.1rem;
  border: 1px solid var(--patients-line);
  border-radius: 1.12rem;
  background: var(--patients-card);
  box-shadow: 0 12px 36px rgb(var(--patients-shadow-rgb) / 0.045);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.patient-card:hover {
  border-color: color-mix(in srgb, var(--patients-primary) 28%, var(--patients-line));
  box-shadow: 0 18px 42px rgb(var(--patients-shadow-rgb) / 0.07);
}

.patient-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.78rem;
  align-items: start;
}

.patient-avatar {
  display: grid;
  width: 3.05rem;
  height: 3.05rem;
  place-items: center;
  border-radius: 0.98rem;
  background: var(--patients-success-bg);
  color: var(--patients-primary-strong);
  font-size: 1rem;
  font-weight: 600;
}

.patient-avatar[data-tone='high'] {
  background: var(--patients-warm-bg);
  color: var(--patients-warm-text);
}

.patient-avatar[data-tone='medium'] {
  background: var(--patients-amber-bg);
  color: var(--patients-amber-text);
}

.patient-card__identity {
  display: grid;
  min-width: 0;
  gap: 0.28rem;
  padding-top: 0.16rem;
}

.patient-card__identity strong {
  overflow: hidden;
  color: var(--patients-text);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patient-card__identity small {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.38rem;
  overflow: hidden;
  color: var(--patients-faint);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patient-card__identity i {
  flex: 0 0 auto;
  font-size: 0.66rem;
}

.risk-pill,
.clinical-tag {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.risk-pill {
  padding: 0.32rem 0.58rem;
  background: var(--patients-success-bg);
  color: var(--patients-success-text);
}

.risk-pill[data-tone='high'] {
  background: var(--patients-warm-bg);
  color: var(--patients-warm-text);
}

.risk-pill[data-tone='medium'] {
  background: var(--patients-amber-bg);
  color: var(--patients-amber-text);
}

.patient-card__details {
  display: grid;
  gap: 0.62rem;
  margin: 0;
  padding: 0.9rem 0 0;
  border-top: 1px solid var(--patients-line-soft);
}

.patient-card__details div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}

.patient-card__details dt,
.patient-card__details dd {
  margin: 0;
  min-width: 0;
  line-height: 1.2;
}

.patient-card__details dt {
  color: var(--patients-faint);
  font-size: 0.76rem;
  font-weight: 600;
}

.patient-card__details dd {
  overflow: hidden;
  color: var(--patients-text);
  font-size: 0.78rem;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patient-card__return--urgent {
  color: var(--patients-warm-text) !important;
}

.patient-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.clinical-tag {
  min-height: 1.62rem;
  padding: 0 0.62rem;
  background: var(--patients-success-bg);
  color: var(--patients-success-text);
}

.clinical-tag[data-tone='high'] {
  background: var(--patients-warm-bg);
  color: var(--patients-warm-text);
}

.clinical-tag[data-tone='medium'] {
  background: var(--patients-amber-bg);
  color: var(--patients-amber-text);
}

.patient-card__footer button {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--patients-muted);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.patient-card__footer button:hover {
  color: var(--patients-primary-strong);
}

.patients-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  margin-top: 1.35rem;
  padding: 3.4rem 1rem;
  border: 1px dashed var(--patients-line);
  border-radius: 1rem;
  background: var(--patients-card);
  text-align: center;
}

.patients-state i {
  color: var(--patients-primary);
  font-size: 1.5rem;
}

.patients-state strong {
  color: var(--patients-text);
}

.patients-state p {
  max-width: 28rem;
  margin: 0;
  color: var(--patients-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.patients-state--error i {
  color: var(--patients-warm-text);
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--patients-line);
  border-top-color: var(--patients-primary);
  border-radius: 999px;
  animation: patients-spin 800ms linear infinite;
}

@keyframes patients-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1380px) {
  .patients-grid {
    grid-template-columns: repeat(3, minmax(15.5rem, 1fr));
  }
}

@media (max-width: 1120px) {
  .patients-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .patients-actions {
    justify-content: flex-start;
  }

  .patients-search {
    width: min(100%, 28rem);
  }

  .patients-grid {
    grid-template-columns: repeat(2, minmax(15.5rem, 1fr));
  }
}

@media (max-width: 760px) {
  .patients-page {
    padding: 1rem;
  }

  .patients-actions,
  .patients-button--primary,
  .patients-search,
  .filter-selects,
  .select-control {
    width: 100%;
  }

  .patients-filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-selects {
    flex-wrap: wrap;
  }

  .patients-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 460px) {
  .filter-group,
  .patient-card__header,
  .patient-card__details div,
  .patient-card__footer {
    grid-template-columns: 1fr;
  }

  .patient-card__footer {
    display: grid;
    justify-items: start;
  }

  .patient-card__details dd {
    text-align: left;
  }
}
</style>
