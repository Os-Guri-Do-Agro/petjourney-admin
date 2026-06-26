<script setup lang="ts">
import { ref } from 'vue'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'

const email = ref('')
</script>

<template>
  <AuthLayout
    description="Informe o e-mail cadastrado para receber as instruções de recuperação de acesso."
    eyebrow="Recuperação"
    title="Redefinir senha"
  >
    <form class="space-y-5" @submit.prevent>
      <AuthTextField
        id="forgot-email"
        v-model="email"
        autocomplete="email"
        hint="Se o e-mail existir na base, enviaremos um link seguro de redefinição."
        label="E-mail"
        placeholder="seuemail@clinica.com"
        required
        type="email"
      />

      <AuthButton full-width type="submit">Enviar instruções</AuthButton>
    </form>

    <AuthButton full-width to="/auth/login" variant="secondary">Voltar para login</AuthButton>
  </AuthLayout>
</template>
