<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, nextTick, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { TipoServicoPrestador } from '@/service/parceiro/types'
import {
  criarExameSolicitadoForm,
  criarPrescricaoItemForm,
  DURACAO_MAX_DIAS,
  DURACAO_MIN_DIAS,
  LIMITES_ESCALARES,
  LIMITES_EXAME_SOLICITADO,
  LIMITES_PRESCRICAO,
  MAX_ITENS_LISTA,
  PESO_MAX_KG,
  PESO_MIN_KG,
  tipoAceitaCampo,
  type AnotacaoEstruturadaForm,
  type CampoPrescricaoConferivel,
  type PrescricaoItemForm,
} from '@/utils/parceiro/anotacao-estruturada'

/**
 * Campos da anotação direcionados ao tipo de serviço do acesso. O prestador de
 * banho não vê campo clínico e o vet de exame não vê prescrição: quem decide é o
 * `tipoServico`, e o backend rejeita (400) campo que não pertence ao tipo.
 * Tudo aqui é opcional — salvar rápido continua possível sem tocar nesta seção.
 *
 * Mora dentro da folha da nova anotação e não desenha cartão próprio: cada bloco é uma
 * seção da folha, separada por fio, com o mesmo recuo (`--folha-pad-x`) das seções da tela.
 */
const props = defineProps<{
  tipoServico: TipoServicoPrestador
  /** Mensagens já traduzidas, por id de campo (`motivo`, `prescricaoItens.0.nome`). */
  erros: Record<string, string>
  disabled?: boolean
  /** A IA está lendo uma receita: a tabela guarda lugar para os remédios que vão chegar. */
  lendoReceita?: boolean
}>()

const form = defineModel<AnotacaoEstruturadaForm>({ required: true })

const { t, locale } = useI18n()

const numberLocale = computed(() => INTL_LOCALE[locale.value as Locale])

const aceita = (campo: Parameters<typeof tipoAceitaCampo>[1]) =>
  tipoAceitaCampo(props.tipoServico, campo)

const isConsulta = computed(() => aceita('motivo'))
const isExame = computed(() => aceita('tipoExame'))
const isEstetica = computed(() => aceita('produtos'))
const isHotel = computed(() => aceita('dataEntrada'))

const ICONE_TIPO: Partial<Record<TipoServicoPrestador, string>> = {
  CONSULTA: 'ph ph-stethoscope',
  EXAME: 'ph ph-microscope',
  BANHO: 'ph ph-drop',
  TOSA: 'ph ph-scissors',
  HOTEL: 'ph ph-bed',
}

const iconeTipo = computed(() => ICONE_TIPO[props.tipoServico] ?? 'ph ph-list-checks')

const podeAdicionarPrescricao = computed(() => form.value.prescricaoItens.length < MAX_ITENS_LISTA)
const podeAdicionarExame = computed(() => form.value.examesSolicitados.length < MAX_ITENS_LISTA)

function erroDe(id: string) {
  return props.erros[id]
}

function describedBy(id: string, extra?: string) {
  const ids = [extra, erroDe(id) ? `est-erro-${id}` : ''].filter(Boolean)

  return ids.length ? ids.join(' ') : undefined
}

/**
 * Na linha da receita os erros não cabem embaixo de cada campo (a coluna da dose tem 4rem):
 * saem juntos, embaixo da linha, com o nome do campo na frente.
 */
function errosDoItem(lista: 'prescricaoItens' | 'examesSolicitados', indice: number) {
  const prefixo = `${lista}.${indice}.`
  const grupo = lista === 'prescricaoItens' ? 'prescricao' : 'exames'

  return Object.entries(props.erros)
    .filter(([id]) => id.startsWith(prefixo))
    .map(([id, mensagem]) => ({
      id,
      mensagem,
      rotulo: t(`acessos.estruturada.${grupo}.${id.slice(prefixo.length)}`),
    }))
}

async function focar(id: string) {
  await nextTick()
  document.getElementById(id)?.focus()
}

function addPrescricao() {
  if (podeAdicionarPrescricao.value) {
    form.value.prescricaoItens.push(criarPrescricaoItemForm())
    void focar(`est-presc-nome-${form.value.prescricaoItens.length - 1}`)
  }
}

function removePrescricao(indice: number) {
  form.value.prescricaoItens.splice(indice, 1)
}

/** Campo vindo da leitura com IA sem confiança alta, ainda não mexido pelo profissional. */
function aConferir(item: PrescricaoItemForm, campo: CampoPrescricaoConferivel) {
  return Boolean(item.conferir?.[campo])
}

/**
 * Campo marcado que a leitura deixou vazio não mostra o exemplo: dentro do destaque, "1x ao dia"
 * parece valor lido, e o profissional deixaria passar a frequência em branco.
 */
function semExemplo(item: PrescricaoItemForm, campo: CampoPrescricaoConferivel, exemplo: string) {
  return aConferir(item, campo) ? undefined : exemplo
}

/** Editar o campo é conferir: a marca sai, como na anamnese por voz aprovada. */
function conferido(item: PrescricaoItemForm, campo: CampoPrescricaoConferivel) {
  if (item.conferir?.[campo]) {
    item.conferir[campo] = false
  }
}

/**
 * O aviso de frequência aparece só onde faz falta: item com nome e sem frequência. Fixo embaixo
 * de todo campo, ele virava papel de parede e ninguém lia.
 */
function semFrequencia(item: PrescricaoItemForm) {
  return Boolean(item.nome.trim()) && !item.frequencia.trim()
}

const CONFERIVEIS: readonly CampoPrescricaoConferivel[] = [
  'nome',
  'dose',
  'frequencia',
  'duracaoDias',
]

function ehConferivel(campo: string): campo is CampoPrescricaoConferivel {
  return (CONFERIVEIS as readonly string[]).includes(campo)
}

/** `aria-describedby` de um campo da receita: marca da leitura, aviso e erro, o que houver. */
function descricaoPresc(item: PrescricaoItemForm, indice: number, campo: string) {
  const ids = [
    ehConferivel(campo) && aConferir(item, campo) ? `est-conf-${indice}-${campo}` : '',
    campo === 'frequencia' && semFrequencia(item) ? `est-freq-hint-${indice}` : '',
    erroDe(`prescricaoItens.${indice}.${campo}`)
      ? `est-erro-prescricaoItens.${indice}.${campo}`
      : '',
  ].filter(Boolean)

  return ids.length ? ids.join(' ') : undefined
}

/** Nome do remédio quebra linha para caber inteiro, mas Enter não vira parágrafo. */
function semQuebra(evento: KeyboardEvent) {
  evento.preventDefault()
}

/*
 * Chave estável por item, para a lista animar a linha certa: com a chave no índice, remover o
 * segundo remédio animava a saída do último. O item não tem id próprio (nasce no formulário),
 * então a chave mora num WeakMap ligado ao objeto cru.
 */
const chaves = new WeakMap<object, number>()
let proximaChave = 0

function chaveDe(item: object) {
  const cru = toRaw(item)
  let chave = chaves.get(cru)

  if (chave === undefined) {
    proximaChave += 1
    chave = proximaChave
    chaves.set(cru, chave)
  }

  return chave
}

/**
 * Remédios que acabaram de chegar da leitura, com a ordem em que chegaram: entram um a um e
 * passam um brilho pervinca que se apaga. Item lido é o que tem `conferir` (mesmo todo falso).
 */
const recemLidos = ref(new Map<number, number>())
let apagarRecemLidos: ReturnType<typeof setTimeout> | null = null

watch(
  () => form.value.prescricaoItens.map(chaveDe),
  (atuais, anteriores) => {
    const antes = new Set(anteriores ?? atuais)
    const novos = form.value.prescricaoItens.filter(
      (item) => item.conferir && !antes.has(chaveDe(item)),
    )

    if (!novos.length) {
      return
    }

    recemLidos.value = new Map(novos.map((item, ordem) => [chaveDe(item), ordem]))

    if (apagarRecemLidos) {
      clearTimeout(apagarRecemLidos)
    }

    apagarRecemLidos = setTimeout(() => {
      recemLidos.value = new Map()
    }, 2600)
  },
)

onBeforeUnmount(() => {
  if (apagarRecemLidos) {
    clearTimeout(apagarRecemLidos)
  }
})

function ordemLida(item: PrescricaoItemForm) {
  return recemLidos.value.get(chaveDe(item))
}

function addExame() {
  if (podeAdicionarExame.value) {
    form.value.examesSolicitados.push(criarExameSolicitadoForm())
    void focar(`est-exame-nome-${form.value.examesSolicitados.length - 1}`)
  }
}

function removeExame(indice: number) {
  form.value.examesSolicitados.splice(indice, 1)
}
</script>

<template>
  <div class="est">
    <section class="est__secao" aria-labelledby="est-title">
      <header class="est__cab">
        <h3 id="est-title" class="est__titulo">
          <i :class="iconeTipo" aria-hidden="true" />
          {{ t(`acessos.estruturada.title.${tipoServico}`) }}
        </h3>
        <p class="est__lede">{{ t(`acessos.estruturada.lede.${tipoServico}`) }}</p>
      </header>

      <!-- CONSULTA -->
      <template v-if="isConsulta">
        <div class="est__linha est__linha--estreita">
          <div class="est__field">
            <label for="est-motivo">{{ t('acessos.estruturada.campos.motivo') }}</label>
            <InputText
              id="est-motivo"
              v-model="form.motivo"
              :disabled="disabled"
              :maxlength="LIMITES_ESCALARES.motivo"
              :invalid="Boolean(erroDe('motivo'))"
              :aria-describedby="describedBy('motivo')"
              :placeholder="t('acessos.estruturada.placeholders.motivo')"
            />
            <small v-if="erroDe('motivo')" id="est-erro-motivo" class="est__error" role="alert">
              {{ erroDe('motivo') }}
            </small>
          </div>

          <div class="est__field">
            <label for="est-pesoKg">{{ t('acessos.estruturada.campos.pesoKg') }}</label>
            <InputNumber
              v-model="form.pesoKg"
              input-id="est-pesoKg"
              :disabled="disabled"
              :locale="numberLocale"
              :min="PESO_MIN_KG"
              :max="PESO_MAX_KG"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              suffix=" kg"
              :invalid="Boolean(erroDe('pesoKg'))"
              :aria-describedby="describedBy('pesoKg')"
              :placeholder="t('acessos.estruturada.placeholders.pesoKg')"
            />
            <small v-if="erroDe('pesoKg')" id="est-erro-pesoKg" class="est__error" role="alert">
              {{ erroDe('pesoKg') }}
            </small>
          </div>
        </div>

        <div class="est__field">
          <label for="est-diagnostico">{{ t('acessos.estruturada.campos.diagnostico') }}</label>
          <Textarea
            id="est-diagnostico"
            v-model="form.diagnostico"
            rows="2"
            auto-resize
            :disabled="disabled"
            :maxlength="LIMITES_ESCALARES.diagnostico"
            :invalid="Boolean(erroDe('diagnostico'))"
            :aria-describedby="describedBy('diagnostico')"
            :placeholder="t('acessos.estruturada.placeholders.diagnostico')"
          />
          <small
            v-if="erroDe('diagnostico')"
            id="est-erro-diagnostico"
            class="est__error"
            role="alert"
          >
            {{ erroDe('diagnostico') }}
          </small>
        </div>
      </template>

      <!-- EXAME -->
      <template v-else-if="isExame">
        <div class="est__linha est__linha--data">
          <div class="est__field">
            <label for="est-tipoExame">{{ t('acessos.estruturada.campos.tipoExame') }}</label>
            <InputText
              id="est-tipoExame"
              v-model="form.tipoExame"
              :disabled="disabled"
              :maxlength="LIMITES_ESCALARES.tipoExame"
              :invalid="Boolean(erroDe('tipoExame'))"
              :aria-describedby="describedBy('tipoExame')"
              :placeholder="t('acessos.estruturada.placeholders.tipoExame')"
            />
            <small
              v-if="erroDe('tipoExame')"
              id="est-erro-tipoExame"
              class="est__error"
              role="alert"
            >
              {{ erroDe('tipoExame') }}
            </small>
          </div>

          <div class="est__field">
            <label for="est-dataResultado">
              {{ t('acessos.estruturada.campos.dataResultado') }}
            </label>
            <InputText
              id="est-dataResultado"
              v-model="form.dataResultado"
              class="est__date"
              type="date"
              fluid
              :disabled="disabled"
              :invalid="Boolean(erroDe('dataResultado'))"
              :aria-describedby="describedBy('dataResultado')"
            />
            <small
              v-if="erroDe('dataResultado')"
              id="est-erro-dataResultado"
              class="est__error"
              role="alert"
            >
              {{ erroDe('dataResultado') }}
            </small>
          </div>
        </div>

        <div class="est__field">
          <label for="est-laudoTexto">{{ t('acessos.estruturada.campos.laudoTexto') }}</label>
          <Textarea
            id="est-laudoTexto"
            v-model="form.laudoTexto"
            rows="4"
            auto-resize
            :disabled="disabled"
            :maxlength="LIMITES_ESCALARES.laudoTexto"
            :invalid="Boolean(erroDe('laudoTexto'))"
            :aria-describedby="describedBy('laudoTexto')"
            :placeholder="t('acessos.estruturada.placeholders.laudoTexto')"
          />
          <small
            v-if="erroDe('laudoTexto')"
            id="est-erro-laudoTexto"
            class="est__error"
            role="alert"
          >
            {{ erroDe('laudoTexto') }}
          </small>
        </div>
      </template>

      <!-- BANHO / TOSA -->
      <template v-else-if="isEstetica">
        <div class="est__field">
          <label for="est-produtos">{{ t('acessos.estruturada.campos.produtos') }}</label>
          <Textarea
            id="est-produtos"
            v-model="form.produtos"
            rows="2"
            auto-resize
            :disabled="disabled"
            :maxlength="LIMITES_ESCALARES.produtos"
            :invalid="Boolean(erroDe('produtos'))"
            :aria-describedby="describedBy('produtos')"
            :placeholder="t('acessos.estruturada.placeholders.produtos')"
          />
          <small v-if="erroDe('produtos')" id="est-erro-produtos" class="est__error" role="alert">
            {{ erroDe('produtos') }}
          </small>
        </div>

        <div class="est__linha">
          <div class="est__field">
            <label for="est-condicaoPele">
              {{ t('acessos.estruturada.campos.condicaoPele') }}
            </label>
            <Textarea
              id="est-condicaoPele"
              v-model="form.condicaoPele"
              rows="2"
              auto-resize
              :disabled="disabled"
              :maxlength="LIMITES_ESCALARES.condicaoPele"
              :invalid="Boolean(erroDe('condicaoPele'))"
              :aria-describedby="describedBy('condicaoPele')"
              :placeholder="t('acessos.estruturada.placeholders.condicaoPele')"
            />
            <small
              v-if="erroDe('condicaoPele')"
              id="est-erro-condicaoPele"
              class="est__error"
              role="alert"
            >
              {{ erroDe('condicaoPele') }}
            </small>
          </div>

          <div class="est__field">
            <label for="est-comportamento">
              {{ t('acessos.estruturada.campos.comportamento') }}
            </label>
            <Textarea
              id="est-comportamento"
              v-model="form.comportamento"
              rows="2"
              auto-resize
              :disabled="disabled"
              :maxlength="LIMITES_ESCALARES.comportamento"
              :invalid="Boolean(erroDe('comportamento'))"
              :aria-describedby="describedBy('comportamento')"
              :placeholder="t('acessos.estruturada.placeholders.comportamento')"
            />
            <small
              v-if="erroDe('comportamento')"
              id="est-erro-comportamento"
              class="est__error"
              role="alert"
            >
              {{ erroDe('comportamento') }}
            </small>
          </div>
        </div>
      </template>

      <!-- HOTEL -->
      <template v-else-if="isHotel">
        <div class="est__linha">
          <div class="est__field">
            <label for="est-dataEntrada">{{ t('acessos.estruturada.campos.dataEntrada') }}</label>
            <InputText
              id="est-dataEntrada"
              v-model="form.dataEntrada"
              class="est__date"
              type="datetime-local"
              fluid
              :disabled="disabled"
              :invalid="Boolean(erroDe('dataEntrada'))"
              :aria-describedby="describedBy('dataEntrada')"
            />
            <small
              v-if="erroDe('dataEntrada')"
              id="est-erro-dataEntrada"
              class="est__error"
              role="alert"
            >
              {{ erroDe('dataEntrada') }}
            </small>
          </div>

          <div class="est__field">
            <label for="est-dataSaida">{{ t('acessos.estruturada.campos.dataSaida') }}</label>
            <InputText
              id="est-dataSaida"
              v-model="form.dataSaida"
              class="est__date"
              type="datetime-local"
              fluid
              :disabled="disabled"
              :min="form.dataEntrada || undefined"
              :invalid="Boolean(erroDe('dataSaida'))"
              :aria-describedby="describedBy('dataSaida')"
            />
            <small
              v-if="erroDe('dataSaida')"
              id="est-erro-dataSaida"
              class="est__error"
              role="alert"
            >
              {{ erroDe('dataSaida') }}
            </small>
          </div>
        </div>

        <div class="est__field">
          <label for="est-alimentacao">{{ t('acessos.estruturada.campos.alimentacao') }}</label>
          <Textarea
            id="est-alimentacao"
            v-model="form.alimentacao"
            rows="2"
            auto-resize
            :disabled="disabled"
            :maxlength="LIMITES_ESCALARES.alimentacao"
            :invalid="Boolean(erroDe('alimentacao'))"
            :aria-describedby="describedBy('alimentacao')"
            :placeholder="t('acessos.estruturada.placeholders.alimentacao')"
          />
          <small
            v-if="erroDe('alimentacao')"
            id="est-erro-alimentacao"
            class="est__error"
            role="alert"
          >
            {{ erroDe('alimentacao') }}
          </small>
        </div>

        <div class="est__linha">
          <div class="est__field">
            <label for="est-comportamento-hotel">
              {{ t('acessos.estruturada.campos.comportamento') }}
            </label>
            <Textarea
              id="est-comportamento-hotel"
              v-model="form.comportamento"
              rows="2"
              auto-resize
              :disabled="disabled"
              :maxlength="LIMITES_ESCALARES.comportamento"
              :invalid="Boolean(erroDe('comportamento'))"
              :aria-describedby="describedBy('comportamento')"
              :placeholder="t('acessos.estruturada.placeholders.comportamentoHotel')"
            />
            <small
              v-if="erroDe('comportamento')"
              id="est-erro-comportamento"
              class="est__error"
              role="alert"
            >
              {{ erroDe('comportamento') }}
            </small>
          </div>

          <div class="est__field">
            <label for="est-intercorrencias">
              {{ t('acessos.estruturada.campos.intercorrencias') }}
            </label>
            <Textarea
              id="est-intercorrencias"
              v-model="form.intercorrencias"
              rows="2"
              auto-resize
              :disabled="disabled"
              :maxlength="LIMITES_ESCALARES.intercorrencias"
              :invalid="Boolean(erroDe('intercorrencias'))"
              :aria-describedby="describedBy('intercorrencias')"
              :placeholder="t('acessos.estruturada.placeholders.intercorrencias')"
            />
            <small
              v-if="erroDe('intercorrencias')"
              id="est-erro-intercorrencias"
              class="est__error"
              role="alert"
            >
              {{ erroDe('intercorrencias') }}
            </small>
          </div>
        </div>
      </template>
    </section>

    <!-- Prescrição: uma linha por remédio, como numa receita, e não um formulário por item. -->
    <section v-if="isConsulta" class="est__secao" aria-labelledby="est-presc-title">
      <header class="est__cab est__cab--acao">
        <h3 id="est-presc-title" class="est__titulo">
          <i class="ph ph-pill" aria-hidden="true" />
          {{ t('acessos.estruturada.prescricao.title') }}
          <span v-if="form.prescricaoItens.length" class="est__contagem">
            {{ form.prescricaoItens.length }}/{{ MAX_ITENS_LISTA }}
          </span>
        </h3>
        <Button
          :label="t('acessos.estruturada.prescricao.add')"
          icon="ph ph-plus"
          size="small"
          severity="secondary"
          outlined
          :disabled="disabled || !podeAdicionarPrescricao"
          @click="addPrescricao"
        />
      </header>

      <!-- Ler receita com IA (só consulta, no portal): quem decide é a tela. -->
      <slot name="prescricao-topo" />

      <p v-if="!form.prescricaoItens.length && !lendoReceita" class="est__vazio">
        {{ t('acessos.estruturada.prescricao.empty') }}
      </p>

      <div v-else class="presc">
        <div class="presc__cab" aria-hidden="true">
          <span />
          <span>{{ t('acessos.estruturada.prescricao.nome') }}</span>
          <span>{{ t('acessos.estruturada.prescricao.dose') }}</span>
          <span>{{ t('acessos.estruturada.prescricao.unidade') }}</span>
          <span>{{ t('acessos.estruturada.prescricao.frequencia') }}</span>
          <span>{{ t('acessos.estruturada.prescricao.duracaoDias') }}</span>
          <span />
        </div>

        <TransitionGroup tag="ol" name="presc-linha" class="presc__lista">
          <li
            v-for="(item, index) in form.prescricaoItens"
            :key="chaveDe(item)"
            class="presc__item"
            :class="{ 'presc__item--lido': ordemLida(item) !== undefined }"
            :style="ordemLida(item) !== undefined ? { '--ordem': ordemLida(item) } : undefined"
          >
            <span class="presc__n" aria-hidden="true">{{ index + 1 }}</span>

            <div
              class="presc__c presc__c--nome"
              :class="{ 'presc__c--conferir': aConferir(item, 'nome') }"
            >
              <i v-if="aConferir(item, 'nome')" class="ph ph-eye presc__olho" aria-hidden="true" />
              <label class="presc__lbl" :for="`est-presc-nome-${index}`">
                {{ t('acessos.estruturada.prescricao.nome') }}
              </label>
              <Textarea
                :id="`est-presc-nome-${index}`"
                v-model="item.nome"
                rows="1"
                auto-resize
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.nome"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.nome`))"
                :aria-describedby="descricaoPresc(item, index, 'nome')"
                :placeholder="
                  semExemplo(item, 'nome', t('acessos.estruturada.prescricao.nomePlaceholder'))
                "
                @keydown.enter="semQuebra"
                @update:model-value="conferido(item, 'nome')"
              />
            </div>

            <div
              class="presc__c presc__c--dose"
              :class="{ 'presc__c--conferir': aConferir(item, 'dose') }"
            >
              <i v-if="aConferir(item, 'dose')" class="ph ph-eye presc__olho" aria-hidden="true" />
              <label class="presc__lbl" :for="`est-presc-dose-${index}`">
                {{ t('acessos.estruturada.prescricao.dose') }}
              </label>
              <InputText
                :id="`est-presc-dose-${index}`"
                v-model="item.dose"
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.dose"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.dose`))"
                :aria-describedby="descricaoPresc(item, index, 'dose')"
                :placeholder="semExemplo(item, 'dose', '10')"
                @update:model-value="conferido(item, 'dose')"
              />
            </div>

            <div class="presc__c presc__c--unidade">
              <label class="presc__lbl" :for="`est-presc-unidade-${index}`">
                {{ t('acessos.estruturada.prescricao.unidade') }}
              </label>
              <InputText
                :id="`est-presc-unidade-${index}`"
                v-model="item.unidade"
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.unidade"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.unidade`))"
                :aria-describedby="descricaoPresc(item, index, 'unidade')"
                placeholder="mg"
              />
            </div>

            <div
              class="presc__c presc__c--freq"
              :class="{ 'presc__c--conferir': aConferir(item, 'frequencia') }"
            >
              <i
                v-if="aConferir(item, 'frequencia')"
                class="ph ph-eye presc__olho"
                aria-hidden="true"
              />
              <label class="presc__lbl" :for="`est-presc-freq-${index}`">
                {{ t('acessos.estruturada.prescricao.frequencia') }}
              </label>
              <InputText
                :id="`est-presc-freq-${index}`"
                v-model="item.frequencia"
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.frequencia"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.frequencia`))"
                :aria-describedby="descricaoPresc(item, index, 'frequencia')"
                :placeholder="
                  semExemplo(
                    item,
                    'frequencia',
                    t('acessos.estruturada.prescricao.frequenciaPlaceholder'),
                  )
                "
                @update:model-value="conferido(item, 'frequencia')"
              />
            </div>

            <div
              class="presc__c presc__c--dias"
              :class="{ 'presc__c--conferir': aConferir(item, 'duracaoDias') }"
            >
              <i
                v-if="aConferir(item, 'duracaoDias')"
                class="ph ph-eye presc__olho"
                aria-hidden="true"
              />
              <label class="presc__lbl" :for="`est-presc-duracao-${index}`">
                {{ t('acessos.estruturada.prescricao.duracaoDias') }}
              </label>
              <InputNumber
                v-model="item.duracaoDias"
                :input-id="`est-presc-duracao-${index}`"
                :disabled="disabled"
                :locale="numberLocale"
                :min="DURACAO_MIN_DIAS"
                :max="DURACAO_MAX_DIAS"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.duracaoDias`))"
                :aria-describedby="descricaoPresc(item, index, 'duracaoDias')"
                :placeholder="semExemplo(item, 'duracaoDias', '7')"
                @update:model-value="conferido(item, 'duracaoDias')"
              />
            </div>

            <Button
              class="presc__remover"
              icon="ph ph-trash"
              severity="secondary"
              text
              rounded
              :disabled="disabled"
              :aria-label="t('acessos.estruturada.prescricao.remove', { n: index + 1 })"
              :title="t('acessos.estruturada.prescricao.remove', { n: index + 1 })"
              @click="removePrescricao(index)"
            />

            <div class="presc__c presc__c--instr">
              <label class="presc__lbl" :for="`est-presc-instr-${index}`">
                {{ t('acessos.estruturada.prescricao.instrucoes') }}
              </label>
              <Textarea
                :id="`est-presc-instr-${index}`"
                v-model="item.instrucoes"
                rows="1"
                auto-resize
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.instrucoes"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.instrucoes`))"
                :aria-describedby="descricaoPresc(item, index, 'instrucoes')"
                :placeholder="`${t('acessos.estruturada.prescricao.instrucoes')} · ${t('acessos.estruturada.prescricao.instrucoesPlaceholder')}`"
              />
            </div>

            <!-- Descrições para o leitor de tela; na tela a marca é a cor do campo. -->
            <template v-for="campo in CONFERIVEIS" :key="campo">
              <span
                v-if="aConferir(item, campo)"
                :id="`est-conf-${index}-${campo}`"
                class="presc__sr"
              >
                {{ t('acessos.leituraReceita.conferirTitulo') }}
              </span>
            </template>

            <p v-if="semFrequencia(item)" :id="`est-freq-hint-${index}`" class="presc__aviso">
              <i class="ph ph-warning" aria-hidden="true" />
              {{ t('acessos.estruturada.prescricao.frequenciaHint') }}
            </p>

            <ul v-if="errosDoItem('prescricaoItens', index).length" class="presc__erros">
              <li
                v-for="erro in errosDoItem('prescricaoItens', index)"
                :id="`est-erro-${erro.id}`"
                :key="erro.id"
                role="alert"
              >
                <strong>{{ erro.rotulo }}:</strong> {{ erro.mensagem }}
              </li>
            </ul>
          </li>
        </TransitionGroup>

        <!-- Lugar guardado para o que a IA está lendo: duas linhas-fantasma no formato da tabela. -->
        <Transition name="presc-fantasma">
          <div v-if="lendoReceita" class="presc__fantasmas" aria-hidden="true">
            <div v-for="n in 2" :key="n" class="presc__item presc__item--fantasma">
              <span />
              <span class="presc__osso presc__osso--nome" />
              <span class="presc__osso" />
              <span class="presc__osso" />
              <span class="presc__osso" />
              <span class="presc__osso" />
              <span />
            </div>
          </div>
        </Transition>
      </div>

      <small v-if="erroDe('prescricaoItens')" class="est__error" role="alert">
        {{ erroDe('prescricaoItens') }}
      </small>
    </section>

    <!-- Exames solicitados -->
    <section v-if="isConsulta" class="est__secao" aria-labelledby="est-exames-title">
      <header class="est__cab est__cab--acao">
        <h3 id="est-exames-title" class="est__titulo">
          <i class="ph ph-flask" aria-hidden="true" />
          {{ t('acessos.estruturada.exames.title') }}
          <span v-if="form.examesSolicitados.length" class="est__contagem">
            {{ form.examesSolicitados.length }}/{{ MAX_ITENS_LISTA }}
          </span>
        </h3>
        <Button
          :label="t('acessos.estruturada.exames.add')"
          icon="ph ph-plus"
          size="small"
          severity="secondary"
          outlined
          :disabled="disabled || !podeAdicionarExame"
          @click="addExame"
        />
      </header>

      <p v-if="!form.examesSolicitados.length" class="est__vazio">
        {{ t('acessos.estruturada.exames.empty') }}
      </p>

      <div v-else class="presc presc--exames">
        <div class="presc__cab" aria-hidden="true">
          <span />
          <span>{{ t('acessos.estruturada.exames.nome') }}</span>
          <span>{{ t('acessos.estruturada.exames.observacao') }}</span>
          <span />
        </div>

        <TransitionGroup tag="ol" name="presc-linha" class="presc__lista">
          <li
            v-for="(item, index) in form.examesSolicitados"
            :key="chaveDe(item)"
            class="presc__item"
          >
            <span class="presc__n" aria-hidden="true">{{ index + 1 }}</span>

            <div class="presc__c">
              <label class="presc__lbl" :for="`est-exame-nome-${index}`">
                {{ t('acessos.estruturada.exames.nome') }}
              </label>
              <InputText
                :id="`est-exame-nome-${index}`"
                v-model="item.nome"
                :disabled="disabled"
                :maxlength="LIMITES_EXAME_SOLICITADO.nome"
                :invalid="Boolean(erroDe(`examesSolicitados.${index}.nome`))"
                :aria-describedby="describedBy(`examesSolicitados.${index}.nome`)"
                :placeholder="t('acessos.estruturada.exames.nomePlaceholder')"
              />
            </div>

            <div class="presc__c">
              <label class="presc__lbl" :for="`est-exame-obs-${index}`">
                {{ t('acessos.estruturada.exames.observacao') }}
              </label>
              <InputText
                :id="`est-exame-obs-${index}`"
                v-model="item.observacao"
                :disabled="disabled"
                :maxlength="LIMITES_EXAME_SOLICITADO.observacao"
                :invalid="Boolean(erroDe(`examesSolicitados.${index}.observacao`))"
                :aria-describedby="describedBy(`examesSolicitados.${index}.observacao`)"
                :placeholder="t('acessos.estruturada.exames.observacaoPlaceholder')"
              />
            </div>

            <Button
              class="presc__remover"
              icon="ph ph-trash"
              severity="secondary"
              text
              rounded
              :disabled="disabled"
              :aria-label="t('acessos.estruturada.exames.remove', { n: index + 1 })"
              :title="t('acessos.estruturada.exames.remove', { n: index + 1 })"
              @click="removeExame(index)"
            />

            <ul v-if="errosDoItem('examesSolicitados', index).length" class="presc__erros">
              <li
                v-for="erro in errosDoItem('examesSolicitados', index)"
                :id="`est-erro-${erro.id}`"
                :key="erro.id"
                role="alert"
              >
                <strong>{{ erro.rotulo }}:</strong> {{ erro.mensagem }}
              </li>
            </ul>
          </li>
        </TransitionGroup>
      </div>

      <small v-if="erroDe('examesSolicitados')" class="est__error" role="alert">
        {{ erroDe('examesSolicitados') }}
      </small>
    </section>
  </div>
</template>

<style scoped>
/*
 * Sem cartão: as seções são da folha da anotação. O recuo lateral e o fio entre seções vêm da
 * tela (`--folha-pad-x`, `--folha-fio`), para a linha de cima e a de baixo baterem.
 */
.est {
  display: grid;
}

.est__secao {
  display: grid;
  gap: 0.9rem;
  padding: 1.25rem var(--folha-pad-x, 1.25rem);
  border-top: 1px solid var(--folha-fio, var(--hc-linha));
}

.est__cab {
  display: grid;
  gap: 0.2rem;
}

.est__cab--acao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.est__titulo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.est__titulo i {
  color: var(--hc-marca);
  font-size: 1.05rem;
}

.est__contagem {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.est__lede {
  margin: 0;
  padding-inline-start: 1.55rem;
  color: var(--folha-suave, #6b7a74);
  font-size: 0.8rem;
  line-height: 1.45;
}

.est__field {
  display: grid;
  gap: 0.35rem;
  align-content: start;
  min-width: 0;
}

.est__field label {
  color: var(--hc-tinta);
  font-size: 0.8rem;
  font-weight: 650;
}

.est__field :deep(.p-inputnumber) {
  width: 100%;
}

.est__linha {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Motivo largo, peso estreito: o número tem três dígitos e uma vírgula. */
.est__linha--estreita {
  grid-template-columns: minmax(0, 1fr) 9.5rem;
}

.est__linha--data {
  grid-template-columns: minmax(0, 1fr) 11.5rem;
}

.est__error {
  color: var(--hc-coral-tinta);
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.35;
}

.est__vazio {
  margin: 0;
  color: var(--folha-suave, #6b7a74);
  font-size: 0.82rem;
}

/*
 * Data/hora: InputText do PrimeVue com type date/datetime-local (mesmo padrão do módulo
 * clínico) — seletor localizado pelo navegador e o model continua string local.
 * O ícone nativo do seletor some no escuro sem isto.
 */
.est__date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(var(--est-picker-invert, 0));
  opacity: 0.65;
}

.app-dark .est__date::-webkit-calendar-picker-indicator {
  --est-picker-invert: 1;
}

/* ------------------------------------------------------------ receita em linhas */

.presc {
  container: presc / inline-size;
}

.presc__cab,
.presc__item {
  display: grid;
  grid-template-columns: 1.1rem minmax(0, 1fr) 4.25rem 7.25rem 6.5rem 5.5rem 2.25rem;
  column-gap: 0.5rem;
  align-items: start;
}

.presc--exames .presc__cab,
.presc--exames .presc__item {
  grid-template-columns: 1.1rem minmax(0, 1fr) minmax(0, 1.3fr) 2.25rem;
}

.presc__cab {
  align-items: end;
  padding-bottom: 0.4rem;
}

.presc__cab span {
  color: var(--folha-suave, #6b7a74);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25;
}

.presc__lista {
  position: relative;
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.presc__item {
  row-gap: 0.45rem;
  padding-block: 0.65rem;
  border-top: 1px solid var(--folha-fio, var(--hc-linha));
}

.presc__item:first-child {
  border-top: 0;
  padding-top: 0;
}

/* ------------------------------------------------------------ movimento da lista */

/*
 * Linha que entra desce 6 px e aparece; a que sai some e as de baixo sobem para o lugar dela.
 * Remédio que veio da leitura entra na sua vez (`--ordem`), um depois do outro, e passa um
 * brilho pervinca que se apaga: é o "isto chegou agora, e veio da máquina".
 */
.presc-linha-enter-active {
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out;
  transition-delay: calc(var(--ordem, 0) * 90ms);
}

.presc-linha-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

/*
 * A linha que sai some no próprio lugar e só então a lista fecha. Tirá-la do fluxo para as de
 * baixo deslizarem (FLIP) fazia a seção seguinte subir na hora e encavalar na linha em trânsito.
 */
.presc-linha-leave-active {
  transition: opacity 150ms ease-out;
}

.presc-linha-leave-to {
  opacity: 0;
}

.presc__item--lido {
  border-radius: 0.6rem;
  animation: presc-lido 1.8s ease-out both;
  animation-delay: calc(var(--ordem, 0) * 90ms);
}

@keyframes presc-lido {
  0%,
  25% {
    background-color: color-mix(in srgb, var(--hc-lilas-fundo) 85%, transparent);
    box-shadow: 0 0 0 0.4rem color-mix(in srgb, var(--hc-lilas-fundo) 85%, transparent);
  }

  100% {
    background-color: transparent;
    box-shadow: 0 0 0 0.4rem transparent;
  }
}

/* Linhas-fantasma: o formato da tabela, com um brilho correndo enquanto a IA lê. */
.presc__fantasmas {
  display: grid;
}

.presc__item--fantasma {
  padding-block: 0.65rem;
  border-top: 1px solid var(--folha-fio, var(--hc-linha));
}

.presc__osso {
  height: 2.4rem;
  border-radius: 0.6rem;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--hc-lilas-fundo) 70%, var(--hc-cartao)) 0%,
    color-mix(in srgb, var(--hc-lilas-fundo) 100%, var(--hc-cartao)) 40%,
    color-mix(in srgb, var(--hc-lilas-fundo) 70%, var(--hc-cartao)) 80%
  );
  background-size: 250% 100%;
  animation: presc-osso 1.4s ease-in-out infinite;
}

.presc__item--fantasma + .presc__item--fantasma .presc__osso {
  animation-delay: 0.2s;
  opacity: 0.6;
}

@keyframes presc-osso {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: -100% 0;
  }
}

.presc-fantasma-enter-active,
.presc-fantasma-leave-active {
  transition: opacity 180ms ease-out;
}

.presc-fantasma-enter-from,
.presc-fantasma-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .presc-linha-enter-active,
  .presc-linha-leave-active,
  .presc-fantasma-enter-active,
  .presc-fantasma-leave-active {
    transition: none;
  }

  .presc__item--lido,
  .presc__osso {
    animation: none;
  }
}

.presc__n {
  padding-top: 0.6rem;
  color: var(--folha-suave, #6b7a74);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.presc__c {
  position: relative;
  min-width: 0;
}

.presc__c :deep(.p-inputtext),
.presc__c :deep(.p-textarea),
.presc__c :deep(.p-inputnumber) {
  width: 100%;
}

.presc__c--instr,
.presc__aviso,
.presc__erros {
  grid-column: 2 / -2;
}

/* Instrução é complemento: o campo recua de tom até alguém escrever nele. */
.presc__c--instr :deep(.p-textarea:placeholder-shown:not(:focus)) {
  border-style: dashed;
  background: transparent;
}

.presc__remover.p-button {
  width: 2.25rem;
  height: 2.25rem;
  margin-top: 0.1rem;
  color: var(--folha-suave, #6b7a74);
}

.presc__remover.p-button:not(:disabled):hover {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.presc__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Rótulo de cada campo: some na tela larga (o cabeçalho da tabela fala por ele), fica para o
   leitor de tela e reaparece quando a linha empilha. */
.presc__lbl {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/*
 * Campo que a leitura com IA propôs sem confiança alta: a pervinca, "a máquina propôs e
 * ninguém aprovou ainda". Editado, perde a cor e vira anotação. O olho no canto marca o campo
 * mesmo para quem não distingue a cor.
 */
.presc__c--conferir :deep(.p-inputtext),
.presc__c--conferir :deep(.p-textarea) {
  border-color: color-mix(in srgb, var(--hc-lilas-tinta) 55%, transparent);
  background: var(--hc-lilas-fundo);
  color: var(--hc-tinta);
}

.presc__olho {
  position: absolute;
  z-index: 1;
  top: -0.45rem;
  inset-inline-end: -0.35rem;
  display: grid;
  width: 1.1rem;
  height: 1.1rem;
  place-items: center;
  border-radius: 999px;
  background: var(--hc-lilas-tinta);
  color: var(--hc-cartao);
  font-size: 0.66rem;
  pointer-events: none;
}

.presc__aviso {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0;
  color: var(--hc-pessego-tinta);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

.presc__erros {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--hc-coral-tinta);
  font-size: 0.75rem;
  line-height: 1.4;
}

/*
 * Coluna média (ficha ao lado num notebook de 1280): a linha vira três — o nome, os quatro
 * números lado a lado, as instruções — e cada campo ganha rótulo, já que o cabeçalho some.
 */
@container presc (max-width: 38rem) {
  .presc__cab {
    display: none;
  }

  .presc__item {
    grid-template-columns: 1.1rem repeat(4, minmax(0, 1fr)) 2.25rem;
    row-gap: 0.6rem;
  }

  .presc__lbl {
    position: static;
    display: block;
    width: auto;
    height: auto;
    margin-bottom: 0.25rem;
    overflow: visible;
    clip: auto;
    color: var(--folha-suave, #6b7a74);
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* O olho marca o campo, não o rótulo: desce a altura do rótulo. */
  .presc__olho {
    top: 0.75rem;
  }

  .presc__n {
    grid-row: 1;
    padding-top: 1.75rem;
  }

  .presc__c--nome {
    grid-row: 1;
    grid-column: 2 / 6;
  }

  .presc__remover.p-button {
    grid-row: 1;
    grid-column: 6;
    margin-top: 1.35rem;
  }

  .presc__c--dose {
    grid-row: 2;
    grid-column: 2;
  }

  .presc__c--unidade {
    grid-row: 2;
    grid-column: 3;
  }

  .presc__c--freq {
    grid-row: 2;
    grid-column: 4;
  }

  .presc__c--dias {
    grid-row: 2;
    grid-column: 5;
  }

  .presc__c--instr,
  .presc__aviso,
  .presc__erros {
    grid-column: 2 / 6;
  }

  .presc--exames .presc__item {
    grid-template-columns: 1.1rem minmax(0, 1fr) 2.25rem;
  }

  .presc--exames .presc__c {
    grid-column: 2;
  }

  .presc--exames .presc__remover.p-button {
    grid-row: 1;
    grid-column: 3;
  }

  .presc--exames .presc__erros {
    grid-column: 2;
  }

  /* Fantasma na coluna média: uma barra só, do tamanho do nome. */
  .presc__item--fantasma {
    grid-template-columns: 1.1rem minmax(0, 1fr) 2.25rem;
  }

  .presc__item--fantasma .presc__osso:not(.presc__osso--nome) {
    display: none;
  }
}

/* Coluna estreita de verdade: os números em duas linhas de dois. */
@container presc (max-width: 26rem) {
  .presc__item {
    grid-template-columns: 1.1rem repeat(2, minmax(0, 1fr)) 2.25rem;
  }

  .presc__c--nome,
  .presc__c--instr,
  .presc__aviso,
  .presc__erros {
    grid-column: 2 / 4;
  }

  .presc__remover.p-button {
    grid-column: 4;
  }

  .presc__c--freq {
    grid-row: 3;
    grid-column: 2;
  }

  .presc__c--dias {
    grid-row: 3;
    grid-column: 3;
  }
}

@media (max-width: 640px) {
  .est__linha,
  .est__linha--estreita,
  .est__linha--data {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
