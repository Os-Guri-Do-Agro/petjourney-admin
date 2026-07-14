<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import { changePasswordAuthenticated } from '@/service/auth/auth-service'
import { isPasswordValid } from '@/utils/validation/password'

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
    senhaAtualError.value = 'Informe a senha atual.'
  }

  if (!isPasswordValid(novaSenha.value)) {
    novaSenhaError.value = 'A nova senha não atende todos os requisitos.'
  }

  if (!confirmarSenha.value) {
    confirmarSenhaError.value = 'Confirme a nova senha.'
  } else if (confirmarSenha.value !== novaSenha.value) {
    confirmarSenhaError.value = 'As senhas não coincidem.'
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
      summary: 'Senha alterada',
      detail: 'Use a nova senha no próximo acesso.',
      life: 4000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Não foi possível alterar a senha',
      detail: error instanceof Error ? error.message : 'Verifique a senha atual e tente de novo.',
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
      <h3>Troca de senha</h3>
      <p>
        A sessão atual permanece ativa após a alteração. Use uma senha forte e exclusiva desta
        conta.
      </p>
      <ul>
        <li>Mínimo de 6 caracteres</li>
        <li>Número, maiúscula e caractere especial</li>
        <li>Não reutilize senhas de outros sistemas</li>
      </ul>
    </aside>

    <form class="settings-seguranca__panel" @submit.prevent="handleChangePassword">
      <AuthTextField
        id="settings-senha-atual"
        v-model="senhaAtual"
        autocomplete="current-password"
        label="Senha atual"
        placeholder="Digite a senha atual"
        :type="showCurrentPassword ? 'text' : 'password'"
        :disabled="savingPassword"
        :error="senhaAtualError"
      >
        <template #trailing>
          <button
            type="button"
            class="settings-seguranca__eye"
            :aria-label="showCurrentPassword ? 'Ocultar senha' : 'Mostrar senha'"
            @click="showCurrentPassword = !showCurrentPassword"
          >
            <i :class="showCurrentPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
          </button>
        </template>
      </AuthTextField>

      <AuthTextField
        id="settings-nova-senha"
        v-model="novaSenha"
        autocomplete="new-password"
        label="Nova senha"
        placeholder="Crie uma senha forte"
        :type="showNewPassword ? 'text' : 'password'"
        :disabled="savingPassword"
        :error="novaSenhaError"
      >
        <template #trailing>
          <button
            type="button"
            class="settings-seguranca__eye"
            :aria-label="showNewPassword ? 'Ocultar senha' : 'Mostrar senha'"
            @click="showNewPassword = !showNewPassword"
          >
            <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
          </button>
        </template>
      </AuthTextField>

      <PasswordRequirements :password="novaSenha" />

      <AuthTextField
        id="settings-confirmar-senha"
        v-model="confirmarSenha"
        autocomplete="new-password"
        label="Confirmar nova senha"
        placeholder="Repita a nova senha"
        :type="showConfirmPassword ? 'text' : 'password'"
        :disabled="savingPassword"
        :error="confirmarSenhaError"
      >
        <template #trailing>
          <button
            type="button"
            class="settings-seguranca__eye"
            :aria-label="showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
          </button>
        </template>
      </AuthTextField>

      <footer class="settings-seguranca__foot">
        <Button
          type="submit"
          label="Alterar senha"
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
  padding-left: 1.1rem;
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

.settings-seguranca__eye {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.settings-seguranca__eye:hover,
.settings-seguranca__eye:focus-visible {
  background: color-mix(in srgb, var(--partner-primary) 14%, transparent);
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
