<script setup lang="ts">
/**
 * A sugestão que aparece ao abrir o histórico: "veja este paciente em 30 segundos".
 *
 * Um modal que interrompe só se paga se disser **por que agora**. Por isso ele não é um
 * anúncio genérico da tela nova: traz os primeiros sinais do próprio paciente — a perda de peso,
 * o desmaio registrado em casa — ou diz que não há nada fora do comum. Quem lê já sabe se vale
 * o clique.
 *
 * "Não sugerir mais" vale para todos os pacientes e é reversível na tela do resumo; o modal diz
 * onde, para que desligar não pareça definitivo. Fechar sem marcar só fecha: na próxima abertura
 * de histórico ele volta.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ResumoSinais from './ResumoSinais.vue'
import { useClinicPrefs } from '../../../composables/useClinicPrefs'
import type { ResumoDoPaciente } from '../../../domain/resumo-do-paciente'

const props = defineProps<{
  visivel: boolean
  petNome: string
  resumo: ResumoDoPaciente
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  ver: []
}>()

/** Na sugestão, dois sinais bastam: o resto é o motivo de abrir o resumo. */
const SINAIS_NA_SUGESTAO = 2

const { t } = useI18n()
const prefs = useClinicPrefs()
const idDoCheckbox = useId()

const naoSugerirMais = ref(false)

watch(
  () => props.visivel,
  (aberto) => {
    if (aberto) {
      naoSugerirMais.value = false
    }
  },
)

/** A escolha vale em qualquer saída do modal — ver o resumo, "agora não", Esc ou clique fora. */
function aplicarEscolha() {
  if (naoSugerirMais.value) {
    prefs.sugerirResumo.value = false
  }
}

function fechar() {
  aplicarEscolha()
  emit('update:visivel', false)
}

function ver() {
  aplicarEscolha()
  emit('update:visivel', false)
  emit('ver')
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(34rem, 94vw)' }"
    :dismissable-mask="true"
    @update:visible="(valor) => (valor ? emit('update:visivel', true) : fechar())"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="pi pi-stopwatch" /></span>
        {{ t('clinico.resumoDoPaciente.sugestao.titulo', { nome: petNome }) }}
      </h2>
    </template>

    <div class="sugestao clinic-scope">
      <p class="sugestao__texto">{{ t('clinico.resumoDoPaciente.sugestao.texto') }}</p>

      <div class="sugestao__previa">
        <p v-if="resumo.primeiraVez" class="sugestao__primeira">
          <i class="pi pi-info-circle" aria-hidden="true" />
          {{ t('clinico.resumoDoPaciente.sugestao.primeiraVez') }}
        </p>
        <ResumoSinais v-else :sinais="resumo.sinais" :limite="SINAIS_NA_SUGESTAO" sem-moldura />
      </div>

      <div class="sugestao__escolha">
        <Checkbox v-model="naoSugerirMais" binary :input-id="idDoCheckbox" />
        <label :for="idDoCheckbox">
          {{ t('clinico.resumoDoPaciente.sugestao.naoSugerir') }}
          <span class="sugestao__dica">{{
            t('clinico.resumoDoPaciente.sugestao.comoReativar')
          }}</span>
        </label>
      </div>
    </div>

    <template #footer>
      <Button
        severity="secondary"
        text
        :label="t('clinico.resumoDoPaciente.sugestao.agoraNao')"
        @click="fechar"
      />
      <Button
        :label="t('clinico.resumoDoPaciente.sugestao.ver')"
        icon="pi pi-arrow-right"
        icon-pos="right"
        autofocus
        @click="ver"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.sugestao {
  display: grid;
  gap: var(--clinic-space-3);
}

.sugestao__texto {
  margin: 0;
  color: var(--clinic-muted);
}

.sugestao__previa {
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.sugestao__primeira {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: var(--clinic-space-2);
  font-weight: 600;
}

.sugestao__primeira .pi {
  margin-top: 0.2em;
  color: var(--clinic-accent-strong);
}

.sugestao__escolha {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-2);
}

.sugestao__escolha label {
  display: grid;
  gap: 2px;
  cursor: pointer;
  font-weight: 600;
}

.sugestao__dica {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 500;
}
</style>
