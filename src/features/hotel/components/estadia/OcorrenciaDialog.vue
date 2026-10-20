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
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <div class="ocor">
      <div class="grade">
        <div class="campo">
          <label :for="`${idCampo}-kind`" class="campo__rotulo">{{ t('hotel.ocorrencia.oQue') }}</label>
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
          <span :id="`${idCampo}-gravidade`" class="campo__rotulo">{{ t('hotel.ocorrencia.gravidade') }}</span>
          <SelectButton
            v-model="gravidade"
            class="gravidade"
            :class="`gravidade--${gravidade}`"
            :options="GRAVIDADES.map((item) => ({ valor: item, rotulo: formato.gravidade(item) }))"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            :aria-labelledby="`${idCampo}-gravidade`"
          />
        </div>
      </div>

      <!--
        A consequência aparece no instante da escolha, e não depois de salvar. Quem descobre o
        travamento pelo erro aprende a não marcar grave — que é o contrário do que a regra quer.
      -->
      <p v-if="vaiTravar" class="consequencia" role="status">
        <i class="ph ph-phone-call" aria-hidden="true" />
        {{ t('hotel.ocorrencia.vaiTravar') }}
      </p>

      <div class="campo">
        <label :for="`${idCampo}-descricao`" class="campo__rotulo">{{ t('hotel.ocorrencia.descricao') }}</label>
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
        <label :for="`${idCampo}-conduta`" class="campo__rotulo">{{ t('hotel.ocorrencia.conduta') }}</label>
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
        <label :for="`${idCampo}-vet`" class="campo__rotulo">
          <i class="ph ph-first-aid" aria-hidden="true" />
          {{ t('hotel.ocorrencia.encaminhar') }}
        </label>
        <ToggleSwitch :input-id="`${idCampo}-vet`" v-model="encaminhar" />
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
        :label="t('hotel.ocorrencia.registrar')"
        icon="ph ph-flag"
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
  gap: 18px;
}

.grade {
  display: grid;
  gap: 14px 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
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
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.campo__rotulo i {
  color: var(--hotel-tinta);
  font-size: 17px;
}

/* A gravidade escolhida leva a cor dela: âmbar moderada, vermelho grave — e a palavra junto. */
.gravidade--moderada :deep(.p-togglebutton-checked .p-togglebutton-label) {
  color: var(--atencao-tinta);
}

.gravidade--grave :deep(.p-togglebutton-checked .p-togglebutton-label) {
  color: var(--risco-tinta);
  font-weight: 650;
}

.consequencia {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.consequencia i {
  flex: none;
  font-size: 18px;
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
</style>
