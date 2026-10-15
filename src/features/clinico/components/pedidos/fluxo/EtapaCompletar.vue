<script setup lang="ts">
/**
 * O cadastro incompleto, resolvido dentro do fluxo.
 *
 * Mandar a pessoa para o perfil do pet no meio do pedido é perder o pedido. Aqui ela completa só o
 * que a clínica precisa (nascimento e sexo), o app salva no perfil, e o fluxo segue de onde estava.
 */
import { PhGenderFemale, PhGenderMale } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PetSex } from '../../../data/types'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()

const nascimento = ref<Date | null>(null)
const sexo = ref<PetSex | null>(null)

const pet = computed(() => fluxo.petIncompleto.value)
const hoje = new Date()

watch(
  () => pet.value?.id,
  () => {
    nascimento.value = null
    sexo.value = null
  },
)

const sexos = computed(() => [
  { valor: 'macho', rotulo: t('clinico.pedidos.app.sexo.macho'), icone: PhGenderMale },
  { valor: 'femea', rotulo: t('clinico.pedidos.app.sexo.femea'), icone: PhGenderFemale },
])

const pronto = computed(
  () =>
    pet.value !== null &&
    (!pet.value.faltam.includes('nascimento') || nascimento.value !== null) &&
    (!pet.value.faltam.includes('sexo') || sexo.value !== null),
)
</script>

<template>
  <div v-if="pet" class="fx-etapa">
    <div class="fx-corpo">
      <p class="fx-ajuda">{{ t('clinico.pedidos.app.completarAjuda', { nome: pet.nome }) }}</p>

      <label v-if="pet.faltam.includes('nascimento')" class="fx-campo">
        <span>{{ t('clinico.pedidos.app.nascimento') }}</span>
        <DatePicker
          v-model="nascimento"
          :max-date="hoje"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          fluid
          :manual-input="false"
        />
      </label>

      <div v-if="pet.faltam.includes('sexo')" class="fx-campo">
        <span id="completar-sexo">{{ t('clinico.pedidos.app.sexoRotulo') }}</span>
        <SelectButton
          v-model="sexo"
          :options="sexos"
          option-label="rotulo"
          option-value="valor"
          aria-labelledby="completar-sexo"
          class="grupo fx-escolhas"
        >
          <template #option="{ option }">
            <span class="fx-escolha">
              <component :is="option.icone" weight="duotone" aria-hidden="true" />
              <strong>{{ option.rotulo }}</strong>
            </span>
          </template>
        </SelectButton>
      </div>

      <p class="fx-linha fx-linha--suave">
        <i class="ph ph-floppy-disk" aria-hidden="true" />
        {{ t('clinico.pedidos.app.completarSalva', { nome: pet.nome }) }}
      </p>
    </div>

    <div class="fx-rodape">
      <Button
        :label="t('clinico.pedidos.app.salvarContinuar')"
        icon="ph ph-check"
        :disabled="!pronto"
        :loading="fluxo.carregando.value"
        @click="fluxo.completarPet({ nascimento, sexo })"
      />
    </div>
  </div>
</template>
