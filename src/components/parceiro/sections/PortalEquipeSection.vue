<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import AuthTextField from '@/components/auth/AuthTextField.vue'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { convidarMembroEquipe, removerMembroEquipe } from '@/service/parceiro/parceiro-portal-service'
import type { PapelParceiro } from '@/service/parceiro/types'

const toast = useToast()
const { store, parceiroQuery } = useParceiroPortal()

const inviteEmail = ref('')
const invitePapel = ref<PapelParceiro>('OPERADOR')
const removeUserId = ref('')
const inviting = ref(false)
const removing = ref(false)
const removeConfirmVisible = ref(false)

const papelOptions = [
  { label: 'Operador', value: 'OPERADOR' as const },
  { label: 'Dono', value: 'DONO' as const },
]

async function handleInvite() {
  if (!inviteEmail.value.trim()) {
    return
  }

  inviting.value = true

  try {
    await convidarMembroEquipe(
      { email: inviteEmail.value.trim(), papel: invitePapel.value },
      parceiroQuery(),
    )
    toast.add({
      severity: 'success',
      summary: 'Convite enviado',
      detail: 'O convidado precisa aceitar em /parceiro/convite.',
      life: 4000,
    })
    inviteEmail.value = ''
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro ao convidar',
      detail: err instanceof Error ? err.message : 'Tente novamente.',
      life: 5000,
    })
  } finally {
    inviting.value = false
  }
}

function requestRemoveMember() {
  if (!removeUserId.value.trim()) {
    return
  }

  removeConfirmVisible.value = true
}

async function handleRemoveMember() {
  removing.value = true

  try {
    await removerMembroEquipe(removeUserId.value.trim(), parceiroQuery())
    toast.add({ severity: 'success', summary: 'Membro removido', life: 3000 })
    removeUserId.value = ''
    removeConfirmVisible.value = false
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erro ao remover',
      detail: err instanceof Error ? err.message : 'Tente novamente.',
      life: 5000,
    })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <div class="equipe">
    <p class="equipe__intro">
      Papel atual: <strong>{{ store.papel ?? '—' }}</strong>.
      Apenas donos convidam ou removem membros.
    </p>

    <div class="equipe__grid">
      <article class="equipe-card equipe-card--muted">
        <h4>Recebeu convite?</h4>
        <p>Aceite com o ID da empresa enviado por e-mail.</p>
        <Button as="router-link" label="Aceitar convite" size="small" to="/parceiro/convite" />
      </article>

      <article v-if="store.isDono" class="equipe-card">
        <h4>Convidar membro</h4>
        <div class="equipe-form">
          <AuthTextField
            id="invite-email"
            v-model="inviteEmail"
            autocomplete="email"
            :disabled="inviting || !store.podeOperar"
            label="E-mail"
            placeholder="operador@empresa.com"
            type="email"
          />
          <label class="equipe-select">
            <span>Papel</span>
            <Select
              v-model="invitePapel"
              :disabled="inviting || !store.podeOperar"
              option-label="label"
              option-value="value"
              :options="papelOptions"
            />
          </label>
          <Button
            label="Enviar convite"
            size="small"
            :disabled="!store.podeOperar"
            :loading="inviting"
            @click="handleInvite"
          />
        </div>
      </article>

      <article v-if="store.isDono" class="equipe-card">
        <h4>Remover membro</h4>
        <p class="equipe-card__hint">Informe o ID do usuário (fornecido pelo suporte).</p>
        <div class="equipe-form equipe-form--inline">
          <AuthTextField
            id="remove-user-id"
            v-model="removeUserId"
            :disabled="removing || !store.podeOperar"
            label="ID do usuário"
            placeholder="uuid-do-usuario"
          />
          <Button
            label="Remover"
            severity="danger"
            size="small"
            :disabled="!store.podeOperar"
            :loading="removing"
            @click="requestRemoveMember"
          />
        </div>
      </article>

      <article v-if="!store.isDono" class="equipe-card equipe-card--muted">
        <h4>Acesso de operador</h4>
        <p>Operadores acompanham a parceria, mas não enviam convites nem removem membros.</p>
      </article>
    </div>

    <p class="equipe__footer">
      Link para convidados:
      <RouterLink to="/parceiro/convite">/parceiro/convite?parceiroId=...</RouterLink>
    </p>

    <ConfirmActionDialog
      v-model:visible="removeConfirmVisible"
      confirm-label="Remover membro"
      message="Esta ação revoga o acesso do usuário à empresa. Não é possível remover o último dono."
      severity="danger"
      title="Remover membro da equipe?"
      @confirm="handleRemoveMember"
    />
  </div>
</template>

<style scoped>
.equipe {
  display: grid;
  gap: 0.85rem;
}

.equipe__intro,
.equipe__footer,
.equipe-card__hint {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.86rem;
}

.equipe__footer a {
  color: var(--partner-primary-strong);
  font-weight: 600;
}

.equipe__grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
}

.equipe-card {
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.9rem;
  background: var(--partner-surface);
}

.equipe-card--muted {
  background: color-mix(in srgb, var(--partner-primary-soft) 10%, var(--partner-card));
}

.equipe-card h4 {
  margin: 0;
  font-size: 0.92rem;
}

.equipe-card p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.82rem;
}

.equipe-form {
  display: grid;
  gap: 0.65rem;
}

.equipe-form--inline {
  align-items: end;
  grid-template-columns: 1fr auto;
}

.equipe-select {
  display: grid;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .equipe-form--inline {
    grid-template-columns: 1fr;
  }
}
</style>
