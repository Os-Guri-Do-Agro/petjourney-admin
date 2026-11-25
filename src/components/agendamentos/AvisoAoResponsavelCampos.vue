<script setup lang="ts">
/**
 * O interruptor "Avisar o responsável no app" e a mensagem (E3-06, guia e3 4.1), no marcar, no
 * mudar, no arrastar e no cancelar. A mensagem só se escreve com o interruptor ligado, aparece no
 * app (nunca na notificação) e conta como a API conta: `[...texto.trim()].length`, até 500.
 */
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { useI18n } from 'vue-i18n'

import type { AvisoAoResponsavel } from '@/components/agendamentos/useAvisoAoResponsavel'
import '@/components/parceiro/estabelecimento/gaveta.css'
import { MENSAGEM_DO_AVISO_MAX } from '@/service/parceiro/agenda-service'

const props = defineProps<{
  aviso: AvisoAoResponsavel
  /** Prefixo dos ids dos campos (o `for` dos rótulos). */
  prefixo: string
  desabilitado?: boolean
}>()

const { t } = useI18n()

/* O composable vem inteiro na prop (um objeto de refs, que não perde a reatividade ao abrir). */
const { temApp, avisar, mensagem, tamanho, longa } = props.aviso
</script>

<template>
  <section class="eg__secao avc">
    <label class="avc__chave" :for="`${prefixo}-avisar`">
      <span>
        <strong>{{ t('agendamentos.aviso.titulo') }}</strong>
        <small>{{
          temApp === false ? t('agendamentos.aviso.semApp') : t('agendamentos.aviso.comApp')
        }}</small>
      </span>
      <ToggleSwitch v-model="avisar" :input-id="`${prefixo}-avisar`" :disabled="desabilitado" />
    </label>

    <div class="avc__mensagem">
      <label class="eg__rotulo" :for="`${prefixo}-mensagem`">
        {{ t('agendamentos.aviso.mensagem') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <Textarea
        :id="`${prefixo}-mensagem`"
        v-model="mensagem"
        rows="2"
        auto-resize
        :invalid="longa"
        :disabled="desabilitado || !avisar"
        :aria-describedby="`${prefixo}-mensagem-dica`"
      />
      <div :id="`${prefixo}-mensagem-dica`" class="avc__pe">
        <small class="eg__dica">{{ t('agendamentos.aviso.mensagemDica') }}</small>
        <small class="avc__conta ui-num" :class="{ 'avc__conta--longa': longa }">
          {{ tamanho }}/{{ MENSAGEM_DO_AVISO_MAX }}
        </small>
      </div>
      <small v-if="longa" class="eg__invalido" role="alert">{{
        t('agendamentos.aviso.mensagemLonga', { max: MENSAGEM_DO_AVISO_MAX })
      }}</small>
    </div>
  </section>
</template>

<style scoped>
.avc {
  gap: 12px;
}

.avc__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.avc__chave span {
  display: grid;
  gap: 2px;
}

.avc__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.avc__chave small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.avc__mensagem {
  display: grid;
  gap: 6px;
}

.avc__pe {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.avc__conta {
  flex: none;
  color: var(--tinta-2);
  font-size: 12px;
}

.avc__conta--longa {
  color: var(--risco-tinta);
  font-weight: 600;
}
</style>
