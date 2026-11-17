<script setup lang="ts">
/**
 * A faixa de todas as telas do protótipo: diz, antes de qualquer número, que eles são ilustrativos
 * (uma simulação dos 90 primeiros dias), para ninguém sair da apresentação achando que são medidos.
 * Abrir uma tela daqui liga o espaço no menu; "Sair do protótipo" desliga e volta ao Início.
 */
import Button from 'primevue/button'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { dataCurta, PERIODO } from '@/features/saude-publica/dados'
import { usePrototipoSaudePublica } from '@/features/saude-publica/prototipo'

const router = useRouter()
const { ligar, desligar } = usePrototipoSaudePublica()

onMounted(ligar)

function sair() {
  desligar()
  void router.push('/inicio')
}
</script>

<template>
  <p class="aviso-prototipo" role="note">
    <span class="aviso-prototipo__selo">
      <i class="ph ph-flask" aria-hidden="true" />
      Protótipo
    </span>
    <span class="aviso-prototipo__texto">
      Dados ilustrativos: uma simulação dos 90 primeiros dias do programa em Campo Grande ({{
        dataCurta(PERIODO.inicio)
      }}
      a {{ dataCurta(PERIODO.fim) }}), para mostrar o que a Prefeitura recebe. Nenhum tutor é
      identificado.
    </span>
    <Button
      type="button"
      size="small"
      severity="secondary"
      outlined
      icon="ph ph-sign-out"
      label="Sair do protótipo"
      class="aviso-prototipo__sair"
      @click="sair"
    />
  </p>
</template>

<style scoped>
.aviso-prototipo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin: 0;
  padding: 10px 12px 10px 10px;
  border: 1px dashed color-mix(in oklab, var(--portal-tinta) 45%, var(--linha));
  border-radius: 14px;
  background: color-mix(in oklab, var(--portal-fundo) 45%, var(--superficie));
  color: var(--tinta-2);
  font-size: 13.5px;
}

.aviso-prototipo__selo {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.aviso-prototipo__texto {
  flex: 1 1 24rem;
  min-width: 0;
}

.aviso-prototipo__sair {
  flex: none;
}
</style>
