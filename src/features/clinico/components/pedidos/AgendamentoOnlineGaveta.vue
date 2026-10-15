<script setup lang="ts">
/**
 * Como a clínica recebe pedidos pela internet.
 *
 * Configuração rara, por isso recolhida numa gaveta lateral e não espalhada pela tela de trabalho
 * — nem num diálogo no meio dela, que tapava a caixa que a configuração muda. Quatro blocos,
 * na ordem das perguntas que a clínica se faz: recebo pedidos? por quais caminhos? o que e com
 * quem? e o que digo a quem tem uma emergência?
 *
 * O aceite automático nasce desligado e diz o que faz em uma frase: é a única chave aqui que tira a
 * recepção do caminho, e ninguém deveria ligá-la sem entender isso.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AgendamentoOnline } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  configuracao: AgendamentoOnline | null
  salvando: boolean
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  salvar: [configuracao: AgendamentoOnline]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()

const rascunho = ref<AgendamentoOnline | null>(null)

/** Cópia funda e sem reatividade: o `structuredClone` recusa o proxy do Vue. */
function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

watch(
  () => [props.visivel, props.configuracao] as const,
  ([visivel, configuracao]) => {
    if (visivel && configuracao) {
      rascunho.value = copia(configuracao)
    }
  },
  { immediate: true },
)

const aberto = computed({
  get: () => props.visivel,
  set: (valor: boolean) => emit('update:visivel', valor),
})

/** Cirurgia e emergência nunca entram: são as que pedem conversa antes de horário. */
const servicos = computed(() =>
  clinico.tipos.filter((tipo) => tipo.kind !== 'cirurgia' && tipo.kind !== 'emergencia'),
)

const profissionais = computed(() => clinico.profissionais.filter((item) => item.ativo))

/** Sem nenhum caminho ligado, o app não teria o que oferecer: o segundo não desliga se o primeiro já está. */
const algumCaminho = computed(
  () =>
    rascunho.value !== null &&
    (rascunho.value.permiteEscolherHorario || rascunho.value.permiteMelhorHorario),
)

const valido = computed(
  () =>
    rascunho.value !== null &&
    (!rascunho.value.ativo ||
      (algumCaminho.value &&
        rascunho.value.typeIds.length > 0 &&
        rascunho.value.professionalIds.length > 0)) &&
    rascunho.value.emergencia.telefone.trim().length > 0,
)

function salvar() {
  if (rascunho.value && valido.value) {
    emit('salvar', copia(rascunho.value))
  }
}
</script>

<template>
  <Drawer
    v-model:visible="aberto"
    position="right"
    class="hc-tema config-gaveta"
    :style="{ width: 'min(34rem, 96vw)' }"
    :header="t('clinico.pedidos.config.titulo')"
  >
    <div v-if="rascunho" class="config clinic-scope">
      <!-- Recebo? -->
      <label class="config__chave">
        <span class="config__chave-texto">
          <strong>{{ t('clinico.pedidos.config.ativo') }}</strong>
          <span>{{ t('clinico.pedidos.config.ativoAjuda') }}</span>
        </span>
        <ToggleSwitch v-model="rascunho.ativo" />
      </label>

      <fieldset class="config__bloco" :disabled="!rascunho.ativo">
        <legend class="config__titulo">
          <i class="ph ph-signpost" aria-hidden="true" />
          {{ t('clinico.pedidos.config.caminhos') }}
        </legend>

        <label class="config__opcao">
          <Checkbox
            v-model="rascunho.permiteEscolherHorario"
            binary
            :disabled="!rascunho.permiteMelhorHorario && rascunho.permiteEscolherHorario"
          />
          <span>
            <strong>{{ t('clinico.pedidos.config.escolherHorario') }}</strong>
            <span>{{ t('clinico.pedidos.config.escolherHorarioAjuda') }}</span>
          </span>
        </label>

        <label class="config__opcao">
          <Checkbox
            v-model="rascunho.permiteMelhorHorario"
            binary
            :disabled="!rascunho.permiteEscolherHorario && rascunho.permiteMelhorHorario"
          />
          <span>
            <strong>{{ t('clinico.pedidos.config.melhorHorario') }}</strong>
            <span>{{ t('clinico.pedidos.config.melhorHorarioAjuda') }}</span>
          </span>
        </label>

        <label class="config__chave config__chave--interna">
          <span class="config__chave-texto">
            <strong>{{ t('clinico.pedidos.config.aceitarSozinho') }}</strong>
            <span>{{ t('clinico.pedidos.config.aceitarSozinhoAjuda') }}</span>
          </span>
          <ToggleSwitch
            v-model="rascunho.aceitarSozinho"
            :disabled="!rascunho.permiteEscolherHorario"
          />
        </label>
      </fieldset>

      <fieldset class="config__bloco" :disabled="!rascunho.ativo">
        <legend class="config__titulo">
          <i class="ph ph-list-checks" aria-hidden="true" />
          {{ t('clinico.pedidos.config.oQueEQuem') }}
        </legend>

        <div class="config__grupo">
          <span class="clinic-label">{{ t('clinico.pedidos.config.servicos') }}</span>
          <div class="config__marcas">
            <label v-for="tipo in servicos" :key="tipo.id" class="config__marca">
              <Checkbox v-model="rascunho.typeIds" :value="tipo.id" />
              {{ tipo.nome }}
            </label>
          </div>
        </div>

        <div class="config__grupo">
          <span class="clinic-label">{{ t('clinico.pedidos.config.profissionais') }}</span>
          <div class="config__marcas">
            <label
              v-for="profissional in profissionais"
              :key="profissional.id"
              class="config__marca"
            >
              <Checkbox v-model="rascunho.professionalIds" :value="profissional.id" />
              {{ profissional.nome }}
            </label>
          </div>
        </div>

        <div class="config__numeros">
          <label class="config__numero">
            <span class="clinic-label">{{ t('clinico.pedidos.config.prazo') }}</span>
            <InputNumber
              v-model="rascunho.prazoDeRespostaHoras"
              :min="1"
              :max="48"
              show-buttons
              :suffix="` ${t('clinico.pedidos.config.horas')}`"
              fluid
            />
          </label>
          <label class="config__numero">
            <span class="clinic-label">{{ t('clinico.pedidos.config.antecedencia') }}</span>
            <InputNumber
              v-model="rascunho.antecedenciaMinimaHoras"
              :min="0"
              :max="72"
              show-buttons
              :suffix="` ${t('clinico.pedidos.config.horas')}`"
              fluid
            />
          </label>
          <label class="config__numero">
            <span class="clinic-label">{{ t('clinico.pedidos.config.horizonte') }}</span>
            <InputNumber
              v-model="rascunho.horizonteDias"
              :min="7"
              :max="90"
              show-buttons
              :suffix="` ${t('clinico.pedidos.config.dias')}`"
              fluid
            />
          </label>
        </div>
      </fieldset>

      <fieldset class="config__bloco">
        <legend class="config__titulo">
          <i class="ph ph-first-aid" aria-hidden="true" />
          {{ t('clinico.pedidos.config.emergencia') }}
        </legend>
        <p class="config__ajuda">{{ t('clinico.pedidos.config.emergenciaAjuda') }}</p>

        <div class="config__numeros">
          <label class="config__numero">
            <span class="clinic-label">{{ t('clinico.pedidos.config.telefone') }}</span>
            <InputText v-model="rascunho.emergencia.telefone" fluid />
          </label>
          <label class="config__numero">
            <span class="clinic-label">{{ t('clinico.pedidos.config.whatsapp') }}</span>
            <InputText
              :model-value="rascunho.emergencia.whatsapp ?? ''"
              fluid
              @update:model-value="rascunho.emergencia.whatsapp = $event || null"
            />
          </label>
          <label class="config__numero">
            <span class="clinic-label">{{ t('clinico.pedidos.config.plantao') }}</span>
            <InputText
              :model-value="rascunho.emergencia.telefoneDePlantao ?? ''"
              :placeholder="t('clinico.pedidos.config.semPlantao')"
              fluid
              @update:model-value="rascunho.emergencia.telefoneDePlantao = $event || null"
            />
          </label>
        </div>

        <label class="config__grupo">
          <span class="clinic-label">{{ t('clinico.pedidos.config.orientacao') }}</span>
          <Textarea v-model="rascunho.emergencia.orientacao" rows="3" auto-resize fluid />
        </label>
      </fieldset>
    </div>

    <template #footer>
      <div class="config__rodape">
        <Button
          :label="t('clinico.agenda.mover.cancelar')"
          severity="secondary"
          outlined
          @click="aberto = false"
        />
        <Button
          class="config__salvar"
          :label="t('clinico.pedidos.config.salvar')"
          icon="ph ph-check"
          :disabled="!valido"
          :loading="salvando"
          @click="salvar"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.config__rodape {
  display: flex;
  gap: 0.5rem;
}

.config__salvar.p-button {
  flex: 1;
}

.config {
  display: grid;
  gap: var(--clinic-space-4);
}

.config__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-4);
  cursor: pointer;
}

.config__chave--interna {
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--hc-linha);
}

.config__chave-texto,
.config__opcao > span {
  display: grid;
  gap: 0.1rem;
}

.config__chave-texto span,
.config__opcao span span,
.config__ajuda {
  color: var(--hc-tinta-2);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.config__ajuda {
  margin: 0;
}

.config__bloco {
  display: grid;
  margin: 0;
  padding: var(--clinic-space-4);
  border: 1px solid var(--hc-borda);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
}

.config__bloco:disabled {
  opacity: 0.55;
}

.config__titulo {
  display: inline-flex;
  align-items: center;
  padding: 0 0.35rem;
  gap: 0.4rem;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 700;
}

.config__titulo i {
  color: var(--hc-marca);
}

.config__opcao {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  cursor: pointer;
}

.config__grupo {
  display: grid;
  gap: 0.4rem;
}

.config__marcas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.1rem;
}

.config__marca {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.config__numeros {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.config__numero {
  display: grid;
  gap: 0.3rem;
}
</style>
