<script setup lang="ts">
/**
 * Registrar ocorrência — a regra R3 no ponto em que ela nasce.
 *
 * A gravidade é a **única** entrada da regra, e a tela diz isso em voz alta: escolher "grave"
 * mostra, na hora, que a casa vai ter de ligar antes do fim do turno. Esconder a consequência
 * atrás do salvamento faria alguém marcar grave por precaução e descobrir o travamento depois —
 * e quem descobre assim aprende a marcar moderada.
 *
 * A conduta é obrigatória. Ocorrência sem conduta é fofoca: quem lê amanhã precisa saber o que já
 * foi feito para não repetir, e o responsável ao telefone quer ouvir isso antes de perguntar.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import { exigeContato } from '../../domain/estadia'
import type { GravidadeDaOcorrencia, OcorrenciaKind } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  petNome: string
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  confirmar: [
    payload: {
      kind: OcorrenciaKind
      gravidade: GravidadeDaOcorrencia
      descricao: string
      conduta: string
      encaminhadaAoVeterinario: boolean
    },
  ]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const KINDS: OcorrenciaKind[] = [
  'recusa-alimentar',
  'vomito',
  'diarreia',
  'apatia',
  'tosse',
  'estresse',
  'briga',
  'lesao',
  'tentativa-de-fuga',
  'destruicao',
  'outro',
]

const GRAVIDADES: GravidadeDaOcorrencia[] = ['leve', 'moderada', 'grave']

const kind = ref<OcorrenciaKind>('recusa-alimentar')
const gravidade = ref<GravidadeDaOcorrencia>('leve')
const descricao = ref('')
const conduta = ref('')
const encaminhar = ref(false)

const vaiTravar = computed(() => exigeContato(gravidade.value))

const podeSalvar = computed(() => descricao.value.trim() !== '' && conduta.value.trim() !== '')

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      kind.value = 'recusa-alimentar'
      gravidade.value = 'leve'
      descricao.value = ''
      conduta.value = ''
      encaminhar.value = false
    }
  },
)

/* Grave quase sempre vai ao veterinário de retaguarda; marcar sozinho poupa o clique certo. */
watch(gravidade, (valor) => {
  encaminhar.value = valor === 'grave'
})

function confirmar() {
  if (!podeSalvar.value) {
    return
  }

  emit('confirmar', {
    kind: kind.value,
    gravidade: gravidade.value,
    descricao: descricao.value,
    conduta: conduta.value,
    encaminhadaAoVeterinario: encaminhar.value,
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.ocorrencia.titulo', { pet: petNome })"
    :style="{ width: 'min(38rem, 94vw)' }"
    class="clinic-scope"
    @update:visible="emit('fechar')"
  >
    <div class="ocor">
      <div class="campo">
        <label :for="`${idCampo}-kind`">{{ t('hotel.ocorrencia.oQue') }}</label>
        <Select
          :input-id="`${idCampo}-kind`"
          v-model="kind"
          :options="KINDS.map((item) => ({ valor: item, rotulo: formato.ocorrenciaKind(item) }))"
          option-label="rotulo"
          option-value="valor"
          fluid
        />
      </div>

      <div class="campo">
        <span class="campo__rotulo">{{ t('hotel.ocorrencia.gravidade') }}</span>
        <SelectButton
          v-model="gravidade"
          :options="GRAVIDADES.map((item) => ({ valor: item, rotulo: formato.gravidade(item) }))"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('hotel.ocorrencia.gravidade')"
        />
      </div>

      <!--
        A consequência aparece no instante da escolha, e não depois de salvar. Quem descobre o
        travamento pelo erro aprende a não marcar grave — que é o contrário do que a regra quer.
      -->
      <Message v-if="vaiTravar" severity="warn" :closable="false">
        {{ t('hotel.ocorrencia.vaiTravar') }}
      </Message>

      <div class="campo">
        <label :for="`${idCampo}-descricao`">{{ t('hotel.ocorrencia.descricao') }}</label>
        <Textarea
          :id="`${idCampo}-descricao`"
          v-model="descricao"
          rows="3"
          auto-resize
          fluid
          :placeholder="t('hotel.ocorrencia.descricaoDica')"
        />
      </div>

      <div class="campo">
        <label :for="`${idCampo}-conduta`">{{ t('hotel.ocorrencia.conduta') }}</label>
        <Textarea
          :id="`${idCampo}-conduta`"
          v-model="conduta"
          rows="2"
          auto-resize
          fluid
          :placeholder="t('hotel.ocorrencia.condutaDica')"
        />
      </div>

      <div class="campo campo--linha">
        <label :for="`${idCampo}-vet`">{{ t('hotel.ocorrencia.encaminhar') }}</label>
        <ToggleSwitch :input-id="`${idCampo}-vet`" v-model="encaminhar" />
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
        :label="t('hotel.ocorrencia.registrar')"
        icon="pi pi-flag"
        :loading="salvando"
        :disabled="!podeSalvar"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.ocor {
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
