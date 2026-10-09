<script setup lang="ts">
/**
 * Um campo proposto pela escuta: o valor, o trecho de onde veio, e por que conferir.
 *
 * Aparece em três momentos, e muda de forma em cada um:
 *
 * - **Escuta** — só leitura. O disco periwinkle diz "a máquina propôs"; o campo ainda não é de
 *   ninguém.
 * - **Revisão** — a caixa de marcar entra no lugar do disco, e **nasce vazia**. Corrigir abre o
 *   editor do próprio campo, com as opções que a anamnese aceita, e a correção já marca: quem se
 *   deu ao trabalho de corrigir quer levar.
 * - **Rastro** — depois de aplicado. O que entrou, o que foi corrigido e o que ficou de fora,
 *   cada um ainda com a frase que o sustenta. É o que responde "de onde veio isto?" amanhã.
 *
 * A citação é um botão, não enfeite: leva à fala na conversa ao lado. É o gesto que o requisito
 * pede — rastrear o campo até o que foi dito — em um clique.
 *
 * Os alertas usam o tom de atenção e sempre com ícone e palavra: "Latido no trecho" precisa ser
 * lido em escala de cinza tão bem quanto em cor. Nenhum deles pinta a linha — urgência mora no
 * ícone, não na superfície.
 */
import {
  PhArrowsLeftRight,
  PhDog,
  PhEar,
  PhLightbulb,
  PhSpeakerHigh,
  PhUsers,
  PhWarningCircle,
  PhWaveform,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, nextTick, ref, useId, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import { useRotulosDaEscuta } from '../../composables/useRotulosDaEscuta'
import type { AntecedenteKind } from '../../data/types'
import { FORMA_DO_CAMPO, OPCOES_DA_ESCUTA } from '../../domain/escuta'
import type {
  AlertaDaProposta,
  CampoDeOpcao,
  PropostaDaEscuta,
  ValorDaEscuta,
} from '../../domain/escuta'
import type { DecisaoDaRevisao } from '../../stores/escuta'

export type CitacaoVisivel = { trechoId: string; texto: string; hora: string }

const props = defineProps<{
  proposta: PropostaDaEscuta
  alertas: AlertaDaProposta[]
  modo: 'escuta' | 'revisao' | 'rastro'
  decisao: DecisaoDaRevisao | null
  citacoes: CitacaoVisivel[]
  /** O que o campo tem hoje no prontuário, já por extenso. Vazio quando não há o que comparar. */
  noProntuario: string
  /** Uma linha sobre o que aceitar faz: "entra no fim da história", "já está nos antecedentes". */
  nota: string
  desabilitado: boolean
}>()

const emit = defineEmits<{
  marcar: [incluir: boolean]
  corrigir: [mudanca: { valor: ValorDaEscuta; tipo: AntecedenteKind | null; quando: string }]
  desfazer: []
  olhar: [olhando: boolean]
  verNaConversa: [trechoId: string]
}>()

const { t } = useI18n()
const rotulos = useRotulosDaEscuta()
const idBase = useId()

const ICONE_DO_ALERTA: Record<AlertaDaProposta, Component> = {
  'sem-origem': PhWarningCircle,
  'fala-sobreposta': PhUsers,
  latido: PhDog,
  ruido: PhSpeakerHigh,
  'baixa-confianca': PhEar,
  divergencia: PhArrowsLeftRight,
  deduzido: PhLightbulb,
}

const forma = computed(() => FORMA_DO_CAMPO[props.proposta.campo])

/** O que vale agora: o corrigido, se houve correção; senão, o proposto. */
const atual = computed(() => ({
  valor: props.decisao?.valor ?? props.proposta.valor,
  tipo: props.decisao?.tipo ?? props.proposta.tipo,
  quando: props.decisao?.quando ?? props.proposta.quando,
}))

const rotulo = computed(() => rotulos.campo(props.proposta.campo, atual.value.tipo))
const valorEmTexto = computed(() =>
  rotulos.valor(props.proposta.campo, atual.value.valor, atual.value.quando),
)
const propostoEmTexto = computed(() =>
  rotulos.valor(props.proposta.campo, props.proposta.valor, props.proposta.quando),
)

const corrigida = computed(() => Boolean(props.decisao?.corrigida))
const incluida = computed(() => Boolean(props.decisao?.incluir))

// ------------------------------------------------------------------ correção

const editando = ref(false)
const rascunho = ref<{ valor: ValorDaEscuta; tipo: AntecedenteKind | null; quando: string }>({
  valor: '',
  tipo: null,
  quando: '',
})
const editor = ref<HTMLElement | null>(null)
const linha = ref<HTMLElement | null>(null)

const opcoes = computed(() => {
  const campo = props.proposta.campo

  if (!(campo in OPCOES_DA_ESCUTA)) {
    return []
  }

  return OPCOES_DA_ESCUTA[campo as CampoDeOpcao].map((valor) => ({
    valor,
    rotulo: rotulos.valor(campo, valor),
  }))
})

const opcoesSimNao = computed(() => [
  { valor: true, rotulo: t('clinico.prontuario.anamnese.opcoes.sim') },
  { valor: false, rotulo: t('clinico.prontuario.anamnese.opcoes.nao') },
])

const TIPOS: AntecedenteKind[] = [
  'alergia',
  'medicacao-continua',
  'doenca-previa',
  'cirurgia',
  'reacao-vacinal',
  'trauma',
  'outro',
]

const opcoesDeTipo = computed(() =>
  TIPOS.map((tipo) => ({ valor: tipo, rotulo: rotulos.campo('antecedente', tipo) })),
)

const podeConfirmar = computed(() =>
  typeof rascunho.value.valor === 'boolean' ? true : rascunho.value.valor.trim().length > 0,
)

async function abrirEditor() {
  rascunho.value = { ...atual.value }
  editando.value = true
  await nextTick()
  editor.value?.querySelector<HTMLElement>('input, textarea, [tabindex="0"]')?.focus()
}

function confirmar() {
  if (!podeConfirmar.value) {
    return
  }

  const valor = rascunho.value.valor

  emit('corrigir', {
    valor: typeof valor === 'string' ? valor.trim() : valor,
    tipo: rascunho.value.tipo,
    quando: rascunho.value.quando.trim(),
  })
  fecharEditor()
}

function cancelar() {
  fecharEditor()
}

/** O foco volta para a linha: quem corrige pelo teclado continua de onde parou. */
async function fecharEditor() {
  editando.value = false
  await nextTick()
  linha.value?.querySelector<HTMLElement>('.campo__acoes button')?.focus()
}
</script>

<template>
  <li
    ref="linha"
    class="campo"
    :class="[
      `campo--${modo}`,
      {
        'campo--marcado': modo === 'revisao' && incluida,
        'campo--fora': modo === 'rastro' && !incluida,
        'campo--alerta': alertas.length > 0,
      },
    ]"
    @mouseenter="emit('olhar', true)"
    @mouseleave="emit('olhar', false)"
    @focusin="emit('olhar', true)"
    @focusout="emit('olhar', false)"
  >
    <!-- ------------------------------------------------ a marca da linha -->
    <span v-if="modo === 'escuta'" class="marca marca--maquina" aria-hidden="true">
      <PhWaveform weight="bold" />
    </span>

    <Checkbox
      v-else-if="modo === 'revisao'"
      class="marca"
      :model-value="incluida"
      binary
      :input-id="`${idBase}-incluir`"
      :disabled="desabilitado"
      :aria-label="t('clinico.escuta.proposta.incluir', { campo: rotulo })"
      @update:model-value="emit('marcar', Boolean($event))"
    />

    <span
      v-else
      class="marca"
      :class="incluida ? 'marca--aplicado' : 'marca--fora'"
      aria-hidden="true"
    >
      <i :class="incluida ? 'ph ph-check' : 'ph ph-minus'" />
    </span>

    <!-- ------------------------------------------------ o corpo -->
    <div class="campo__corpo">
      <label class="campo__rotulo" :for="modo === 'revisao' ? `${idBase}-incluir` : undefined">
        {{ rotulo }}
        <span v-if="modo === 'rastro'" class="campo__situacao">
          ·
          {{
            incluida ? t('clinico.escuta.proposta.aplicado') : t('clinico.escuta.proposta.deFora')
          }}
        </span>
      </label>

      <div v-if="editando" ref="editor" class="editor" @keydown.esc.stop="cancelar">
        <InputText
          v-if="forma === 'texto'"
          :model-value="String(rascunho.valor)"
          @update:model-value="rascunho.valor = $event ?? ''"
          size="small"
          fluid
          :aria-label="rotulo"
          @keydown.enter.stop.prevent="confirmar"
        />

        <Textarea
          v-else-if="forma === 'texto-longo'"
          :model-value="String(rascunho.valor)"
          @update:model-value="rascunho.valor = $event ?? ''"
          rows="2"
          auto-resize
          fluid
          :aria-label="rotulo"
        />

        <Select
          v-else-if="forma === 'opcao'"
          v-model="rascunho.valor"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          size="small"
          :aria-label="rotulo"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        />

        <ClinicToggleGroup
          v-else-if="forma === 'sim-nao'"
          :model-value="rascunho.valor as boolean"
          :opcoes="opcoesSimNao"
          :rotulo="rotulo"
          @update:model-value="rascunho.valor = $event"
        />

        <div v-else class="editor__antecedente">
          <Select
            v-model="rascunho.tipo"
            :options="opcoesDeTipo"
            option-label="rotulo"
            option-value="valor"
            size="small"
            :aria-label="t('clinico.escuta.proposta.antecedente')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
          <InputText
            :model-value="String(rascunho.valor)"
            @update:model-value="rascunho.valor = $event ?? ''"
            size="small"
            :aria-label="t('clinico.escuta.proposta.descricao')"
            :placeholder="t('clinico.escuta.proposta.descricao')"
            @keydown.enter.stop.prevent="confirmar"
          />
          <InputText
            v-model="rascunho.quando"
            size="small"
            :aria-label="t('clinico.escuta.proposta.quando')"
            :placeholder="t('clinico.escuta.proposta.quando')"
            @keydown.enter.stop.prevent="confirmar"
          />
        </div>

        <span class="editor__acoes">
          <Button
            :label="t('clinico.escuta.proposta.pronto')"
            icon="ph ph-check"
            size="small"
            :disabled="!podeConfirmar"
            @click="confirmar"
          />
          <Button
            :label="t('clinico.escuta.proposta.cancelar')"
            severity="secondary"
            text
            size="small"
            @click="cancelar"
          />
        </span>
      </div>

      <p v-else class="campo__valor">
        <span>{{ valorEmTexto }}</span>
        <span v-if="corrigida" class="campo__corrigido">
          {{ t('clinico.escuta.proposta.corrigido') }}
        </span>
        <s v-if="corrigida" class="campo__proposto">
          {{ t('clinico.escuta.proposta.proposto', { valor: propostoEmTexto }) }}
        </s>
      </p>

      <!-- De onde veio. Cada citação leva à fala na conversa. -->
      <p v-if="citacoes.length > 0" class="campo__citacoes">
        <Button
          v-for="citacao in citacoes"
          :key="`${citacao.trechoId}-${citacao.texto}`"
          class="citacao"
          link
          size="small"
          :title="t('clinico.escuta.proposta.verNaConversa')"
          @click="emit('verNaConversa', citacao.trechoId)"
        >
          <span class="citacao__texto">“{{ citacao.texto }}”</span>
          <span class="citacao__hora clinic-value">{{ citacao.hora }}</span>
        </Button>
      </p>

      <ul v-if="alertas.length > 0" class="campo__alertas">
        <li
          v-for="alerta in alertas"
          :key="alerta"
          class="alerta"
          :class="{ 'alerta--grave': alerta === 'sem-origem' }"
        >
          <component :is="ICONE_DO_ALERTA[alerta]" weight="bold" aria-hidden="true" />
          {{ rotulos.alerta(alerta, proposta) }}
        </li>
      </ul>

      <p v-if="noProntuario || nota" class="campo__nota">
        <template v-if="noProntuario">
          {{ t('clinico.escuta.proposta.noProntuario', { valor: noProntuario }) }}
        </template>
        <template v-else>{{ nota }}</template>
      </p>
    </div>

    <!-- ------------------------------------------------ ações -->
    <span v-if="modo === 'revisao' && !editando" class="campo__acoes">
      <Button
        v-if="corrigida"
        :label="t('clinico.escuta.proposta.desfazer')"
        severity="secondary"
        text
        size="small"
        :disabled="desabilitado"
        @click="emit('desfazer')"
      />
      <Button
        v-else
        icon="ph ph-pencil-simple"
        rounded
        :aria-label="`${t('clinico.escuta.proposta.corrigir')}: ${rotulo}`"
        :title="t('clinico.escuta.proposta.corrigir')"
        severity="secondary"
        text
        size="small"
        :disabled="desabilitado"
        @click="abrirEditor"
      />
    </span>
  </li>
</template>

<style scoped>
.campo {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3) 0;
  border-top: 1px solid var(--clinic-line-soft);
}

.campo:first-child {
  border-top: 0;
}

.marca {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  margin-top: 0.05rem;
  place-items: center;
  border-radius: 999px;
  font-size: 0.75rem;
}

.marca--maquina {
  background: var(--clinic-maquina-bg);
  color: var(--clinic-maquina);
}

.marca--aplicado {
  background: var(--clinic-ok-bg);
  color: var(--clinic-ok-text);
}

.marca--fora {
  background: var(--clinic-surface-sunken);
  color: var(--clinic-faint);
}

.campo__corpo {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.campo__rotulo {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.campo--revisao .campo__rotulo {
  cursor: pointer;
}

.campo__situacao {
  letter-spacing: 0;
  text-transform: none;
}

.campo__valor {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--clinic-space-2);
  margin: 0;
  font-size: var(--clinic-font-value);
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/* Ficou de fora: continua legível — é rastro —, mas recua. */
.campo--fora .campo__valor {
  color: var(--clinic-faint);
  font-weight: 500;
}

.campo__corrigido {
  color: var(--clinic-ok-text);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.campo__proposto {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 500;
}

.campo__citacoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--clinic-space-3);
  margin: 0;
}

/* A citação é link, e fala baixo: itálico no tom do texto secundário, com a hora ao lado. */
.citacao.p-button {
  gap: 0.35rem;
  padding: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.citacao.p-button:not(:disabled):hover {
  color: var(--clinic-maquina);
}

.citacao__texto {
  font-style: italic;
  text-align: start;
}

.citacao__hora {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-style: normal;
}

.campo__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.1rem var(--clinic-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.alerta {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.alerta--grave {
  color: var(--clinic-risk-text);
}

.campo__nota {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.campo__acoes {
  display: flex;
  align-items: center;
}

.editor {
  display: grid;
  gap: var(--clinic-space-2);
  padding-top: 0.15rem;
}

.editor__antecedente {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr) 8rem;
  gap: var(--clinic-space-2);
}

.editor__acoes {
  display: flex;
  gap: var(--clinic-space-2);
}

@media (max-width: 720px) {
  .editor__antecedente {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
