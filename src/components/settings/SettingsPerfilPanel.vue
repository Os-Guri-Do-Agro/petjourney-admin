<script setup lang="ts">
/**
 * Configurações → Perfil.
 *
 * Em cima, a capa: a foto grande — clicar nela ou em "Trocar foto" abre a escolha do arquivo, e a
 * foto nova sobe e já fica salva —, o nome, o e-mail, os papéis e a empresa. Embaixo, os dados em
 * quatro seções (identidade, contato, documento, perfil veterinário) e o "Salvar perfil" no
 * rodapé da folha.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthTextField from '@/components/auth/AuthTextField.vue'
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

import './configuracoes.css'

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

const hasVetPerfil = computed(
  () => Boolean(sessionUser.value?.veterinarioId) || Boolean(profile.value?.veterinarioPerfil),
)

/** CRMV/especialidade são opcionais no produto: preencher um exige o par (cria o perfil clínico). */
const vetFieldsFilled = computed(() => Boolean(crmv.value.trim() || especialidade.value.trim()))

const vetFieldsRequired = computed(() => hasVetPerfil.value || vetFieldsFilled.value)

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

/** A empresa em que se entrou, embaixo do nome. O papel já está nos selos ao lado. */
const empresa = computed(() =>
  store.loadState === 'ready' && store.dashboard ? store.parceiroNome : '',
)

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

  if (vetFieldsRequired.value) {
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

  if (hasVetPerfil.value || vetFieldsFilled.value || (trimmedFoto && sessionUser.value?.veterinarioId)) {
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
  <div v-if="pageState === 'loading'" class="ui-folha cfg-folha" aria-hidden="true">
    <div class="perfil__capa">
      <Skeleton shape="circle" size="7rem" />
      <div class="perfil__esqueleto">
        <Skeleton width="14rem" height="1.4rem" border-radius="6px" />
        <Skeleton width="11rem" height="1rem" border-radius="6px" />
        <Skeleton width="8rem" height="2.5rem" border-radius="10px" />
      </div>
    </div>
    <div class="cfg-secao">
      <Skeleton width="8rem" height="1rem" border-radius="6px" />
      <Skeleton height="6rem" border-radius="12px" />
    </div>
  </div>

  <div v-else-if="pageState === 'error'" class="ui-folha cfg-folha cfg-estado" role="alert">
    <span class="cfg-estado__icone" aria-hidden="true"><i class="ph ph-warning-circle" /></span>
    <h2>{{ t('settings.perfil.errors.loadTitle') }}</h2>
    <p>{{ loadError }}</p>
    <Button
      icon="ph ph-arrow-clockwise"
      :label="t('settings.perfil.actions.retry')"
      severity="secondary"
      outlined
      @click="loadProfile"
    />
  </div>

  <form
    v-else-if="sessionUser"
    class="ui-folha cfg-folha perfil"
    novalidate
    @submit.prevent="handleSaveProfile"
  >
    <!-- A capa: a foto grande, fácil de trocar, e quem é. -->
    <section class="perfil__capa" :aria-label="t('settings.perfil.capaAria')">
      <button
        type="button"
        class="perfil__foto"
        :class="{ 'perfil__foto--enviando': uploadingPhoto }"
        :disabled="photoBusy"
        :aria-label="
          uploadingPhoto
            ? t('settings.perfil.aria.uploadingPhoto')
            : t('settings.perfil.aria.changePhoto')
        "
        @click="openPhotoPicker"
      >
        <img v-if="avatarUrl" :src="avatarUrl" alt="" />
        <span v-else class="perfil__iniciais">{{ initials }}</span>
        <span class="perfil__foto-veu" aria-hidden="true">
          <i :class="uploadingPhoto ? 'ph ph-circle-notch ph-spin' : 'ph ph-camera'" />
        </span>
      </button>

      <!--
        Segue nativo e escondido: a foto e o botão são os gatilhos. O `FileUpload` do PrimeVue traz
        o próprio botão e área de soltar, e seria um terceiro controle para a mesma coisa.
      -->
      <input
        ref="photoInputRef"
        class="perfil__arquivo"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        tabindex="-1"
        aria-hidden="true"
        :disabled="photoBusy"
        @change="onPhotoSelected"
      />

      <div class="perfil__quem">
        <h2 class="perfil__nome">
          {{ nome.trim() || sessionUser.nome || t('settings.perfil.fallbackName') }}
        </h2>
        <p class="perfil__email">{{ sessionUser.email }}</p>

        <ul v-if="roleChips.length || empresa" class="perfil__papeis">
          <li v-if="empresa" class="perfil__empresa">
            <i class="ph ph-buildings" aria-hidden="true" />
            {{ empresa }}
          </li>
          <li v-for="chip in roleChips" :key="chip" class="ui-selo ui-selo--contorno">
            {{ chip }}
          </li>
        </ul>

        <div class="perfil__trocar">
          <Button
            type="button"
            icon="ph ph-camera"
            :label="avatarUrl ? t('settings.perfil.foto.trocar') : t('settings.perfil.foto.escolher')"
            severity="secondary"
            outlined
            :loading="uploadingPhoto"
            :disabled="photoBusy"
            @click="openPhotoPicker"
          />
          <span class="perfil__formatos">{{ t('settings.perfil.foto.formatos') }}</span>
        </div>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="perfil-secao-identidade">
      <header class="cfg-secao__cabeca">
        <h3 id="perfil-secao-identidade" class="cfg-secao__titulo">
          {{ t('settings.perfil.sections.identidade') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.perfil.secoes.identidade') }}</p>
      </header>
      <div class="cfg-secao__corpo">
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
        >
          <template #trailing>
            <i class="ph ph-lock-simple perfil__cadeado" aria-hidden="true" />
          </template>
        </AuthTextField>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="perfil-secao-contato">
      <header class="cfg-secao__cabeca">
        <h3 id="perfil-secao-contato" class="cfg-secao__titulo">
          {{ t('settings.perfil.sections.contato') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.perfil.secoes.contato') }}</p>
      </header>
      <div class="cfg-secao__corpo cfg-grade">
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
    </section>

    <section class="cfg-secao" aria-labelledby="perfil-secao-documento">
      <header class="cfg-secao__cabeca">
        <h3 id="perfil-secao-documento" class="cfg-secao__titulo">
          {{ t('settings.perfil.sections.documento') }}
        </h3>
      </header>
      <div class="cfg-secao__corpo cfg-grade">
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
    </section>

    <section class="cfg-secao" aria-labelledby="perfil-secao-vet">
      <header class="cfg-secao__cabeca">
        <h3 id="perfil-secao-vet" class="cfg-secao__titulo">
          {{ t('settings.perfil.sections.vet') }}
        </h3>
        <p v-if="!hasVetPerfil" class="cfg-secao__descricao">
          {{ t('settings.perfil.sections.vetOptionalHint') }}
        </p>
      </header>
      <div class="cfg-secao__corpo cfg-grade">
        <AuthTextField
          id="settings-perfil-crmv"
          v-model="crmv"
          :label="t('settings.perfil.fields.crmv.label')"
          :placeholder="t('settings.perfil.fields.crmv.placeholder')"
          :required="vetFieldsRequired"
          :disabled="savingProfile"
          :error="crmvError"
        />
        <AuthTextField
          id="settings-perfil-especialidade"
          v-model="especialidade"
          :label="t('settings.perfil.fields.especialidade.label')"
          :placeholder="t('settings.perfil.fields.especialidade.placeholder')"
          :required="vetFieldsRequired"
          :disabled="savingProfile"
          :error="especialidadeError"
        />
      </div>
    </section>

    <footer class="cfg-rodape">
      <Button
        type="submit"
        :label="t('settings.perfil.actions.save')"
        icon="ph ph-check"
        :loading="savingProfile"
        :disabled="uploadingPhoto"
      />
    </footer>
  </form>
</template>

<style scoped>
.perfil__capa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px 28px;
  padding: 28px;
  border-bottom: 1px solid var(--linha);
}

.perfil__esqueleto {
  display: grid;
  gap: 10px;
}

/* A foto: 112 px, o alvo maior da tela. No hover e no foco, o véu com a câmera diz o que faz. */
.perfil__foto {
  position: relative;
  display: grid;
  width: 112px;
  height: 112px;
  flex: none;
  place-items: center;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--musgo-fundo);
  box-shadow:
    0 0 0 4px var(--superficie),
    0 0 0 5px var(--linha);
  color: var(--musgo);
  cursor: pointer;
}

.perfil__foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.perfil__iniciais {
  font-family: var(--font-dados);
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.perfil__foto-veu {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in oklab, var(--rail) 55%, transparent);
  color: var(--sobre-rail);
  font-size: 28px;
  opacity: 0;
  transition: opacity var(--pj-tempo-curto) var(--pj-curva-chega);
}

.perfil__foto:hover .perfil__foto-veu,
.perfil__foto:focus-visible .perfil__foto-veu,
.perfil__foto--enviando .perfil__foto-veu {
  opacity: 1;
}

.perfil__foto:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 6px;
}

.perfil__foto:disabled {
  cursor: wait;
}

.perfil__arquivo {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.perfil__quem {
  display: grid;
  min-width: 0;
  flex: 1 1 18rem;
  justify-items: start;
  gap: 4px;
}

.perfil__nome {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.perfil__email {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  word-break: break-word;
}

.perfil__papeis {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.perfil__empresa {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.perfil__empresa i {
  color: var(--tinta-2);
  font-size: 16px;
}

.perfil__trocar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-top: 14px;
}

.perfil__trocar :deep(.p-button) {
  min-height: 40px;
}

.perfil__formatos {
  color: var(--tinta-2);
  font-size: 13px;
}

.perfil__cadeado {
  padding-inline-end: 10px;
  color: var(--tinta-3);
  font-size: 17px;
}

@media (max-width: 600px) {
  .perfil__capa {
    flex-direction: column;
    align-items: flex-start;
    padding: 24px 20px;
  }

  .perfil__foto {
    width: 96px;
    height: 96px;
  }

  /* Em coluna, a base de 18 rem viraria altura e espalharia as linhas. */
  .perfil__quem {
    flex: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .perfil__foto-veu {
    transition: none;
  }
}
</style>
