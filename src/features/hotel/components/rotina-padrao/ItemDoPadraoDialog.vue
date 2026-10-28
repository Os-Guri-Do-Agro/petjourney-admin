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

/**
 * O que foi digitado e não virou horário ("9h", "25:00").
 *
 * A leitura descartava em silêncio: "9h, 25:00, 16:00" virava só "16:00", com o Aplicar aceso, e a
 * higiene das nove sumia da casa sem ninguém notar. Agora a tela diz o que ficou de fora.
 */
const ignorados = computed(() =>
  texto.value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item !== '' && lerHorarios(item).length === 0),
)

const problemas = computed(() =>
  props.item
    ? problemasDoItem({ ...props.item, horarios: horarios.value, ativo: ativo.value })
    : [],
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
    :header="
      item ? t('hotel.rotinaPadrao.editarTitulo', { servico: formato.tarefaKind(item.kind) }) : ''
    "
    :style="{ width: 'min(32rem, 96vw)' }"
    class="clinic-dialog hc-tema pj-lugar--hotel"
    dismissable-mask
    @update:visible="emit('fechar')"
  >
    <div v-if="item" class="editor">
      <label class="liga">
        <span class="liga__icone" :class="{ 'liga__icone--off': !ativo }" aria-hidden="true">
          <IconeDeTarefa :kind="item.kind" />
        </span>
        <span class="liga__rotulo">{{ t('hotel.rotinaPadrao.ativo') }}</span>
        <ToggleSwitch v-model="ativo" />
      </label>

      <div class="campo">
        <label :for="`${idCampo}-horarios`">{{ t('hotel.rotinaPadrao.campoHorarios') }}</label>
        <InputText
          :id="`${idCampo}-horarios`"
          v-model="texto"
          class="campo__horarios"
          autocomplete="off"
          fluid
        />
        <p class="campo__dica">{{ t('hotel.rotinaPadrao.campoHorariosDica') }}</p>
      </div>

      <!--
        A leitura do que foi digitado, já ordenada e sem repetidos. É o que de fato vai ser
        gravado, e vê-lo antes de aplicar é o que faz o campo de texto ser seguro.
      -->
      <ul v-if="horarios.length > 0" class="chips" :class="{ 'chips--off': !ativo }">
        <li v-for="hora in horarios" :key="hora" class="chip ui-hora">{{ hora }}</li>
      </ul>

      <Message v-if="ignorados.length > 0" severity="error" :closable="false">
        {{ t('hotel.rotinaPadrao.ignorados', { itens: ignorados.join(', ') }) }}
      </Message>

      <Message v-if="problemas.includes('sem-horario')" severity="warn" :closable="false">
        {{ t('hotel.rotinaPadrao.semHorario') }}
      </Message>

      <Message v-if="problemas.includes('horarios-demais')" severity="warn" :closable="false">
        {{ t('hotel.rotinaPadrao.horarios', { total: horarios.length }, horarios.length) }}
      </Message>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('hotel.rotinaPadrao.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('hotel.rotinaPadrao.aplicar')"
        icon="ph ph-check"
        :disabled="ignorados.length > 0"
        @click="aplicar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 18px;
}

/* Ligar e desligar o serviço: uma linha inteira clicável, com o serviço na frente. */
.liga {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  cursor: pointer;
}

.liga__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 14px;
}

.liga__icone--off {
  background: var(--superficie-2);
  color: var(--tinta-3);
}

.liga__rotulo {
  flex: 1;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.campo {
  display: grid;
  gap: 6px;
}

.campo label {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.campo__horarios {
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
}

.campo__dica {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

/* Os horários lidos, como pastilhas: é a confirmação visual do que o texto virou. */
.chips {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: 6px;
  list-style: none;
}

.chip.ui-hora {
  padding: 4px 10px;
  border-radius: 7px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 14px;
}

.chips--off .chip.ui-hora {
  background: var(--superficie-2);
  color: var(--tinta-3);
}
</style>
