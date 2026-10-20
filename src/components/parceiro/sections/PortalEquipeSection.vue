<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

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
    toast.add({
      severity: 'success',
      summary: 'Membro removido',
      detail: 'O acesso à empresa foi revogado.',
      life: 3000,
    })
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
  <!--
    A equipe em três blocos: aceitar um convite recebido, convidar alguém e remover alguém. Os dois
    últimos são do dono; quem é operador vê, no lugar deles, por que não pode.
  -->
  <div class="equipe">
    <p class="equipe__papel">
      <span class="ui-selo ui-selo--lugar">
        <i class="ph ph-identification-badge" aria-hidden="true" />
        Papel atual: {{ store.papel ?? '-' }}
      </span>
      <span>Apenas donos convidam ou removem membros.</span>
    </p>

    <div class="equipe__grade">
      <section class="bloco ui-folha" aria-labelledby="equipe-convite">
        <span class="bloco__icone" aria-hidden="true"><i class="ph ph-envelope-open" /></span>
        <h2 id="equipe-convite" class="bloco__titulo">Recebeu convite?</h2>
        <p class="bloco__texto">Aceite com o ID da empresa enviado por e-mail.</p>
        <RouterLink class="p-button p-component p-button-secondary p-button-outlined bloco__link" to="/parceiro/convite">
          Aceitar convite
        </RouterLink>
      </section>

      <section v-if="store.isDono" class="bloco ui-folha" aria-labelledby="equipe-convidar">
        <span class="bloco__icone" aria-hidden="true"><i class="ph ph-user-plus" /></span>
        <h2 id="equipe-convidar" class="bloco__titulo">Convidar membro</h2>
        <form class="bloco__form" novalidate @submit.prevent="handleInvite">
          <div class="campo">
            <label for="invite-email">E-mail</label>
            <InputText
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              autocomplete="email"
              placeholder="operador@empresa.com"
              :disabled="inviting || !store.podeOperar"
            />
          </div>
          <div class="campo">
            <label id="invite-papel-rotulo" for="invite-papel">Papel</label>
            <Select
              v-model="invitePapel"
              label-id="invite-papel"
              aria-labelledby="invite-papel-rotulo"
              :disabled="inviting || !store.podeOperar"
              option-label="label"
              option-value="value"
              :options="papelOptions"
            />
          </div>
          <Button
            type="submit"
            icon="ph ph-paper-plane-tilt"
            label="Enviar convite"
            :disabled="!store.podeOperar || inviting"
            :loading="inviting"
          />
        </form>
      </section>

      <section v-if="store.isDono" class="bloco ui-folha" aria-labelledby="equipe-remover">
        <span class="bloco__icone bloco__icone--risco" aria-hidden="true">
          <i class="ph ph-user-minus" />
        </span>
        <h2 id="equipe-remover" class="bloco__titulo">Remover membro</h2>
        <p class="bloco__texto">Informe o ID do usuário (fornecido pelo suporte).</p>
        <form class="bloco__form" novalidate @submit.prevent="requestRemoveMember">
          <div class="campo">
            <label for="remove-user-id">ID do usuário</label>
            <InputText
              id="remove-user-id"
              v-model="removeUserId"
              placeholder="uuid-do-usuario"
              autocomplete="off"
              spellcheck="false"
              :disabled="removing || !store.podeOperar"
            />
          </div>
          <Button
            type="submit"
            icon="ph ph-user-minus"
            label="Remover"
            severity="danger"
            outlined
            :disabled="!store.podeOperar || removing"
            :loading="removing"
          />
        </form>
      </section>

      <section v-if="!store.isDono" class="bloco ui-folha" aria-labelledby="equipe-operador">
        <span class="bloco__icone" aria-hidden="true"><i class="ph ph-lock-simple" /></span>
        <h2 id="equipe-operador" class="bloco__titulo">Acesso de operador</h2>
        <p class="bloco__texto">
          Operadores acompanham a parceria, mas não enviam convites nem removem membros.
        </p>
      </section>
    </div>

    <p class="equipe__rodape">
      <i class="ph ph-link" aria-hidden="true" />
      Link para convidados:
      <RouterLink class="ui-mais" to="/parceiro/convite">/parceiro/convite?parceiroId=...</RouterLink>
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
  gap: 18px;
}

.equipe__papel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.equipe__grade {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
}

.bloco {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 8px;
  padding: 22px;
}

.bloco__icone {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 12px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 21px;
}

.bloco__icone--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.bloco__titulo {
  margin: 6px 0 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.bloco__texto {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.bloco__link {
  margin-top: 8px;
  text-decoration: none;
}

.bloco__form {
  display: grid;
  width: 100%;
  gap: 14px;
  margin-top: 6px;
}

.campo {
  display: grid;
  gap: 6px;
}

.campo label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.campo :deep(.p-inputtext),
.campo :deep(.p-select) {
  width: 100%;
}

.equipe__rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.equipe__rodape > i {
  color: var(--tinta-3);
  font-size: 16px;
}
</style>
