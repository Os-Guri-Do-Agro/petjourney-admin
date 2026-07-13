<!--
  ARQUIVO MOCADO — fora do app de produção.
  Ver src/_mocks/README.md
-->
<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'

import { getAuthUser } from '@/service/auth/auth-session'
import { currentColors } from '@/theme/color-mode'

type ProfileState = 'loading' | 'ready' | 'error'

type SelectOption = {
  value: string
  label: string
  detail: string
  icon: string
}

type SelectInstance = {
  hide?: () => void
  overlayVisible?: boolean
}

const toast = useToast()
const user = computed(() => getAuthUser())
const pageState = ref<ProfileState>('ready')
const notificationEnabled = ref(true)
const twoFactorEnabled = ref(false)
const roleSelectRef = ref<SelectInstance | null>(null)
const specialtySelectRef = ref<SelectInstance | null>(null)

const profileForm = ref({
  name: user.value?.nome ?? 'Dra. Marina Alves',
  email: user.value?.email ?? 'dra.marina@petjourney.vet',
  phone: '(11) 98422-1030',
  role: 'Veterinária clínica',
  crmv: 'CRMV-SP 18422',
  specialty: 'Clínica médica e dermatologia',
  clinic: 'Clínica PetJourney Vila Mariana',
  bio: 'Atendimento clínico com foco em cuidado contínuo, acompanhamento de pacientes crônicos e comunicação clara com tutores.',
})

const roleOptions: SelectOption[] = [
  {
    value: 'Veterinária clínica',
    label: 'Veterinária clínica',
    detail: 'Atendimento, prontuários e acompanhamento',
    icon: 'pi pi-heart',
  },
  {
    value: 'Responsável técnica',
    label: 'Responsável técnica',
    detail: 'Supervisão clínica e permissões elevadas',
    icon: 'pi pi-shield',
  },
  {
    value: 'Veterinário cirurgião',
    label: 'Veterinário cirurgião',
    detail: 'Procedimentos, retornos e documentos',
    icon: 'pi pi-briefcase',
  },
  {
    value: 'Gestor parceiro',
    label: 'Gestor parceiro',
    detail: 'Operação da clínica e equipe',
    icon: 'pi pi-building',
  },
]

const specialtyOptions: SelectOption[] = [
  {
    value: 'Clínica médica e dermatologia',
    label: 'Clínica médica e dermatologia',
    detail: 'Rotina clínica e pele',
    icon: 'pi pi-sparkles',
  },
  {
    value: 'Clínica médica geral',
    label: 'Clínica médica geral',
    detail: 'Consulta, retorno e prevenção',
    icon: 'pi pi-heart',
  },
  {
    value: 'Cirurgia',
    label: 'Cirurgia',
    detail: 'Procedimentos e pós-operatório',
    icon: 'pi pi-briefcase',
  },
  {
    value: 'Felinos',
    label: 'Felinos',
    detail: 'Atendimento especializado em gatos',
    icon: 'pi pi-star',
  },
  {
    value: 'Animais exóticos',
    label: 'Animais exóticos',
    detail: 'Aves, coelhos, répteis e outros',
    icon: 'pi pi-send',
  },
]

const initials = computed(() =>
  profileForm.value.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const profileStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--profile-bg': colors.dashboard.bg,
    '--profile-card': colors.dashboard.surface,
    '--profile-surface': colors.dashboard.surfaceSoft,
    '--profile-line': colors.dashboard.line,
    '--profile-line-soft': colors.dashboard.lineSoft,
    '--profile-text': colors.dashboard.text,
    '--profile-muted': colors.dashboard.muted,
    '--profile-faint': colors.dashboard.faint,
    '--profile-primary': colors.vet.primary,
    '--profile-primary-soft': colors.vet.secondary,
    '--profile-primary-strong': colors.dashboard.primaryStrong,
    '--profile-primary-deep': colors.dashboard.primaryDeep,
    '--profile-success-bg': colors.dashboard.successBg,
    '--profile-success-text': colors.dashboard.successText,
    '--profile-warm-bg': colors.dashboard.warmBg,
    '--profile-warm-line': colors.dashboard.warmLine,
    '--profile-warm-text': colors.dashboard.warmText,
    '--profile-amber-bg': colors.dashboard.amberBg,
    '--profile-amber-text': colors.dashboard.amberText,
    '--profile-shadow-rgb': colors.auth.shadowRgb,
  }
})

const profileSelectPt = computed(() => {
  const colors = currentColors.value

  return {
    overlay: {
      class: 'profile-select-overlay',
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
      class: 'profile-select-list',
    },
    option: {
      class: 'profile-select-option',
    },
  }
})

const selectedRoleOption = computed(
  () => roleOptions.find((option) => option.value === profileForm.value.role) ?? roleOptions[0],
)

const selectedSpecialtyOption = computed(
  () => specialtyOptions.find((option) => option.value === profileForm.value.specialty) ?? specialtyOptions[0],
)

function saveProfile(context = 'Perfil') {
  toast.add({
    severity: 'success',
    summary: 'Alterações salvas',
    detail: `${context} atualizado para integração com a API.`,
    life: 3000,
  })
}

function sendPasswordReset() {
  toast.add({
    severity: 'info',
    summary: 'Segurança',
    detail: 'Fluxo de alteração de senha preparado para integração.',
    life: 3000,
  })
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

function handleRoleSelectShow() {
  closeSelect(specialtySelectRef.value)
}

function handleSpecialtySelectShow() {
  closeSelect(roleSelectRef.value)
}

function retryProfile() {
  pageState.value = 'loading'

  window.setTimeout(() => {
    pageState.value = 'ready'
  }, 350)
}
</script>

<template>
  <main class="profile-page" :style="profileStyle">
    <section class="profile-hero">
      <div class="profile-identity">
        <span class="profile-avatar">{{ initials }}</span>
        <div>
          <span class="profile-kicker">Perfil profissional</span>
          <h1>{{ profileForm.name }}</h1>
          <p>{{ profileForm.role }} - {{ profileForm.clinic }}</p>
        </div>
      </div>

      <div class="profile-hero__actions">
        <Button
          class="profile-action profile-action--ghost"
          icon="pi pi-camera"
          label="Atualizar foto"
          severity="secondary"
          outlined
          type="button"
          @click="saveProfile('Foto')"
        />
        <Button
          class="profile-action profile-action--primary"
          icon="pi pi-save"
          label="Salvar perfil"
          type="button"
          @click="saveProfile()"
        />
      </div>
    </section>

    <section v-if="pageState === 'loading'" class="profile-state" role="status">
      <span class="state-spinner" aria-hidden="true" />
      <strong>Carregando perfil</strong>
      <p>Buscando dados profissionais e vínculo com a clínica.</p>
    </section>

    <section v-else-if="pageState === 'error'" class="profile-state profile-state--error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <strong>Não foi possível carregar o perfil</strong>
      <p>Confira sua sessão e tente novamente.</p>
      <Button label="Tentar novamente" type="button" @click="retryProfile" />
    </section>

    <section v-else class="profile-workspace">
      <Card class="profile-card profile-card--main">
        <template #title>
          <span class="card-title">
            <i class="pi pi-user" aria-hidden="true" />
            Dados principais
          </span>
        </template>

        <template #subtitle>Informações usadas no painel, prontuários e ações clínicas.</template>

        <template #content>
          <div class="profile-form-grid">
            <label class="profile-field" for="profile-name">
              <span>Nome completo</span>
              <InputText id="profile-name" v-model="profileForm.name" class="profile-input" />
            </label>

            <label class="profile-field" for="profile-email">
              <span>E-mail</span>
              <InputText id="profile-email" v-model="profileForm.email" class="profile-input" type="email" />
            </label>

            <label class="profile-field" for="profile-phone">
              <span>Telefone</span>
              <InputText id="profile-phone" v-model="profileForm.phone" class="profile-input" />
            </label>

            <label class="profile-field" for="profile-crmv">
              <span>Registro profissional</span>
              <InputText id="profile-crmv" v-model="profileForm.crmv" class="profile-input" />
            </label>

            <label class="profile-field" for="profile-role">
              <span>Papel no painel</span>
              <Select
                ref="roleSelectRef"
                input-id="profile-role"
                v-model="profileForm.role"
                :options="roleOptions"
                option-label="label"
                option-value="value"
                append-to="body"
                class="profile-select"
                :pt="profileSelectPt"
                placeholder="Selecione o papel"
                @show="handleRoleSelectShow"
              >
                <template #value>
                  <div class="profile-select-value">
                    <i :class="selectedRoleOption?.icon" aria-hidden="true" />
                    <span>{{ selectedRoleOption?.label }}</span>
                  </div>
                </template>

                <template #option="slotProps">
                  <div class="profile-select-option-content">
                    <span class="profile-select-option-content__icon">
                      <i :class="slotProps.option.icon" aria-hidden="true" />
                    </span>
                    <span class="profile-select-option-content__line">
                      <strong>{{ slotProps.option.label }}</strong>
                      <small>{{ slotProps.option.detail }}</small>
                    </span>
                  </div>
                </template>
              </Select>
            </label>

            <label class="profile-field" for="profile-specialty">
              <span>Especialidade</span>
              <Select
                ref="specialtySelectRef"
                input-id="profile-specialty"
                v-model="profileForm.specialty"
                :options="specialtyOptions"
                option-label="label"
                option-value="value"
                append-to="body"
                class="profile-select"
                :pt="profileSelectPt"
                placeholder="Selecione a especialidade"
                @show="handleSpecialtySelectShow"
              >
                <template #value>
                  <div class="profile-select-value">
                    <i :class="selectedSpecialtyOption?.icon" aria-hidden="true" />
                    <span>{{ selectedSpecialtyOption?.label }}</span>
                  </div>
                </template>

                <template #option="slotProps">
                  <div class="profile-select-option-content">
                    <span class="profile-select-option-content__icon">
                      <i :class="slotProps.option.icon" aria-hidden="true" />
                    </span>
                    <span class="profile-select-option-content__line">
                      <strong>{{ slotProps.option.label }}</strong>
                      <small>{{ slotProps.option.detail }}</small>
                    </span>
                  </div>
                </template>
              </Select>
            </label>

            <label class="profile-field profile-field--wide" for="profile-bio">
              <span>Bio profissional</span>
              <Textarea id="profile-bio" v-model="profileForm.bio" class="profile-textarea" rows="4" />
            </label>
          </div>
        </template>
      </Card>

      <aside class="profile-side">
        <Card class="profile-card">
          <template #title>
            <span class="card-title">
              <i class="pi pi-building" aria-hidden="true" />
              Vínculo parceiro
            </span>
          </template>
          <template #content>
            <dl class="profile-summary">
              <div>
                <dt>Clínica</dt>
                <dd>{{ profileForm.clinic }}</dd>
              </div>
              <div>
                <dt>Acesso</dt>
                <dd>Prontuário, agenda e pacientes</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><span class="profile-pill">Ativo</span></dd>
              </div>
            </dl>
          </template>
        </Card>

        <Card class="profile-card">
          <template #title>
            <span class="card-title">
              <i class="pi pi-shield" aria-hidden="true" />
              Segurança
            </span>
          </template>
          <template #content>
            <button
              class="toggle-row"
              type="button"
              :aria-pressed="notificationEnabled"
              @click="notificationEnabled = !notificationEnabled"
            >
              <span>
                <strong>Notificações clínicas</strong>
                <small>Receber alertas de agenda, retorno e revisão.</small>
              </span>
              <span class="toggle" :class="{ 'toggle--active': notificationEnabled }" />
            </button>

            <button class="toggle-row" type="button" :aria-pressed="twoFactorEnabled" @click="twoFactorEnabled = !twoFactorEnabled">
              <span>
                <strong>Verificação em duas etapas</strong>
                <small>Preparado para habilitar proteção adicional.</small>
              </span>
              <span class="toggle" :class="{ 'toggle--active': twoFactorEnabled }" />
            </button>
          </template>
          <template #footer>
            <Button
              class="profile-card__button profile-action profile-action--ghost"
              icon="pi pi-key"
              label="Alterar senha"
              severity="secondary"
              outlined
              type="button"
              @click="sendPasswordReset"
            />
          </template>
        </Card>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  min-height: calc(100vh - 4.25rem);
  padding: 1.25rem 1.4rem 1.8rem;
  background: var(--profile-bg);
  color: var(--profile-text);
}

.profile-hero,
.profile-card,
.profile-state {
  border: 1px solid var(--profile-line);
  background: var(--profile-card);
}

.profile-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.15rem;
  border-radius: 1.2rem;
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 0.95rem;
  min-width: 0;
}

.profile-avatar {
  display: grid;
  width: 4rem;
  height: 4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 1.2rem;
  background: linear-gradient(135deg, var(--profile-primary), var(--profile-primary-deep));
  color: white;
  font-size: 1.2rem;
  font-weight: 800;
}

.profile-kicker {
  display: block;
  color: var(--profile-faint);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.profile-hero h1 {
  margin: 0.35rem 0 0;
  color: var(--profile-text);
  font-size: clamp(1.9rem, 3vw, 2.45rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.06em;
}

.profile-hero p {
  margin: 0.5rem 0 0;
  color: var(--profile-muted);
  font-size: 0.92rem;
}

.profile-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: flex-end;
}

.profile-action {
  min-height: 2.45rem;
  border-radius: 0.78rem !important;
  font-size: 0.82rem;
  font-weight: 700;
}

.profile-action--primary {
  border: 0 !important;
  background: linear-gradient(135deg, var(--profile-primary), var(--profile-primary-strong)) !important;
  color: white !important;
  box-shadow: 0 12px 28px rgb(var(--profile-shadow-rgb) / 0.1);
}

.profile-action--primary:hover {
  background: linear-gradient(135deg, var(--profile-primary-strong), var(--profile-primary-deep)) !important;
}

.profile-action--ghost {
  border-color: var(--profile-line) !important;
  background: var(--profile-card) !important;
  color: var(--profile-text) !important;
  box-shadow: none !important;
}

.profile-action--ghost:hover {
  border-color: color-mix(in srgb, var(--profile-primary) 34%, var(--profile-line)) !important;
  background: var(--profile-surface) !important;
}

.profile-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24rem;
  gap: 1rem;
  align-items: start;
  margin-top: 1rem;
}

.profile-side {
  display: grid;
  gap: 1rem;
}

.profile-card {
  border-radius: 1.15rem;
  overflow: hidden;
  box-shadow: 0 16px 48px rgb(var(--profile-shadow-rgb) / 0.045);
}

.profile-card :deep(.p-card) {
  background: var(--profile-card);
  color: var(--profile-text);
}

.profile-card :deep(.p-card-body) {
  gap: 1rem;
  padding: 1.05rem;
  background: var(--profile-card);
  color: var(--profile-text);
}

.profile-card :deep(.p-card-title),
.profile-card :deep(.p-card-subtitle),
.profile-card :deep(.p-card-content),
.profile-card :deep(.p-card-footer) {
  padding: 0;
}

.profile-card :deep(.p-card-subtitle) {
  color: var(--profile-muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.profile-card :deep(.p-button) {
  border-radius: 0.78rem;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--profile-text);
  font-size: 1rem;
  font-weight: 800;
}

.card-title i {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--profile-primary) 14%, var(--profile-card));
  color: var(--profile-primary-strong);
  font-size: 0.82rem;
}

.profile-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.profile-field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.profile-field--wide {
  grid-column: 1 / -1;
}

.profile-field > span {
  color: var(--profile-faint);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.profile-input,
.profile-select,
.profile-textarea {
  width: 100%;
}

.profile-input,
.profile-textarea,
:deep(.profile-select) {
  border: 1px solid var(--profile-line);
  border-radius: 0.82rem;
  background: var(--profile-card);
  color: var(--profile-text);
  font-size: 0.84rem;
  font-weight: 600;
  box-shadow: none;
}

.profile-input,
.profile-textarea {
  padding: 0.68rem 0.75rem;
}

.profile-textarea {
  resize: vertical;
}

.profile-input:enabled:focus,
.profile-textarea:enabled:focus,
:deep(.profile-select:not(.p-disabled).p-focus) {
  border-color: color-mix(in srgb, var(--profile-primary) 38%, var(--profile-line));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--profile-primary) 12%, transparent);
}

:deep(.profile-select .p-select-label) {
  padding: 0.66rem 0.75rem;
  color: var(--profile-text);
  font-size: 0.84rem;
  font-weight: 600;
}

:deep(.profile-select .p-select-dropdown) {
  color: var(--profile-faint);
}

:global(.profile-select-overlay) {
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

:global(.profile-select-list) {
  padding: 0.35rem;
  background: var(--pj-select-card);
}

:global(.profile-select-option) {
  min-height: 2.65rem;
  max-width: 100%;
  border-radius: 0.72rem;
  background: transparent;
  color: var(--pj-select-text);
}

:global(.profile-select-option:hover),
:global(.profile-select-option.p-focus),
:global(.profile-select-option.p-select-option-selected) {
  background: color-mix(in srgb, var(--pj-select-primary) 22%, var(--pj-select-card)) !important;
  color: var(--pj-select-text);
}

:global(.profile-select-option:hover) .profile-select-option-content__line strong,
:global(.profile-select-option.p-focus) .profile-select-option-content__line strong,
:global(.profile-select-option.p-select-option-selected) .profile-select-option-content__line strong {
  color: var(--pj-select-text) !important;
}

:global(.profile-select-option:hover) .profile-select-option-content__line small,
:global(.profile-select-option.p-focus) .profile-select-option-content__line small,
:global(.profile-select-option.p-select-option-selected) .profile-select-option-content__line small {
  color: var(--pj-select-muted) !important;
}

.profile-select-value {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.48rem;
}

.profile-select-value i {
  flex: 0 0 auto;
  color: var(--profile-primary-strong);
  font-size: 0.76rem;
}

.profile-select-value span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-select-option-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 0.2rem 0;
}

.profile-select-option-content__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--pj-select-primary-soft, var(--profile-primary-soft)) 26%, var(--pj-select-card, var(--profile-card)));
  color: var(--pj-select-primary-strong, var(--profile-primary-strong));
}

.profile-select-option-content__icon i {
  font-size: 0.78rem;
}

.profile-select-option-content__line {
  display: block;
  flex: 1 1 auto;
  width: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--pj-select-text, var(--profile-text));
  font-size: 0.84rem;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-select-option-content__line strong {
  color: var(--pj-select-text, var(--profile-text));
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.15;
}

.profile-select-option-content__line small {
  color: var(--pj-select-faint, var(--profile-faint));
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
}

.profile-select-option-content__line small::before {
  content: ' - ';
  color: var(--pj-select-faint, var(--profile-faint));
}

.profile-summary {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}

.profile-summary div {
  display: grid;
  gap: 0.18rem;
  padding: 0.75rem;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--profile-card) 82%, var(--profile-bg));
}

.profile-summary dt,
.profile-summary dd {
  margin: 0;
}

.profile-summary dt {
  color: var(--profile-faint);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.profile-summary dd {
  color: var(--profile-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.profile-pill {
  display: inline-flex;
  width: fit-content;
  min-height: 1.6rem;
  align-items: center;
  padding: 0 0.62rem;
  border-radius: 999px;
  background: var(--profile-success-bg);
  color: var(--profile-success-text);
  font-size: 0.68rem;
  font-weight: 800;
}

.toggle-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  padding: 0.8rem;
  border: 1px solid var(--profile-line);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--profile-card) 82%, var(--profile-bg));
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.toggle-row + .toggle-row {
  margin-top: 0.75rem;
}

.toggle-row strong,
.toggle-row small {
  display: block;
}

.toggle-row strong {
  color: var(--profile-text);
  font-size: 0.84rem;
}

.toggle-row small {
  margin-top: 0.16rem;
  color: var(--profile-muted);
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
  background: color-mix(in srgb, var(--profile-muted) 28%, var(--profile-card));
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
  background: var(--profile-primary);
}

.toggle--active::after {
  transform: translateX(0.95rem);
}

.profile-card__button {
  width: 100%;
}

.profile-state {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
  padding: 3.2rem 1rem;
  border-radius: 1rem;
  text-align: center;
}

.profile-state i {
  color: var(--profile-primary);
  font-size: 1.5rem;
}

.profile-state--error i {
  color: var(--profile-warm-text);
}

.profile-state strong {
  color: var(--profile-text);
}

.profile-state p {
  max-width: 28rem;
  margin: 0;
  color: var(--profile-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.state-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--profile-line);
  border-top-color: var(--profile-primary);
  border-radius: 999px;
  animation: profile-spin 800ms linear infinite;
}

@keyframes profile-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1120px) {
  .profile-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-hero__actions {
    justify-content: flex-start;
  }

  .profile-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .profile-page {
    padding: 1rem;
  }

  .profile-identity {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-form-grid {
    grid-template-columns: 1fr;
  }

  .profile-hero__actions,
  .profile-hero__actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
