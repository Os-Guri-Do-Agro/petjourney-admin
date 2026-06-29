<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'

import { currentColors } from '@/theme/color-mode'

type RecordRisk = 'critical' | 'attention' | 'stable'
type PageState = 'loading' | 'ready' | 'error'
type QueueFilter = 'todos' | 'criticos' | 'pendencias' | 'compartilhados'
type RecordTab = 'resumo' | 'clinico' | 'soap' | 'historico' | 'arquivos'

type TimelineEntry = {
  date: string
  title: string
  detail: string
  tone: RecordRisk | 'info'
}

type SoapNote = {
  subjective: string
  objective: string
  assessment: string
  plan: string
  professional: string
  date: string
}

type ClinicalRecord = {
  id: string
  pet: string
  species: string
  breed: string
  age: string
  tutor: string
  authorization: string
  sharedScope: string
  risk: RecordRisk
  status: string
  mainAlert: string
  allergies: string[]
  diagnoses: string[]
  treatments: string[]
  lastVisit: string
  nextAction: string
  pendingTasks: string[]
  lastSoap: SoapNote
  timeline: TimelineEntry[]
  vaccines: Array<{ name: string; date: string; status: string }>
  documents: Array<{ name: string; date: string; type: string }>
  weight: Array<{ date: string; value: string; note: string }>
  tutorDiary: Array<{ date: string; note: string }>
}

const toast = useToast()
const pageState = ref<PageState>('ready')
const searchQuery = ref('')
const selectedFilter = ref<QueueFilter>('todos')
const selectedRecordId = ref('luna')
const selectedTab = ref<RecordTab>('resumo')

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--records-bg': colors.dashboard.bg,
    '--records-card': colors.dashboard.surface,
    '--records-surface': colors.dashboard.surfaceSoft,
    '--records-line': colors.dashboard.line,
    '--records-line-soft': colors.dashboard.lineSoft,
    '--records-text': colors.dashboard.text,
    '--records-muted': colors.dashboard.muted,
    '--records-faint': colors.dashboard.faint,
    '--records-primary': colors.vet.primary,
    '--records-primary-soft': colors.vet.secondary,
    '--records-primary-strong': colors.dashboard.primaryStrong,
    '--records-primary-deep': colors.dashboard.primaryDeep,
    '--records-success-bg': colors.dashboard.successBg,
    '--records-success-text': colors.dashboard.successText,
    '--records-warm': colors.dashboard.warm,
    '--records-warm-bg': colors.dashboard.warmBg,
    '--records-warm-soft': colors.dashboard.warmSoft,
    '--records-warm-line': colors.dashboard.warmLine,
    '--records-warm-text': colors.dashboard.warmText,
    '--records-amber': colors.dashboard.amber,
    '--records-amber-bg': colors.dashboard.amberBg,
    '--records-amber-text': colors.dashboard.amberText,
    '--records-info-bg': colors.purple,
    '--records-tutor': colors.tutor.primary,
    '--records-shadow-rgb': colors.auth.shadowRgb,
  }
})

const records = ref<ClinicalRecord[]>([
  {
    id: 'luna',
    pet: 'Luna',
    species: 'Canina',
    breed: 'Golden Retriever',
    age: '7 anos',
    tutor: 'Marina Alves',
    authorization: 'Vínculo ativo da clínica',
    sharedScope: 'Prontuário completo autorizado até 04 jul.',
    risk: 'critical',
    status: 'Pós-operatório',
    mainAlert: 'Alergia grave a dipirona. Conferir antes de qualquer prescrição.',
    allergies: ['Dipirona - reação anafilática', 'Sensibilidade a curativos adesivos'],
    diagnoses: ['Pós-operatório ortopédico', 'Dermatite atópica controlada'],
    treatments: ['Cefalexina 500 mg a cada 12h', 'Curativo diário até reavaliação'],
    lastVisit: 'Hoje, 09:30',
    nextAction: 'Registrar evolução e orientar retorno em 7 dias.',
    pendingTasks: ['Revisar ferida cirúrgica', 'Anexar foto do curativo', 'Gerar retorno'],
    lastSoap: {
      subjective: 'Tutora relata melhora do apetite e menor desconforto durante a noite.',
      objective: 'Temperatura 38,4 C, mucosas normocoradas, ferida limpa com discreto edema local.',
      assessment: 'Evolução compatível com pós-operatório esperado, sem sinais sistêmicos de infecção.',
      plan: 'Manter antibiótico, trocar curativo e retorno em 7 dias para nova avaliação.',
      professional: 'Dra. Marina Alves',
      date: '29 jun 2026, 09:48',
    },
    timeline: [
      {
        date: 'Hoje',
        title: 'Retorno pós-operatório',
        detail: 'Revisão de curativo e atualização de conduta.',
        tone: 'critical',
      },
      {
        date: '22 jun',
        title: 'Procedimento ortopédico',
        detail: 'Alta com antibiótico, analgesia e repouso supervisionado.',
        tone: 'attention',
      },
      {
        date: '14 jun',
        title: 'Exame de imagem',
        detail: 'Radiografia anexada ao prontuário para planejamento cirúrgico.',
        tone: 'info',
      },
    ],
    vaccines: [
      { name: 'V10', date: '12 jan 2026', status: 'Em dia' },
      { name: 'Raiva', date: '12 jan 2026', status: 'Em dia' },
      { name: 'Gripe canina', date: '30 jul 2025', status: 'Reforço próximo' },
    ],
    documents: [
      { name: 'Radiografia membro posterior', date: '14 jun 2026', type: 'Imagem' },
      { name: 'Autorização cirúrgica', date: '22 jun 2026', type: 'Consentimento' },
      { name: 'Foto do curativo', date: '29 jun 2026', type: 'Evolução' },
    ],
    weight: [
      { date: '29 jun', value: '28,4 kg', note: 'Estável' },
      { date: '22 jun', value: '28,6 kg', note: 'Pré-operatório' },
      { date: '10 mai', value: '29,1 kg', note: 'Consulta de rotina' },
    ],
    tutorDiary: [
      { date: 'Hoje, 07:20', note: 'Comeu metade da porção e aceitou água normalmente.' },
      { date: 'Ontem, 21:10', note: 'Dormiu melhor, tentou lamber o curativo duas vezes.' },
    ],
  },
  {
    id: 'bob',
    pet: 'Bob',
    species: 'Canina',
    breed: 'Bulldog Francês',
    age: '6 anos',
    tutor: 'Paulo Mendes',
    authorization: 'Vínculo ativo da clínica',
    sharedScope: 'Exames, diagnósticos e medicamentos liberados pelo tutor.',
    risk: 'attention',
    status: 'Respiratório',
    mainAlert: 'Paciente braquicefálico. Evitar estresse térmico e acompanhar saturação.',
    allergies: ['Alergia alimentar registrada'],
    diagnoses: ['Síndrome braquicefálica', 'Otite recorrente'],
    treatments: ['Controle ambiental', 'Limpeza auricular semanal'],
    lastVisit: '30 jun, 11:45',
    nextAction: 'Coletar exame e criar atividade de revisão do resultado.',
    pendingTasks: ['Checar saturação', 'Revisar exames respiratórios'],
    lastSoap: {
      subjective: 'Tutor relata ronco intenso e cansaço em passeios curtos.',
      objective: 'Ausculta sem ruídos adventícios. Saturação basal 96% em repouso.',
      assessment: 'Quadro respiratório crônico estável, com necessidade de controle ambiental.',
      plan: 'Solicitar exames de controle e orientar evitar calor e esforço intenso.',
      professional: 'Dra. Marina Alves',
      date: '12 jun 2026, 15:20',
    },
    timeline: [
      {
        date: '30 jun',
        title: 'Exame de controle',
        detail: 'Coleta agendada para acompanhamento respiratório.',
        tone: 'attention',
      },
      {
        date: '12 jun',
        title: 'Consulta respiratória',
        detail: 'Orientações ambientais e controle de esforço.',
        tone: 'attention',
      },
      {
        date: '02 mai',
        title: 'Otite recorrente',
        detail: 'Tratamento tópico finalizado com boa resposta.',
        tone: 'info',
      },
    ],
    vaccines: [
      { name: 'V10', date: '18 mar 2026', status: 'Em dia' },
      { name: 'Raiva', date: '18 mar 2026', status: 'Em dia' },
    ],
    documents: [
      { name: 'Hemograma completo', date: '10 jun 2026', type: 'Laboratório' },
      { name: 'Raio-X tórax', date: '04 abr 2026', type: 'Imagem' },
    ],
    weight: [
      { date: '12 jun', value: '13,8 kg', note: 'Meta: reduzir 400 g' },
      { date: '02 mai', value: '14,1 kg', note: 'Acima do ideal' },
    ],
    tutorDiary: [
      { date: 'Ontem, 19:45', note: 'Cansou depois de 10 minutos de passeio no calor.' },
    ],
  },
  {
    id: 'thor',
    pet: 'Thor',
    species: 'Felina',
    breed: 'Siamês',
    age: '3 anos',
    tutor: 'Rafael Lima',
    authorization: 'Acesso por atendimento agendado',
    sharedScope: 'Vacinas e peso autorizados por 24h.',
    risk: 'stable',
    status: 'Vacinação',
    mainAlert: 'Sem alergias críticas registradas. Confirmar reação vacinal anterior.',
    allergies: [],
    diagnoses: ['Sem diagnóstico ativo'],
    treatments: ['Sem tratamento contínuo'],
    lastVisit: '10 jun 2026',
    nextAction: 'Aplicar vacina anual e emitir próximo lembrete.',
    pendingTasks: ['Conferir carteirinha', 'Registrar peso atual'],
    lastSoap: {
      subjective: 'Tutor não relata alterações recentes de apetite, urina ou comportamento.',
      objective: 'Exame físico sem alterações relevantes no último atendimento.',
      assessment: 'Paciente estável para protocolo vacinal.',
      plan: 'Atualizar vacina, observar reação por 24h e registrar próxima dose.',
      professional: 'Dr. Rafael Lima',
      date: '10 jun 2026, 10:35',
    },
    timeline: [
      {
        date: 'Hoje',
        title: 'Protocolo vacinal',
        detail: 'Atendimento previsto para atualização anual.',
        tone: 'stable',
      },
      {
        date: '10 jun',
        title: 'Check-up',
        detail: 'Sem alterações clínicas relevantes.',
        tone: 'stable',
      },
    ],
    vaccines: [
      { name: 'V4', date: '10 jun 2025', status: 'Vence hoje' },
      { name: 'Raiva', date: '10 jun 2025', status: 'Vence hoje' },
    ],
    documents: [
      { name: 'Carteirinha digital', date: '10 jun 2025', type: 'Vacina' },
    ],
    weight: [
      { date: '10 jun', value: '4,7 kg', note: 'Estável' },
      { date: '02 jan', value: '4,6 kg', note: 'Sem alteração relevante' },
    ],
    tutorDiary: [
      { date: '26 jun, 20:10', note: 'Tutor registrou rotina normal e boa ingestão de água.' },
    ],
  },
])

const filters: Array<{ value: QueueFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'criticos', label: 'Críticos' },
  { value: 'pendencias', label: 'Pendências' },
  { value: 'compartilhados', label: 'Compartilhados' },
]

const tabs: Array<{ value: RecordTab; label: string; icon: string }> = [
  { value: 'resumo', label: 'Visão geral', icon: 'pi pi-id-card' },
  { value: 'clinico', label: 'Clínico', icon: 'pi pi-heart' },
  { value: 'soap', label: 'SOAP', icon: 'pi pi-file-edit' },
  { value: 'historico', label: 'Histórico', icon: 'pi pi-history' },
  { value: 'arquivos', label: 'Arquivos', icon: 'pi pi-paperclip' },
]

const riskLabel: Record<RecordRisk, string> = {
  critical: 'Crítico',
  attention: 'Atenção',
  stable: 'Estável',
}

const summary = computed(() => ({
  total: records.value.length,
  critical: records.value.filter((record) => record.risk === 'critical').length,
  pending: records.value.filter((record) => record.pendingTasks.length > 0).length,
  shared: records.value.filter((record) => record.sharedScope).length,
}))

const visibleRecords = computed(() => {
  const normalizedSearch = searchQuery.value.trim().toLocaleLowerCase('pt-BR')

  return records.value.filter((record) => {
    const searchableText =
      `${record.pet} ${record.tutor} ${record.species} ${record.breed} ${record.status}`.toLocaleLowerCase('pt-BR')

    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)
    const matchesFilter =
      selectedFilter.value === 'todos' ||
      (selectedFilter.value === 'criticos' && record.risk === 'critical') ||
      (selectedFilter.value === 'pendencias' && record.pendingTasks.length > 0) ||
      (selectedFilter.value === 'compartilhados' && Boolean(record.sharedScope))

    return matchesSearch && matchesFilter
  })
})

const selectedRecord = computed(
  () =>
    visibleRecords.value.find((record) => record.id === selectedRecordId.value) ??
    visibleRecords.value[0] ??
    null,
)

const hasQueueFilters = computed(() => Boolean(searchQuery.value.trim()) || selectedFilter.value !== 'todos')

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function selectRecord(record: ClinicalRecord) {
  selectedRecordId.value = record.id
  selectedTab.value = 'resumo'
}

function getFilterCount(filter: QueueFilter) {
  if (filter === 'todos') {
    return records.value.length
  }

  if (filter === 'criticos') {
    return summary.value.critical
  }

  if (filter === 'pendencias') {
    return summary.value.pending
  }

  return summary.value.shared
}

function clearFilters() {
  searchQuery.value = ''
  selectedFilter.value = 'todos'
}

function retryRecords() {
  pageState.value = 'loading'

  window.setTimeout(() => {
    pageState.value = 'ready'
  }, 350)
}

function startSoapRecord() {
  if (!selectedRecord.value) {
    return
  }

  toast.add({
    severity: 'success',
    summary: 'SOAP preparado',
    detail: `Registro SOAP de ${selectedRecord.value.pet} preparado para integração.`,
    life: 3000,
  })
}

function createClinicalTask() {
  if (!selectedRecord.value) {
    return
  }

  toast.add({
    severity: 'success',
    summary: 'Atividade criada',
    detail: `Atividade clínica criada para ${selectedRecord.value.pet}.`,
    life: 3000,
  })
}
</script>

<template>
  <main class="records-page" :style="pageStyle">
    <section v-if="pageState === 'loading'" class="records-state" role="status">
      <span class="state-spinner" aria-hidden="true" />
      <strong>Carregando prontuários</strong>
      <p>Buscando histórico clínico, permissões de acesso e snapshots compartilhados.</p>
    </section>

    <section v-else-if="pageState === 'error'" class="records-state records-state--error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <strong>Não foi possível carregar os prontuários</strong>
      <p>Confira sessão, vínculo com a clínica e permissões antes de tentar novamente.</p>
      <button class="records-button records-button--primary" type="button" @click="retryRecords">Tentar novamente</button>
    </section>

    <section v-else-if="visibleRecords.length === 0" class="records-state">
      <i class="pi pi-search" aria-hidden="true" />
      <strong>Nenhum prontuário encontrado</strong>
      <p>Não encontramos pets autorizados para a busca e filtros selecionados.</p>
      <button class="records-button records-button--ghost" type="button" @click="clearFilters">Limpar filtros</button>
    </section>

    <section v-else class="records-workspace">
      <aside class="records-list-panel" aria-label="Lista de prontuários">
        <div class="panel-title">
          <div>
            <span class="records-kicker">Fila clínica</span>
            <h2>Pets autorizados</h2>
          </div>
          <strong>{{ visibleRecords.length }}</strong>
        </div>

        <label class="queue-search" for="records-queue-search">
          <i class="pi pi-search" aria-hidden="true" />
          <input
            id="records-queue-search"
            v-model="searchQuery"
            type="search"
            placeholder="Filtrar pet, tutor ou alerta"
          />
        </label>

        <div class="filter-group" aria-label="Filtros de prontuários">
          <button
            v-for="filter in filters"
            :key="filter.value"
            class="filter-chip"
            :class="{ 'filter-chip--active': selectedFilter === filter.value }"
            type="button"
            @click="selectedFilter = filter.value"
          >
            {{ filter.label }}
            <span>{{ getFilterCount(filter.value) }}</span>
          </button>
        </div>

        <button v-if="hasQueueFilters" class="queue-clear" type="button" @click="clearFilters">
          Limpar busca e filtros
        </button>

        <div class="record-list">
          <button
            v-for="record in visibleRecords"
            :key="record.id"
            class="record-card"
            :class="{ 'record-card--active': selectedRecord?.id === record.id }"
            type="button"
            :aria-current="selectedRecord?.id === record.id ? 'true' : undefined"
            @click="selectRecord(record)"
          >
            <span class="pet-avatar" :data-tone="record.risk">{{ getInitials(record.pet) }}</span>
            <span class="record-card__body">
              <span class="record-card__title">
                <strong>{{ record.pet }}</strong>
                <span class="risk-pill" :data-tone="record.risk">{{ riskLabel[record.risk] }}</span>
              </span>
              <small>{{ record.species }} - {{ record.breed }} - {{ record.tutor }}</small>
              <span class="record-card__alert">{{ record.mainAlert }}</span>
              <span class="record-card__meta">
                <span>{{ record.lastVisit }}</span>
                <span>{{ record.pendingTasks.length }} pend.</span>
                <span>{{ record.status }}</span>
              </span>
            </span>
          </button>
        </div>
      </aside>

      <article v-if="selectedRecord" class="record-detail" aria-label="Prontuário selecionado">
        <header class="record-detail__header">
          <div class="record-identity">
            <span class="pet-avatar pet-avatar--lg" :data-tone="selectedRecord.risk">
              {{ getInitials(selectedRecord.pet) }}
            </span>
            <div>
              <span class="records-kicker">Paciente selecionado</span>
              <h2>{{ selectedRecord.pet }}</h2>
              <p>{{ selectedRecord.species }} - {{ selectedRecord.breed }} - {{ selectedRecord.age }}</p>
            </div>
          </div>

          <div class="record-detail__actions">
            <span class="risk-pill" :data-tone="selectedRecord.risk">{{ riskLabel[selectedRecord.risk] }}</span>
            <button class="records-button records-button--ghost" type="button" @click="createClinicalTask">
              Criar atividade
            </button>
          </div>
        </header>

        <nav class="record-tabs" aria-label="Abas do prontuário">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="record-tab"
            :class="{ 'record-tab--active': selectedTab === tab.value }"
            type="button"
            @click="selectedTab = tab.value"
          >
            <i :class="tab.icon" aria-hidden="true" />
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="selectedTab === 'resumo'" class="tab-panel">
          <dl class="patient-facts" aria-label="Dados principais do paciente">
            <div>
              <dt>Tutor</dt>
              <dd>{{ selectedRecord.tutor }}</dd>
            </div>
            <div>
              <dt>Última visita</dt>
              <dd>{{ selectedRecord.lastVisit }}</dd>
            </div>
            <div>
              <dt>Status clínico</dt>
              <dd>{{ selectedRecord.status }}</dd>
            </div>
          </dl>

          <section class="record-context-grid">
            <article class="critical-alert" :data-tone="selectedRecord.risk">
              <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              <div>
                <strong>Antes de prescrever</strong>
                <p>{{ selectedRecord.mainAlert }}</p>
              </div>
            </article>

            <article class="access-card">
              <i class="pi pi-lock" aria-hidden="true" />
              <div>
                <strong>{{ selectedRecord.authorization }}</strong>
                <p>{{ selectedRecord.sharedScope }}</p>
              </div>
            </article>
          </section>

          <section class="overview-grid">
            <article class="clinical-card clinical-card--wide">
              <span class="records-kicker">Próxima ação</span>
              <h3>{{ selectedRecord.nextAction }}</h3>
              <ul class="task-list">
                <li v-for="task in selectedRecord.pendingTasks" :key="task">{{ task }}</li>
              </ul>
            </article>

            <article class="clinical-card">
              <span class="records-kicker">Último SOAP</span>
              <h3>{{ selectedRecord.lastSoap.date }}</h3>
              <p>{{ selectedRecord.lastSoap.assessment }}</p>
            </article>
          </section>
        </section>

        <section v-else-if="selectedTab === 'clinico'" class="tab-panel">
          <div class="clinical-grid">
            <article class="clinical-card">
              <span class="records-kicker">Alergias</span>
              <h3>Atenções críticas</h3>
              <div class="tag-list">
                <span v-if="selectedRecord.allergies.length === 0" class="clinical-tag" data-tone="stable">
                  Sem alergias registradas
                </span>
                <span v-for="allergy in selectedRecord.allergies" :key="allergy" class="clinical-tag" data-tone="critical">
                  {{ allergy }}
                </span>
              </div>
            </article>

            <article class="clinical-card">
              <span class="records-kicker">Diagnósticos</span>
              <h3>Condições ativas</h3>
              <div class="tag-list">
                <span v-for="diagnosis in selectedRecord.diagnoses" :key="diagnosis" class="clinical-tag" data-tone="attention">
                  {{ diagnosis }}
                </span>
              </div>
            </article>

            <article class="clinical-card">
              <span class="records-kicker">Tratamentos</span>
              <h3>Condutas contínuas</h3>
              <div class="tag-list">
                <span v-for="treatment in selectedRecord.treatments" :key="treatment" class="clinical-tag">
                  {{ treatment }}
                </span>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="selectedTab === 'soap'" class="tab-panel">
          <section class="soap-card">
            <div class="soap-card__header">
              <div>
                <span class="records-kicker">Último atendimento SOAP</span>
                <h3>{{ selectedRecord.lastSoap.date }}</h3>
              </div>
              <small>{{ selectedRecord.lastSoap.professional }}</small>
            </div>

            <dl class="soap-grid">
              <div>
                <dt>S</dt>
                <dd>{{ selectedRecord.lastSoap.subjective }}</dd>
              </div>
              <div>
                <dt>O</dt>
                <dd>{{ selectedRecord.lastSoap.objective }}</dd>
              </div>
              <div>
                <dt>A</dt>
                <dd>{{ selectedRecord.lastSoap.assessment }}</dd>
              </div>
              <div>
                <dt>P</dt>
                <dd>{{ selectedRecord.lastSoap.plan }}</dd>
              </div>
            </dl>

            <button class="records-button records-button--primary" type="button" @click="startSoapRecord">
              <i class="pi pi-file-edit" aria-hidden="true" />
              Continuar atendimento
            </button>
          </section>
        </section>

        <section v-else-if="selectedTab === 'historico'" class="tab-panel history-layout">
          <section class="timeline-panel">
            <article v-for="entry in selectedRecord.timeline" :key="`${entry.date}-${entry.title}`" class="timeline-row">
              <span class="timeline-dot" :data-tone="entry.tone" />
              <div>
                <span>{{ entry.date }}</span>
                <strong>{{ entry.title }}</strong>
                <p>{{ entry.detail }}</p>
              </div>
            </article>
          </section>

          <article class="clinical-card clinical-card--wide">
            <span class="records-kicker">Diário do tutor</span>
            <h3>Sinais recentes compartilhados</h3>
            <div class="compact-list">
              <p v-for="entry in selectedRecord.tutorDiary" :key="entry.date">
                <strong>{{ entry.date }}</strong>
                {{ entry.note }}
              </p>
            </div>
          </article>
        </section>

        <section v-else class="tab-panel split-panel">
          <article v-for="vaccine in selectedRecord.vaccines" :key="vaccine.name" class="data-row">
            <span class="data-row__icon">
              <i class="pi pi-shield" aria-hidden="true" />
            </span>
            <div>
              <strong>{{ vaccine.name }}</strong>
              <small>{{ vaccine.date }}</small>
            </div>
            <span class="clinical-tag" :data-tone="vaccine.status.includes('próximo') || vaccine.status.includes('Vence') ? 'attention' : 'stable'">
              {{ vaccine.status }}
            </span>
          </article>

          <article v-for="weightEntry in selectedRecord.weight" :key="weightEntry.date" class="data-row">
            <span class="data-row__icon">
              <i class="pi pi-chart-line" aria-hidden="true" />
            </span>
            <div>
              <strong>{{ weightEntry.value }}</strong>
              <small>{{ weightEntry.date }} - {{ weightEntry.note }}</small>
            </div>
          </article>

          <article v-for="document in selectedRecord.documents" :key="document.name" class="data-row">
            <span class="data-row__icon">
              <i class="pi pi-paperclip" aria-hidden="true" />
            </span>
            <div>
              <strong>{{ document.name }}</strong>
              <small>{{ document.type }} - {{ document.date }}</small>
            </div>
            <button class="records-link-button" type="button">Abrir</button>
          </article>
        </section>
      </article>
    </section>
  </main>
</template>

<style scoped>
.records-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.45rem 1.6rem 2rem;
  background: var(--records-bg);
  color: var(--records-text);
}

.records-kicker {
  display: block;
  color: var(--records-faint);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.filter-group,
.record-detail__actions,
.record-tabs,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.records-button,
.filter-chip,
.record-tab,
.records-link-button {
  display: inline-flex;
  min-height: 2.55rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 0.95rem;
  border: 0;
  border-radius: 0.82rem;
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

.records-button:hover,
.filter-chip:hover,
.record-tab:hover,
.record-card:hover,
.records-link-button:hover {
  transform: translateY(-1px);
}

.records-button--primary {
  min-width: 9.5rem;
  background: linear-gradient(135deg, var(--records-primary), var(--records-primary-strong));
  color: var(--records-card);
  box-shadow: 0 16px 30px rgb(var(--records-shadow-rgb) / 0.12);
}

.records-button--ghost,
.filter-chip,
.record-tab,
.records-link-button {
  border: 1px solid var(--records-line);
  background: var(--records-card);
  color: var(--records-muted);
}

.records-list-panel,
.record-detail,
.clinical-card,
.soap-card,
.data-row {
  border: 1px solid var(--records-line);
  background: var(--records-card);
}

.risk-pill,
.clinical-tag {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}

.records-workspace {
  display: grid;
  grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr);
  gap: 1.2rem;
  align-items: start;
  margin-top: 1.35rem;
}

.records-list-panel,
.record-detail {
  min-width: 0;
  border-radius: 1.25rem;
}

.records-list-panel {
  position: sticky;
  top: 5.25rem;
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
}

.filter-chip {
  min-height: 2.32rem;
  padding-inline: 0.78rem;
}

.filter-chip--active {
  border-color: color-mix(in srgb, var(--records-primary) 42%, var(--records-line));
  background: var(--records-primary);
  color: white;
}

.filter-chip span {
  display: inline-flex;
  min-width: 1.3rem;
  height: 1.3rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 0.68rem;
}

.record-list {
  display: grid;
  gap: 0.65rem;
}

.record-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  width: 100%;
  padding: 0.85rem;
  border: 1px solid var(--records-line);
  border-radius: 1rem;
  background: var(--records-surface);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.record-card--active {
  border-color: color-mix(in srgb, var(--records-primary) 42%, var(--records-line));
  background: color-mix(in srgb, var(--records-primary-soft) 24%, var(--records-card));
}

.record-card__body {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.record-card__body strong {
  overflow: hidden;
  color: var(--records-text);
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-card__body small,
.record-card__alert {
  overflow: hidden;
  color: var(--records-muted);
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
}

.record-card__alert {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.pet-avatar {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 0.9rem;
  background: var(--records-success-bg);
  color: var(--records-primary-strong);
  font-size: 0.9rem;
  font-weight: 700;
}

.pet-avatar--lg {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 1rem;
  font-size: 1rem;
}

.pet-avatar[data-tone='critical'],
.risk-pill[data-tone='critical'],
.clinical-tag[data-tone='critical'] {
  background: var(--records-warm-bg);
  color: var(--records-warm-text);
}

.pet-avatar[data-tone='attention'],
.risk-pill[data-tone='attention'],
.clinical-tag[data-tone='attention'] {
  background: var(--records-amber-bg);
  color: var(--records-amber-text);
}

.risk-pill,
.clinical-tag {
  padding: 0.32rem 0.58rem;
  background: var(--records-success-bg);
  color: var(--records-success-text);
  white-space: nowrap;
}

.clinical-tag {
  min-height: 1.75rem;
  padding-inline: 0.68rem;
}

.clinical-tag[data-tone='stable'] {
  background: var(--records-success-bg);
  color: var(--records-success-text);
}

.record-detail {
  padding: 1.1rem;
  box-shadow: 0 16px 48px rgb(var(--records-shadow-rgb) / 0.045);
}

.record-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.record-identity {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  min-width: 0;
}

.record-detail h2 {
  margin: 0.18rem 0 0;
  color: var(--records-text);
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.045em;
}

.record-detail p {
  margin: 0;
  color: var(--records-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.access-card,
.critical-alert {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
  margin-top: 1rem;
  padding: 0.85rem;
  border-radius: 1rem;
}

.access-card {
  border: 1px solid color-mix(in srgb, var(--records-tutor) 24%, var(--records-line));
  background: color-mix(in srgb, var(--records-tutor) 8%, var(--records-card));
}

.access-card i {
  color: var(--records-tutor);
}

.access-card strong,
.critical-alert strong {
  display: block;
  color: var(--records-text);
  font-size: 0.9rem;
}

.critical-alert {
  border: 1px solid var(--records-line);
  background: var(--records-success-bg);
}

.critical-alert[data-tone='critical'] {
  border-color: var(--records-warm-line);
  background: var(--records-warm-bg);
}

.critical-alert[data-tone='attention'] {
  border-color: color-mix(in srgb, var(--records-amber) 42%, var(--records-line));
  background: var(--records-amber-bg);
}

.critical-alert i {
  color: var(--records-primary-strong);
}

.critical-alert[data-tone='critical'] i {
  color: var(--records-warm-text);
}

.critical-alert[data-tone='attention'] i {
  color: var(--records-amber-text);
}

.record-tabs {
  margin-top: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--records-line-soft);
}

.record-tab {
  min-height: 2.32rem;
  padding-inline: 0.78rem;
}

.record-tab--active {
  border-color: color-mix(in srgb, var(--records-primary) 42%, var(--records-line));
  background: color-mix(in srgb, var(--records-primary-soft) 32%, var(--records-card));
  color: var(--records-primary-strong);
}

.tab-panel {
  margin-top: 1rem;
}

.clinical-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.overview-grid,
.history-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 0.9rem;
  margin-top: 0.9rem;
}

.clinical-card,
.soap-card {
  padding: 1rem;
  border-radius: 1rem;
}

.clinical-card h3,
.soap-card h3 {
  margin: 0.22rem 0 0;
  color: var(--records-text);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.task-list {
  display: grid;
  gap: 0.45rem;
  margin: 0.8rem 0 0;
  padding: 0;
  list-style: none;
}

.task-list li {
  color: var(--records-muted);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.45;
}

.task-list li::before {
  content: '';
  display: inline-block;
  width: 0.44rem;
  height: 0.44rem;
  margin-right: 0.45rem;
  border-radius: 999px;
  background: var(--records-amber);
  vertical-align: 0.05rem;
}

.soap-card {
  margin-top: 0.9rem;
}

.soap-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.soap-card__header small {
  color: var(--records-faint);
  font-size: 0.78rem;
  font-weight: 700;
}

.soap-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}

.soap-grid div {
  display: grid;
  grid-template-columns: 2.1rem minmax(0, 1fr);
  gap: 0.62rem;
  padding: 0.75rem;
  border: 1px solid var(--records-line-soft);
  border-radius: 0.9rem;
  background: var(--records-surface);
}

.soap-grid dt {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 0.62rem;
  background: color-mix(in srgb, var(--records-primary) 16%, var(--records-card));
  color: var(--records-primary-strong);
  font-weight: 800;
}

.soap-grid dd {
  margin: 0;
  color: var(--records-muted);
  font-size: 0.82rem;
  line-height: 1.55;
}

.timeline-panel,
.split-panel,
.compact-list {
  display: grid;
  gap: 0.72rem;
}

.timeline-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.95rem;
  border: 1px solid var(--records-line);
  border-radius: 1rem;
  background: var(--records-surface);
}

.timeline-dot {
  width: 0.85rem;
  height: 0.85rem;
  margin-top: 0.25rem;
  border-radius: 999px;
  background: var(--records-success-text);
  box-shadow: 0 0 0 0.3rem var(--records-success-bg);
}

.timeline-dot[data-tone='critical'] {
  background: var(--records-warm-text);
  box-shadow: 0 0 0 0.3rem var(--records-warm-bg);
}

.timeline-dot[data-tone='attention'] {
  background: var(--records-amber-text);
  box-shadow: 0 0 0 0.3rem var(--records-amber-bg);
}

.timeline-dot[data-tone='info'] {
  background: var(--records-tutor);
  box-shadow: 0 0 0 0.3rem color-mix(in srgb, var(--records-tutor) 12%, var(--records-card));
}

.timeline-row span {
  color: var(--records-faint);
  font-size: 0.72rem;
  font-weight: 700;
}

.timeline-row strong {
  display: block;
  margin-top: 0.15rem;
  color: var(--records-text);
  font-size: 0.95rem;
}

.split-panel {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.clinical-card--wide {
  min-height: 9rem;
}

.compact-list p {
  padding: 0.76rem;
  border-radius: 0.86rem;
  background: var(--records-surface);
}

.compact-list strong {
  display: block;
  color: var(--records-tutor);
  font-size: 0.76rem;
}

.data-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.9rem;
  border-radius: 1rem;
}

.data-row__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.82rem;
  background: color-mix(in srgb, var(--records-primary-soft) 28%, var(--records-card));
  color: var(--records-primary-strong);
}

.data-row strong {
  display: block;
  color: var(--records-text);
  font-size: 0.94rem;
}

.data-row small {
  display: block;
  margin-top: 0.16rem;
  color: var(--records-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.records-link-button {
  min-height: 2rem;
  padding-inline: 0.75rem;
  color: var(--records-primary-strong);
}

.records-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  margin-top: 1.35rem;
  padding: 3.4rem 1rem;
  border: 1px dashed var(--records-line);
  border-radius: 1rem;
  background: var(--records-card);
  text-align: center;
}

.records-state i {
  color: var(--records-primary);
  font-size: 1.5rem;
}

.records-state strong {
  color: var(--records-text);
}

.records-state p {
  max-width: 28rem;
  margin: 0;
  color: var(--records-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.records-state--error i {
  color: var(--records-warm-text);
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--records-line);
  border-top-color: var(--records-primary);
  border-radius: 999px;
  animation: records-spin 800ms linear infinite;
}

@keyframes records-spin {
  to {
    transform: rotate(360deg);
  }
}

.records-page {
  padding: 1.25rem 1.4rem 1.7rem;
}

.records-workspace {
  grid-template-columns: 20.5rem minmax(0, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.records-list-panel {
  gap: 0.8rem;
  padding: 0.9rem;
  border-radius: 1.1rem;
}

.panel-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.panel-title h2 {
  margin: 0.12rem 0 0;
  color: var(--records-text);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.panel-title > strong {
  display: grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: var(--records-success-bg);
  color: var(--records-success-text);
  font-size: 0.86rem;
}

.queue-search {
  display: flex;
  height: 2.45rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.72rem;
  border: 1px solid var(--records-line);
  border-radius: 0.8rem;
  background: var(--records-surface);
  color: var(--records-faint);
}

.queue-search:focus-within {
  border-color: color-mix(in srgb, var(--records-primary) 38%, var(--records-line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--records-primary) 12%, transparent);
}

.queue-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--records-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  outline: none;
}

.queue-search input::placeholder {
  color: var(--records-faint);
}

.filter-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.filter-chip {
  min-height: 2.15rem;
  justify-content: space-between;
  padding-inline: 0.68rem;
  border-radius: 0.72rem;
  font-size: 0.74rem;
}

.queue-clear {
  display: inline-flex;
  width: fit-content;
  min-height: 1.9rem;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--records-primary-strong);
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
}

.queue-clear:hover {
  color: var(--records-primary-deep);
}

.record-list {
  gap: 0.5rem;
  max-height: calc(100vh - 24.5rem);
  min-height: 13rem;
  overflow: auto;
  padding-right: 0.15rem;
}

.record-card {
  grid-template-columns: 2.35rem minmax(0, 1fr);
  gap: 0.65rem;
  padding: 0.72rem;
  border-radius: 0.9rem;
  background: var(--records-card);
}

.record-card:focus-visible {
  border-color: var(--records-primary);
  outline: 2px solid color-mix(in srgb, var(--records-primary) 28%, transparent);
  outline-offset: 2px;
}

.record-card--active {
  background: color-mix(in srgb, var(--records-primary-soft) 30%, var(--records-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--records-primary) 34%, transparent);
}

.record-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.record-card__body strong {
  font-size: 0.92rem;
}

.record-card__body small {
  white-space: nowrap;
}

.record-card__alert {
  -webkit-line-clamp: 1;
  font-size: 0.72rem;
}

.record-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin-top: 0.08rem;
}

.record-card__meta span {
  display: inline-flex;
  min-height: 1.35rem;
  align-items: center;
  padding: 0 0.42rem;
  border-radius: 999px;
  background: var(--records-surface);
  color: var(--records-faint);
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1;
}

.pet-avatar {
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 0.78rem;
  font-size: 0.78rem;
}

.pet-avatar--lg {
  width: 3.15rem;
  height: 3.15rem;
  border-radius: 1rem;
  font-size: 1rem;
}

.record-detail {
  padding: 0;
  overflow: hidden;
  border-radius: 1.15rem;
}

.record-detail__header {
  align-items: center;
  padding: 1.1rem 1.15rem;
  border-bottom: 1px solid var(--records-line-soft);
  background: linear-gradient(180deg, var(--records-card), var(--records-surface));
}

.record-detail h2 {
  font-size: 1.6rem;
}

.record-detail__actions {
  align-items: center;
  justify-content: flex-end;
}

.patient-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  border-bottom: 1px solid var(--records-line-soft);
  background: var(--records-card);
}

.patient-facts div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  padding: 0.85rem 1.15rem;
  box-shadow: 1px 0 0 var(--records-line-soft);
}

.patient-facts dt,
.patient-facts dd {
  margin: 0;
}

.patient-facts dt {
  color: var(--records-faint);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.patient-facts dd {
  overflow: hidden;
  color: var(--records-text);
  font-size: 0.84rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-context-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.8fr);
  gap: 0.75rem;
  padding: 0.95rem 1.15rem 0;
}

.access-card,
.critical-alert {
  margin-top: 0;
  padding: 0.85rem 0.95rem;
  border-radius: 0.92rem;
}

.critical-alert {
  align-items: center;
}

.critical-alert strong,
.access-card strong {
  margin-bottom: 0.14rem;
}

.record-tabs {
  flex-wrap: nowrap;
  gap: 0;
  margin: 0.95rem 1.15rem 0;
  padding: 0.25rem;
  overflow-x: auto;
  border: 1px solid var(--records-line);
  border-radius: 0.92rem;
  background: var(--records-surface);
}

.record-tab {
  min-height: 2.25rem;
  flex: 1 0 auto;
  border-color: transparent;
  background: transparent;
  border-radius: 0.72rem;
  font-size: 0.76rem;
}

.record-tab--active {
  background: var(--records-card);
  box-shadow: 0 8px 18px rgb(var(--records-shadow-rgb) / 0.06);
}

.tab-panel {
  margin-top: 0;
  padding: 1rem 1.15rem 1.15rem;
}

.clinical-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.clinical-card,
.soap-card {
  padding: 0.9rem;
  border-radius: 0.95rem;
  background: var(--records-card);
}

.clinical-card h3,
.soap-card h3 {
  font-size: 0.94rem;
}

.tag-list {
  gap: 0.38rem;
  margin-top: 0.7rem;
}

.clinical-tag {
  max-width: 100%;
  min-height: 1.55rem;
  padding-inline: 0.55rem;
  overflow: hidden;
  font-size: 0.66rem;
  text-overflow: ellipsis;
}

.soap-card {
  margin-top: 0.75rem;
}

.soap-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
}

.soap-grid div {
  grid-template-columns: 1.85rem minmax(0, 1fr);
  align-content: start;
  padding: 0.7rem;
  border-radius: 0.82rem;
}

.soap-grid dt {
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 0.5rem;
  font-size: 0.78rem;
}

.soap-grid dd {
  font-size: 0.76rem;
  line-height: 1.45;
}

@media (max-width: 1180px) {
  .record-detail__header {
    align-items: stretch;
    flex-direction: column;
  }

  .clinical-grid,
  .overview-grid,
  .history-layout,
  .split-panel,
  .record-context-grid,
  .soap-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .records-workspace {
    grid-template-columns: 1fr;
  }

  .records-list-panel {
    position: static;
  }
}

@media (max-width: 760px) {
  .records-page {
    padding: 1rem;
  }

  .records-button--primary {
    width: 100%;
  }

  .clinical-grid,
  .overview-grid,
  .history-layout,
  .soap-grid,
  .split-panel,
  .patient-facts,
  .record-context-grid,
  .record-card,
  .data-row {
    grid-template-columns: 1fr;
  }

  .record-detail__header {
    padding: 1rem;
  }

  .patient-facts div {
    box-shadow: 0 1px 0 var(--records-line-soft);
  }

  .record-context-grid,
  .tab-panel {
    padding-inline: 1rem;
  }

  .record-detail__actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
