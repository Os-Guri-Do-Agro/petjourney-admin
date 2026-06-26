<script setup lang="ts">
import { ref } from 'vue'

import AccountTypeOption from '@/components/auth/AccountTypeOption.vue'
import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'

const name = ref('')
const email = ref('')
</script>

<template>
  <AuthLayout
    description="Comece informando os dados principais para acessar o ambiente clínico veterinário."
    eyebrow="Primeiro acesso"
    title="Criar conta"
  >
    <form class="space-y-5" @submit.prevent>
      <AuthTextField
        id="name"
        v-model="name"
        autocomplete="name"
        label="Nome completo"
        placeholder="Nome do responsável"
        required
      />

      <AuthTextField
        id="register-email"
        v-model="email"
        autocomplete="email"
        hint="Usaremos este e-mail para login e comunicações importantes."
        label="E-mail"
        placeholder="seuemail@clinica.com"
        required
        type="email"
      />

      <div class="space-y-3">
        <p class="text-sm font-semibold text-(--auth-primary)">Perfil inicial</p>

        <AccountTypeOption
          description="Para profissionais com rotina clínica, agenda, pacientes e prontuário."
          title="Veterinário"
          to="/veterinario"
          tone="vet"
        >
          <template #icon>V</template>
        </AccountTypeOption>
      </div>

      <AuthButton full-width type="submit">Continuar cadastro</AuthButton>
    </form>

    <p class="text-center text-sm leading-6 text-(--auth-muted)">
      Já possui conta?
      <RouterLink
        class="font-bold text-(--auth-primary) transition hover:opacity-75"
        to="/auth/login"
      >
        Entrar agora
      </RouterLink>
    </p>
  </AuthLayout>
</template>
