<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PartnerFocusCard from '@/components/parceiro/PartnerFocusCard.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'
import { uploadUsuarioFile } from '@/service/upload/upload-service'
import {
  getUsuarioAllInformations,
  type UpdateUsuarioPayload,
  type UsuarioProfile,
  updateUsuario,
} from '@/service/user/user-service'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { formatPhone, stripPhone } from '@/utils/format/phone'
import { formatCpf, isValidCpf, stripCpf } from '@/utils/validation/cpf'

type PageState = 'loading' | 'ready' | 'error'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const { t } = useI18n()
const toast = useToast()
const { store, ensureContext } = useParceiroPortal()
const usuarioPerfilStore = useUsuarioPerfilStore()

const pageState = ref<PageState>('loading')
const loadError = ref('')
const profile = ref<UsuarioProfile | null>(null)
const savingProfile = ref(false)
const uploadingPhoto = ref(false)
const photoInputRef = ref<HTMLInputElement | null>(null)

const nome = ref('')
const telefone = ref('')
const telefoneWhatsApp = ref('')
const cpf = ref('')
const crmv = ref('')
const especialidade = ref('')
const fotoUrl = ref('')

const nomeError = ref('')
const telefoneError = ref('')
const telefoneWhatsAppError = ref('')
const cpfError = ref('')
const crmvError = ref('')
const especialidadeError = ref('')

const sessionUser = computed(() => {
  void authSessionVersion.value
  return getAuthUser()
})

const cpfLocked = computed(() => Boolean(profile.value?.cpf?.trim()))

const showVetSection = computed(
  () => Boolean(sessionUser.value?.veterinarioId) || Boolean(profile.value?.veterinarioPerfil),
)

const initials = computed(() => {
  const source = nome.value.trim() || sessionUser.value?.nome || sessionUser.value?.email || '?'

  return source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const avatarUrl = computed(() => {
  const url = fotoUrl.value.trim() || profile.value?.veterinarioPerfil?.foto?.trim() || ''
  return isValidHttpUrl(url) ? url : ''
})

const roleChips = computed(() => {
  const chips: string[] = []

  if (sessionUser.value?.veterinarioId) {
    chips.push(t('settings.perfil.roles.veterinario'))
  }

  if (store.loadState === 'ready' && store.parceiroNome) {
    chips.push(
      store.isDono
        ? t('settings.perfil.roles.donoParceiro')
        : t('settings.perfil.roles.operadorParceiro'),
    )
  }

  if (sessionUser.value?.isSystemAdmin) {
    chips.push(t('settings.perfil.roles.admin'))
  }

  return chips
})

const partnerContextLabel = computed(() => {
  if (store.loadState !== 'ready' || !store.dashboard) {
    return ''
  }

  const papel = store.isDono
    ? t('settings.perfil.partnerContext.papelDono')
    : t('settings.perfil.partnerContext.papelOperador')

  return t('settings.perfil.partnerContext.template', {
    parceiroNome: store.parceiroNome,
    papel,
  })
})

const photoBusy = computed(() => uploadingPhoto.value || savingProfile.value)

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function applyProfileToForm(data: UsuarioProfile) {
  profile.value = data
  nome.value = data.nome ?? ''
  telefone.value = data.telefone ? formatPhone(data.telefone) : ''
  telefoneWhatsApp.value = data.telefoneWhatsApp ? formatPhone(data.telefoneWhatsApp) : ''
  cpf.value = data.cpf ? formatCpf(data.cpf) : ''
  crmv.value = data.veterinarioPerfil?.crmv ?? ''
  especialidade.value = data.veterinarioPerfil?.especialidade ?? ''
  fotoUrl.value = data.veterinarioPerfil?.foto ?? ''

  syncHeaderProfile(data)
}

function syncHeaderProfile(data: UsuarioProfile) {
  usuarioPerfilStore.applyProfile({
    userId: data.id || sessionUser.value?.userId,
    nome: data.nome || nome.value,
    email: data.email || sessionUser.value?.email || '',
    fotoUrl: data.veterinarioPerfil?.foto || fotoUrl.value || '',
  })
}

function clearProfileErrors() {
  nomeError.value = ''
  telefoneError.value = ''
  telefoneWhatsAppError.value = ''
  cpfError.value = ''
  crmvError.value = ''
  especialidadeError.value = ''
}

function onTelefoneInput(value: string) {
  telefone.value = formatPhone(value)
}

function onWhatsAppInput(value: string) {
  telefoneWhatsApp.value = formatPhone(value)
}

function onCpfInput(value: string) {
  if (cpfLocked.value) {
    return
  }

  cpf.value = formatCpf(value)
}

function validateProfileForm() {
  clearProfileErrors()

  if (nome.value.trim().length < 3) {
    nomeError.value = t('settings.perfil.errors.nomeMin')
  }

  const phoneDigits = stripPhone(telefone.value)
  if (phoneDigits && phoneDigits.length < 10) {
    telefoneError.value = t('settings.perfil.errors.telefone')
  }

  const whatsDigits = stripPhone(telefoneWhatsApp.value)
  if (whatsDigits && whatsDigits.length < 10) {
    telefoneWhatsAppError.value = t('settings.perfil.errors.whatsapp')
  }

  if (!cpfLocked.value) {
    const cpfDigits = stripCpf(cpf.value)
    if (cpfDigits && !isValidCpf(cpfDigits)) {
      cpfError.value = t('settings.perfil.errors.cpf')
    }
  }

  if (showVetSection.value) {
    if (!crmv.value.trim()) {
      crmvError.value = t('settings.perfil.errors.crmvRequired')
    }

    if (!especialidade.value.trim()) {
      especialidadeError.value = t('settings.perfil.errors.especialidadeRequired')
    }
  }

  return (
    !nomeError.value &&
    !telefoneError.value &&
    !telefoneWhatsAppError.value &&
    !cpfError.value &&
    !crmvError.value &&
    !especialidadeError.value
  )
}

function buildUpdatePayload(extraFoto?: string): UpdateUsuarioPayload {
  const payload: UpdateUsuarioPayload = {
    nome: nome.value.trim(),
  }

  const phoneDigits = stripPhone(telefone.value)
  payload.telefone = phoneDigits || undefined

  const whatsDigits = stripPhone(telefoneWhatsApp.value)
  payload.telefoneWhatsApp = whatsDigits || undefined

  if (!cpfLocked.value) {
    const cpfDigits = stripCpf(cpf.value)
    if (cpfDigits) {
      payload.cpf = cpfDigits
    }
  }

  const trimmedFoto = (extraFoto ?? fotoUrl.value).trim()

  if (showVetSection.value || (trimmedFoto && sessionUser.value?.veterinarioId)) {
    payload.veterinario = {}

    const crmvValue = crmv.value.trim() || profile.value?.veterinarioPerfil?.crmv || ''
    const especialidadeValue =
      especialidade.value.trim() || profile.value?.veterinarioPerfil?.especialidade || ''

    if (crmvValue) {
      payload.veterinario.crmv = crmvValue
    }

    if (especialidadeValue) {
      payload.veterinario.especialidade = especialidadeValue
    }

    if (trimmedFoto) {
      payload.veterinario.foto = trimmedFoto
    }
  }

  return payload
}

async function loadProfile() {
  const user = sessionUser.value

  if (!user?.userId) {
    pageState.value = 'error'
    loadError.value = t('settings.perfil.errors.sessionUnavailable')
    return
  }

  pageState.value = 'loading'
  loadError.value = ''

  try {
    const data = await getUsuarioAllInformations(user.userId)
    applyProfileToForm({
      ...data,
      email: data.email || user.email,
      nome: data.nome || user.nome,
    })
    pageState.value = 'ready'
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      applyProfileToForm({
        id: user.userId,
        email: user.email,
        nome: user.nome,
      })
      pageState.value = 'ready'
      toast.add({
        severity: 'warn',
        summary: t('settings.perfil.toasts.partial.summary'),
        detail: t('settings.perfil.toasts.partial.detail'),
        life: 5000,
      })
      return
    }

    pageState.value = 'error'
    loadError.value =
      error instanceof Error ? error.message : t('settings.perfil.errors.loadFailed')
  }
}

async function handleSaveProfile() {
  const user = sessionUser.value

  if (!user?.userId || !validateProfileForm()) {
    return
  }

  savingProfile.value = true

  try {
    const updated = await updateUsuario(user.userId, buildUpdatePayload())
    applyProfileToForm({
      ...updated,
      email: updated.email || user.email,
      nome: updated.nome || nome.value.trim(),
    })
    toast.add({
      severity: 'success',
      summary: t('settings.perfil.toasts.saved.summary'),
      detail: t('settings.perfil.toasts.saved.detail'),
      life: 3500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('settings.perfil.toasts.saveError.summary'),
      detail:
        error instanceof Error
          ? error.message
          : t('settings.perfil.toasts.saveError.detailFallback'),
      life: 5000,
    })
  } finally {
    savingProfile.value = false
  }
}

function openPhotoPicker() {
  if (photoBusy.value) {
    return
  }

  photoInputRef.value?.click()
}

function validatePhotoFile(file: File) {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return t('settings.perfil.photo.errors.invalidType')
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return t('settings.perfil.photo.errors.maxSize')
  }

  return ''
}

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) {
    return
  }

  const validationError = validatePhotoFile(file)
  if (validationError) {
    toast.add({
      severity: 'warn',
      summary: t('settings.perfil.toasts.invalidFile.summary'),
      detail: validationError,
      life: 4000,
    })
    return
  }

  const user = sessionUser.value
  if (!user?.userId) {
    return
  }

  uploadingPhoto.value = true

  try {
    const uploadedUrl = await uploadUsuarioFile(file)
    fotoUrl.value = uploadedUrl

    const updated = await updateUsuario(user.userId, buildUpdatePayload(uploadedUrl))
    applyProfileToForm({
      ...updated,
      email: updated.email || user.email,
      nome: updated.nome || nome.value.trim(),
      veterinarioPerfil: {
        ...updated.veterinarioPerfil,
        foto: updated.veterinarioPerfil?.foto || uploadedUrl,
      },
    })

    toast.add({
      severity: 'success',
      summary: t('settings.perfil.toasts.photoOk.summary'),
      detail: t('settings.perfil.toasts.photoOk.detail'),
      life: 3500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('settings.perfil.toasts.photoError.summary'),
      detail:
        error instanceof Error
          ? error.message
          : t('settings.perfil.toasts.photoError.detailFallback'),
      life: 5000,
    })
  } finally {
    uploadingPhoto.value = false
  }
}

onMounted(() => {
  void ensureContext().catch(() => undefined)
  void loadProfile()
})
</script>

<template>
  <div v-if="pageState === 'loading'" class="settings-perfil" aria-hidden="true">
    <PartnerFocusCard class="settings-perfil__hero settings-perfil__hero--skel">
      <div class="settings-perfil__hero-row">
        <Skeleton shape="circle" width="4rem" height="4rem" />
        <div>
          <Skeleton width="14rem" height="1.25rem" border-radius="6px" />
          <Skeleton width="11rem" height="0.85rem" border-radius="4px" class="settings-perfil__gap" />
        </div>
      </div>
    </PartnerFocusCard>
    <div class="settings-perfil__panel">
      <Skeleton height="8rem" border-radius="0.9rem" />
      <Skeleton height="8rem" border-radius="0.9rem" />
    </div>
  </div>

  <div v-else-if="pageState === 'error'" class="settings-perfil__error" role="alert">
    <i class="pi pi-exclamation-circle" aria-hidden="true" />
    <div>
      <strong>{{ t('settings.perfil.errors.loadTitle') }}</strong>
      <p>{{ loadError }}</p>
    </div>
    <Button
      :label="t('settings.perfil.actions.retry')"
      severity="secondary"
      @click="loadProfile"
    />
  </div>

  <div v-else-if="sessionUser" class="settings-perfil">
    <PartnerFocusCard class="settings-perfil__hero">
      <div class="settings-perfil__hero-row">
        <button
          type="button"
          class="settings-perfil__avatar"
          :class="{ 'settings-perfil__avatar--busy': uploadingPhoto }"
          :disabled="photoBusy"
          :aria-label="
            uploadingPhoto
              ? t('settings.perfil.aria.uploadingPhoto')
              : t('settings.perfil.aria.changePhoto')
          "
          @click="openPhotoPicker"
        >
          <span class="settings-perfil__avatar-media">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" />
            <span v-else>{{ initials }}</span>
            <span
              v-if="!uploadingPhoto"
              class="settings-perfil__avatar-overlay"
              aria-hidden="true"
            >
              <i class="pi pi-camera" />
            </span>
            <span
              v-else
              class="settings-perfil__avatar-overlay settings-perfil__avatar-overlay--busy"
              aria-hidden="true"
            />
          </span>
          <span class="settings-perfil__avatar-badge" aria-hidden="true">
            <i :class="uploadingPhoto ? 'pi pi-spin pi-spinner' : 'pi pi-pencil'" />
          </span>
        </button>

        <input
          ref="photoInputRef"
          class="settings-perfil__file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          :disabled="photoBusy"
          @change="onPhotoSelected"
        />

        <div class="settings-perfil__identity">
          <h2>{{ nome.trim() || sessionUser.nome || t('settings.perfil.fallbackName') }}</h2>
          <p>{{ sessionUser.email }}</p>
          <p class="settings-perfil__photo-hint">{{ t('settings.perfil.photoHint') }}</p>
          <p v-if="partnerContextLabel" class="settings-perfil__meta">
            <i class="pi pi-building" aria-hidden="true" />
            {{ partnerContextLabel }}
          </p>
        </div>

        <ul
          v-if="roleChips.length"
          class="settings-perfil__roles"
          :aria-label="t('settings.perfil.aria.roles')"
        >
          <li v-for="chip in roleChips" :key="chip">{{ chip }}</li>
        </ul>
      </div>
    </PartnerFocusCard>

    <form class="settings-perfil__panel" @submit.prevent="handleSaveProfile">
      <div class="settings-perfil__groups">
        <fieldset class="settings-perfil__group">
          <legend>{{ t('settings.perfil.sections.identidade') }}</legend>
          <div class="settings-perfil__fields">
            <AuthTextField
              id="settings-perfil-nome"
              v-model="nome"
              autocomplete="name"
              :label="t('settings.perfil.fields.nome.label')"
              :placeholder="t('settings.perfil.fields.nome.placeholder')"
              required
              :disabled="savingProfile"
              :error="nomeError"
            />
            <AuthTextField
              id="settings-perfil-email"
              :model-value="sessionUser.email"
              autocomplete="email"
              :label="t('settings.perfil.fields.email.label')"
              :hint="t('settings.perfil.fields.email.hint')"
              disabled
            />
          </div>
        </fieldset>

        <fieldset class="settings-perfil__group">
          <legend>{{ t('settings.perfil.sections.contato') }}</legend>
          <div class="settings-perfil__fields settings-perfil__fields--2">
            <AuthTextField
              id="settings-perfil-telefone"
              :model-value="telefone"
              autocomplete="tel"
              inputmode="tel"
              :label="t('settings.perfil.fields.telefone.label')"
              :placeholder="t('settings.perfil.fields.telefone.placeholder')"
              :disabled="savingProfile"
              :error="telefoneError"
              @update:model-value="onTelefoneInput"
            />
            <AuthTextField
              id="settings-perfil-whatsapp"
              :model-value="telefoneWhatsApp"
              autocomplete="tel"
              inputmode="tel"
              :label="t('settings.perfil.fields.whatsapp.label')"
              :placeholder="t('settings.perfil.fields.whatsapp.placeholder')"
              :disabled="savingProfile"
              :error="telefoneWhatsAppError"
              @update:model-value="onWhatsAppInput"
            />
          </div>
        </fieldset>

        <fieldset class="settings-perfil__group">
          <legend>{{ t('settings.perfil.sections.documento') }}</legend>
          <div class="settings-perfil__fields">
            <AuthTextField
              id="settings-perfil-cpf"
              :model-value="cpf"
              inputmode="numeric"
              :label="t('settings.perfil.fields.cpf.label')"
              :placeholder="t('settings.perfil.fields.cpf.placeholder')"
              :disabled="savingProfile || cpfLocked"
              :hint="
                cpfLocked
                  ? t('settings.perfil.fields.cpf.hintLocked')
                  : t('settings.perfil.fields.cpf.hintOptional')
              "
              :error="cpfError"
              @update:model-value="onCpfInput"
            />
          </div>
        </fieldset>

        <fieldset v-if="showVetSection" class="settings-perfil__group">
          <legend>{{ t('settings.perfil.sections.vet') }}</legend>
          <div class="settings-perfil__fields settings-perfil__fields--2">
            <AuthTextField
              id="settings-perfil-crmv"
              v-model="crmv"
              :label="t('settings.perfil.fields.crmv.label')"
              :placeholder="t('settings.perfil.fields.crmv.placeholder')"
              required
              :disabled="savingProfile"
              :error="crmvError"
            />
            <AuthTextField
              id="settings-perfil-especialidade"
              v-model="especialidade"
              :label="t('settings.perfil.fields.especialidade.label')"
              :placeholder="t('settings.perfil.fields.especialidade.placeholder')"
              required
              :disabled="savingProfile"
              :error="especialidadeError"
            />
          </div>
        </fieldset>
      </div>

      <footer class="settings-perfil__foot">
        <Button
          type="submit"
          :label="t('settings.perfil.actions.save')"
          icon="pi pi-check"
          :loading="savingProfile"
          :disabled="uploadingPhoto"
        />
      </footer>
    </form>
  </div>
</template>

<style scoped>
.settings-perfil {
  display: grid;
  gap: 1.15rem;
  width: 100%;
}

.settings-perfil__hero-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.35rem;
}

.settings-perfil__avatar {
  position: relative;
  display: grid;
  flex-shrink: 0;
  width: 6.5rem;
  height: 6.5rem;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--pf-on);
  cursor: pointer;
  padding: 0;
}

.settings-perfil__avatar-media {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--pf-chip);
  font-size: 1.65rem;
  font-weight: 700;
  box-shadow: 0 0 0 3px rgb(var(--pf-glow-rgb) / 0.28);
}

.settings-perfil__avatar-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.settings-perfil__avatar-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(15 23 20 / 0.42);
  color: var(--pf-on);
  opacity: 0;
  transition: opacity 160ms ease;
  font-size: 1.2rem;
}

.settings-perfil__avatar-badge {
  position: absolute;
  right: 0.05rem;
  bottom: 0.05rem;
  z-index: 2;
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 2px solid var(--pf-on);
  border-radius: 999px;
  background: var(--pf-cta-bg, var(--pf-on));
  color: var(--pf-cta-text, var(--pf-from));
  box-shadow: 0 6px 16px rgb(var(--pf-shadow-rgb) / 0.22);
  font-size: 0.78rem;
}

.settings-perfil__avatar:hover .settings-perfil__avatar-overlay,
.settings-perfil__avatar:focus-visible .settings-perfil__avatar-overlay,
.settings-perfil__avatar-overlay--busy {
  opacity: 1;
}

.settings-perfil__avatar:focus-visible {
  outline: 2px solid var(--pf-on);
  outline-offset: 4px;
  border-radius: 999px;
}

.settings-perfil__avatar:disabled {
  cursor: wait;
}

.settings-perfil__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.settings-perfil__identity {
  display: grid;
  flex: 1 1 14rem;
  gap: 0.2rem;
  min-width: 0;
}

.settings-perfil__identity h2 {
  margin: 0;
  font-size: clamp(1.25rem, 2vw, 1.55rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--pf-on);
}

.settings-perfil__identity p {
  margin: 0;
  color: var(--pf-on-soft);
  font-size: 0.9rem;
  word-break: break-word;
}

.settings-perfil__photo-hint {
  margin-top: 0.1rem !important;
  font-size: 0.78rem !important;
  opacity: 0.9;
}

.settings-perfil__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.15rem !important;
  font-size: 0.82rem !important;
}

.settings-perfil__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0 0 0 auto;
  padding: 0;
  list-style: none;
}

.settings-perfil__roles li {
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  background: var(--pf-chip);
  color: var(--pf-on);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.settings-perfil__panel {
  display: grid;
  gap: 1.15rem;
  width: 100%;
  padding: 1.25rem 1.35rem 1.3rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  box-shadow: 0 12px 28px rgb(var(--partner-shadow-rgb) / 0.04);
}

.settings-perfil__groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.15rem 1.35rem;
}

.settings-perfil__group {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.settings-perfil__group legend {
  float: left;
  width: 100%;
  margin: 0 0 0.1rem;
  padding: 0;
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.settings-perfil__group legend + * {
  clear: both;
}

.settings-perfil__fields {
  display: grid;
  gap: 0.75rem;
}

.settings-perfil__fields--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-perfil__foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.35rem;
  border-top: 1px solid var(--partner-line);
}

.settings-perfil__error {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  padding: 1.25rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.settings-perfil__error i {
  color: var(--partner-warm-text);
  font-size: 1.25rem;
}

.settings-perfil__error p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
}

.settings-perfil__gap {
  margin-top: 0.5rem;
}

.settings-perfil__hero--skel :deep(.p-skeleton) {
  background: rgb(var(--pf-glow-rgb) / 0.22);
}

@media (max-width: 960px) {
  .settings-perfil__groups {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .settings-perfil__roles {
    margin-left: 0;
    width: 100%;
  }

  .settings-perfil__fields--2 {
    grid-template-columns: 1fr;
  }

  .settings-perfil__foot {
    justify-content: stretch;
  }

  .settings-perfil__foot :deep(.p-button) {
    width: 100%;
  }
}
</style>
