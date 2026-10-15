<script setup lang="ts">
/**
 * Em qual clínica. As da conta, com o estado de cada uma: a que recebe pedidos segue; a que não
 * recebe diz isso e dá o telefone — a pessoa não descobre no último passo.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'

import { OUTRA_CLINICA, useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const rotulos = useRotulosDoPedido()

const clinica = computed(() => fluxo.clinica.value)

/** "Já atende Pérola e Brunilda" ou "Primeira vez aqui". */
const vinculo = computed(() => {
  const conhecidos = fluxo.petsEscolhidos.value.filter((pet) => pet.conhecidoPelaClinica)

  return conhecidos.length > 0
    ? t('clinico.pedidos.app.jaAtende', { nomes: rotulos.nomes(conhecidos.map((pet) => pet.nome)) })
    : t('clinico.pedidos.app.primeiraVezAqui')
})
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <ul v-if="clinica" class="fx-lista">
        <li>
          <Button
            class="fx-opcao"
            text
            :disabled="!clinica.recebePedidos"
            @click="fluxo.escolherClinica()"
          >
            <span class="fx-opcao__icone" aria-hidden="true"
              ><i class="ph ph-first-aid-kit"
            /></span>
            <span class="fx-opcao__texto">
              <strong>{{ clinica.clinica.nome }}</strong>
              <span>{{ clinica.enderecoResumo }}</span>
              <span v-if="clinica.recebePedidos">{{ vinculo }}</span>
              <span v-else class="fx-linha--atencao">
                {{ t('clinico.pedidos.app.pausada', { telefone: clinica.clinica.telefone }) }}
              </span>
            </span>
            <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
          </Button>
        </li>
        <li>
          <Button class="fx-opcao" text disabled>
            <span class="fx-opcao__icone" aria-hidden="true"><i class="ph ph-hospital" /></span>
            <span class="fx-opcao__texto">
              <strong>{{ OUTRA_CLINICA.nome }}</strong>
              <span>
                {{ t('clinico.pedidos.app.naoRecebe', { telefone: OUTRA_CLINICA.telefone }) }}
              </span>
            </span>
          </Button>
        </li>
      </ul>
    </div>
  </div>
</template>
