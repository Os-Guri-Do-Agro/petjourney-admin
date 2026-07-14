<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/service/api'
import { authSessionVersion, clearAuthSession, getAuthUser } from '@/service/auth/auth-session'
import {
  getUsersMeInactiveReasons,
  type InactiveReason,
  postUsersMeInactivate,
} from '@/service/user/inativacao-service'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { currentColors } from '@/theme/color-mode'

const router = useRouter()
const store = useParceiroStore()
const usuarioPerfilStore = useUsuarioPerfilStore()
const toast = useToast()

const dialogVisible = ref(false)
const loadingReasons = ref(false)
const submitting = ref(false)
const reasons = ref<InactiveReason[]>([])
const selectedReasonId = ref<string | null>(null)
const customReason = ref('')
const reasonsError = ref('')
const customReasonError = ref('')

const sessionUser = computed(() => {
  void authSessionVersion.value
  return getAuthUser()
})

const displayName = computed(
  () => usuarioPerfilStore.displayName || sessionUser.value?.nome?.trim() || 'Usuário',
)

const initials = computed(() => usuarioPerfilStore.initials)

const avatarUrl = computed(() => usuarioPerfilStore.avatarUrl)

const sessionEmail = computed(
  () => usuarioPerfilStore.email || sessionUser.value?.email || '',
)

const partnerLabel = computed(() => {
  if (store.loadState !== 'ready' || !store.dashboard) {
    return ''
  }

  const papel = store.isDono ? 'DONO' : store.papel ?? 'OPERADOR'
  return `${store.parceiroNome} · ${papel}`
})

const roleHints = computed(() => {
  const hints: string[] = []
  if (sessionUser.value?.veterinarioId) {
    hints.push('Veterinário')
  }
  if (store.loadState === 'ready' && store.parceiroNome) {
    hints.push(store.isDono ? 'Dono' : 'Operador')
  }
  if (sessionUser.value?.isSystemAdmin) {
    hints.push('Admin')
  }
  return hints
})

const selectedReason = computed(
  () => reasons.value.find((item) => item.id === selectedReasonId.value) ?? null,
)

const showCustomReason = computed(() => Boolean(selectedReason.value?.isCustomAllowed))

const dialogStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--inativ-bg': colors.dashboard.surface,
    '--inativ-text': colors.dashboard.text,
    '--inativ-muted': colors.dashboard.muted,
    '--inativ-line': colors.dashboard.line,
    '--inativ-warm-bg': colors.dashboard.warmBg,
    '--inativ-warm-text': colors.dashboard.warmText,
    '--inativ-faint': colors.dashboard.faint,
    '--inativ-shadow-rgb': colors.auth.shadowRgb,
  }
})

const deactivatePoints = [
  {
    id: 'soft',
    icon: 'pi pi-replay',
    title: 'Reversível',
    text: 'Os dados da conta permanecem. Você reativa no próximo login.',
  },
  {
    id: 'scope',
    icon: 'pi pi-shield',
    title: 'Só o perfil',
    text: 'Não apaga clínica, parceiro nem histórico — só pausa o perfil ativo.',
  },
  {
    id: 'not-delete',
    icon: 'pi pi-ban',
    title: 'Não é exclusão',
    text: 'Encerramento permanente (LGPD) é outro fluxo e não aparece aqui.',
  },
] as const

function handleLogout() {
  store.reset()
  usuarioPerfilStore.clear()
  clearAuthSession()
  void router.push('/auth/login')
}

async function openInactivateDialog() {
  dialogVisible.value = true
  reasonsError.value = ''
  customReasonError.value = ''
  customReason.value = ''
  selectedReasonId.value = null

  if (reasons.value.length > 0) {
    return
  }

  loadingReasons.value = true

  try {
    reasons.value = await getUsersMeInactiveReasons()
    if (reasons.value.length === 0) {
      reasonsError.value = 'Nenhum motivo disponível no momento. Tente novamente mais tarde.'
    }
  } catch (error) {
    reasonsError.value =
      error instanceof Error ? error.message : 'Não foi possível carregar os motivos.'
  } finally {
    loadingReasons.value = false
  }
}

function closeInactivateDialog() {
  if (submitting.value) {
    return
  }

  dialogVisible.value = false
}

function validateInactivate() {
  reasonsError.value = ''
  customReasonError.value = ''

  if (!selectedReasonId.value) {
    reasonsError.value = 'Selecione um motivo para continuar.'
    return false
  }

  if (showCustomReason.value && customReason.value.trim().length < 3) {
    customReasonError.value = 'Descreva o motivo com pelo menos 3 caracteres.'
    return false
  }

  return true
}

async function handleInactivate() {
  if (!validateInactivate() || !selectedReasonId.value) {
    return
  }

  submitting.value = true

  try {
    await postUsersMeInactivate({
      reasonId: selectedReasonId.value,
      customReason: showCustomReason.value ? customReason.value.trim() : undefined,
    })

    clearAuthSession()
    usuarioPerfilStore.clear()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Perfil desativado',
      detail: 'Sua sessão foi encerrada. Você pode reativar o perfil no próximo login.',
      life: 5000,
    })
    await router.replace('/auth/login')
  } catch (error) {
    const detail =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Não foi possível desativar o perfil.'

    toast.add({
      severity: 'error',
      summary: 'Falha ao desativar',
      detail,
      life: 5000,
    })
  } finally {
    submitting.value = false
  }
}

watch(showCustomReason, (allowed) => {
  if (!allowed) {
    customReason.value = ''
    customReasonError.value = ''
  }
})
</script>

<template>
  <div class="conta">
    <section class="conta-session" aria-labelledby="conta-session-title">
      <div class="conta-session__identity">
        <span class="conta-session__avatar" aria-hidden="true">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" />
          <template v-else>{{ initials }}</template>
        </span>
        <div class="conta-session__copy">
          <p class="conta-session__eyebrow">Sessão neste dispositivo</p>
          <h2 id="conta-session-title">{{ displayName }}</h2>
          <p class="conta-session__email">{{ sessionEmail }}</p>
          <p v-if="partnerLabel" class="conta-session__meta">
            <i class="pi pi-building" aria-hidden="true" />
            {{ partnerLabel }}
          </p>
        </div>
      </div>

      <div class="conta-session__aside">
        <ul v-if="roleHints.length" class="conta-session__roles" aria-label="Papéis">
          <li v-for="role in roleHints" :key="role">{{ role }}</li>
        </ul>
        <Button
          class="conta-session__logout"
          label="Sair da conta"
          severity="danger"
          outlined
          type="button"
          icon="pi pi-sign-out"
          @click="handleLogout"
        />
      </div>
    </section>

    <div class="conta-split">
      <article class="conta-panel">
        <header class="conta-panel__head">
          <span class="conta-panel__icon" aria-hidden="true">
            <i class="pi pi-desktop" />
          </span>
          <div>
            <h3>Dispositivo</h3>
            <p>Encerrar só remove o acesso neste computador.</p>
          </div>
        </header>
        <p class="conta-panel__body">
          O token fica limpo neste browser. Seus dados e o perfil na nuvem continuam intactos.
        </p>
      </article>

      <article class="conta-panel conta-panel--muted">
        <header class="conta-panel__head">
          <span class="conta-panel__icon conta-panel__icon--muted" aria-hidden="true">
            <i class="pi pi-sliders-h" />
          </span>
          <div>
            <h3>Preferências avançadas</h3>
            <p>Empresa, equipe e integrações.</p>
          </div>
        </header>
        <p class="conta-panel__body">
          Ainda não liberadas neste go-live. Quando chegarem, entram nesta seção.
        </p>
      </article>
    </div>

    <section class="conta-risk" aria-labelledby="conta-risk-title">
      <header class="conta-risk__head">
        <div>
          <p class="conta-risk__eyebrow">Zona sensível</p>
          <h3 id="conta-risk-title">Desativar perfil</h3>
          <p>Pausa reversível do perfil — diferente de sair do dispositivo ou excluir a conta.</p>
        </div>
        <Button
          label="Desativar perfil"
          severity="danger"
          type="button"
          icon="pi pi-user-minus"
          @click="openInactivateDialog"
        />
      </header>

      <ul class="conta-risk__points">
        <li v-for="point in deactivatePoints" :key="point.id">
          <span class="conta-risk__point-icon" aria-hidden="true">
            <i :class="point.icon" />
          </span>
          <div>
            <strong>{{ point.title }}</strong>
            <p>{{ point.text }}</p>
          </div>
        </li>
      </ul>
    </section>
  </div>

  <Dialog
    v-model:visible="dialogVisible"
    modal
    :draggable="false"
    :dismissable-mask="!submitting"
    :closable="!submitting"
    class="inativ-dialog"
    header="Desativar perfil"
    @hide="closeInactivateDialog"
  >
    <div class="inativ-dialog__body" :style="dialogStyle">
      <p class="inativ-dialog__lede">
        Escolha o motivo da pausa. Depois confirmaremos e encerraremos esta sessão.
      </p>

      <div v-if="loadingReasons" class="inativ-dialog__loading" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        Carregando motivos…
      </div>

      <template v-else>
        <label class="inativ-dialog__label" for="inativ-motivo">Motivo</label>
        <Select
          id="inativ-motivo"
          v-model="selectedReasonId"
          :options="reasons"
          option-label="label"
          option-value="id"
          placeholder="Selecione um motivo"
          class="inativ-dialog__select"
          :disabled="submitting || reasons.length === 0"
        />
        <p v-if="selectedReason?.description" class="inativ-dialog__hint">
          {{ selectedReason.description }}
        </p>
        <p v-if="reasonsError" class="inativ-dialog__error" role="alert">{{ reasonsError }}</p>

        <div v-if="showCustomReason" class="inativ-dialog__custom">
          <label class="inativ-dialog__label" for="inativ-custom">Conte mais (obrigatório)</label>
          <Textarea
            id="inativ-custom"
            v-model="customReason"
            rows="3"
            auto-resize
            class="inativ-dialog__textarea"
            placeholder="Descreva o motivo"
            :disabled="submitting"
          />
          <p v-if="customReasonError" class="inativ-dialog__error" role="alert">
            {{ customReasonError }}
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <Button
        label="Cancelar"
        severity="secondary"
        text
        type="button"
        :disabled="submitting"
        @click="closeInactivateDialog"
      />
      <Button
        label="Confirmar desativação"
        severity="danger"
        type="button"
        icon="pi pi-user-minus"
        :loading="submitting"
        :disabled="loadingReasons || reasons.length === 0"
        @click="handleInactivate"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.conta {
  display: grid;
  gap: 1.15rem;
  width: 100%;
}

.conta-session {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.15rem 1.5rem;
  padding: 1.2rem 1.35rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.15rem;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--partner-primary-soft) 22%, var(--partner-card)),
      var(--partner-card) 55%
    );
  box-shadow: 0 12px 28px rgb(var(--partner-shadow-rgb) / 0.04);
}

.conta-session__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.conta-session__avatar {
  display: grid;
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.5rem;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 22%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 1.05rem;
  font-weight: 700;
}

.conta-session__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conta-session__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.conta-session__eyebrow {
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.conta-session__copy h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--partner-text);
}

.conta-session__email,
.conta-session__meta {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
  word-break: break-word;
}

.conta-session__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.15rem;
  font-size: 0.82rem;
}

.conta-session__aside {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
}

.conta-session__logout :deep(.p-button),
:deep(button.conta-session__logout) {
  border-width: 1.5px;
  border-color: var(--partner-warm-text);
  background: color-mix(in srgb, var(--partner-warm-bg) 70%, var(--partner-card));
  color: var(--partner-warm-text);
  font-weight: 700;
}

.conta-session__logout :deep(.p-button:hover),
.conta-session__logout :deep(.p-button:focus-visible),
:deep(button.conta-session__logout:hover),
:deep(button.conta-session__logout:focus-visible) {
  background: var(--partner-warm-bg);
  border-color: var(--partner-warm-text);
  color: var(--partner-warm-text);
}

.conta-session__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conta-session__roles li {
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.7rem;
  font-weight: 700;
}

.conta-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.conta-panel {
  display: grid;
  gap: 0.7rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.05rem;
  background: var(--partner-card);
}

.conta-panel--muted {
  background: color-mix(in srgb, var(--partner-surface) 60%, var(--partner-card));
}

.conta-panel__head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.conta-panel__icon {
  display: grid;
  flex-shrink: 0;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.95rem;
}

.conta-panel__icon--muted {
  background: color-mix(in srgb, var(--partner-muted) 14%, transparent);
  color: var(--partner-muted);
}

.conta-panel__head h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--partner-text);
}

.conta-panel__head p {
  margin: 0.25rem 0 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.4;
}

.conta-panel__body {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.conta-risk {
  display: grid;
  gap: 1.1rem;
  padding: 1.25rem 1.35rem 1.3rem;
  border: 1px solid color-mix(in srgb, var(--partner-warm-text) 22%, var(--partner-line));
  border-radius: 1.15rem;
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--partner-warm-bg) 55%, var(--partner-card)),
      var(--partner-card) 70%
    );
}

.conta-risk__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.85rem 1.25rem;
}

.conta-risk__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--partner-warm-text);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.conta-risk__head h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--partner-text);
}

.conta-risk__head > div > p {
  margin: 0.35rem 0 0;
  max-width: 36rem;
  color: var(--partner-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.conta-risk__points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conta-risk__points li {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.85rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--partner-warm-text) 12%, var(--partner-line));
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--partner-card) 82%, transparent);
}

.conta-risk__point-icon {
  display: grid;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--partner-warm-bg) 80%, transparent);
  color: var(--partner-warm-text);
  font-size: 0.85rem;
}

.conta-risk__points strong {
  display: block;
  margin: 0 0 0.2rem;
  color: var(--partner-text);
  font-size: 0.88rem;
}

.conta-risk__points p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.inativ-dialog__body {
  display: grid;
  gap: 0.65rem;
  max-width: 28rem;
  color: var(--inativ-text);
}

.inativ-dialog__lede {
  margin: 0 0 0.35rem;
  color: var(--inativ-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.inativ-dialog__label {
  color: var(--inativ-faint);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.inativ-dialog__select,
.inativ-dialog__textarea {
  width: 100%;
}

.inativ-dialog__hint {
  margin: 0;
  color: var(--inativ-muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.inativ-dialog__error {
  margin: 0;
  color: var(--inativ-warm-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.inativ-dialog__loading {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--inativ-muted);
  font-size: 0.9rem;
}

.inativ-dialog__custom {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.35rem;
}

@media (max-width: 900px) {
  .conta-risk__points {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .conta-split {
    grid-template-columns: 1fr;
  }

  .conta-session__aside {
    width: 100%;
    justify-content: space-between;
  }

  .conta-risk__head {
    flex-direction: column;
    align-items: stretch;
  }

  .conta-risk__head :deep(.p-button) {
    width: 100%;
  }
}
</style>
