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
import Message from 'primevue/message'
import SelectButton from 'primevue/selectbutton'
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
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.diario.titulo', { pet: petNome })"
    :style="{ width: 'min(34rem, 94vw)' }"
    class="clinic-scope hc-tema"
    @update:visible="emit('fechar')"
  >
    <div class="diario">
      <div class="campo">
        <span class="campo__rotulo">{{ t('hotel.diario.oQue') }}</span>
        <SelectButton
          v-model="kind"
          :options="KINDS.map((item) => ({ valor: item, rotulo: formato.registroKind(item) }))"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.diario.oQue')"
        />
      </div>

      <div class="campo">
        <label :for="`${idCampo}-texto`">{{ t('hotel.diario.texto') }}</label>
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
        <label :for="`${idCampo}-foto`">{{ t('hotel.diario.comFoto') }}</label>
        <ToggleSwitch :input-id="`${idCampo}-foto`" v-model="comFoto" />
      </div>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.diario.registrar')"
        icon="ph ph-camera"
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
  gap: var(--clinic-space-3);
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 0.25rem;
}

.campo--linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.campo label,
.campo__rotulo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
