<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { currentColors } from '@/theme/color-mode'

type ShareStatus = 'active' | 'expiring' | 'expired' | 'revoked'
type ShareFilter = 'todos' | 'ativos' | 'expiram' | 'expirados' | 'revisao'
type ShareTab = 'visao' | 'escopo' | 'registros' | 'auditoria'
type PageState = 'loading' | 'ready' | 'error'
type ScopeTone = 'clinical' | 'tutor' | 'attention' | 'neutral'

type ShareScope = {
  name: string
  detail: string
  icon: string
  tone: ScopeTone
}

type ShareAuditEntry = {
  time: string
  title: string
  detail: string
  tone: ShareStatus | 'review'
}

type ShareAttachment = {
  name: string
  type: string
  source: string
  date: string
  icon: string
}

type PartnerNote = {
  author: string
  date: string
  text: string
}

type AuthorizedShare = {
  id: string
  pet: string
  species: string
  breed: string
  tutor: string
  tutorContact: string
  status: ShareStatus
  serviceType: string
  reason: string
  protocol: string
  expiresAt: string
  expiresLabel: string
  receivedAt: string
  lastAccess: string
  reviewed: boolean
  consent: string
  restriction: string
  clinicalSummary: string
  nextAction: string
  scopes: ShareScope[]
  alerts: string[]
  attachments: ShareAttachment[]
  notes: PartnerNote[]
  audit: ShareAuditEntry[]
}

const router = useRouter()
const toast = useToast()
const pageState = ref<PageState>('ready')
const searchQuery = ref('')
const selectedFilter = ref<ShareFilter>('todos')
const selectedShareId = ref('share-luna')
const selectedShareTab = ref<ShareTab>('visao')
const newNote = ref('')
const pendingAttachmentName = ref('')

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--shares-bg': colors.dashboard.bg,
    '--shares-card': colors.dashboard.surface,
    '--shares-surface': colors.dashboard.surfaceSoft,
    '--shares-line': colors.dashboard.line,
    '--shares-line-soft': colors.dashboard.lineSoft,
    '--shares-text': colors.dashboard.text,
    '--shares-muted': colors.dashboard.muted,
    '--shares-faint': colors.dashboard.faint,
    '--shares-primary': colors.vet.primary,
    '--shares-primary-soft': colors.vet.secondary,
    '--shares-primary-strong': colors.dashboard.primaryStrong,
    '--shares-success-bg': colors.dashboard.successBg,
    '--shares-success-text': colors.dashboard.successText,
    '--shares-warm-bg': colors.dashboard.warmBg,
    '--shares-warm-line': colors.dashboard.warmLine,
    '--shares-warm-text': colors.dashboard.warmText,
    '--shares-amber-bg': colors.dashboard.amberBg,
    '--shares-amber-text': colors.dashboard.amberText,
    '--shares-muted-pill-bg': colors.dashboard.mutedPillBg,
    '--shares-muted-pill-text': colors.dashboard.mutedPillText,
    '--shares-tutor': colors.tutor.primary,
    '--shares-shadow-rgb': colors.auth.shadowRgb,
  }
})

const shares = ref<AuthorizedShare[]>([
  {
    id: 'share-luna',
    pet: 'Luna',
    species: 'Canina',
    breed: 'Golden Retriever',
    tutor: 'Marina Alves',
    tutorContact: '(11) 98422-1030',
    status: 'active',
    serviceType: 'Consulta veterinária',
    reason: 'Retorno pós-operatório',
    protocol: 'SHR-29JUN-LUNA',
    expiresAt: '04 jul 2026, 18:00',
    expiresLabel: 'Expira em 5 dias',
    receivedAt: 'Hoje, 08:42',
    lastAccess: 'Hoje, 09:18',
    reviewed: false,
    consent: 'Tutor autorizou snapshot completo para a Clínica PetJourney Vila Mariana.',
    restriction: 'Uso restrito ao atendimento atual. Não compartilhar fora da equipe autorizada.',
    clinicalSummary:
      'Pós-operatório ortopédico com alergia grave a dipirona. Tutor enviou fotos recentes do curativo e diário de alimentação.',
    nextAction: 'Revisar ferida cirúrgica antes de registrar evolução SOAP.',
    scopes: [
      {
        name: 'Prontuário completo',
        detail: 'Consultas, diagnósticos, alergias e tratamentos ativos.',
        icon: 'pi pi-file-edit',
        tone: 'clinical',
      },
      {
        name: 'Documentos e imagens',
        detail: 'Radiografia, autorização cirúrgica e fotos do curativo.',
        icon: 'pi pi-paperclip',
        tone: 'neutral',
      },
      {
        name: 'Diário do tutor',
        detail: 'Relatos das últimas 48h sobre apetite, dor e curativo.',
        icon: 'pi pi-comments',
        tone: 'tutor',
      },
    ],
    alerts: ['Alergia a dipirona', 'Foto do curativo pendente de revisão'],
    attachments: [
      {
        name: 'Foto curativo - chegada.jpeg',
        type: 'Imagem',
        source: 'Tutor',
        date: 'Hoje, 08:42',
        icon: 'pi pi-image',
      },
      {
        name: 'Evolução pós-operatória.pdf',
        type: 'PDF',
        source: 'Clínica',
        date: 'Hoje, 09:30',
        icon: 'pi pi-file-pdf',
      },
    ],
    notes: [
      {
        author: 'Dra. Marina Alves',
        date: 'Hoje, 09:34',
        text: 'Curativo limpo, sem secreção. Tutor orientado a manter colar elizabetano até nova avaliação.',
      },
    ],
    audit: [
      {
        time: 'Hoje, 09:18',
        title: 'Acesso realizado',
        detail: 'Dra. Marina Alves abriu o snapshot autorizado.',
        tone: 'active',
      },
      {
        time: 'Hoje, 08:42',
        title: 'Compartilhamento recebido',
        detail: 'Tutor liberou o escopo para retorno pós-operatório.',
        tone: 'review',
      },
    ],
  },
  {
    id: 'share-bob',
    pet: 'Bob',
    species: 'Canina',
    breed: 'Bulldog Francês',
    tutor: 'Paulo Mendes',
    tutorContact: '(11) 98114-0098',
    status: 'expiring',
    serviceType: 'Exame',
    reason: 'Exame respiratório',
    protocol: 'SHR-30JUN-BOB',
    expiresAt: 'Hoje, 18:30',
    expiresLabel: 'Expira hoje',
    receivedAt: 'Ontem, 17:05',
    lastAccess: 'Hoje, 10:12',
    reviewed: false,
    consent: 'Tutor autorizou exames, diagnósticos ativos e medicamentos recentes.',
    restriction: 'Escopo temporário sem acesso a documentos financeiros ou dados de outros pets.',
    clinicalSummary:
      'Paciente braquicefálico com histórico de cansaço em passeio. Exames prévios e diário respiratório disponíveis.',
    nextAction: 'Confirmar jejum e registrar orientação antes do exame.',
    scopes: [
      {
        name: 'Exames',
        detail: 'Hemograma, raio-X de tórax e solicitação do exame atual.',
        icon: 'pi pi-chart-line',
        tone: 'clinical',
      },
      {
        name: 'Medicamentos',
        detail: 'Histórico de prescrição e tratamentos de suporte.',
        icon: 'pi pi-briefcase',
        tone: 'neutral',
      },
      {
        name: 'Diário respiratório',
        detail: 'Relatos do tutor sobre cansaço, calor e tosse.',
        icon: 'pi pi-comments',
        tone: 'tutor',
      },
    ],
    alerts: ['Braquicefálico', 'Jejum ainda não confirmado'],
    attachments: [
      {
        name: 'Raio-X torácico anterior.pdf',
        type: 'PDF',
        source: 'Tutor',
        date: 'Ontem, 17:05',
        icon: 'pi pi-file-pdf',
      },
    ],
    notes: [
      {
        author: 'Dr. Rafael Lima',
        date: 'Hoje, 10:16',
        text: 'Confirmar jejum por telefone antes da entrada para exame. Evitar espera prolongada em ambiente quente.',
      },
    ],
    audit: [
      {
        time: 'Hoje, 10:12',
        title: 'Revisão iniciada',
        detail: 'Equipe abriu exames compartilhados.',
        tone: 'expiring',
      },
      {
        time: 'Ontem, 17:05',
        title: 'Autorização criada',
        detail: 'Tutor liberou dados por 24 horas.',
        tone: 'review',
      },
    ],
  },
  {
    id: 'share-thor',
    pet: 'Thor',
    species: 'Felina',
    breed: 'Siamês',
    tutor: 'Rafael Lima',
    tutorContact: '(11) 97741-8200',
    status: 'active',
    serviceType: 'Vacinação',
    reason: 'Vacinação anual',
    protocol: 'SHR-29JUN-THOR',
    expiresAt: '30 jun 2026, 12:00',
    expiresLabel: 'Expira amanhã',
    receivedAt: 'Hoje, 07:55',
    lastAccess: 'Ainda não acessado',
    reviewed: true,
    consent: 'Tutor autorizou vacinas, peso e histórico de reação vacinal.',
    restriction: 'Snapshot limitado a prevenção e carteirinha.',
    clinicalSummary: 'Paciente estável para protocolo vacinal. Sem alergias críticas registradas.',
    nextAction: 'Conferir carteirinha e registrar peso no atendimento.',
    scopes: [
      {
        name: 'Vacinas',
        detail: 'Carteirinha, datas de aplicação e reforços próximos.',
        icon: 'pi pi-shield',
        tone: 'clinical',
      },
      {
        name: 'Peso',
        detail: 'Histórico recente para conferência do protocolo.',
        icon: 'pi pi-chart-bar',
        tone: 'neutral',
      },
    ],
    alerts: ['Confirmar reação vacinal anterior'],
    attachments: [
      {
        name: 'Carteirinha digital.png',
        type: 'Imagem',
        source: 'Tutor',
        date: 'Hoje, 07:55',
        icon: 'pi pi-image',
      },
    ],
    notes: [
      {
        author: 'Recepção',
        date: 'Hoje, 08:10',
        text: 'Tutor informou que não houve reação vacinal na última aplicação.',
      },
    ],
    audit: [
      {
        time: 'Hoje, 08:10',
        title: 'Marcado como revisado',
        detail: 'Recepção conferiu escopo antes da consulta.',
        tone: 'review',
      },
      {
        time: 'Hoje, 07:55',
        title: 'Compartilhamento recebido',
        detail: 'Autorização vinculada ao atendimento de vacinação.',
        tone: 'active',
      },
    ],
  },
  {
    id: 'share-aurora',
    pet: 'Aurora',
    species: 'Felina',
    breed: 'Persa',
    tutor: 'Helena Cruz',
    tutorContact: '(11) 94122-0091',
    status: 'expired',
    serviceType: 'Consulta',
    reason: 'Investigação de perda de peso',
    protocol: 'SHR-27JUN-AURORA',
    expiresAt: '28 jun 2026, 20:00',
    expiresLabel: 'Expirado',
    receivedAt: '27 jun, 16:20',
    lastAccess: '28 jun, 09:05',
    reviewed: true,
    consent: 'Autorização temporária encerrada pelo prazo configurado.',
    restriction: 'Dados indisponíveis até nova autorização do tutor.',
    clinicalSummary:
      'Snapshot expirado. Solicite renovação para acessar exames anteriores e diário de apetite.',
    nextAction: 'Solicitar renovação antes de abrir conduta clínica.',
    scopes: [
      {
        name: 'Exames anteriores',
        detail: 'Acesso indisponível até renovação.',
        icon: 'pi pi-lock',
        tone: 'attention',
      },
      {
        name: 'Diário alimentar',
        detail: 'Histórico bloqueado por expiração.',
        icon: 'pi pi-comments',
        tone: 'tutor',
      },
    ],
    alerts: ['Solicitar renovação ao tutor'],
    attachments: [
      {
        name: 'Exames anteriores bloqueados',
        type: 'Snapshot expirado',
        source: 'Sistema',
        date: '28 jun, 20:00',
        icon: 'pi pi-lock',
      },
    ],
    notes: [
      {
        author: 'Dra. Carla Souza',
        date: '28 jun, 09:12',
        text: 'Avaliar necessidade de nova autorização para revisar exames e diário alimentar.',
      },
    ],
    audit: [
      {
        time: '28 jun, 20:00',
        title: 'Compartilhamento expirado',
        detail: 'Escopo temporário encerrado automaticamente.',
        tone: 'expired',
      },
      {
        time: '28 jun, 09:05',
        title: 'Último acesso',
        detail: 'Dados consultados pela equipe clínica.',
        tone: 'review',
      },
    ],
  },
  {
    id: 'share-mel',
    pet: 'Mel',
    species: 'Canina',
    breed: 'Poodle',
    tutor: 'Bianca Torres',
    tutorContact: '(11) 95501-3377',
    status: 'revoked',
    serviceType: 'Consulta',
    reason: 'Retorno dermatológico',
    protocol: 'SHR-26JUN-MEL',
    expiresAt: 'Revogado em 27 jun 2026, 14:40',
    expiresLabel: 'Revogado',
    receivedAt: '26 jun, 10:15',
    lastAccess: '26 jun, 11:22',
    reviewed: true,
    consent: 'Tutor revogou a autorização antes do fim do prazo.',
    restriction: 'Não acessar dados fora de novo consentimento explícito.',
    clinicalSummary: 'Acesso encerrado. Apenas metadados da autorização permanecem visíveis para auditoria.',
    nextAction: 'Orientar tutor a criar novo compartilhamento se desejar continuidade.',
    scopes: [
      {
        name: 'Prontuário dermatológico',
        detail: 'Conteúdo bloqueado após revogação.',
        icon: 'pi pi-ban',
        tone: 'attention',
      },
    ],
    alerts: ['Autorização revogada pelo tutor'],
    attachments: [
      {
        name: 'Anexos indisponíveis',
        type: 'Acesso revogado',
        source: 'Sistema',
        date: '27 jun, 14:40',
        icon: 'pi pi-ban',
      },
    ],
    notes: [
      {
        author: 'Equipe clínica',
        date: '26 jun, 11:25',
        text: 'Acesso usado apenas durante autorização ativa. Solicitar novo compartilhamento para continuidade.',
      },
    ],
    audit: [
      {
        time: '27 jun, 14:40',
        title: 'Acesso revogado',
        detail: 'Tutor encerrou a autorização manualmente.',
        tone: 'revoked',
      },
      {
        time: '26 jun, 11:22',
        title: 'Acesso anterior',
        detail: 'Consulta realizada enquanto autorização estava ativa.',
        tone: 'review',
      },
    ],
  },
])

const filters: Array<{ value: ShareFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'expiram', label: 'Expiram' },
  { value: 'expirados', label: 'Encerrados' },
  { value: 'revisao', label: 'Revisão' },
]

const shareTabs: Array<{ value: ShareTab; label: string; icon: string }> = [
  { value: 'visao', label: 'Visão', icon: 'pi pi-id-card' },
  { value: 'escopo', label: 'Escopo', icon: 'pi pi-lock' },
  { value: 'registros', label: 'Registros', icon: 'pi pi-pencil' },
  { value: 'auditoria', label: 'Auditoria', icon: 'pi pi-history' },
]

const statusLabel: Record<ShareStatus, string> = {
  active: 'Ativo',
  expiring: 'Expira em breve',
  expired: 'Expirado',
  revoked: 'Revogado',
}

const visibleShares = computed(() => {
  const normalizedSearch = searchQuery.value.trim().toLocaleLowerCase('pt-BR')

  return shares.value.filter((share) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [share.pet, share.tutor, share.reason, share.protocol, share.clinicalSummary]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedSearch)

    const matchesFilter =
      selectedFilter.value === 'todos' ||
      (selectedFilter.value === 'ativos' && share.status === 'active') ||
      (selectedFilter.value === 'expiram' && share.status === 'expiring') ||
      (selectedFilter.value === 'expirados' && ['expired', 'revoked'].includes(share.status)) ||
      (selectedFilter.value === 'revisao' && !share.reviewed)

    return matchesSearch && matchesFilter
  })
})

const selectedShare = computed(
  () => shares.value.find((share) => share.id === selectedShareId.value) ?? visibleShares.value[0] ?? null,
)

const hasFilters = computed(() => searchQuery.value.trim().length > 0 || selectedFilter.value !== 'todos')

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getFilterCount(filter: ShareFilter) {
  if (filter === 'todos') {
    return shares.value.length
  }

  if (filter === 'ativos') {
    return shares.value.filter((share) => share.status === 'active').length
  }

  if (filter === 'expiram') {
    return shares.value.filter((share) => share.status === 'expiring').length
  }

  if (filter === 'expirados') {
    return shares.value.filter((share) => ['expired', 'revoked'].includes(share.status)).length
  }

  return shares.value.filter((share) => !share.reviewed).length
}

function selectShare(share: AuthorizedShare) {
  selectedShareId.value = share.id
  selectedShareTab.value = 'visao'
}

function clearFilters() {
  searchQuery.value = ''
  selectedFilter.value = 'todos'
}

function retryShares() {
  pageState.value = 'loading'

  window.setTimeout(() => {
    pageState.value = 'ready'
  }, 350)
}

function requestRenewal() {
  if (!selectedShare.value) {
    return
  }

  toast.add({
    severity: 'info',
    summary: 'Renovação solicitada',
    detail: `Pedido de renovação preparado para ${selectedShare.value.tutor}.`,
    life: 3000,
  })
}

function markReviewed() {
  if (!selectedShare.value) {
    return
  }

  selectedShare.value.reviewed = true
  toast.add({
    severity: 'success',
    summary: 'Compartilhamento revisado',
    detail: `Snapshot de ${selectedShare.value.pet} marcado como revisado.`,
    life: 3000,
  })
}

function savePdf() {
  if (!selectedShare.value) {
    return
  }

  toast.add({
    severity: 'success',
    summary: 'PDF preparado',
    detail: `Resumo do compartilhamento de ${selectedShare.value.pet} preparado para salvar.`,
    life: 3000,
  })
}

function saveServiceNote() {
  const text = newNote.value.trim()

  if (!selectedShare.value || text.length === 0) {
    return
  }

  selectedShare.value.notes.unshift({
    author: 'Equipe parceira',
    date: 'Agora',
    text,
  })
  selectedShare.value.audit.unshift({
    time: 'Agora',
    title: 'Anotação adicionada',
    detail: 'Equipe registrou uma observação no compartilhamento.',
    tone: 'review',
  })
  newNote.value = ''

  toast.add({
    severity: 'success',
    summary: 'Anotação salva',
    detail: `Observação adicionada ao compartilhamento de ${selectedShare.value.pet}.`,
    life: 3000,
  })
}

function attachDocument() {
  const name = pendingAttachmentName.value.trim()

  if (!selectedShare.value || name.length === 0) {
    return
  }

  selectedShare.value.attachments.unshift({
    name,
    type: name.toLocaleLowerCase('pt-BR').endsWith('.pdf') ? 'PDF' : 'Documento',
    source: 'Parceiro',
    date: 'Agora',
    icon: name.toLocaleLowerCase('pt-BR').endsWith('.pdf') ? 'pi pi-file-pdf' : 'pi pi-file',
  })
  selectedShare.value.audit.unshift({
    time: 'Agora',
    title: 'Documento anexado',
    detail: `${name} foi anexado ao serviço compartilhado.`,
    tone: 'review',
  })
  pendingAttachmentName.value = ''

  toast.add({
    severity: 'success',
    summary: 'Documento anexado',
    detail: 'Arquivo registrado no prontuário do compartilhamento.',
    life: 3000,
  })
}

async function openRecord() {
  await router.push('/veterinario/prontuarios')
}
</script>

<template>
  <main class="shares-page" :style="pageStyle">
    <section v-if="pageState === 'loading'" class="shares-state" role="status">
      <span class="state-spinner" aria-hidden="true" />
      <strong>Carregando compartilhamentos</strong>
      <p>Buscando autorizações temporárias, escopos clínicos e histórico de auditoria.</p>
    </section>

    <section v-else-if="pageState === 'error'" class="shares-state shares-state--error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <strong>Não foi possível carregar os compartilhamentos</strong>
      <p>Confira sessão, vínculo com a clínica e permissões antes de tentar novamente.</p>
      <button class="shares-button shares-button--primary" type="button" @click="retryShares">Tentar novamente</button>
    </section>

    <section v-else class="shares-workspace">
      <aside class="shares-list-panel" aria-label="Compartilhamentos recebidos">
        <div class="panel-title">
          <div>
            <span class="shares-kicker">Compartilhamentos</span>
            <h2>Recebidos do tutor</h2>
          </div>
          <strong>{{ visibleShares.length }}</strong>
        </div>

        <label class="shares-search" for="shares-search">
          <i class="pi pi-search" aria-hidden="true" />
          <input
            id="shares-search"
            v-model="searchQuery"
            type="search"
            placeholder="Filtrar pet, tutor ou protocolo"
          />
        </label>

        <div class="filter-group" aria-label="Filtros de compartilhamento">
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

        <button v-if="hasFilters" class="queue-clear" type="button" @click="clearFilters">
          Limpar busca e filtros
        </button>

        <div v-if="visibleShares.length === 0" class="empty-list">
          <i class="pi pi-share-alt" aria-hidden="true" />
          <strong>Nenhum compartilhamento encontrado</strong>
          <p>Não há autorizações para os filtros selecionados.</p>
        </div>

        <div v-else class="share-list">
          <button
            v-for="share in visibleShares"
            :key="share.id"
            class="share-card"
            :class="{ 'share-card--active': selectedShare?.id === share.id }"
            type="button"
            :aria-current="selectedShare?.id === share.id ? 'true' : undefined"
            @click="selectShare(share)"
          >
            <span class="pet-avatar" :data-status="share.status">{{ getInitials(share.pet) }}</span>
            <span class="share-card__body">
              <span class="share-card__title">
                <strong>{{ share.pet }}</strong>
                <span class="status-pill" :data-status="share.status">{{ statusLabel[share.status] }}</span>
              </span>
              <small>{{ share.species }} - {{ share.breed }} - {{ share.tutor }}</small>
              <span class="share-card__reason">{{ share.serviceType }} - {{ share.reason }}</span>
              <span class="share-card__meta">
                <span>{{ share.expiresLabel }}</span>
                <span>{{ share.reviewed ? 'Revisado' : 'Pendente' }}</span>
              </span>
            </span>
          </button>
        </div>
      </aside>

      <article v-if="selectedShare" class="share-detail" aria-label="Compartilhamento selecionado">
        <header class="share-detail__header">
          <div class="share-identity">
            <span class="pet-avatar pet-avatar--lg" :data-status="selectedShare.status">
              {{ getInitials(selectedShare.pet) }}
            </span>
            <div>
              <span class="shares-kicker">Serviço compartilhado</span>
              <h2>{{ selectedShare.pet }}</h2>
              <p>{{ selectedShare.species }} - {{ selectedShare.breed }} - tutor {{ selectedShare.tutor }}</p>
            </div>
          </div>

          <div class="share-detail__actions">
            <span class="status-pill" :data-status="selectedShare.status">{{ statusLabel[selectedShare.status] }}</span>
            <button class="shares-button shares-button--ghost" type="button" @click="savePdf">
              <i class="pi pi-file-pdf" aria-hidden="true" />
              Salvar PDF
            </button>
          </div>
        </header>

        <dl class="share-facts" aria-label="Dados do compartilhamento">
          <div>
            <dt>Serviço</dt>
            <dd>{{ selectedShare.serviceType }}</dd>
          </div>
          <div>
            <dt>Expiração</dt>
            <dd>{{ selectedShare.expiresAt }}</dd>
          </div>
          <div>
            <dt>Recebido</dt>
            <dd>{{ selectedShare.receivedAt }}</dd>
          </div>
          <div>
            <dt>Protocolo</dt>
            <dd>{{ selectedShare.protocol }}</dd>
          </div>
        </dl>

        <nav class="share-tabs" aria-label="Abas do compartilhamento">
          <button
            v-for="tab in shareTabs"
            :key="tab.value"
            class="share-tab"
            :class="{ 'share-tab--active': selectedShareTab === tab.value }"
            type="button"
            @click="selectedShareTab = tab.value"
          >
            <i :class="tab.icon" aria-hidden="true" />
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="selectedShareTab === 'visao'" class="share-tab-panel">
          <section class="context-grid">
            <article class="context-card context-card--consent">
              <i class="pi pi-lock" aria-hidden="true" />
              <div>
                <strong>Consentimento</strong>
                <p>{{ selectedShare.consent }}</p>
              </div>
            </article>

            <article class="context-card" :data-status="selectedShare.status">
              <i class="pi pi-info-circle" aria-hidden="true" />
              <div>
                <strong>Restrição de uso</strong>
                <p>{{ selectedShare.restriction }}</p>
              </div>
            </article>
          </section>

          <section class="clinical-section">
            <article class="clinical-card clinical-card--wide">
              <span class="shares-kicker">Contexto do serviço</span>
              <h3>{{ selectedShare.reason }}</h3>
              <p>{{ selectedShare.clinicalSummary }}</p>
            </article>

            <article class="clinical-card">
              <span class="shares-kicker">Próxima ação</span>
              <h3>{{ selectedShare.nextAction }}</h3>
              <div class="alert-list">
                <span v-for="alert in selectedShare.alerts" :key="alert">
                  <i class="pi pi-exclamation-circle" aria-hidden="true" />
                  {{ alert }}
                </span>
              </div>
            </article>
          </section>
        </section>

        <section v-else-if="selectedShareTab === 'escopo'" class="scope-section share-tab-panel">
          <div class="section-heading">
            <span class="shares-kicker">Liberado pelo tutor</span>
            <h3>Informações disponíveis durante o serviço</h3>
          </div>

          <div class="scope-grid">
            <article v-for="scope in selectedShare.scopes" :key="scope.name" class="scope-card" :data-tone="scope.tone">
              <span class="scope-card__icon">
                <i :class="scope.icon" aria-hidden="true" />
              </span>
              <div>
                <strong>{{ scope.name }}</strong>
                <p>{{ scope.detail }}</p>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="selectedShareTab === 'registros'" class="service-workspace share-tab-panel">
          <article class="workspace-card">
            <div class="section-heading">
              <span class="shares-kicker">Anotações do parceiro</span>
              <h3>Registro do atendimento/serviço</h3>
            </div>

            <label class="note-composer" for="share-note">
              <textarea
                id="share-note"
                v-model="newNote"
                rows="4"
                placeholder="Registre observações do banho, tosa, consulta, exame ou orientação realizada..."
              />
            </label>

            <button class="shares-button shares-button--primary" type="button" @click="saveServiceNote">
              <i class="pi pi-pencil" aria-hidden="true" />
              Salvar anotação
            </button>

            <div class="note-list">
              <article v-for="note in selectedShare.notes" :key="`${note.date}-${note.text}`" class="note-row">
                <strong>{{ note.author }}</strong>
                <small>{{ note.date }}</small>
                <p>{{ note.text }}</p>
              </article>
            </div>
          </article>

          <article class="workspace-card">
            <div class="section-heading">
              <span class="shares-kicker">Documentação anexada</span>
              <h3>Fotos, PDFs, Word e registros do serviço</h3>
            </div>

            <div class="attachment-composer">
              <input
                v-model="pendingAttachmentName"
                type="text"
                placeholder="Ex.: laudo-exame.pdf, foto-pos-banho.jpg"
                aria-label="Nome do arquivo para anexar"
              />
              <button class="shares-button shares-button--ghost" type="button" @click="attachDocument">
                <i class="pi pi-paperclip" aria-hidden="true" />
                Anexar
              </button>
            </div>

            <div class="attachment-list">
              <article v-for="attachment in selectedShare.attachments" :key="`${attachment.name}-${attachment.date}`" class="attachment-row">
                <span class="attachment-row__icon">
                  <i :class="attachment.icon" aria-hidden="true" />
                </span>
                <div>
                  <strong>{{ attachment.name }}</strong>
                  <small>{{ attachment.type }} - {{ attachment.source }} - {{ attachment.date }}</small>
                </div>
              </article>
            </div>
          </article>
        </section>

        <section v-else class="audit-panel share-tab-panel">
          <div class="section-heading">
            <span class="shares-kicker">Auditoria</span>
            <h3>Rastro de autorização, acesso e registros</h3>
          </div>

          <article v-for="entry in selectedShare.audit" :key="`${entry.time}-${entry.title}`" class="audit-row">
            <span class="audit-dot" :data-tone="entry.tone" />
            <div>
              <span>{{ entry.time }}</span>
              <strong>{{ entry.title }}</strong>
              <p>{{ entry.detail }}</p>
            </div>
          </article>
        </section>

        <footer class="detail-actions">
          <button class="shares-button shares-button--primary" type="button" @click="openRecord">
            <i class="pi pi-file-edit" aria-hidden="true" />
            Abrir prontuário
          </button>
          <button class="shares-button shares-button--ghost" type="button" @click="markReviewed">
            Marcar revisado
          </button>
          <button class="shares-button shares-button--ghost" type="button" @click="requestRenewal">
            Solicitar renovação
          </button>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.shares-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.45rem 1.6rem 2rem;
  background: var(--shares-bg);
  color: var(--shares-text);
}

.shares-workspace {
  display: grid;
  grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr);
  gap: 1.2rem;
  align-items: start;
}

.shares-list-panel,
.share-detail,
.clinical-card,
.scope-card,
.audit-panel,
.context-card,
.workspace-card {
  border: 1px solid var(--shares-line);
  background: var(--shares-card);
}

.shares-list-panel {
  position: sticky;
  top: 5.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-height: calc(100vh - 6.5rem);
  min-height: 0;
  overflow: hidden;
  padding: 0.95rem;
  border-radius: 1.1rem;
}

.panel-title,
.share-detail__header,
.share-identity,
.share-detail__actions,
.filter-group,
.detail-actions,
.alert-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.panel-title,
.share-detail__header {
  align-items: flex-start;
  justify-content: space-between;
}

.panel-title h2,
.share-detail h2,
.section-heading h3,
.clinical-card h3 {
  margin: 0;
  color: var(--shares-text);
  font-weight: 700;
  letter-spacing: -0.035em;
}

.panel-title h2 {
  margin-top: 0.12rem;
  font-size: 1rem;
}

.panel-title > strong {
  display: grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--shares-primary) 16%, var(--shares-card));
  color: var(--shares-primary-strong);
  font-size: 0.92rem;
}

.shares-kicker {
  display: block;
  color: var(--shares-faint);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.shares-search {
  display: inline-flex;
  width: 100%;
  min-height: 2.55rem;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.78rem;
  border: 1px solid var(--shares-line);
  border-radius: 0.82rem;
  background: var(--shares-surface);
  color: var(--shares-faint);
}

.shares-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--shares-text);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  outline: none;
}

.shares-search input::placeholder {
  color: var(--shares-faint);
}

.filter-chip,
.shares-button,
.queue-clear {
  display: inline-flex;
  min-height: 2.35rem;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
  padding: 0 0.82rem;
  border: 0;
  border-radius: 0.72rem;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.filter-chip,
.shares-button--ghost {
  border: 1px solid var(--shares-line);
  background: var(--shares-card);
  color: var(--shares-muted);
}

.shares-button--primary {
  background: linear-gradient(135deg, var(--shares-primary), var(--shares-primary-strong));
  color: var(--shares-card);
}

.filter-chip:hover,
.shares-button:hover,
.share-card:hover,
.queue-clear:hover {
  transform: translateY(-1px);
}

.filter-chip--active {
  border-color: color-mix(in srgb, var(--shares-primary) 44%, var(--shares-line));
  background: color-mix(in srgb, var(--shares-primary-soft) 36%, var(--shares-card));
  color: var(--shares-primary-strong);
}

.filter-chip span {
  color: var(--shares-faint);
  font-size: 0.72rem;
}

.queue-clear {
  width: 100%;
  background: var(--shares-surface);
  color: var(--shares-muted);
}

.share-list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 0.65rem;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.18rem;
}

.share-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.72rem;
  width: 100%;
  padding: 0.72rem;
  border: 1px solid var(--shares-line);
  border-radius: 0.95rem;
  background: var(--shares-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.share-card--active {
  border-color: color-mix(in srgb, var(--shares-primary) 52%, var(--shares-line));
  background: color-mix(in srgb, var(--shares-primary-soft) 22%, var(--shares-card));
  box-shadow: 0 12px 32px rgb(var(--shares-shadow-rgb) / 0.08);
}

.pet-avatar {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: 0.78rem;
  background: var(--shares-success-bg);
  color: var(--shares-success-text);
  font-size: 0.78rem;
  font-weight: 800;
}

.pet-avatar--lg {
  width: 3.3rem;
  height: 3.3rem;
  border-radius: 1rem;
  font-size: 1rem;
}

.pet-avatar[data-status='expiring'] {
  background: var(--shares-amber-bg);
  color: var(--shares-amber-text);
}

.pet-avatar[data-status='expired'],
.pet-avatar[data-status='revoked'] {
  background: var(--shares-muted-pill-bg);
  color: var(--shares-muted-pill-text);
}

.share-card__body,
.share-card__title {
  min-width: 0;
}

.share-card__body {
  display: grid;
  gap: 0.34rem;
}

.share-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
}

.share-card__title strong {
  overflow: hidden;
  color: var(--shares-text);
  font-size: 0.92rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-card small,
.share-card__reason,
.share-card__meta {
  color: var(--shares-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.share-card__reason {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  color: var(--shares-faint);
}

.status-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.34rem 0.55rem;
  background: var(--shares-success-bg);
  color: var(--shares-success-text);
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.status-pill[data-status='expiring'] {
  background: var(--shares-amber-bg);
  color: var(--shares-amber-text);
}

.status-pill[data-status='expired'],
.status-pill[data-status='revoked'] {
  background: var(--shares-muted-pill-bg);
  color: var(--shares-muted-pill-text);
}

.share-detail {
  display: grid;
  gap: 1rem;
  min-width: 0;
  padding: 1.05rem;
  border-radius: 1.2rem;
}

.share-identity {
  align-items: center;
}

.share-detail h2 {
  margin-top: 0.14rem;
  font-size: clamp(1.55rem, 2vw, 2.05rem);
}

.share-detail p {
  margin: 0;
  color: var(--shares-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.share-detail__actions,
.detail-actions {
  align-items: center;
  justify-content: flex-end;
}

.share-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  border: 1px solid var(--shares-line);
  border-radius: 1rem;
  overflow: hidden;
}

.share-facts div {
  min-width: 0;
  padding: 0.85rem;
  background: var(--shares-surface);
  box-shadow: 1px 0 0 var(--shares-line-soft);
}

.share-facts dt {
  color: var(--shares-faint);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.share-facts dd {
  margin: 0.24rem 0 0;
  overflow: hidden;
  color: var(--shares-text);
  font-size: 0.84rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--shares-line-soft);
}

.share-tab {
  display: inline-flex;
  min-height: 2.32rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0 0.78rem;
  border: 1px solid var(--shares-line);
  border-radius: 0.72rem;
  background: var(--shares-card);
  color: var(--shares-muted);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.share-tab:hover {
  transform: translateY(-1px);
}

.share-tab--active {
  border-color: color-mix(in srgb, var(--shares-primary) 42%, var(--shares-line));
  background: color-mix(in srgb, var(--shares-primary-soft) 34%, var(--shares-card));
  color: var(--shares-primary-strong);
}

.share-tab-panel {
  display: grid;
  gap: 0.85rem;
}

.context-grid,
.clinical-section {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.context-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.9rem;
  border-radius: 1rem;
}

.context-card i {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.72rem;
  background: color-mix(in srgb, var(--shares-primary-soft) 36%, var(--shares-card));
  color: var(--shares-primary-strong);
}

.context-card[data-status='expired'] i,
.context-card[data-status='revoked'] i {
  background: var(--shares-muted-pill-bg);
  color: var(--shares-muted-pill-text);
}

.context-card strong,
.scope-card strong,
.clinical-card h3,
.audit-row strong {
  color: var(--shares-text);
}

.scope-section,
.audit-panel,
.clinical-card,
.workspace-card {
  display: grid;
  gap: 0.85rem;
}

.section-heading h3 {
  margin-top: 0.16rem;
  font-size: 1.05rem;
}

.scope-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.scope-card {
  display: grid;
  gap: 0.72rem;
  align-content: start;
  padding: 0.9rem;
  border-radius: 1rem;
}

.scope-card__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 0.75rem;
  background: var(--shares-success-bg);
  color: var(--shares-success-text);
}

.scope-card[data-tone='tutor'] .scope-card__icon {
  background: color-mix(in srgb, var(--shares-tutor) 14%, var(--shares-card));
  color: var(--shares-tutor);
}

.scope-card[data-tone='attention'] .scope-card__icon {
  background: var(--shares-amber-bg);
  color: var(--shares-amber-text);
}

.scope-card[data-tone='neutral'] .scope-card__icon {
  background: var(--shares-surface);
  color: var(--shares-primary-strong);
}

.clinical-card {
  padding: 0.95rem;
  border-radius: 1rem;
}

.clinical-card--wide {
  grid-column: span 1;
}

.clinical-card h3 {
  margin-top: 0.16rem;
  font-size: 1rem;
  line-height: 1.25;
}

.service-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 0.85rem;
}

.workspace-card {
  align-content: start;
  padding: 0.95rem;
  border-radius: 1rem;
}

.note-composer textarea,
.attachment-composer input {
  width: 100%;
  border: 1px solid var(--shares-line);
  border-radius: 0.82rem;
  background: var(--shares-surface);
  color: var(--shares-text);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  outline: none;
}

.note-composer textarea {
  min-height: 7rem;
  resize: vertical;
  padding: 0.78rem;
  line-height: 1.5;
}

.attachment-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
}

.attachment-composer input {
  min-height: 2.35rem;
  padding: 0 0.78rem;
}

.note-composer textarea::placeholder,
.attachment-composer input::placeholder {
  color: var(--shares-faint);
}

.note-composer textarea:focus,
.attachment-composer input:focus {
  border-color: color-mix(in srgb, var(--shares-primary) 42%, var(--shares-line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--shares-primary) 14%, transparent);
}

.note-list,
.attachment-list {
  display: grid;
  gap: 0.65rem;
}

.note-row,
.attachment-row {
  border: 1px solid var(--shares-line-soft);
  border-radius: 0.85rem;
  background: var(--shares-surface);
}

.note-row {
  display: grid;
  gap: 0.25rem;
  padding: 0.78rem;
}

.note-row strong,
.attachment-row strong {
  color: var(--shares-text);
  font-size: 0.86rem;
}

.note-row small,
.attachment-row small {
  color: var(--shares-faint);
  font-size: 0.74rem;
  font-weight: 700;
}

.note-row p {
  margin: 0.16rem 0 0;
  color: var(--shares-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.attachment-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.68rem;
  align-items: center;
  padding: 0.72rem;
}

.attachment-row__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--shares-primary-soft) 34%, var(--shares-card));
  color: var(--shares-primary-strong);
}

.alert-list span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
  padding: 0.42rem 0.58rem;
  border-radius: 999px;
  background: var(--shares-warm-bg);
  color: var(--shares-warm-text);
  font-size: 0.72rem;
  font-weight: 800;
}

.audit-panel {
  padding: 0.95rem;
  border-radius: 1rem;
}

.audit-row {
  display: grid;
  grid-template-columns: 0.9rem minmax(6.5rem, 8rem) minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
  padding: 0.9rem 0;
  border-top: 1px solid var(--shares-line-soft);
}

.audit-dot {
  width: 0.72rem;
  height: 0.72rem;
  margin-top: 0.42rem;
  border-radius: 999px;
  background: var(--shares-success-text);
  box-shadow: 0 0 0 4px var(--shares-success-bg);
}

.audit-dot[data-tone='expiring'] {
  background: var(--shares-amber-text);
  box-shadow: 0 0 0 4px var(--shares-amber-bg);
}

.audit-dot[data-tone='expired'],
.audit-dot[data-tone='revoked'] {
  background: var(--shares-muted-pill-text);
  box-shadow: 0 0 0 4px var(--shares-muted-pill-bg);
}

.audit-dot[data-tone='review'] {
  background: var(--shares-primary-strong);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--shares-primary-soft) 34%, var(--shares-card));
}

.audit-row > div {
  display: contents;
}

.audit-row span:not(.audit-dot) {
  color: var(--shares-faint);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.45;
}

.audit-row strong {
  display: block;
  line-height: 1.35;
}

.audit-row p {
  grid-column: 3;
  margin-top: 0.18rem;
  line-height: 1.45;
}

.shares-state,
.empty-list {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  padding: 3rem 1rem;
  border: 1px dashed var(--shares-line);
  border-radius: 1rem;
  background: var(--shares-surface);
  text-align: center;
}

.empty-list {
  padding: 1.5rem 0.8rem;
}

.shares-state i,
.empty-list i {
  color: var(--shares-primary);
  font-size: 1.35rem;
}

.shares-state strong,
.empty-list strong {
  color: var(--shares-text);
}

.shares-state p,
.empty-list p {
  max-width: 28rem;
  margin: 0;
  color: var(--shares-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.shares-state--error i {
  color: var(--shares-warm-text);
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--shares-line);
  border-top-color: var(--shares-primary);
  border-radius: 999px;
  animation: shares-spin 800ms linear infinite;
}

@keyframes shares-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .shares-workspace,
  .context-grid,
  .clinical-section,
  .service-workspace {
    grid-template-columns: 1fr;
  }

  .shares-list-panel {
    position: static;
    max-height: none;
  }

  .share-list {
    max-height: 32rem;
  }

  .scope-grid,
  .share-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .shares-page {
    padding: 1rem;
  }

  .scope-grid,
  .share-facts,
  .share-card {
    grid-template-columns: 1fr;
  }

  .share-detail__header,
  .share-detail__actions,
  .detail-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .shares-button {
    width: 100%;
  }
}
</style>
