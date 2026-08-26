<script setup lang="ts">
/**
 * Seletor de medicamento a partir da conduta.
 *
 * É a ponte entre bulário e prontuário. Antes o campo de medicamento era um `Select` com o nome
 * comercial e nada mais: quem prescrevia escolhia de memória e digitava a dose de cabeça. Aqui
 * a mesma lista do bulário aparece com busca por indicação, a ficha ao lado, e o botão devolve
 * **a dose da espécie do paciente já preenchida**.
 *
 * A escolha nunca é bloqueada — nem quando a espécie é proibida. O que a tela faz é mostrar o
 * aviso e mudar o texto do botão: prescrever assim vira ato consciente, não descuido.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BularioDetalhe from './BularioDetalhe.vue'
import BularioLista from './BularioLista.vue'
import type { Medication, Pet } from '../../data/types'
import {
  FILTRO_VAZIO,
  especieProibida,
  sugestaoDePrescricao,
  type BularioFiltro,
} from '../../domain/bulario'

const props = defineProps<{
  visivel: boolean
  medicamentos: Medication[]
  pet: Pet | null
  /** Medicamento já escolhido, para a lista abrir nele. */
  atualId: string | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  escolher: [
    escolha: {
      medicamento: Medication
      mgPorKg: number
      frequenciaHoras: number
      duracaoDias: number
    },
  ]
}>()

const { t } = useI18n()

const filtro = ref<BularioFiltro>({ ...FILTRO_VAZIO })
const selecionadoId = ref<string | null>(props.atualId)

const selecionado = computed(
  () => props.medicamentos.find((item) => item.id === selecionadoId.value) ?? null,
)

const proibido = computed(
  () =>
    Boolean(selecionado.value && props.pet) &&
    especieProibida(selecionado.value as Medication, (props.pet as Pet).especie),
)

/** Reabrir cai no medicamento em uso e na espécie do paciente, não no estado da vez passada. */
watch(
  () => props.visivel,
  (aberto) => {
    if (!aberto) {
      return
    }

    selecionadoId.value = props.atualId ?? props.medicamentos[0]?.id ?? null
    filtro.value = { ...FILTRO_VAZIO, especie: props.pet?.especie ?? null }
  },
)

function confirmar() {
  const medicamento = selecionado.value

  if (!medicamento) {
    return
  }

  emit('escolher', { medicamento, ...sugestaoDePrescricao(medicamento, props.pet) })
  emit('update:visivel', false)
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog picker"
    :style="{ width: 'min(62rem, 94vw)' }"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i :class="'pi pi-book'" /></span>
        {{ t('clinico.bulario.escolherTitulo') }}
      </h2>
    </template>

    <div class="picker__corpo clinic-scope">
      <div class="picker__lista">
        <BularioLista
          compacta
          :medicamentos="medicamentos"
          :filtro="filtro"
          :selecionado-id="selecionadoId"
          :pet="pet"
          @update:filtro="filtro = $event"
          @selecionar="selecionadoId = $event.id"
        />
      </div>

      <div class="picker__ficha">
        <BularioDetalhe v-if="selecionado" :medicamento="selecionado" :pet="pet" />
      </div>
    </div>

    <template #footer>
      <div class="picker__rodape">
        <span v-if="proibido" class="picker__alerta">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          {{ t('clinico.bulario.proibidoRodape') }}
        </span>

        <Button
          severity="secondary"
          text
          :label="t('clinico.comum.cancelar')"
          @click="emit('update:visivel', false)"
        />
        <Button
          :severity="proibido ? 'danger' : 'primary'"
          :disabled="!selecionado"
          :label="proibido ? t('clinico.bulario.usarMesmoAssim') : t('clinico.bulario.usar')"
          @click="confirmar"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.picker__corpo {
  display: grid;
  gap: var(--clinic-space-4);
  grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr);
}

.picker__ficha {
  max-height: 24rem;
  overflow-y: auto;
  padding-right: var(--clinic-space-2);
}

.picker__rodape {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
}

.picker__alerta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-right: auto;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

@media (max-width: 820px) {
  .picker__corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .picker__ficha {
    max-height: 16rem;
  }
}
</style>
