<script setup lang="ts">
/**
 * Configurações → Conta: a sessão neste aparelho (quem entrou, em que empresa, sair ou trocar de
 * empresa) e, separada embaixo, a desativação do perfil — com o que ela é e o que não é antes do
 * botão, e o motivo pedido num diálogo. O idioma passou para Aparência, junto com o tema.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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

import './configuracoes.css'

const { t } = useI18n()
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
  () =>
    usuarioPerfilStore.displayName ||
    sessionUser.value?.nome?.trim() ||
    t('settings.conta.session.fallbackName'),
)

const initials = computed(() => usuarioPerfilStore.initials)

const avatarUrl = computed(() => usuarioPerfilStore.avatarUrl)

const sessionEmail = computed(
  () => usuarioPerfilStore.email || sessionUser.value?.email || '',
)

/** A empresa em que se entrou; o papel vai nos selos ao lado. */
const empresa = computed(() =>
  store.loadState === 'ready' && store.dashboard ? store.parceiroNome : '',
)

const roleHints = computed(() => {
  const hints: string[] = []
  if (sessionUser.value?.veterinarioId) {
    hints.push(t('settings.conta.roles.veterinario'))
  }
  if (store.loadState === 'ready' && store.parceiroNome) {
    hints.push(store.isDono ? t('settings.conta.roles.dono') : t('settings.conta.roles.operador'))
  }
  if (sessionUser.value?.isSystemAdmin) {
    hints.push(t('settings.conta.roles.admin'))
  }
  return hints
})

const selectedReason = computed(
  () => reasons.value.find((item) => item.id === selectedReasonId.value) ?? null,
)

const showCustomReason = computed(() => Boolean(selectedReason.value?.isCustomAllowed))

const deactivatePoints = computed(() => [
  {
    id: 'soft',
    icon: 'ph ph-arrow-counter-clockwise',
    title: t('settings.conta.risk.points.soft.title'),
    text: t('settings.conta.risk.points.soft.text'),
  },
  {
    id: 'scope',
    icon: 'ph ph-shield',
    title: t('settings.conta.risk.points.scope.title'),
    text: t('settings.conta.risk.points.scope.text'),
  },
  {
    id: 'not-delete',
    icon: 'ph ph-prohibit',
    title: t('settings.conta.risk.points.notDelete.title'),
    text: t('settings.conta.risk.points.notDelete.text'),
  },
])

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
      reasonsError.value = t('settings.conta.inactivate.errors.noReasons')
    }
  } catch (error) {
    reasonsError.value =
      error instanceof Error
        ? error.message
        : t('settings.conta.inactivate.errors.loadReasons')
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
    reasonsError.value = t('settings.conta.inactivate.errors.reasonRequired')
    return false
  }

  if (showCustomReason.value && customReason.value.trim().length < 3) {
    customReasonError.value = t('settings.conta.inactivate.errors.customMin')
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
      summary: t('settings.conta.inactivate.toasts.success.summary'),
      detail: t('settings.conta.inactivate.toasts.success.detail'),
      life: 5000,
    })
    await router.replace('/auth/login')
  } catch (error) {
    const detail =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : t('settings.conta.inactivate.errors.failedFallback')

    toast.add({
      severity: 'error',
      summary: t('settings.conta.inactivate.toasts.error.summary'),
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
  <div class="ui-folha cfg-folha conta">
    <section class="cfg-secao" aria-labelledby="conta-sessao-titulo">
      <header class="cfg-secao__cabeca">
        <h3 id="conta-sessao-titulo" class="cfg-secao__titulo">
          {{ t('settings.conta.session.eyebrow') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.conta.session.logoutHint') }}</p>
      </header>

      <div class="cfg-secao__corpo">
        <div class="sessao">
          <span class="sessao__rosto" aria-hidden="true">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" />
            <template v-else>{{ initials }}</template>
          </span>
          <span class="sessao__quem">
            <strong>{{ displayName }}</strong>
            <span>{{ sessionEmail }}</span>
          </span>
        </div>

        <ul
          v-if="empresa || roleHints.length"
          class="sessao__papeis"
          :aria-label="t('settings.conta.aria.roles')"
        >
          <li v-if="empresa" class="sessao__empresa">
            <i class="ph ph-buildings" aria-hidden="true" />
            {{ empresa }}
          </li>
          <li v-for="role in roleHints" :key="role" class="ui-selo ui-selo--contorno">
            {{ role }}
          </li>
        </ul>

        <div class="sessao__acoes">
          <Button
            :label="t('settings.conta.actions.logout')"
            severity="secondary"
            outlined
            type="button"
            icon="ph ph-sign-out"
            @click="handleLogout"
          />
          <RouterLink
            class="p-button p-component p-button-secondary p-button-text"
            to="/parceiro/selecionar"
          >
            <i class="ph ph-arrows-left-right" aria-hidden="true" />
            {{ t('shell.user.trocarEmpresa') }}
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="cfg-secao risco" aria-labelledby="conta-risco-titulo">
      <header class="cfg-secao__cabeca">
        <h3 id="conta-risco-titulo" class="cfg-secao__titulo">
          <i class="ph ph-user-minus risco__icone" aria-hidden="true" />
          {{ t('settings.conta.risk.title') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.conta.risk.lede') }}</p>
      </header>

      <div class="cfg-secao__corpo">
        <ul class="risco__pontos">
          <li v-for="point in deactivatePoints" :key="point.id">
            <i :class="point.icon" aria-hidden="true" />
            <span>
              <strong>{{ point.title }}</strong>
              {{ point.text }}
            </span>
          </li>
        </ul>

        <div>
          <Button
            :label="t('settings.conta.risk.actions.deactivate')"
            severity="danger"
            outlined
            type="button"
            icon="ph ph-user-minus"
            @click="openInactivateDialog"
          />
        </div>
      </div>
    </section>
  </div>

  <Dialog
    v-model:visible="dialogVisible"
    modal
    :draggable="false"
    :dismissable-mask="!submitting"
    :closable="!submitting"
    class="inativ-dialog"
    :style="{ width: 'min(30rem, calc(100vw - 32px))' }"
    :header="t('settings.conta.inactivate.dialog.title')"
    @hide="closeInactivateDialog"
  >
    <div class="inativ-dialog__body">
      <p class="inativ-dialog__lede">
        {{ t('settings.conta.inactivate.dialog.lede') }}
      </p>

      <div v-if="loadingReasons" class="inativ-dialog__loading" role="status">
        <i class="ph ph-spin ph-circle-notch" aria-hidden="true" />
        {{ t('settings.conta.inactivate.loading') }}
      </div>

      <template v-else>
        <label id="inativ-motivo-rotulo" class="inativ-dialog__label" for="inativ-motivo">{{
          t('settings.conta.inactivate.fields.reason.label')
        }}</label>
        <Select
          v-model="selectedReasonId"
          label-id="inativ-motivo"
          aria-labelledby="inativ-motivo-rotulo"
          :options="reasons"
          option-label="label"
          option-value="id"
          :placeholder="t('settings.conta.inactivate.fields.reason.placeholder')"
          class="inativ-dialog__select"
          :invalid="Boolean(reasonsError)"
          :disabled="submitting || reasons.length === 0"
        />
        <p v-if="selectedReason?.description" class="inativ-dialog__hint">
          {{ selectedReason.description }}
        </p>
        <p v-if="reasonsError" class="inativ-dialog__error" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          {{ reasonsError }}
        </p>

        <div v-if="showCustomReason" class="inativ-dialog__custom">
          <label class="inativ-dialog__label" for="inativ-custom">{{
            t('settings.conta.inactivate.fields.custom.label')
          }}</label>
          <Textarea
            id="inativ-custom"
            v-model="customReason"
            rows="3"
            auto-resize
            class="inativ-dialog__textarea"
            :placeholder="t('settings.conta.inactivate.fields.custom.placeholder')"
            :invalid="Boolean(customReasonError)"
            :disabled="submitting"
          />
          <p v-if="customReasonError" class="inativ-dialog__error" role="alert">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            {{ customReasonError }}
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <Button
        :label="t('settings.conta.inactivate.actions.cancel')"
        severity="secondary"
        text
        type="button"
        :disabled="submitting"
        @click="closeInactivateDialog"
      />
      <Button
        :label="t('settings.conta.inactivate.actions.confirm')"
        severity="danger"
        type="button"
        icon="ph ph-user-minus"
        :loading="submitting"
        :disabled="loadingReasons || reasons.length === 0"
        @click="handleInactivate"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.sessao {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sessao__rosto {
  display: grid;
  width: 56px;
  height: 56px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-family: var(--font-dados);
  font-size: 19px;
  font-weight: 650;
}

.sessao__rosto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sessao__quem {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.sessao__quem strong {
  font-size: 17px;
  font-weight: 600;
}

.sessao__quem span {
  color: var(--tinta-2);
  font-size: 14px;
  word-break: break-word;
}

.sessao__papeis {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sessao__empresa {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 550;
}

.sessao__empresa i {
  color: var(--tinta-2);
  font-size: 16px;
}

.sessao__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sessao__acoes :deep(.p-button) {
  min-height: 42px;
  gap: 8px;
  text-decoration: none;
}

/* A desativação: separada, com o vermelho só no ícone e no botão — o resto é texto para ler. */
.risco {
  background: color-mix(in oklab, var(--risco-fundo) 35%, var(--superficie));
}

.risco__icone.ph {
  color: var(--risco-tinta);
}

.risco__pontos {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.risco__pontos li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.risco__pontos i {
  flex: none;
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 18px;
}

.risco__pontos strong {
  margin-inline-end: 4px;
  color: var(--tinta);
  font-weight: 600;
}

.inativ-dialog__body {
  display: grid;
  gap: 8px;
  color: var(--tinta);
}

.inativ-dialog__lede {
  margin: 0 0 8px;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

.inativ-dialog__label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.inativ-dialog__select,
.inativ-dialog__textarea {
  width: 100%;
}

.inativ-dialog__hint {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.inativ-dialog__error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.inativ-dialog__error i {
  margin-top: 1px;
  font-size: 16px;
}

.inativ-dialog__loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 14.5px;
}

.inativ-dialog__custom {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
</style>
