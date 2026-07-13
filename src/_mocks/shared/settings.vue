<!--
  ARQUIVO MOCADO — fora do app de produção.
  Ver src/_mocks/README.md
-->
<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import { getAuthUser } from '@/service/auth/auth-session'
import { currentColors } from '@/theme/color-mode'

type SettingsSection = 'empresa' | 'equipe' | 'integracoes' | 'seguranca'
type SettingState = 'loading' | 'ready' | 'error'
type IntegrationStatus = 'connected' | 'pending' | 'disabled'

type SectionItem = {
  id: SettingsSection
  label: string
  detail: string
  icon: string
}

type TeamMember = {
  id: string
  name: string
  role: string
  crm: string
  status: string
  access: string
}

type Integration = {
  name: string
  detail: string
  status: IntegrationStatus
  icon: string
}

type SelectOption = {
  value: string
  label: string
  detail: string
  icon: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const user = computed(() => getAuthUser())
const pageState = ref<SettingState>('ready')
const activeSection = ref<SettingsSection>('empresa')
const sharedAccessEnabled = ref(true)
const auditEnabled = ref(true)
const removeTeamMemberConfirmVisible = ref(false)
const memberPendingRemoval = ref<TeamMember | null>(null)
const companyForm = ref({
  name: 'Clínica PetJourney Vila Mariana',
  cnpj: '12.345.678/0001-90',
  responsible: 'Dra. Marina Alves',
  crmv: 'CRMV-SP 18422',
  unit: 'Vila Mariana - SP',
  services: 'Consulta clínica, retorno, vacinação, exames e procedimentos leves.',
})

const sections: SectionItem[] = [
  {
    id: 'empresa',
    label: 'Empresa',
    detail: 'Dados da clínica, unidades e responsável técnico',
    icon: 'pi pi-building',
  },
  {
    id: 'equipe',
    label: 'Equipe',
    detail: 'Profissionais, permissões e convites',
    icon: 'pi pi-id-card',
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    detail: 'Canais externos e sincronizações',
    icon: 'pi pi-link',
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    detail: 'Sessões, auditoria e acesso autorizado',
    icon: 'pi pi-shield',
  },
]

const teamMembers = ref<TeamMember[]>([
  {
    id: 'marina',
    name: 'Dra. Marina Alves',
    role: 'Responsável técnica',
    crm: 'CRMV-SP 18422',
    status: 'Ativa',
    access: 'Admin clínica',
  },
  {
    id: 'rafael',
    name: 'Dr. Rafael Lima',
    role: 'Veterinário clínico',
    crm: 'CRMV-SP 22109',
    status: 'Ativo',
    access: 'Prontuário e agenda',
  },
  {
    id: 'carla',
    name: 'Carla Souza',
    role: 'Recepção',
    crm: 'Sem CRMV',
    status: 'Convite pendente',
    access: 'Agenda e pacientes',
  },
])

const accessOptions: SelectOption[] = [
  {
    value: 'Admin clínica',
    label: 'Admin clínica',
    detail: 'Gerencia empresa, equipe e permissões',
    icon: 'pi pi-shield',
  },
  {
    value: 'Prontuário e agenda',
    label: 'Prontuário e agenda',
    detail: 'Acessa histórico clínico e agenda',
    icon: 'pi pi-file-edit',
  },
  {
    value: 'Agenda e pacientes',
    label: 'Agenda e pacientes',
    detail: 'Opera agenda e cadastro clínico',
    icon: 'pi pi-calendar',
  },
  {
    value: 'Somente leitura',
    label: 'Somente leitura',
    detail: 'Consulta dados sem editar registros',
    icon: 'pi pi-eye',
  },
]
const fallbackAccessOption = accessOptions[0] as SelectOption

const integrations: Integration[] = [
  {
    name: 'WhatsApp da clínica',
    detail: 'Confirmações de agenda e retornos para tutores.',
    status: 'connected',
    icon: 'pi pi-comments',
  },
  {
    name: 'Calendário externo',
    detail: 'Sincronização de atendimentos com Google Calendar.',
    status: 'pending',
    icon: 'pi pi-calendar-clock',
  },
  {
    name: 'API PetJourney',
    detail: 'Acesso futuro para integrações autorizadas da clínica.',
    status: 'disabled',
    icon: 'pi pi-code',
  },
]

const sectionIds = new Set(sections.map((section) => section.id))
const fallbackSection = sections[0] as SectionItem

const settingsStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--settings-bg': colors.dashboard.bg,
    '--settings-card': colors.dashboard.surface,
    '--settings-surface': colors.dashboard.surfaceSoft,
    '--settings-line': colors.dashboard.line,
    '--settings-line-soft': colors.dashboard.lineSoft,
    '--settings-text': colors.dashboard.text,
    '--settings-muted': colors.dashboard.muted,
    '--settings-faint': colors.dashboard.faint,
    '--settings-primary': colors.vet.primary,
    '--settings-primary-soft': colors.vet.secondary,
    '--settings-primary-strong': colors.dashboard.primaryStrong,
    '--settings-primary-deep': colors.dashboard.primaryDeep,
    '--settings-success-bg': colors.dashboard.successBg,
    '--settings-success-text': colors.dashboard.successText,
    '--settings-warm-bg': colors.dashboard.warmBg,
    '--settings-warm-line': colors.dashboard.warmLine,
    '--settings-warm-text': colors.dashboard.warmText,
    '--settings-amber-bg': colors.dashboard.amberBg,
    '--settings-amber-text': colors.dashboard.amberText,
    '--settings-tutor': colors.tutor.primary,
    '--settings-shadow-rgb': colors.auth.shadowRgb,
  }
})

const activeSectionData = computed<SectionItem>(
  () => sections.find((section) => section.id === activeSection.value) ?? fallbackSection,
)

const integrationStatusLabel: Record<IntegrationStatus, string> = {
  connected: 'Conectado',
  pending: 'Pendente',
  disabled: 'Desativado',
}

const settingsSelectPt = computed(() => {
  const colors = currentColors.value

  return {
    overlay: {
      class: 'settings-select-overlay',
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
      class: 'settings-select-list',
    },
    option: {
      class: 'settings-select-option',
    },
  }
})

watch(
  () => route.hash,
  (hash) => {
    const hashSection = hash.replace('#', '') as SettingsSection

    if (sectionIds.has(hashSection)) {
      activeSection.value = hashSection
    }
  },
  { immediate: true },
)

function setActiveSection(sectionId: SettingsSection) {
  activeSection.value = sectionId
  void router.replace({ hash: `#${sectionId}` })
}

function saveSettings(context: string) {
  toast.add({
    severity: 'success',
    summary: 'Alterações salvas',
    detail: `${context} salvas para integração com a API.`,
    life: 3000,
  })
}

function getAccessOption(access: string) {
  return accessOptions.find((option) => option.value === access) ?? fallbackAccessOption
}

function requestRemoveTeamMember(member: TeamMember) {
  memberPendingRemoval.value = member
  removeTeamMemberConfirmVisible.value = true
}

function confirmRemoveTeamMember() {
  const member = memberPendingRemoval.value

  if (!member) {
    return
  }

  teamMembers.value = teamMembers.value.filter((teamMember) => teamMember.id !== member.id)
  toast.add({
    severity: 'success',
    summary: 'Usuário removido',
    detail: `${member.name} foi removido da equipe localmente.`,
    life: 3000,
  })
  memberPendingRemoval.value = null
}

function cancelRemoveTeamMember() {
  memberPendingRemoval.value = null
}

function retrySettings() {
  pageState.value = 'loading'

  window.setTimeout(() => {
    pageState.value = 'ready'
  }, 350)
}
</script>

<template>
  <main class="settings-page" :style="settingsStyle">
    <section class="settings-hero">
      <div>
        <span class="settings-kicker">Configurações compartilhadas</span>
        <h1>Settings</h1>
        <p>
          Centralize dados da clínica, equipe, integrações e segurança sem misturar rotinas de tutor com a operação
          veterinária.
        </p>
      </div>

      <button class="settings-hero__meta" type="button" aria-label="Editar perfil da conta ativa" @click="router.push('/perfil')">
        <span class="settings-avatar-wrap">
          <span class="settings-avatar">{{ user?.nome?.slice(0, 1) ?? 'V' }}</span>
          <span class="settings-avatar-edit">
            <i class="pi pi-pencil" aria-hidden="true" />
          </span>
        </span>
        <div>
          <strong>{{ user?.nome ?? 'Veterinário' }}</strong>
          <small>Conta parceira ativa - editar perfil</small>
        </div>
      </button>
    </section>

    <section v-if="pageState === 'loading'" class="settings-state" role="status">
      <span class="state-spinner" aria-hidden="true" />
      <strong>Carregando configurações</strong>
      <p>Buscando dados da clínica, equipe e permissões da conta parceira.</p>
    </section>

    <section v-else-if="pageState === 'error'" class="settings-state settings-state--error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <strong>Não foi possível carregar as configurações</strong>
      <p>Confira sessão e permissões administrativas antes de tentar novamente.</p>
      <button class="settings-button settings-button--primary" type="button" @click="retrySettings">
        Tentar novamente
      </button>
    </section>

    <section v-else class="settings-workspace">
      <aside class="settings-sidebar" aria-label="Seções de configuração">
        <button
          v-for="section in sections"
          :key="section.id"
          class="settings-nav-card"
          :class="{ 'settings-nav-card--active': activeSection === section.id }"
          type="button"
          @click="setActiveSection(section.id)"
        >
          <span class="settings-nav-card__icon">
            <i :class="section.icon" aria-hidden="true" />
          </span>
          <span>
            <strong>{{ section.label }}</strong>
            <small>{{ section.detail }}</small>
          </span>
        </button>
      </aside>

      <article class="settings-panel">
        <header class="settings-panel__header">
          <div>
            <span class="settings-kicker">Seção ativa</span>
            <h2>{{ activeSectionData.label }}</h2>
            <p>{{ activeSectionData.detail }}</p>
          </div>

          <button class="settings-button settings-button--primary" type="button" @click="saveSettings(activeSectionData.label)">
            <i class="pi pi-save" aria-hidden="true" />
            Salvar alterações
          </button>
        </header>

        <section v-if="activeSection === 'empresa'" class="settings-section-grid">
          <article class="settings-card settings-card--wide">
            <span class="settings-kicker">Perfil da clínica</span>
            <h3>Dados editáveis da empresa</h3>

            <div class="editable-form">
              <label class="editable-field" for="company-name">
                <span>Nome da clínica</span>
                <InputText id="company-name" v-model="companyForm.name" class="settings-input" />
              </label>

              <label class="editable-field" for="company-cnpj">
                <span>CNPJ</span>
                <InputText id="company-cnpj" v-model="companyForm.cnpj" class="settings-input" />
              </label>

              <label class="editable-field" for="company-responsible">
                <span>Responsável técnico</span>
                <InputText id="company-responsible" v-model="companyForm.responsible" class="settings-input" />
              </label>

              <label class="editable-field" for="company-crmv">
                <span>CRMV</span>
                <InputText id="company-crmv" v-model="companyForm.crmv" class="settings-input" />
              </label>

              <label class="editable-field editable-field--wide" for="company-unit">
                <span>Unidade principal</span>
                <InputText id="company-unit" v-model="companyForm.unit" class="settings-input" />
              </label>
            </div>
          </article>

          <article class="settings-card">
            <span class="settings-kicker">Escopo operacional</span>
            <h3>Dados autorizados</h3>
            <p>Prontuários, agenda, pacientes e compartilhamentos temporários ficam restritos ao vínculo da clínica.</p>
            <span class="settings-pill">Permissão clínica ativa</span>
          </article>

          <article class="settings-card">
            <span class="settings-kicker">Atendimento</span>
            <h3>Rotina veterinária</h3>
            <label class="editable-field editable-field--stacked" for="company-services">
              <span>Serviços habilitados</span>
              <Textarea id="company-services" v-model="companyForm.services" class="settings-textarea" rows="4" />
            </label>
            <button class="settings-link-button" type="button" @click="saveSettings('Serviços da clínica')">
              Salvar serviços
            </button>
          </article>
        </section>

        <section v-else-if="activeSection === 'equipe'" class="settings-section-grid">
          <article class="settings-card settings-card--wide">
            <div class="settings-card__heading">
              <div>
                <span class="settings-kicker">Equipe</span>
                <h3>Profissionais e acessos</h3>
              </div>
              <button class="settings-button settings-button--ghost" type="button" @click="saveSettings('Convite de equipe')">
                Convidar pessoa
              </button>
            </div>

            <div class="team-list">
              <article v-for="member in teamMembers" :key="member.id" class="team-row team-row--editable">
                <span class="team-avatar">{{ member.name.slice(0, 1) }}</span>
                <div class="team-edit-grid">
                  <label class="editable-field" :for="`member-name-${member.id}`">
                    <span>Nome</span>
                    <InputText :id="`member-name-${member.id}`" v-model="member.name" class="settings-input" />
                  </label>

                  <label class="editable-field" :for="`member-role-${member.id}`">
                    <span>Função</span>
                    <InputText :id="`member-role-${member.id}`" v-model="member.role" class="settings-input" />
                  </label>

                  <label class="editable-field" :for="`member-crm-${member.id}`">
                    <span>Registro</span>
                    <InputText :id="`member-crm-${member.id}`" v-model="member.crm" class="settings-input" />
                  </label>

                  <label class="editable-field" :for="`member-access-${member.id}`">
                    <span>Acesso</span>
                    <Select
                      :input-id="`member-access-${member.id}`"
                      v-model="member.access"
                      :options="accessOptions"
                      option-label="label"
                      option-value="value"
                      append-to="body"
                      class="settings-select"
                      :pt="settingsSelectPt"
                    >
                      <template #value>
                        <div class="settings-select-value">
                          <i :class="getAccessOption(member.access).icon" aria-hidden="true" />
                          <span>{{ getAccessOption(member.access).label }}</span>
                        </div>
                      </template>

                      <template #option="slotProps">
                        <div class="settings-select-option-content">
                          <span class="settings-select-option-content__icon">
                            <i :class="slotProps.option.icon" aria-hidden="true" />
                          </span>
                          <span class="settings-select-option-content__line">
                            <strong>{{ slotProps.option.label }}</strong>
                            <small>{{ slotProps.option.detail }}</small>
                          </span>
                        </div>
                      </template>
                    </Select>
                  </label>
                </div>
                <span class="settings-pill" :data-tone="member.status.includes('pendente') ? 'attention' : 'success'">
                  {{ member.status }}
                </span>
                <button
                  class="settings-icon-button settings-icon-button--danger"
                  type="button"
                  :aria-label="`Remover ${member.name} da equipe`"
                  title="Remover usuário"
                  @click="requestRemoveTeamMember(member)"
                >
                  <i class="pi pi-trash" aria-hidden="true" />
                </button>
              </article>
            </div>
          </article>
        </section>

        <section v-else-if="activeSection === 'integracoes'" class="settings-section-grid">
          <article class="settings-card settings-card--wide">
            <span class="settings-kicker">Integrações</span>
            <h3>Canais conectados</h3>
            <div class="integration-list">
              <article v-for="integration in integrations" :key="integration.name" class="integration-row">
                <span class="settings-nav-card__icon">
                  <i :class="integration.icon" aria-hidden="true" />
                </span>
                <div>
                  <strong>{{ integration.name }}</strong>
                  <small>{{ integration.detail }}</small>
                </div>
                <span class="settings-pill" :data-tone="integration.status">
                  {{ integrationStatusLabel[integration.status] }}
                </span>
              </article>
            </div>
          </article>
        </section>

        <section v-else class="settings-section-grid">
          <article class="settings-card">
            <span class="settings-kicker">Compartilhamentos</span>
            <h3>Proteção de dados do pet</h3>
            <button
              class="toggle-row"
              type="button"
              :aria-pressed="sharedAccessEnabled"
              @click="sharedAccessEnabled = !sharedAccessEnabled"
            >
              <span>
                <strong>Respeitar expiração</strong>
                <small>Acessos temporários expiram conforme autorização do tutor.</small>
              </span>
              <span class="toggle" :class="{ 'toggle--active': sharedAccessEnabled }" />
            </button>
          </article>

          <article class="settings-card">
            <span class="settings-kicker">Auditoria</span>
            <h3>Histórico de ações</h3>
            <button class="toggle-row" type="button" :aria-pressed="auditEnabled" @click="auditEnabled = !auditEnabled">
              <span>
                <strong>Registrar alterações críticas</strong>
                <small>Prontuário, equipe e permissões ficam rastreáveis.</small>
              </span>
              <span class="toggle" :class="{ 'toggle--active': auditEnabled }" />
            </button>
          </article>

          <article class="settings-card settings-card--danger">
            <span class="settings-kicker">Sessões</span>
            <h3>Controle de acesso</h3>
            <p>Encerrar sessões antigas será tratado com confirmação antes de afetar a equipe conectada.</p>
            <button class="settings-button settings-button--danger" type="button" @click="saveSettings('Sessões')">
              Revisar sessões
            </button>
          </article>
        </section>
      </article>
    </section>

    <ConfirmActionDialog
      v-model:visible="removeTeamMemberConfirmVisible"
      title="Remover usuário da equipe?"
      :message="
        memberPendingRemoval
          ? `${memberPendingRemoval.name} perderá acesso às áreas permitidas da clínica. Essa ação poderá ser integrada com permissões reais depois.`
          : 'Esse usuário perderá acesso às áreas permitidas da clínica.'
      "
      icon="pi pi-user-minus"
      confirm-label="Remover usuário"
      cancel-label="Cancelar"
      severity="danger"
      @confirm="confirmRemoveTeamMember"
      @cancel="cancelRemoveTeamMember"
    />
  </main>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.25rem 1.4rem 1.8rem;
  background: var(--settings-bg);
  color: var(--settings-text);
}

.settings-hero,
.settings-panel,
.settings-sidebar,
.settings-card,
.settings-state {
  border: 1px solid var(--settings-line);
  background: var(--settings-card);
}

.settings-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.15rem;
  border-radius: 1.2rem;
}

.settings-kicker {
  display: block;
  color: var(--settings-faint);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.settings-hero h1,
.settings-panel h2 {
  margin: 0.35rem 0 0;
  color: var(--settings-text);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.06em;
}

.settings-hero h1 {
  font-size: clamp(1.9rem, 3vw, 2.5rem);
}

.settings-panel h2 {
  font-size: 1.55rem;
}

.settings-hero p,
.settings-panel p,
.settings-card p {
  margin: 0.55rem 0 0;
  color: var(--settings-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

.settings-hero__meta {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 14rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--settings-line);
  border-radius: 0.95rem;
  background: var(--settings-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.settings-hero__meta:hover {
  border-color: color-mix(in srgb, var(--settings-primary) 34%, var(--settings-line));
  background: color-mix(in srgb, var(--settings-primary-soft) 24%, var(--settings-card));
  box-shadow: 0 12px 28px rgb(var(--settings-shadow-rgb) / 0.08);
  transform: translateY(-1px);
}

.settings-avatar-wrap {
  position: relative;
  display: inline-grid;
  flex: 0 0 auto;
}

.settings-avatar,
.team-avatar,
.settings-nav-card__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: var(--settings-success-bg);
  color: var(--settings-primary-strong);
  font-weight: 700;
}

.settings-avatar {
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--settings-primary) 18%, var(--settings-card));
  color: var(--settings-primary-strong);
}

.settings-avatar-edit {
  position: absolute;
  right: -0.32rem;
  bottom: -0.32rem;
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border: 2px solid var(--settings-surface);
  border-radius: 0.42rem;
  background: var(--settings-primary);
  color: var(--settings-card);
  font-size: 0.62rem;
}

.settings-avatar-edit i {
  font-size: 0.58rem;
  line-height: 1;
}

.settings-hero__meta strong,
.settings-hero__meta small {
  display: block;
}

.settings-hero__meta strong {
  color: var(--settings-text);
  font-size: 0.9rem;
}

.settings-hero__meta small {
  color: var(--settings-faint);
  font-size: 0.74rem;
  font-weight: 700;
}

.settings-workspace {
  display: grid;
  grid-template-columns: 19rem minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  margin-top: 1rem;
}

.settings-sidebar {
  position: sticky;
  top: 5.25rem;
  display: grid;
  gap: 0.55rem;
  padding: 0.82rem;
  border-radius: 1.12rem;
}

.settings-nav-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.7rem;
  align-items: center;
  width: 100%;
  padding: 0.72rem;
  border: 1px solid transparent;
  border-radius: 0.9rem;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.settings-nav-card:hover,
.settings-nav-card--active {
  border-color: color-mix(in srgb, var(--settings-primary) 30%, var(--settings-line));
  background: color-mix(in srgb, var(--settings-primary-soft) 25%, var(--settings-card));
}

.settings-nav-card__icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.78rem;
}

.settings-nav-card strong {
  display: block;
  color: var(--settings-text);
  font-size: 0.86rem;
}

.settings-nav-card small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--settings-muted);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.settings-panel {
  overflow: hidden;
  border-radius: 1.15rem;
  box-shadow: 0 16px 48px rgb(var(--settings-shadow-rgb) / 0.045);
}

.settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  border-bottom: 1px solid var(--settings-line-soft);
  background: linear-gradient(180deg, var(--settings-card), var(--settings-surface));
}

.settings-section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  padding: 1rem 1.15rem 1.15rem;
}

.settings-card {
  min-width: 0;
  padding: 1rem;
  border-radius: 1rem;
}

.settings-card--wide {
  grid-column: 1 / -1;
}

.settings-card--danger {
  border-color: var(--settings-warm-line);
  background: var(--settings-warm-bg);
}

.settings-card h3 {
  margin: 0.25rem 0 0;
  color: var(--settings-text);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.settings-card__heading,
.team-row,
.integration-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
}

.settings-button,
.settings-link-button,
.settings-icon-button {
  display: inline-flex;
  min-height: 2.35rem;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
  padding: 0 0.85rem;
  border: 0;
  border-radius: 0.78rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.settings-icon-button {
  width: 2.35rem;
  padding: 0;
  flex: 0 0 auto;
}

.settings-icon-button--danger {
  border: 1px solid color-mix(in srgb, var(--settings-warm-text) 26%, var(--settings-line));
  background: var(--settings-warm-bg);
  color: var(--settings-warm-text);
}

.settings-icon-button--danger:hover {
  border-color: color-mix(in srgb, var(--settings-warm-text) 44%, var(--settings-line));
  background: color-mix(in srgb, var(--settings-warm-text) 12%, var(--settings-warm-bg));
}

.settings-button--primary {
  background: linear-gradient(135deg, var(--settings-primary), var(--settings-primary-strong));
  color: white;
}

.settings-button--ghost,
.settings-link-button {
  border: 1px solid var(--settings-line);
  background: var(--settings-card);
  color: var(--settings-primary-strong);
}

.settings-button--danger {
  background: var(--settings-warm-text);
  color: white;
}

.settings-link-button {
  margin-top: 0.85rem;
}

.editable-form,
.team-edit-grid {
  display: grid;
  gap: 0.75rem;
}

.editable-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.9rem;
}

.team-edit-grid {
  flex: 1 1 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
}

.editable-field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.editable-field--wide {
  grid-column: 1 / -1;
}

.editable-field--stacked {
  margin-top: 0.85rem;
}

.editable-field > span {
  color: var(--settings-faint);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.settings-input,
.settings-select,
.settings-textarea {
  width: 100%;
}

.settings-input,
.settings-textarea,
:deep(.settings-select) {
  border: 1px solid var(--settings-line);
  border-radius: 0.82rem;
  background: var(--settings-surface);
  color: var(--settings-text);
  font-size: 0.84rem;
  font-weight: 600;
  box-shadow: none;
}

.settings-input,
.settings-textarea {
  padding: 0.68rem 0.75rem;
}

.settings-textarea {
  resize: vertical;
}

.settings-input:enabled:focus,
.settings-textarea:enabled:focus,
:deep(.settings-select:not(.p-disabled).p-focus) {
  border-color: color-mix(in srgb, var(--settings-primary) 38%, var(--settings-line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--settings-primary) 12%, transparent);
}

:deep(.settings-select .p-select-label) {
  padding: 0.66rem 0.75rem;
  color: var(--settings-text);
  font-size: 0.84rem;
  font-weight: 600;
}

:deep(.settings-select .p-select-dropdown) {
  color: var(--settings-faint);
}

:global(.settings-select-overlay) {
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

:global(.settings-select-list) {
  padding: 0.35rem;
  background: var(--pj-select-card);
}

:global(.settings-select-option) {
  min-height: 2.65rem;
  max-width: 100%;
  border-radius: 0.72rem;
  background: transparent;
  color: var(--pj-select-text);
}

:global(.settings-select-option:hover),
:global(.settings-select-option.p-focus),
:global(.settings-select-option.p-select-option-selected) {
  background: color-mix(in srgb, var(--pj-select-primary) 22%, var(--pj-select-card)) !important;
  color: var(--pj-select-text);
}

:global(.settings-select-option:hover) .settings-select-option-content__line strong,
:global(.settings-select-option.p-focus) .settings-select-option-content__line strong,
:global(.settings-select-option.p-select-option-selected) .settings-select-option-content__line strong {
  color: var(--pj-select-text) !important;
}

:global(.settings-select-option:hover) .settings-select-option-content__line small,
:global(.settings-select-option.p-focus) .settings-select-option-content__line small,
:global(.settings-select-option.p-select-option-selected) .settings-select-option-content__line small {
  color: var(--pj-select-muted) !important;
}

.settings-select-value {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.48rem;
}

.settings-select-value i {
  flex: 0 0 auto;
  color: var(--settings-primary-strong);
  font-size: 0.76rem;
}

.settings-select-value span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-option-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.2rem 0;
}

.settings-select-option-content__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--pj-select-primary-soft, var(--settings-primary-soft)) 26%, var(--pj-select-card, var(--settings-card)));
  color: var(--pj-select-primary-strong, var(--settings-primary-strong));
}

.settings-select-option-content__icon i {
  font-size: 0.78rem;
}

.settings-select-option-content__line {
  display: block;
  flex: 1 1 auto;
  width: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--pj-select-text, var(--settings-text));
  font-size: 0.84rem;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-option-content__line strong {
  color: var(--pj-select-text, var(--settings-text));
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.15;
}

.settings-select-option-content__line small {
  color: var(--pj-select-faint, var(--settings-faint));
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
}

.settings-select-option-content__line small::before {
  content: ' - ';
  color: var(--pj-select-faint, var(--settings-faint));
}

.settings-data-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0.9rem 0 0;
}

.settings-data-grid--single {
  grid-template-columns: 1fr;
}

.settings-data-grid div {
  display: grid;
  gap: 0.18rem;
  padding: 0.75rem;
  border-radius: 0.85rem;
  background: var(--settings-surface);
}

.settings-data-grid dt,
.settings-data-grid dd {
  margin: 0;
}

.settings-data-grid dt {
  color: var(--settings-faint);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.settings-data-grid dd {
  color: var(--settings-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.settings-pill {
  display: inline-flex;
  width: fit-content;
  min-height: 1.65rem;
  align-items: center;
  justify-content: center;
  margin-top: 0.8rem;
  padding: 0 0.62rem;
  border-radius: 999px;
  background: var(--settings-success-bg);
  color: var(--settings-success-text);
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.settings-pill[data-tone='attention'],
.settings-pill[data-tone='pending'] {
  background: var(--settings-amber-bg);
  color: var(--settings-amber-text);
}

.settings-pill[data-tone='disabled'] {
  background: var(--settings-surface);
  color: var(--settings-faint);
}

.team-list,
.integration-list {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
}

.team-row,
.integration-row {
  padding: 0.82rem;
  border: 1px solid var(--settings-line);
  border-radius: 0.92rem;
  background: var(--settings-surface);
}

.team-row--editable {
  align-items: flex-start;
}

.team-avatar {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.82rem;
}

.team-row div,
.integration-row div {
  min-width: 0;
  flex: 1 1 auto;
}

.team-row strong,
.integration-row strong {
  display: block;
  color: var(--settings-text);
  font-size: 0.88rem;
}

.team-row small,
.integration-row small {
  color: var(--settings-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.toggle-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  margin-top: 0.75rem;
  padding: 0.8rem;
  border: 1px solid var(--settings-line);
  border-radius: 0.9rem;
  background: var(--settings-surface);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.toggle-row strong,
.toggle-row small {
  display: block;
}

.toggle-row strong {
  color: var(--settings-text);
  font-size: 0.84rem;
}

.toggle-row small {
  margin-top: 0.16rem;
  color: var(--settings-muted);
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.4;
}

.toggle {
  position: relative;
  width: 2.3rem;
  height: 1.35rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--settings-line);
}

.toggle::after {
  content: '';
  position: absolute;
  top: 0.18rem;
  left: 0.18rem;
  width: 0.98rem;
  height: 0.98rem;
  border-radius: 999px;
  background: white;
  transition: transform 160ms ease;
}

.toggle--active {
  background: var(--settings-primary);
}

.toggle--active::after {
  transform: translateX(0.95rem);
}

.settings-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
  padding: 3.2rem 1rem;
  border-radius: 1rem;
  text-align: center;
}

.settings-state i {
  color: var(--settings-primary);
  font-size: 1.5rem;
}

.settings-state--error i {
  color: var(--settings-warm-text);
}

.settings-state strong {
  color: var(--settings-text);
}

.settings-state p {
  max-width: 28rem;
  margin: 0;
  color: var(--settings-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--settings-line);
  border-top-color: var(--settings-primary);
  border-radius: 999px;
  animation: settings-spin 800ms linear infinite;
}

@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .settings-hero,
  .settings-panel__header {
    align-items: stretch;
    flex-direction: column;
  }

  .settings-workspace {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .settings-page {
    padding: 1rem;
  }

  .settings-sidebar,
  .settings-section-grid,
  .editable-form,
  .team-edit-grid,
  .settings-data-grid,
  .team-row,
  .integration-row {
    grid-template-columns: 1fr;
  }

  .team-row,
  .integration-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-button--primary {
    width: 100%;
  }
}
</style>
