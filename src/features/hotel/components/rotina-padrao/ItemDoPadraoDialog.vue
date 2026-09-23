<script setup lang="ts">
/**
 * Editar uma linha da rotina da casa: os horários e se ela acontece.
 *
 * Os horários são **digitados como se ditam ao telefone** — "8:00, 12:00, 18:00" — e não montados
 * num seletor de relógio. É a forma que o check-in já usa, e ela vem de observar o trabalho: quem
 * mexe nisto sabe de cor o que quer, e um seletor por horário transforma quatro palavras em doze
 * toques. A lista aparece normalizada logo abaixo enquanto se digita, então o erro de digitação se
 * vê antes de aplicar.
 *
 * Nada aqui grava: o diálogo devolve a linha e a tela guarda em rascunho. Gravar só acontece na
 * publicação, que é onde a pessoa vê o que a mudança faz com a casa cheia.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { ItemDeRotina } from '../../data/types'
import { escreverHorarios, lerHorarios, problemasDoItem } from '../../domain/rotina-padrao'

const props = defineProps<{
  /** A linha em edição. `null` mantém o diálogo fechado. */
  item: ItemDeRotina | null
}>()

const emit = defineEmits<{
  fechar: []
  aplicar: [item: ItemDeRotina]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const texto = ref('')
const ativo = ref(true)

watch(
  () => props.item,
  (item) => {
    if (!item) return

    texto.value = escreverHorarios(item.horarios)
    ativo.value = item.ativo
  },
  { immediate: true },
)

const horarios = computed(() => lerHorarios(texto.value))

const problemas = computed(() =>
  props.item ? problemasDoItem({ ...props.item, horarios: horarios.value, ativo: ativo.value }) : [],
)

function aplicar() {
  if (!props.item) return

  emit('aplicar', { ...props.item, horarios: horarios.value, ativo: ativo.value })
}
</script>

<template>
  <Dialog
    :visible="!!item"
    modal
    :header="item ? t('hotel.rotinaPadrao.editarTitulo', { servico: formato.tarefaKind(item.kind) }) : ''"
    :style="{ width: 'min(30rem, 94vw)' }"
    class="clinic-dialog"
    @update:visible="emit('fechar')"
  >
    <div v-if="item" class="editor">
      <label class="linha">
        <ToggleSwitch v-model="ativo" />
        <span class="linha__rotulo">
          <IconeDeTarefa :kind="item.kind" class="linha__icone" />
          {{ t('hotel.rotinaPadrao.ativo') }}
        </span>
      </label>

      <div class="campo">
        <label :for="`${idCampo}-horarios`">{{ t('hotel.rotinaPadrao.campoHorarios') }}</label>
        <InputText :id="`${idCampo}-horarios`" v-model="texto" autocomplete="off" />
        <p class="campo__dica">{{ t('hotel.rotinaPadrao.campoHorariosDica') }}</p>
      </div>

      <!--
        A leitura do que foi digitado, já ordenada e sem repetidos. É o que de fato vai ser
        gravado, e vê-lo antes de aplicar é o que faz o campo de texto ser seguro.
      -->
      <ul v-if="horarios.length > 0" class="chips">
        <li v-for="hora in horarios" :key="hora" class="chip clinic-value">{{ hora }}</li>
      </ul>

      <Message v-if="problemas.includes('sem-horario')" severity="warn" :closable="false">
        {{ t('hotel.rotinaPadrao.semHorario') }}
      </Message>

      <Message v-if="problemas.includes('horarios-demais')" severity="warn" :closable="false">
        {{ t('hotel.rotinaPadrao.horarios', { total: horarios.length }, horarios.length) }}
      </Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.rotinaPadrao.cancelar')"
        severity="secondary"
        text
        size="small"
        @click="emit('fechar')"
      />
      <Button :label="t('hotel.rotinaPadrao.aplicar')" size="small" @click="aplicar" />
    </template>
  </Dialog>
</template>

<style scoped>
.editor {
  display: grid;
  gap: var(--clinic-space-4);
}

.linha {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
  cursor: pointer;
}

.linha__rotulo {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-value);
  font-weight: 700;
}

.linha .linha__icone {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--clinic-accent-strong);
}

.campo {
  display: grid;
  gap: var(--clinic-space-2);
}

.campo label {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__dica {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* Os horários lidos, como pastilhas: é a confirmação visual do que o texto virou. */
.chips {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-2);
  list-style: none;
}

.chip {
  padding: 0.15rem var(--clinic-space-3);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
</style>
