<script setup lang="ts">
/**
 * Anamnese.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Uma folha só, lida de cima para baixo na ordem da conversa. Os grupos (sinais gerais,
 * prevenção, antecedentes) se separam por um fio e um título em frase — não mais por caixas
 * cinzentas dentro da folha, que davam a cada grupo o peso de um formulário à parte.
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
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicForm from '../base/ClinicForm.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { Anamnese, Antecedente, AntecedenteKind, EvolucaoDoQuadro } from '../../data/types'

const props = defineProps<{
  valor: Anamnese
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const emit = defineEmits<{ atualizar: [patch: Partial<Anamnese>] }>()

const { t } = useI18n()

const comandosAbertos = ref(false)
const idAntecedentes = useId()

/** Alergia e medicação contínua mudam a prescrição: o selo delas fala mais alto. */
function tomDoAntecedente(kind: AntecedenteKind) {
  if (kind === 'alergia' || kind === 'reacao-vacinal') {
    return 'ui-selo--risco'
  }

  return kind === 'medicacao-continua' ? 'ui-selo--atencao' : ''
}

/**
 * Evolução do quadro.
 *
 * O eixo que decide urgência, e o único campo que permite comparar dois atendimentos do mesmo
 * quadro. "Dor há três dias" não diz nada sozinho; "dor há três dias, piorando" é outra
 * consulta — e é a diferença entre marcar retorno em duas semanas ou pedir exame hoje.
 *
 * O tom acompanha a gravidade para a varredura funcionar sem leitura, no mesmo padrão dos
 * sistemas do exame físico.
 */
const opcoesEvolucao = computed(() =>
  (
    [
      { valor: 'piorando', tom: 'risco' },
      { valor: 'estavel', tom: 'atencao' },
      { valor: 'melhorando', tom: 'ok' },
      { valor: 'intermitente', tom: 'neutro' },
    ] as const
  ).map((opcao) => ({
    valor: opcao.valor as EvolucaoDoQuadro,
    tom: opcao.tom,
    rotulo: t(`clinico.prontuario.anamnese.evolucaoOpcoes.${opcao.valor}`),
  })),
)

// ------------------------------------------------------------------ antecedentes

/**
 * Os tipos de antecedente, na ordem em que pesam na decisão de hoje.
 *
 * Alergia e medicação contínua vêm primeiro porque são as duas que mudam a prescrição — e
 * prescrição errada por antecedente não lido é o erro que este campo existe para evitar.
 */
const TIPOS_DE_ANTECEDENTE: AntecedenteKind[] = [
  'alergia',
  'medicacao-continua',
  'doenca-previa',
  'cirurgia',
  'reacao-vacinal',
  'trauma',
  'outro',
]

const opcoesAntecedente = computed(() =>
  TIPOS_DE_ANTECEDENTE.map((kind) => ({
    value: kind,
    label: t(`clinico.prontuario.anamnese.antecedenteKind.${kind}`),
  })),
)

const novoKind = ref<AntecedenteKind>('alergia')
const novaDescricao = ref('')
const novoQuando = ref('')

const podeAdicionar = computed(() => novaDescricao.value.trim().length > 0)

function adicionarAntecedente() {
  if (!podeAdicionar.value) {
    return
  }

  const antecedente: Antecedente = {
    id: `ant-${Date.now().toString(36)}`,
    kind: novoKind.value,
    descricao: novaDescricao.value.trim(),
    quando: novoQuando.value.trim(),
  }

  emit('atualizar', { antecedentes: [...props.valor.antecedentes, antecedente] })

  /* O tipo permanece: quem cadastra duas alergias não deve reescolher "alergia" na segunda. */
  novaDescricao.value = ''
  novoQuando.value = ''
}

function removerAntecedente(id: string) {
  emit('atualizar', {
    antecedentes: props.valor.antecedentes.filter((item) => item.id !== id),
  })
}

function opcoes(chaves: readonly string[]) {
  return chaves.map((chave) => ({
    valor: chave,
    rotulo: t(`clinico.prontuario.anamnese.opcoes.${chave}`),
  }))
}

const opcoesApetite = computed(() => opcoes(['normal', 'aumentado', 'reduzido', 'ausente']))
/*
 * Hidratação saiu daqui e foi para o exame físico: desidratação se estima por turgor cutâneo e
 * mucosas, com o paciente na mesa — não é relato do responsável.
 */
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
    <!-- Outros jeitos de preencher a anamnese — a gravação da consulta — entram pelo cabeçalho. -->
    <template v-if="$slots.acoes" #acoes>
      <slot name="acoes" />
    </template>

    <!-- 1. o que trouxe o paciente -->
    <div class="queixa">
      <ClinicField :rotulo="t('clinico.prontuario.anamnese.queixaPrincipal')" obrigatorio>
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

    <!--
      Evolução fica colada em queixa e duração porque é a terceira parte da mesma frase: "o quê,
      há quanto tempo, e como vem se comportando". Separá-la em outro bloco faria a pergunta ser
      esquecida — e é a que muda a conduta.
    -->
    <ClinicField :rotulo="t('clinico.prontuario.anamnese.evolucao')">
      <ClinicToggleGroup
        :model-value="valor.evolucao"
        :opcoes="opcoesEvolucao"
        :desabilitado="somenteLeitura"
        limpavel
        :vazio="''"
        :rotulo="t('clinico.prontuario.anamnese.evolucao')"
        @update:model-value="definir('evolucao', $event as EvolucaoDoQuadro)"
      />
    </ClinicField>

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
                class="comandos__item"
                role="option"
                :aria-selected="false"
                @click="inserirComando(chave)"
              >
                <span class="comandos__barra" aria-hidden="true">/</span>
                {{ t(`clinico.comandos.${chave}`) }}
              </button>
            </li>
          </ul>
        </div>
      </template>
    </ClinicField>

    <!-- 3. sinais gerais -->
    <fieldset class="grupo">
      <legend class="grupo__titulo">{{ t('clinico.prontuario.anamnese.sinaisGerais') }}</legend>

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
    <fieldset class="grupo">
      <legend class="grupo__titulo">{{ t('clinico.prontuario.anamnese.prevencao') }}</legend>

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

    <!--
      Antecedentes: o que já aconteceu e ainda pesa. Lista estruturada, e não um parágrafo,
      porque é isto que o vet varre antes de prescrever — procurar "já fez cirurgia?" dentro de
      um texto corrido é como a informação se perde na consulta em que ela importa.
    -->
    <section class="grupo" :aria-labelledby="`${idAntecedentes}-titulo`">
      <h4 :id="`${idAntecedentes}-titulo`" class="grupo__titulo">
        {{ t('clinico.prontuario.anamnese.antecedentes') }}
        <span v-if="valor.antecedentes.length > 0" class="ui-contagem">
          {{ valor.antecedentes.length }}
        </span>
      </h4>

      <ul v-if="valor.antecedentes.length > 0" class="antecedentes">
        <li v-for="antecedente in valor.antecedentes" :key="antecedente.id" class="antecedente">
          <span class="ui-selo" :class="tomDoAntecedente(antecedente.kind)">
            {{ t(`clinico.prontuario.anamnese.antecedenteKind.${antecedente.kind}`) }}
          </span>
          <span class="antecedente__descricao">{{ antecedente.descricao }}</span>
          <span v-if="antecedente.quando" class="antecedente__quando">
            {{ antecedente.quando }}
          </span>
          <Button
            v-if="!somenteLeitura"
            type="button"
            class="antecedente__remover"
            icon="ph ph-x"
            severity="secondary"
            text
            rounded
            size="small"
            :aria-label="`${t('clinico.comum.remover')}: ${antecedente.descricao}`"
            :title="t('clinico.comum.remover')"
            @click="removerAntecedente(antecedente.id)"
          />
        </li>
      </ul>

      <p v-else class="grupo__vazio">
        {{ t('clinico.prontuario.anamnese.antecedentesVazio') }}
      </p>

      <div v-if="!somenteLeitura" class="novo">
        <Select
          v-model="novoKind"
          :options="opcoesAntecedente"
          option-label="label"
          option-value="value"
          class="novo__tipo"
          :aria-label="t('clinico.prontuario.nova.anamnese.tipoDoAntecedente')"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        />
        <InputText
          v-model="novaDescricao"
          :placeholder="t('clinico.prontuario.anamnese.antecedenteExemplo')"
          :aria-label="t('clinico.prontuario.nova.anamnese.descricaoDoAntecedente')"
          class="novo__descricao"
          @keydown.enter.prevent="adicionarAntecedente"
        />
        <InputText
          v-model="novoQuando"
          :placeholder="t('clinico.prontuario.anamnese.antecedenteQuando')"
          :aria-label="t('clinico.prontuario.anamnese.antecedenteQuando')"
          class="novo__quando"
          @keydown.enter.prevent="adicionarAntecedente"
        />
        <Button
          type="button"
          icon="ph ph-plus"
          severity="secondary"
          outlined
          :label="t('clinico.comum.adicionar')"
          :disabled="!podeAdicionar"
          @click="adicionarAntecedente"
        />
      </div>
    </section>
  </ClinicForm>
</template>

<style scoped>
/* A queixa principal ganha o dobro da largura: é o campo que resume a consulta. */
.queixa {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 18px 20px;
}

.historia {
  position: relative;
}

/*
 * Grupo da folha: um fio em cima e o título em frase. A legenda flutua para dentro da caixa —
 * no lugar padrão ela cortaria o fio ao meio.
 */
.grupo {
  display: grid;
  min-width: 0;
  gap: 14px;
  margin: 4px 0 0;
  padding: 18px 0 0;
  border: 0;
  border-top: 1px solid var(--linha);
}

.grupo__titulo {
  display: flex;
  float: left;
  width: 100%;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.grupo__titulo + * {
  clear: both;
}

.grupo__vazio {
  margin: 0;
  color: var(--tinta-3);
  font-size: 14px;
}

.sinais {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 16px;
}

.prevencao {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 40px;
}

/* ------------------------------------------------------------------ antecedentes */

.antecedentes {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.antecedente {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 12px;
  padding: 6px 8px 6px 14px;
}

.antecedente + .antecedente {
  border-top: 1px solid var(--linha);
}

.antecedente__descricao {
  min-width: 0;
  flex: 1;
  color: var(--tinta);
  font-size: 14.5px;
  overflow-wrap: anywhere;
}

.antecedente__quando {
  color: var(--tinta-3);
  font-size: 13px;
  white-space: nowrap;
}

/* Remover é destrutivo: o hover avisa em vermelho antes do clique, e não depois. */
.antecedente__remover.p-button.p-button-secondary.p-button-text:not(:disabled):hover {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.novo {
  display: grid;
  align-items: center;
  gap: 10px;
  grid-template-columns: 11rem minmax(0, 1fr) 9rem auto;
}

/* ------------------------------------------------------------------ comandos com / */

.comandos {
  position: absolute;
  z-index: 20;
  top: 100%;
  display: grid;
  width: min(20rem, 100%);
  gap: 2px;
  margin: 6px 0 0;
  padding: 6px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
  inset-inline-start: 0;
  list-style: none;
}

.comandos__item {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  text-align: start;
}

.comandos__item:hover,
.comandos__item:focus-visible {
  background: var(--superficie-2);
  outline: none;
}

.comandos__barra {
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-weight: 700;
}

@media (max-width: 760px) {
  .queixa,
  .novo {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
