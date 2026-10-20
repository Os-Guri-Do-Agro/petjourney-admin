<script setup lang="ts">
/**
 * Registrar no diário.
 *
 * O diário é o que o responsável de fato compra: o hotel vende diária, e o cliente compra saber
 * que o animal está bem. Por isso o formulário é curto — três campos e um botão. Um registro que
 * custa dois minutos não acontece num turno com dezoito animais, e um diário vazio não vale nada
 * para ninguém.
 *
 * A foto é opcional e, no protótipo, são as iniciais do hóspede: o mock não carrega imagem, e
 * fingir que carrega criaria uma tela que muda de forma quando a API chegar.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type { RegistroKind } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  petNome: string
  petIniciais: string
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  confirmar: [payload: { kind: RegistroKind; texto: string; foto: string | null }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const KINDS: RegistroKind[] = [
  'refeicao',
  'passeio',
  'brincadeira',
  'sono',
  'eliminacao',
  'banho',
  'carinho',
  'observacao',
]

const kind = ref<RegistroKind>('brincadeira')
const texto = ref('')
const comFoto = ref(true)

const podeSalvar = computed(() => texto.value.trim() !== '')

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      kind.value = 'brincadeira'
      texto.value = ''
      comFoto.value = true
    }
  },
)

/** O desenho de cada registro, o mesmo da lista do diário na estadia. */
const ICONE: Record<RegistroKind, string> = {
  refeicao: 'ph ph-bowl-food',
  passeio: 'ph ph-paw-print',
  brincadeira: 'ph ph-tennis-ball',
  sono: 'ph ph-moon-stars',
  eliminacao: 'ph ph-drop',
  banho: 'ph ph-bathtub',
  carinho: 'ph ph-heart',
  observacao: 'ph ph-note-pencil',
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.diario.titulo', { pet: petNome })"
    :style="{ width: 'min(36rem, 94vw)' }"
    class="clinic-scope"
    @update:visible="emit('fechar')"
  >
    <div class="diario">
      <!--
        Oito momentos, em botões com desenho e nome: escolher lendo uma fileira que quebra em três
        linhas é escolher errado. Cada botão é rádio de verdade para o teclado.
      -->
      <fieldset class="momentos">
        <legend class="campo__rotulo">{{ t('hotel.diario.oQue') }}</legend>

        <label
          v-for="item in KINDS"
          :key="item"
          class="momento"
          :class="{ 'momento--ativo': kind === item }"
        >
          <input v-model="kind" type="radio" :name="`${idCampo}-kind`" :value="item" class="momento__radio" />
          <i :class="ICONE[item]" aria-hidden="true" />
          <span>{{ formato.registroKind(item) }}</span>
        </label>
      </fieldset>

      <div class="campo">
        <label :for="`${idCampo}-texto`" class="campo__rotulo">{{ t('hotel.diario.texto') }}</label>
        <Textarea
          :id="`${idCampo}-texto`"
          v-model="texto"
          rows="3"
          auto-resize
          fluid
          :placeholder="t('hotel.diario.textoDica')"
        />
      </div>

      <div class="campo campo--linha">
        <label :for="`${idCampo}-foto`" class="campo__rotulo">
          <i class="ph ph-camera" aria-hidden="true" />
          {{ t('hotel.diario.comFoto') }}
        </label>
        <ToggleSwitch :input-id="`${idCampo}-foto`" v-model="comFoto" />
      </div>

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('hotel.diario.registrar')"
        icon="ph ph-check"
        :loading="salvando"
        :disabled="!podeSalvar"
        @click="
          emit('confirmar', {
            kind,
            texto,
            foto: comFoto ? petIniciais : null,
          })
        "
      />
    </template>
  </Dialog>
</template>

<style scoped>
.diario {
  display: grid;
  gap: 18px;
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 6px;
}

.campo--linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.campo__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.campo__rotulo i {
  color: var(--hotel-tinta);
  font-size: 17px;
}

.momentos {
  display: grid;
  margin: 0;
  padding: 0;
  border: 0;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.momentos legend {
  margin-bottom: 8px;
}

.momento {
  display: grid;
  min-height: 64px;
  justify-items: center;
  align-content: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 550;
  text-align: center;
  transition:
    border-color var(--pj-tempo-curto) ease,
    background-color var(--pj-tempo-curto) ease;
}

.momento i {
  font-size: 20px;
}

.momento:hover {
  border-color: var(--hotel);
  color: var(--tinta);
}

/* O rádio some da tela, mas não do teclado nem do leitor: é ele que carrega o estado. */
.momento__radio {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
}

.momento:has(.momento__radio:focus-visible) {
  outline: 2px solid var(--hotel);
  outline-offset: 2px;
}

/* O escolhido: borda dobrada e a cor do hotel. Forma e cor, nunca só cor. */
.momento--ativo {
  border: 2px solid var(--hotel);
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-weight: 650;
}

.erro {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 500;
}

.erro i {
  flex: none;
  font-size: 18px;
}

@media (max-width: 520px) {
  .momentos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .momento {
    min-height: 0;
    grid-auto-flow: column;
    justify-content: start;
    padding: 10px 12px;
    text-align: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .momento {
    transition: none;
  }
}
</style>
