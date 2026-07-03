<script setup lang="ts">

import Button from 'primevue/button'

import Select from 'primevue/select'

import { useToast } from 'primevue/usetoast'

import { onMounted, ref } from 'vue'

import { RouterLink } from 'vue-router'



import AuthTextField from '@/components/auth/AuthTextField.vue'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'

import { useParceiroPortal } from '@/composables/useParceiroPortal'

import { convidarMembroEquipe, removerMembroEquipe } from '@/service/parceiro/parceiro-portal-service'

import type { PapelParceiro } from '@/service/parceiro/types'



const toast = useToast()

const { store, bootstrapping, ensureContext, parceiroQuery } = useParceiroPortal()



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



onMounted(() => {

  void ensureContext()

})

</script>



<template>

  <PartnerPageFrame

    subtitle="Portal"

    title="Equipe"

    :loading="bootstrapping"

    @retry="ensureContext(true)"

  >

    <PartnerOperabilityBanner />



    <article class="equipe-card">

      <p class="equipe-card__intro">

        Seu papel atual: <strong>{{ store.papel ?? '—' }}</strong>.

        Apenas donos convidam ou removem membros.

      </p>



      <section class="equipe-section equipe-section--muted">

        <h3>Recebeu um convite?</h3>

        <p>Aceite em uma tela dedicada — o link do e-mail deve incluir o ID da empresa.</p>

        <Button as="router-link" label="Aceitar convite" to="/parceiro/convite" />

      </section>



      <section v-if="store.isDono" class="equipe-section">

        <h3>Convidar membro</h3>

        <div class="equipe-form">

          <AuthTextField

            id="invite-email"

            v-model="inviteEmail"

            autocomplete="email"

            :disabled="inviting || !store.podeOperar"

            label="E-mail do convidado"

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

            :disabled="!store.podeOperar"

            :loading="inviting"

            @click="handleInvite"

          />

        </div>

      </section>



      <section v-if="store.isDono" class="equipe-section">

        <h3>Remover membro</h3>

        <p>Informe o identificador do usuário (fornecido pelo suporte/admin).</p>

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

            :disabled="!store.podeOperar"

            :loading="removing"

            @click="requestRemoveMember"

          />

        </div>

      </section>



      <p v-if="!store.isDono" class="equipe-card__hint">

        Operadores visualizam a equipe, mas não enviam convites nem removem membros.

      </p>



      <p class="equipe-card__hint">

        Compartilhe o link

        <RouterLink to="/parceiro/convite">/parceiro/convite?parceiroId=...</RouterLink>

        com o convidado após enviar o e-mail.

      </p>

    </article>



    <ConfirmActionDialog
      v-model:visible="removeConfirmVisible"
      confirm-label="Remover membro"
      message="Esta ação revoga o acesso do usuário à empresa. Não é possível remover o último dono."
      severity="danger"
      title="Remover membro da equipe?"
      @confirm="handleRemoveMember"
    />

  </PartnerPageFrame>

</template>



<style scoped>

.equipe-card,

.equipe-section {

  padding: 1rem 1.05rem;

  border: 1px solid var(--partner-line);

  border-radius: 0.95rem;

  background: var(--partner-card);

}



.equipe-card {

  display: grid;

  gap: 1rem;

}



.equipe-section {

  display: grid;

  gap: 0.65rem;

}



.equipe-section--muted {

  background: color-mix(in srgb, var(--partner-primary-soft) 10%, var(--partner-card));

}



.equipe-section h3 {

  margin: 0;

  font-size: 0.98rem;

}



.equipe-section p,

.equipe-card__intro,

.equipe-card__hint {

  margin: 0;

  color: var(--partner-muted);

  font-size: 0.88rem;

}



.equipe-card__hint a {

  color: var(--partner-primary-strong);

  font-weight: 600;

}



.equipe-form {

  display: grid;

  gap: 0.75rem;

}



.equipe-form--inline {

  align-items: end;

  grid-template-columns: 1fr auto;

}



.equipe-select {

  display: grid;

  gap: 0.35rem;

  font-size: 0.84rem;

  font-weight: 600;

}



@media (max-width: 640px) {

  .equipe-form--inline {

    grid-template-columns: 1fr;

  }

}

</style>


