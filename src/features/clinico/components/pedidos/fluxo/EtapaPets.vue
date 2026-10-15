<script setup lang="ts">
/**
 * Para quem é o horário — até três pets da conta.
 *
 * Mais de um é o caso da casa com vários bichos: a clínica marca seguidos, com o mesmo
 * profissional, e a pessoa vai uma vez só. Quem está internado não entra (não se marca consulta
 * para quem está lá dentro), e o pet com cadastro incompleto entra, mas a etapa seguinte pede o
 * que falta antes de deixar seguir.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()

function iniciais(nome: string) {
  return nome.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <p class="fx-ajuda">{{ t('clinico.pedidos.app.petsAjuda') }}</p>

      <ul class="fx-lista">
        <li v-for="pet in fluxo.petsDaConta.value" :key="pet.id">
          <label
            class="fx-opcao"
            :class="{
              'fx-opcao--escolhida': fluxo.pedido.petIds.includes(pet.id),
              'fx-opcao--apagada': pet.internado,
            }"
          >
            <Checkbox
              :model-value="fluxo.pedido.petIds.includes(pet.id)"
              binary
              :disabled="
                pet.internado ||
                (!fluxo.pedido.petIds.includes(pet.id) && fluxo.pedido.petIds.length >= 3)
              "
              :input-id="`pet-${pet.id}`"
              @update:model-value="fluxo.alternarPet(pet.id)"
            />
            <PetAvatar
              :nome="pet.nome"
              :iniciais="iniciais(pet.nome)"
              :especie="pet.especie"
              :foto-url="pet.fotoUrl ?? ''"
              tamanho="sm"
            />
            <span class="fx-opcao__texto">
              <strong>{{ pet.nome }}</strong>
              <span v-if="pet.internado">{{ t('clinico.pedidos.app.internado') }}</span>
              <span v-else-if="pet.faltam.length > 0">
                <span class="fx-selo fx-selo--atencao">
                  <i class="ph ph-note-pencil" aria-hidden="true" />
                  {{ t('clinico.pedidos.app.faltaCadastro') }}
                </span>
              </span>
              <span v-else-if="!pet.conhecidoPelaClinica">
                <span class="fx-selo fx-selo--novo">{{
                  t('clinico.pedidos.app.primeiraVez')
                }}</span>
              </span>
            </span>
          </label>
        </li>
      </ul>

      <p v-if="fluxo.pedido.petIds.length > 1" class="fx-linha fx-linha--suave">
        <i class="ph ph-arrows-left-right" aria-hidden="true" />
        {{ t('clinico.pedidos.app.seguidosAjuda') }}
      </p>
    </div>

    <div class="fx-rodape">
      <Button
        :label="t('clinico.pedidos.app.continuar')"
        icon="ph ph-arrow-right"
        icon-pos="right"
        :disabled="fluxo.pedido.petIds.length === 0"
        @click="fluxo.confirmarPets()"
      />
    </div>
  </div>
</template>
