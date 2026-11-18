<script setup lang="ts">
/**
 * "Para qual paciente?": o passo de antes das ações que precisam de um paciente e começam fora da
 * ficha dele (as Ações rápidas do Início: atender agora, aplicar vacina).
 *
 * A gaveta só escolhe: a busca é a mesma das outras gavetas (nome do pet, do responsável ou
 * telefone), e quem abriu decide o que fazer com o paciente escolhido — o botão de confirmar diz
 * o quê ("Abrir atendimento", "Ir para as vacinas"). Ocupado e erro vêm de fora, porque a ação é
 * de quem abriu.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import OpcaoDoPaciente from '@/components/cadastro/OpcaoDoPaciente.vue'
import { useListaAoClicar } from '@/components/cadastro/useListaAoClicar'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'

const props = defineProps<{
  titulo: string
  icone: string
  /** O que acontece ao confirmar, no botão: "Abrir atendimento". */
  confirmar: string
  iconeDoConfirmar?: string
  ocupado?: boolean
  erro?: string
}>()

const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ escolhido: [paciente: PacienteNaLista] }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const paciente = ref<PacienteNaLista | null>(null)
const sugestoes = ref<PacienteNaLista[]>([])
const tentou = ref(false)

watch(aberta, (agora) => {
  if (!agora) return
  paciente.value = null
  sugestoes.value = []
  tentou.value = false
})

/** Clicar no campo já mostra a lista dos pacientes, sem esperar a digitação. */
const { campo: campoDoPaciente, abrirLista } = useListaAoClicar()

async function buscar(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 20 }, parceiroQuery())
    sugestoes.value = pagina.itens
  } catch {
    sugestoes.value = []
  }
}

function rotuloDoPaciente(item: PacienteNaLista) {
  return `${item.nome} · ${item.cliente.nome}`
}

const escolhido = computed(() =>
  paciente.value && typeof paciente.value === 'object' ? paciente.value : null,
)

function enviar() {
  tentou.value = true
  if (!escolhido.value || props.ocupado) return
  emit('escolhido', escolhido.value)
}
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="titulo" :icone="icone" largura="32rem">
    <form id="escolher-paciente" class="eg" novalidate @submit.prevent="enviar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="ep-paciente">{{ t('inicio.rapidas.campoPaciente') }}</label>
        <AutoComplete
          ref="campoDoPaciente"
          v-model="paciente"
          input-id="ep-paciente"
          :suggestions="sugestoes"
          :option-label="rotuloDoPaciente"
          :placeholder="t('fila.buscarPaciente')"
          :invalid="tentou && !escolhido"
          :disabled="ocupado"
          force-selection
          autofocus
          @complete="buscar"
          @click="abrirLista"
          @keydown.down="abrirLista"
        >
          <template #option="{ option }">
            <OpcaoDoPaciente :paciente="option">
              <span class="ep__opcao">
                <strong>{{ option.nome }}</strong>
                <small> {{ rotulos.especie(option) }} · {{ option.cliente.nome }} </small>
              </span>
            </OpcaoDoPaciente>
          </template>
        </AutoComplete>
        <small v-if="tentou && !escolhido" class="eg__invalido">{{
          t('fila.pacienteObrigatorio')
        }}</small>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="ocupado"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="escolher-paciente"
        :icon="iconeDoConfirmar ?? 'ph ph-arrow-right'"
        :label="confirmar"
        :loading="ocupado"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ep__opcao {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.ep__opcao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}
</style>
