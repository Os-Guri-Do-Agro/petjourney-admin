<script setup lang="ts">
/**
 * O que está acontecendo — e o desvio de emergência, antes de qualquer horário.
 *
 * Emergência é a primeira linha, com a cor própria dela: quem precisa dela não pode ter de ler a
 * lista inteira para achar. E sintoma pergunta pelos sinais que não esperam a recepção responder:
 * qualquer um marcado leva ao contato da clínica em vez de seguir para a agenda.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { LIMITES_CLINICOS, SINAIS_DE_EMERGENCIA } from '../../../contrato/responsavel'

import { useFluxo, type MotivoNaTela } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()

const ICONE: Record<Exclude<MotivoNaTela, 'EMERGENCIA' | 'OUTRO'>, string> = {
  CHECKUP: 'ph-heartbeat',
  SINTOMA: 'ph-thermometer',
  VACINA: 'ph-syringe',
  RETORNO: 'ph-arrow-counter-clockwise',
  EXAME: 'ph-scan',
  BANHO: 'ph-drop',
}

const sintoma = computed(() => fluxo.pedido.motivo === 'SINTOMA')
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <ul class="fx-lista">
        <li>
          <Button class="fx-opcao" text @click="fluxo.escolherMotivo('EMERGENCIA')">
            <span class="fx-opcao__icone fx-opcao__icone--emergencia" aria-hidden="true">
              <i class="ph ph-first-aid" />
            </span>
            <span class="fx-opcao__texto">
              <strong>{{ t('clinico.pedidos.app.motivo.EMERGENCIA') }}</strong>
              <span>{{ t('clinico.pedidos.app.motivoAjuda.EMERGENCIA') }}</span>
            </span>
            <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
          </Button>
        </li>
      </ul>

      <ul class="fx-lista">
        <li v-for="motivo in fluxo.motivosDisponiveis.value" :key="motivo">
          <Button
            class="fx-opcao"
            :class="{ 'fx-opcao--escolhida': fluxo.pedido.motivo === motivo }"
            text
            :aria-pressed="fluxo.pedido.motivo === motivo"
            @click="fluxo.escolherMotivo(motivo)"
          >
            <span class="fx-opcao__icone" aria-hidden="true">
              <i class="ph" :class="ICONE[motivo]" />
            </span>
            <span class="fx-opcao__texto">
              <strong>{{ t(`clinico.pedidos.app.motivo.${motivo}`) }}</strong>
              <span>{{ t(`clinico.pedidos.app.motivoAjuda.${motivo}`) }}</span>
            </span>
            <i
              class="ph fx-opcao__fim"
              :class="motivo === 'SINTOMA' ? 'ph-caret-down' : 'ph-caret-right'"
              aria-hidden="true"
            />
          </Button>
        </li>
      </ul>

      <!-- Sintoma: os sinais que não esperam, e o que a pessoa quiser contar. -->
      <section v-if="sintoma" class="fx-bloco">
        <p class="fx-rotulo">{{ t('clinico.pedidos.app.sinaisTitulo') }}</p>
        <label v-for="sinal in SINAIS_DE_EMERGENCIA" :key="sinal" class="motivo__sinal">
          <Checkbox v-model="fluxo.pedido.sinais" :value="sinal" />
          {{ t(`clinico.pedidos.app.sinal.${sinal}`) }}
        </label>

        <label class="fx-campo">
          <span>{{ t('clinico.pedidos.app.queixa') }}</span>
          <Textarea
            v-model="fluxo.pedido.queixa"
            rows="3"
            auto-resize
            fluid
            :maxlength="LIMITES_CLINICOS.observacaoDoAgendamento"
          />
        </label>
      </section>
    </div>

    <div v-if="sintoma" class="fx-rodape">
      <Button
        :label="
          fluxo.pedido.sinais.length > 0
            ? t('clinico.pedidos.app.verEmergencia')
            : t('clinico.pedidos.app.continuar')
        "
        :icon="fluxo.pedido.sinais.length > 0 ? 'ph ph-first-aid' : 'ph ph-arrow-right'"
        :icon-pos="fluxo.pedido.sinais.length > 0 ? 'left' : 'right'"
        @click="fluxo.seguirDoMotivo()"
      />
    </div>
  </div>
</template>

<style scoped>
.motivo__sinal {
  display: flex;
  align-items: center;
  min-height: 2.25rem;
  gap: 0.55rem;
  cursor: pointer;
}
</style>
