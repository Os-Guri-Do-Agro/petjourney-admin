<script setup lang="ts">
/**
 * Configurações → Segurança: trocar a senha. A senha atual, a nova com as regras conferidas
 * enquanto se digita, a confirmação, e "Alterar senha" no rodapé. Cada caixa tem o "Mostrar".
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import { ApiError } from '@/service/api'
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

/*
 * O erro sai do campo assim que a pessoa mexe nele: com a senha já digitada, "Informe a senha
 * atual" e "A nova senha não atende todos os requisitos" ao lado das quatro regras em verde
 * diziam o contrário do que a tela mostrava.
 */
watch(senhaAtual, () => {
  senhaAtualError.value = ''
})

watch(novaSenha, () => {
  novaSenhaError.value = ''

  if (confirmarSenhaError.value && confirmarSenha.value === novaSenha.value) {
    confirmarSenhaError.value = ''
  }
})

watch(confirmarSenha, () => {
  confirmarSenhaError.value = ''
})

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
    /* A senha atual que não confere é erro do campo; o 429 de tentativas segue no aviso. */
    if (error instanceof ApiError && error.codigo === 'SENHA_ATUAL_INCORRETA') {
      senhaAtualError.value = error.message
      return
    }

    /*
     * O 429 das senhas erradas (`SENHA_TENTATIVAS_EXCEDIDAS`) vem traduzido; o do limite da rota
     * traz o texto técnico do servidor, em inglês.
     */
    const limiteDaRota =
      error instanceof ApiError &&
      error.statusCode === 429 &&
      error.codigo !== 'SENHA_TENTATIVAS_EXCEDIDAS'

    toast.add({
      severity: 'error',
      summary: t('settings.seguranca.toasts.error.summary'),
      detail: limiteDaRota
        ? t('settings.seguranca.errors.throttle')
        : error instanceof Error
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
        <AuthTextField
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
          <AuthTextField
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
          <PasswordRequirements :password="novaSenha" />
        </div>

        <AuthTextField
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
