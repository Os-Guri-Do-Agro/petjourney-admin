<script setup lang="ts">
/**
 * Configurações → Segurança: trocar a senha. A senha atual, a nova com as regras conferidas
 * enquanto se digita, a confirmação, e "Alterar senha" no rodapé. Cada caixa tem o "Mostrar".
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SettingsCampo from '@/components/settings/SettingsCampo.vue'
import SettingsRequisitosDaSenha from '@/components/settings/SettingsRequisitosDaSenha.vue'
import { changePasswordAuthenticated } from '@/service/auth/auth-service'
import { isPasswordValid } from '@/utils/validation/password'

import './configuracoes.css'

const { t } = useI18n()
const toast = useToast()

const savingPassword = ref(false)

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
  <form class="ui-folha cfg-folha" novalidate @submit.prevent="handleChangePassword">
    <section class="cfg-secao" aria-labelledby="seguranca-senha-titulo">
      <header class="cfg-secao__cabeca">
        <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
          <i class="ph ph-password" />
        </span>
        <h3 id="seguranca-senha-titulo" class="cfg-secao__titulo">
          {{ t('settings.seguranca.aside.title') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.seguranca.aside.body') }}</p>
        <p class="cfg-secao__descricao seguranca__dica">
          <i class="ph ph-shield-check" aria-hidden="true" />
          {{ t('settings.seguranca.aside.bullets.reuse') }}
        </p>
      </header>

      <div class="cfg-secao__corpo cfg-coluna">
        <SettingsCampo
          id="settings-senha-atual"
          v-model="senhaAtual"
          autocomplete="current-password"
          :label="t('settings.seguranca.fields.current.label')"
          :placeholder="t('settings.seguranca.fields.current.placeholder')"
          type="password"
          revelavel
          :disabled="savingPassword"
          :error="senhaAtualError"
        />

        <div class="seguranca__nova">
          <SettingsCampo
            id="settings-nova-senha"
            v-model="novaSenha"
            autocomplete="new-password"
            :label="t('settings.seguranca.fields.new.label')"
            :placeholder="t('settings.seguranca.fields.new.placeholder')"
            type="password"
            revelavel
            :disabled="savingPassword"
            :error="novaSenhaError"
          />
          <SettingsRequisitosDaSenha :password="novaSenha" />
        </div>

        <SettingsCampo
          id="settings-confirmar-senha"
          v-model="confirmarSenha"
          autocomplete="new-password"
          :label="t('settings.seguranca.fields.confirm.label')"
          :placeholder="t('settings.seguranca.fields.confirm.placeholder')"
          type="password"
          revelavel
          :disabled="savingPassword"
          :error="confirmarSenhaError"
        />
      </div>
    </section>

    <footer class="cfg-rodape">
      <Button
        type="submit"
        :label="t('settings.seguranca.actions.change')"
        icon="ph ph-lock-key"
        :loading="savingPassword"
      />
    </footer>
  </form>
</template>

<style scoped>
.seguranca__dica {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
}

.seguranca__dica i {
  flex: none;
  margin-top: 2px;
  color: var(--musgo);
  font-size: 16px;
}

.seguranca__nova {
  display: grid;
  gap: 12px;
}
</style>
