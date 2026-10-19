<script setup lang="ts">
/**
 * Mapa de teclas do prontuário.
 *
 * Sai da mesma tabela que o ouvinte usa, então documentação e comportamento não divergem — o
 * mesmo arranjo do diálogo da agenda.
 *
 * As duas primeiras linhas não vêm da tabela porque não são atalhos globais: `Enter` e os
 * números são comportamento **de campo**, tratados onde o campo está. Continuam aqui porque
 * são o que faz o modo valer a pena, e um mapa que os omitisse esconderia o principal.
 */
import Dialog from 'primevue/dialog'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ProntuarioDialogoTopo from './ProntuarioDialogoTopo.vue'
import { TECLAS_DO_PRONTUARIO } from '../../composables/useProntuarioTeclado'

const aberto = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const idTitulo = useId()

const SIMBOLO: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
}

const linhas = computed(() => [
  { chave: 'campoSeguinte', teclas: ['Enter'] },
  { chave: 'escolherOpcao', teclas: ['1', '…', '9'] },
  { chave: 'entreOpcoes', teclas: ['←', '→'] },
  ...TECLAS_DO_PRONTUARIO.map((item) => ({
    chave: item.acao,
    teclas: ['Alt', SIMBOLO[item.tecla] ?? item.tecla.toUpperCase()],
  })),
])
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(28rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    :dismissable-mask="true"
  >
    <template #header>
      <ProntuarioDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.prontuario.teclado.titulo')"
        :subtitulo="t('clinico.prontuario.teclado.descricao')"
        icone="ph ph-keyboard"
      />
    </template>

    <dl class="mapa">
      <div v-for="linha in linhas" :key="linha.chave" class="mapa__linha">
        <dt>{{ t(`clinico.prontuario.teclado.acao.${linha.chave}`) }}</dt>
        <dd>
          <template v-for="(tecla, indice) in linha.teclas" :key="indice">
            <span v-if="tecla === '…'" class="mapa__mais">…</span>
            <kbd v-else>{{ tecla }}</kbd>
          </template>
        </dd>
      </div>
    </dl>
  </Dialog>
</template>

<style scoped>
.mapa {
  display: grid;
  margin: 0;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.mapa__linha {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px;
}

.mapa__linha + .mapa__linha {
  border-top: 1px solid var(--linha);
}

.mapa__linha dt {
  color: var(--tinta);
  font-size: 14px;
}

.mapa__linha dd {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}

/* A tecla desenhada: a mesma do campo com atalho, com a borda de baixo mais funda. */
kbd {
  display: inline-grid;
  min-width: 28px;
  height: 26px;
  padding: 0 7px;
  place-items: center;
  border: 1px solid var(--linha-forte);
  border-bottom-width: 2px;
  border-radius: 7px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-weight: 600;
}

.mapa__mais {
  color: var(--tinta-3);
}
</style>
