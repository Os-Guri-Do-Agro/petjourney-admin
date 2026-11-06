<script setup lang="ts">
/**
 * O campo da senha da conta dentro da gaveta de finalizar ou de anular (guia e4 6.8). Aparece
 * depois do 401 `ASSINATURA_SENHA_EXIGIDA`; a senha certa abre 15 minutos nesta sessão.
 */
import Password from 'primevue/password'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

defineProps<{ erro: string; semSenhaPropria: boolean; desabilitado: boolean; id: string }>()
const senha = defineModel<string>({ required: true })

const { t } = useI18n()
</script>

<template>
  <section v-if="semSenhaPropria" class="eg__secao" role="alert">
    <p class="eg__erro">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ t('atendimento.senha.semSenhaPropria') }}</span>
    </p>
    <RouterLink to="/settings">{{ t('atendimento.senha.definir') }}</RouterLink>
  </section>
  <section v-else class="eg__secao">
    <label class="eg__rotulo" :for="id">{{ t('atendimento.senha.rotulo') }}</label>
    <Password
      v-model="senha"
      :input-id="id"
      :feedback="false"
      toggle-mask
      autocomplete="current-password"
      :invalid="Boolean(erro)"
      :disabled="desabilitado"
      :input-props="{ maxlength: 200 }"
      fluid
    />
    <small v-if="erro" class="eg__invalido" role="alert">{{ erro }}</small>
    <small v-else class="eg__dica">{{ t('atendimento.senha.dica') }}</small>
  </section>
</template>
