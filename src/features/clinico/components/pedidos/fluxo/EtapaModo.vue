<script setup lang="ts">
/**
 * Os dois caminhos do pedido, ditos pelo que acontece depois e não pelo nome técnico.
 *
 * "Escolher dia e horário" mostra a agenda e deixa escolher com quem; "Pedir o melhor horário" só
 * pergunta quando a pessoa pode. Nos dois a clínica responde — e o prazo dela fica escrito embaixo,
 * para ninguém achar que já está marcado.
 */
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const rotulos = useRotulosDoPedido()
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <p v-if="fluxo.pedido.remarca" class="fx-linha">
        <i class="ph ph-arrows-clockwise" aria-hidden="true" />
        {{
          t('clinico.pedidos.app.remarcando', {
            pet: fluxo.pedido.remarca.pet.nome,
            quando: rotulos.quando(fluxo.pedido.remarca.inicio),
          })
        }}
      </p>

      <ul class="fx-lista">
        <li v-if="fluxo.modos.value.includes('HORARIO_ESCOLHIDO')">
          <Button class="fx-opcao" text @click="fluxo.escolherModo('HORARIO_ESCOLHIDO')">
            <span class="fx-opcao__icone" aria-hidden="true"
              ><i class="ph ph-calendar-check"
            /></span>
            <span class="fx-opcao__texto">
              <strong>{{ t('clinico.pedidos.app.modo.HORARIO_ESCOLHIDO') }}</strong>
              <span>{{ t('clinico.pedidos.app.modoAjuda.HORARIO_ESCOLHIDO') }}</span>
            </span>
            <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
          </Button>
        </li>
        <li v-if="fluxo.modos.value.includes('MELHOR_HORARIO')">
          <Button class="fx-opcao" text @click="fluxo.escolherModo('MELHOR_HORARIO')">
            <span class="fx-opcao__icone" aria-hidden="true"><i class="ph ph-hand-tap" /></span>
            <span class="fx-opcao__texto">
              <strong>{{ t('clinico.pedidos.app.modo.MELHOR_HORARIO') }}</strong>
              <span>{{ t('clinico.pedidos.app.modoAjuda.MELHOR_HORARIO') }}</span>
            </span>
            <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
          </Button>
        </li>
      </ul>

      <p class="fx-linha fx-linha--suave">
        <i class="ph ph-clock" aria-hidden="true" />
        {{
          t('clinico.pedidos.app.prazoDaClinica', {
            horas: fluxo.clinica.value?.prazoDeRespostaHoras ?? 0,
          })
        }}
      </p>
    </div>
  </div>
</template>
