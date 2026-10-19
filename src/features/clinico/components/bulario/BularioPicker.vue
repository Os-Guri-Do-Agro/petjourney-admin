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
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * O alto diz o que se está fazendo e **para quem** (o paciente e a espécie), como os
 * diálogos da Agenda. Embaixo, a mesma lista e a mesma ficha da tela do bulário, lado a lado; a
 * ficha rola dentro de si. No pé, o aviso de espécie contraindicada à esquerda, com a palavra, e
 * o botão que muda de cor e de texto quando a escolha vai contra ele.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BularioDetalhe from './BularioDetalhe.vue'
import BularioLista from './BularioLista.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
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
const formato = useClinicFormat()
const idTitulo = useId()

/**
 * "Para Cacau · Canina": o diálogo cobre o prontuário, e a escolha é para alguém. O peso fica de
 * fora de propósito: o que vale na receita é o aferido na consulta, que o prontuário conhece e
 * este diálogo não.
 */
const paraQuem = computed(() =>
  props.pet
    ? `${t('clinico.bulario.escolherPara', { pet: props.pet.nome })} · ${formato.especie(props.pet.especie)}`
    : '',
)

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

/**
 * Reabrir cai no medicamento em uso e na espécie do paciente, não no estado da vez passada.
 *
 * Sem medicamento em uso (uma prescrição nova), nada vem marcado. Abrir já no primeiro da lista
 * fazia de "Adicionar" + "Usar na prescrição" uma receita de Amoxicilina que ninguém escolheu.
 */
watch(
  () => props.visivel,
  (aberto) => {
    if (!aberto) {
      return
    }

    selecionadoId.value = props.atualId
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
    class="clinic-dialog hc-tema picker"
    :style="{ width: 'min(64rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <div class="picker__topo">
        <span class="picker__icone" aria-hidden="true"><i class="ph ph-book-open-text" /></span>
        <span class="picker__titulos">
          <h2 :id="idTitulo" class="picker__titulo">{{ t('clinico.bulario.escolherTitulo') }}</h2>
          <span v-if="paraQuem" class="picker__para">{{ paraQuem }}</span>
        </span>
      </div>
    </template>

    <div class="picker__corpo">
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
        <div v-else class="picker__vazio">
          <span class="picker__vazio-icone" aria-hidden="true">
            <i class="ph ph-arrow-left" />
          </span>
          <p>{{ t('clinico.bulario.escolhaNaLista') }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="picker__rodape">
        <span v-if="proibido" class="ui-selo ui-selo--risco picker__alerta" role="status">
          <i class="ph ph-prohibit" aria-hidden="true" />
          {{ t('clinico.bulario.proibidoRodape') }}
        </span>

        <Button
          type="button"
          severity="secondary"
          text
          :label="t('clinico.comum.cancelar')"
          @click="emit('update:visivel', false)"
        />
        <Button
          type="button"
          :severity="proibido ? 'danger' : 'primary'"
          :icon="proibido ? 'ph ph-warning' : 'ph ph-check'"
          :disabled="!selecionado"
          :label="proibido ? t('clinico.bulario.usarMesmoAssim') : t('clinico.bulario.usar')"
          @click="confirmar"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* ------------------------------------------------------------------------------------ o alto */

.picker__topo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.picker__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.picker__titulos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.picker__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.picker__para {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------------------------------------------------------------------------------- o corpo */

.picker__corpo {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(16rem, 21rem) minmax(0, 1fr);
}

.picker__lista {
  min-width: 0;
}

/* A ficha rola dentro de si: a lista fica parada ao lado, como na tela do bulário. */
.picker__ficha {
  min-width: 0;
  max-height: min(30rem, 62vh);
  overflow-y: auto;
  padding: 18px 20px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  overscroll-behavior: contain;
}

.picker__vazio {
  display: grid;
  justify-items: start;
  gap: 8px;
}

.picker__vazio-icone {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 20px;
}

.picker__vazio p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

[dir='rtl'] .picker__vazio .ph-arrow-left {
  transform: scaleX(-1);
}

/* ------------------------------------------------------------------------------------- o pé */

.picker__rodape {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.picker__alerta {
  height: auto;
  min-height: 28px;
  margin-inline-end: auto;
  padding-block: 4px;
  font-size: 13px;
  white-space: normal;
}

@media (max-width: 820px) {
  .picker__corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .picker__ficha {
    max-height: 18rem;
  }

  .picker__para {
    white-space: normal;
  }
}
</style>
