<script setup lang="ts">
/**
 * Anamnese.
 *
 * A ordem da tela é a ordem da conversa: primeiro o que trouxe o paciente, depois o que o
 * responsável observou, e só então os sinais gerais e a prevenção. Dez campos idênticos em
 * duas colunas — que era o desenho anterior — não diziam por onde começar.
 *
 * Os sinais gerais viram uma faixa de escolhas curtas em vez de cinco caixas fechadas: com
 * quatro opções ou menos, mostrar todas custa menos que abrir um menu. E vacinação e
 * vermifugação, que são sim ou não, deixaram de ser `Select` — a resposta fica à vista.
 *
 * O campo de história aceita **comandos com `/`**: é o que permite escrever a consulta inteira
 * sem tirar as mãos do teclado.
 */
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicForm from '../base/ClinicForm.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { Anamnese } from '../../data/types'

const props = defineProps<{
  valor: Anamnese
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const emit = defineEmits<{ atualizar: [patch: Partial<Anamnese>] }>()

const { t } = useI18n()

const comandosAbertos = ref(false)

function opcoes(chaves: readonly string[]) {
  return chaves.map((chave) => ({
    valor: chave,
    rotulo: t(`clinico.prontuario.anamnese.opcoes.${chave}`),
  }))
}

const opcoesApetite = computed(() => opcoes(['normal', 'aumentado', 'reduzido', 'ausente']))
const opcoesHidratacao = computed(() => opcoes(['normal', 'leve', 'moderada', 'grave']))
const opcoesEvacuacao = computed(() => opcoes(['normal', 'diarreia', 'constipacao']))
const opcoesMiccao = computed(() => opcoes(['normal', 'aumentada', 'reduzida', 'disuria']))
const opcoesAmbiente = computed(() => opcoes(['domiciliar', 'externo', 'misto']))

const opcoesSimNao = computed(() => [
  { valor: true, rotulo: t('clinico.prontuario.anamnese.opcoes.sim') },
  { valor: false, rotulo: t('clinico.prontuario.anamnese.opcoes.nao') },
])

/**
 * Os sinais gerais são todos do mesmo tipo — um `Select` curto com rótulo curto. Declará-los
 * numa lista evita cinco blocos de marcação quase idênticos no template.
 */
const sinaisGerais = computed(() => [
  { campo: 'apetite' as const, opcoes: opcoesApetite.value },
  { campo: 'hidratacao' as const, opcoes: opcoesHidratacao.value },
  { campo: 'evacuacao' as const, opcoes: opcoesEvacuacao.value },
  { campo: 'miccao' as const, opcoes: opcoesMiccao.value },
  { campo: 'ambiente' as const, opcoes: opcoesAmbiente.value },
])

/** Trechos prontos do comando `/`. Curtos de propósito: são atalho, não laudo. */
const COMANDOS = ['semAlteracoes', 'naoAferido', 'retorno', 'jejum'] as const

function definir<K extends keyof Anamnese>(campo: K, valor: Anamnese[K]) {
  emit('atualizar', { [campo]: valor } as Partial<Anamnese>)
}

function aoDigitarHistoria(evento: Event) {
  const alvo = evento.target as HTMLTextAreaElement

  definir('historia', alvo.value)
  comandosAbertos.value = alvo.value.endsWith('/')
}

function inserirComando(chave: (typeof COMANDOS)[number]) {
  const texto = t(`clinico.comandos.${chave}`)

  definir('historia', `${props.valor.historia.replace(/\/$/, '')}${texto} `)
  comandosAbertos.value = false
}
</script>

<template>
  <ClinicForm
    :titulo="t('clinico.prontuario.anamnese.titulo')"
    :descricao="t('clinico.prontuario.anamnese.descricao')"
    :colunas="1"
    ancora="anamnese"
    :somente-leitura="somenteLeitura"
    :motivo-somente-leitura="motivoLeitura"
  >
    <!-- 1. o que trouxe o paciente -->
    <div class="queixa">
      <ClinicField
        :rotulo="t('clinico.prontuario.anamnese.queixaPrincipal')"
        obrigatorio
        class="queixa__principal"
      >
        <template #default="{ id }">
          <InputText
            :id="id"
            :model-value="valor.queixaPrincipal"
            :disabled="somenteLeitura"
            fluid
            @update:model-value="definir('queixaPrincipal', $event ?? '')"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.prontuario.anamnese.duracaoSintomas')">
        <template #default="{ id }">
          <InputText
            :id="id"
            :model-value="valor.duracaoSintomas"
            :disabled="somenteLeitura"
            :placeholder="t('clinico.prontuario.anamnese.duracaoExemplo')"
            fluid
            @update:model-value="definir('duracaoSintomas', $event ?? '')"
          />
        </template>
      </ClinicField>
    </div>

    <!-- 2. o que o responsável observou -->
    <ClinicField
      :rotulo="t('clinico.prontuario.anamnese.historia')"
      :dica="t('clinico.comandos.dica')"
      largo
    >
      <template #default="{ id }">
        <div class="historia">
          <Textarea
            :id="id"
            :model-value="valor.historia"
            rows="4"
            auto-resize
            fluid
            :disabled="somenteLeitura"
            @input="aoDigitarHistoria"
            @keydown.esc="comandosAbertos = false"
          />

          <ul v-if="comandosAbertos" class="comandos" role="listbox">
            <li v-for="chave in COMANDOS" :key="chave">
              <button
                type="button"
                class="comandos__item clinic-focusable"
                role="option"
                :aria-selected="false"
                @click="inserirComando(chave)"
              >
                <span class="comandos__barra">/</span>
                {{ t(`clinico.comandos.${chave}`) }}
              </button>
            </li>
          </ul>
        </div>
      </template>
    </ClinicField>

    <!-- 3. sinais gerais -->
    <fieldset class="bloco-secundario">
      <legend class="clinic-label">{{ t('clinico.prontuario.anamnese.sinaisGerais') }}</legend>

      <div class="sinais">
        <ClinicField
          v-for="sinal in sinaisGerais"
          :key="sinal.campo"
          :rotulo="t(`clinico.prontuario.anamnese.${sinal.campo}`)"
        >
          <template #default="{ id }">
            <Select
              :input-id="id"
              :model-value="valor[sinal.campo]"
              :options="sinal.opcoes"
              option-label="rotulo"
              option-value="valor"
              show-clear
              fluid
              :placeholder="t('clinico.formato.semvalor')"
              :disabled="somenteLeitura"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
              @update:model-value="definir(sinal.campo, $event ?? '')"
            />
          </template>
        </ClinicField>
      </div>
    </fieldset>

    <!-- 4. prevenção: duas perguntas de sim ou não, respondidas à vista -->
    <fieldset class="bloco-secundario">
      <legend class="clinic-label">{{ t('clinico.prontuario.anamnese.prevencao') }}</legend>

      <div class="prevencao">
        <ClinicField :rotulo="t('clinico.prontuario.anamnese.vacinacao')">
          <template #default>
            <ClinicToggleGroup
              :model-value="valor.vacinacaoEmDia"
              :opcoes="opcoesSimNao"
              :rotulo="t('clinico.prontuario.anamnese.vacinacao')"
              :desabilitado="somenteLeitura"
              limpavel
              :vazio="null"
              @update:model-value="definir('vacinacaoEmDia', $event)"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.prontuario.anamnese.vermifugacao')">
          <template #default>
            <ClinicToggleGroup
              :model-value="valor.vermifugacaoEmDia"
              :opcoes="opcoesSimNao"
              :rotulo="t('clinico.prontuario.anamnese.vermifugacao')"
              :desabilitado="somenteLeitura"
              limpavel
              :vazio="null"
              @update:model-value="definir('vermifugacaoEmDia', $event)"
            />
          </template>
        </ClinicField>
      </div>
    </fieldset>
  </ClinicForm>
</template>

<style scoped>
/* A queixa principal ganha o dobro da largura: é o campo que resume a consulta. */
.queixa {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--clinic-space-4);
}

.historia {
  position: relative;
}

.bloco-secundario {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.bloco-secundario legend {
  padding-inline: var(--clinic-space-2);
}

.sinais {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
  gap: var(--clinic-space-3);
}

.prevencao {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-5);
}

.comandos {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  display: grid;
  gap: 0.1rem;
  width: min(20rem, 100%);
  margin: 0.2rem 0 0;
  padding: 0.25rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-float);
  list-style: none;
}

.comandos__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--clinic-hit-target);
  padding: 0 var(--clinic-space-2);
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.comandos__item:hover {
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.comandos__barra {
  color: var(--clinic-faint);
  font-weight: 800;
}

@media (max-width: 760px) {
  .queixa {
    grid-template-columns: 1fr;
  }
}
</style>
