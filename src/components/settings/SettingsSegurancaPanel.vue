<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import { changePasswordAuthenticated } from '@/service/auth/auth-service'
import { isPasswordValid } from '@/utils/validation/password'

const { t } = useI18n()
const toast = useToast()

const savingPassword = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const senhaAtual = ref('')
const novaSenha = ref('')
const confirmarSenha = ref('')
const senhaAtualError = ref('')
const novaSenhaError = ref('')
const confirmarSenhaError = ref('')

function clearPasswordErrors() {
  senhaAtualError.value = ''
  novaSenhaError.value = ''
  confirmarSenhaError.value = ''
}

function validatePasswordForm() {
  clearPasswordErrors()

  if (!senhaAtual.value) {
    senhaAtualError.value = t('settings.seguranca.errors.currentRequired')
  }

  if (!isPasswordValid(novaSenha.value)) {
    novaSenhaError.value = t('settings.seguranca.errors.newInvalid')
  }

  if (!confirmarSenha.value) {
    confirmarSenhaError.value = t('settings.seguranca.errors.confirmRequired')
  } else if (confirmarSenha.value !== novaSenha.value) {
    confirmarSenhaError.value = t('settings.seguranca.errors.mismatch')
  }

  return !senhaAtualError.value && !novaSenhaError.value && !confirmarSenhaError.value
}

async function handleChangePassword() {
  if (!validatePasswordForm()) {
    return
  }

  savingPassword.value = true

  try {
    await changePasswordAuthenticated({
      oldPassword: senhaAtual.value,
      newPassword: novaSenha.value,
    })
    senhaAtual.value = ''
    novaSenha.value = ''
    confirmarSenha.value = ''
    clearPasswordErrors()
    toast.add({
      severity: 'success',
      summary: t('settings.seguranca.toasts.success.summary'),
      detail: t('settings.seguranca.toasts.success.detail'),
      life: 4000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('settings.seguranca.toasts.error.summary'),
      detail:
        error instanceof Error
          ? error.message
          : t('settings.seguranca.toasts.error.detailFallback'),
      life: 5000,
    })
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <div class="settings-seguranca">
    <aside class="settings-seguranca__aside">
      <h3>{{ t('settings.seguranca.aside.title') }}</h3>
      <p>
        {{ t('settings.seguranca.aside.body') }}
      </p>
      <ul>
        <li>{{ t('settings.seguranca.aside.bullets.minLength') }}</li>
        <li>{{ t('settings.seguranca.aside.bullets.complexity') }}</li>
        <li>{{ t('settings.seguranca.aside.bullets.reuse') }}</li>
      </ul>
    </aside>

    <form class="settings-seguranca__panel" @submit.prevent="handleChangePassword">
      <AuthTextField
        id="settings-senha-atual"
        v-model="senhaAtual"
        autocomplete="current-password"
        :label="t('settings.seguranca.fields.current.label')"
        :placeholder="t('settings.seguranca.fields.current.placeholder')"
        :type="showCurrentPassword ? 'text' : 'password'"
        :disabled="savingPassword"
        :error="senhaAtualError"
      >
        <template #trailing>
          <Button
            type="button"
            class="settings-seguranca__eye"
            text
            severity="secondary"
            :icon="showCurrentPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
            :aria-label="
              showCurrentPassword
                ? t('settings.seguranca.aria.hidePassword')
                : t('settings.seguranca.aria.showPassword')
            "
            @click="showCurrentPassword = !showCurrentPassword"
          />
        </template>
      </AuthTextField>

      <AuthTextField
        id="settings-nova-senha"
        v-model="novaSenha"
        autocomplete="new-password"
        :label="t('settings.seguranca.fields.new.label')"
        :placeholder="t('settings.seguranca.fields.new.placeholder')"
        :type="showNewPassword ? 'text' : 'password'"
        :disabled="savingPassword"
        :error="novaSenhaError"
      >
        <template #trailing>
          <Button
            type="button"
            class="settings-seguranca__eye"
            text
            severity="secondary"
            :icon="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
            :aria-label="
              showNewPassword
                ? t('settings.seguranca.aria.hidePassword')
                : t('settings.seguranca.aria.showPassword')
            "
            @click="showNewPassword = !showNewPassword"
          />
        </template>
      </AuthTextField>

      <PasswordRequirements :password="novaSenha" />

      <AuthTextField
        id="settings-confirmar-senha"
        v-model="confirmarSenha"
        autocomplete="new-password"
        :label="t('settings.seguranca.fields.confirm.label')"
        :placeholder="t('settings.seguranca.fields.confirm.placeholder')"
        :type="showConfirmPassword ? 'text' : 'password'"
        :disabled="savingPassword"
        :error="confirmarSenhaError"
      >
        <template #trailing>
          <Button
            type="button"
            class="settings-seguranca__eye"
            text
            severity="secondary"
            :icon="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
            :aria-label="
              showConfirmPassword
                ? t('settings.seguranca.aria.hidePassword')
                : t('settings.seguranca.aria.showPassword')
            "
            @click="showConfirmPassword = !showConfirmPassword"
          />
        </template>
      </AuthTextField>

      <footer class="settings-seguranca__foot">
        <Button
          type="submit"
          :label="t('settings.seguranca.actions.change')"
          icon="pi pi-lock"
          :loading="savingPassword"
        />
      </footer>
    </form>
  </div>
</template>

<style scoped>
.settings-seguranca {
  display: grid;
  grid-template-columns: minmax(14rem, 0.85fr) minmax(0, 1.35fr);
  gap: 1.15rem;
  align-items: start;
  width: 100%;
}

.settings-seguranca__aside {
  display: grid;
  gap: 0.65rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--partner-surface) 65%, var(--partner-card));
}

.settings-seguranca__aside h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--partner-text);
}

.settings-seguranca__aside p,
.settings-seguranca__aside li {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.settings-seguranca__aside ul {
  display: grid;
  gap: 0.35rem;
  margin: 0.15rem 0 0;
  padding-inline-start: 1.1rem;
}

.settings-seguranca__panel {
  display: grid;
  gap: 0.85rem;
  padding: 1.25rem 1.35rem 1.3rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  box-shadow: 0 12px 28px rgb(var(--partner-shadow-rgb) / 0.04);
}

.settings-seguranca__foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.35rem;
  border-top: 1px solid var(--partner-line);
}

.settings-seguranca__eye.p-button {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: 0.5rem;
  color: inherit;
}

.settings-seguranca__eye.p-button:not(:disabled):hover,
.settings-seguranca__eye.p-button:not(:disabled):active,
.settings-seguranca__eye.p-button:focus-visible {
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
  box-shadow: none;
  color: inherit;
  outline: none;
}

@media (max-width: 860px) {
  .settings-seguranca {
    grid-template-columns: 1fr;
  }

  .settings-seguranca__foot {
    justify-content: stretch;
  }

  .settings-seguranca__foot :deep(.p-button) {
    width: 100%;
  }
}
</style>
