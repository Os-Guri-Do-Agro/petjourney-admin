<script setup lang="ts">
/**
 * O diagnóstico do atendimento (E4-01): os diagnósticos, em ordem (o primeiro definitivo, ou o
 * primeiro presuntivo, é o principal da linha do tempo), e os antecedentes. O diferencial **nunca**
 * vai ao app. "Sem diagnóstico" é a escolha explícita (D5): com ela, a lista vai vazia.
 *
 * A descrição busca no catálogo de diagnósticos (código e texto, em qualquer idioma) e aceita
 * texto livre. A lista inteira vai a cada gravação, com o `id` dos itens que já existem.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { buscarDiagnosticos, type Diagnostico } from '@/service/parceiro/catalogos-service'

import './secao.css'
import type { Antecedente, DiagnosticoNaTela, ItemDeDiagnostico } from './rascunho-do-atendimento'

defineProps<{ somenteLeitura: boolean; faltaDiagnostico?: boolean }>()
const model = defineModel<DiagnosticoNaTela>({ required: true })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const ITENS_MAX = 20
const ANTECEDENTES_MAX = 30
const TIPOS = ['PRESUNTIVO', 'DEFINITIVO', 'DIFERENCIAL'] as const
const KINDS_DE_ANTECEDENTE = [
  'ALERGIA',
  'MEDICACAO_CONTINUA',
  'DOENCA_PREVIA',
  'CIRURGIA',
  'REACAO_VACINAL',
  'TRAUMA',
  'OUTRO',
] as const

const opcoesDeTipo = computed(() =>
  TIPOS.map((valor) => ({ valor, rotulo: t(`atendimento.diagnostico.tipo.${valor}`) })),
)
const opcoesDeAntecedente = computed(() =>
  KINDS_DE_ANTECEDENTE.map((valor) => ({
    valor,
    rotulo: t(`atendimento.diagnostico.antecedente.${valor}`),
  })),
)

/* ----------------------------------------------------------------------- diagnósticos */

const sugestoes = ref<Diagnostico[]>([])

async function buscar(evento: { query: string }) {
  if (evento.query.trim().length < 2) {
    sugestoes.value = []
    return
  }
  try {
    sugestoes.value = await buscarDiagnosticos({ q: evento.query, limite: 8 }, parceiroQuery())
  } catch {
    sugestoes.value = []
  }
}

/** Escolher do catálogo grava o código; digitar à mão apaga o código que estava. */
function escolher(item: ItemDeDiagnostico, escolhido: Diagnostico) {
  item.descricao = escolhido.descricao
  item.codigo = escolhido.codigo
}

function digitar(item: ItemDeDiagnostico, valor: unknown) {
  if (typeof valor === 'string') {
    item.descricao = valor
    item.codigo = null
  } else if (valor && typeof valor === 'object' && 'descricao' in valor) {
    escolher(item, valor as Diagnostico)
  }
}

function adicionar() {
  if (model.value.itens.length >= ITENS_MAX) return
  const primeiro = model.value.itens.length === 0
  model.value.itens = [
    ...model.value.itens,
    { kind: primeiro ? 'PRESUNTIVO' : 'DIFERENCIAL', codigo: null, descricao: '' },
  ]
}

function remover(indice: number) {
  model.value.itens = model.value.itens.filter((_, i) => i !== indice)
}

function semDiagnostico(valor: boolean) {
  model.value.semDiagnostico = valor
}

/* ----------------------------------------------------------------------- antecedentes */

function adicionarAntecedente() {
  if (model.value.antecedentes.length >= ANTECEDENTES_MAX) return
  model.value.antecedentes = [
    ...model.value.antecedentes,
    { kind: 'ALERGIA', descricao: '', quando: null } satisfies Antecedente,
  ]
}

function removerAntecedente(indice: number) {
  model.value.antecedentes = model.value.antecedentes.filter((_, i) => i !== indice)
}
</script>

<template>
  <section class="ui-folha ui-cartao sa" aria-labelledby="sa-diagnostico">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clipboard-text" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="sa-diagnostico" class="ui-cartao__titulo">
          {{ t('atendimento.secao.DIAGNOSTICO') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('atendimento.diagnostico.descricao') }}</p>
      </span>
    </header>

    <div class="sa__form">
      <section class="sa__grupo" aria-labelledby="sa-diag-itens">
        <div class="sa__sobre">
          <h3 id="sa-diag-itens" class="sa__titulo">{{ t('atendimento.diagnostico.itens') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.diagnostico.itensDica') }}</p>
        </div>
        <div class="sa__campos">
          <label class="dg__sem" for="dg-sem">
            <Checkbox
              :model-value="model.semDiagnostico"
              input-id="dg-sem"
              binary
              :disabled="somenteLeitura"
              @update:model-value="semDiagnostico(Boolean($event))"
            />
            <span>{{ t('atendimento.diagnostico.sem') }}</span>
          </label>

          <template v-if="!model.semDiagnostico">
            <ul v-if="model.itens.length" class="sa__lista">
              <li
                v-for="(item, indice) in model.itens"
                :key="item.id ?? `novo-${indice}`"
                class="sa__item"
              >
                <Select
                  v-model="item.kind"
                  :options="opcoesDeTipo"
                  option-label="rotulo"
                  option-value="valor"
                  :aria-label="t('atendimento.diagnostico.tipoRotulo')"
                  :disabled="somenteLeitura"
                />
                <AutoComplete
                  :model-value="item.descricao"
                  :suggestions="sugestoes"
                  option-label="descricao"
                  :aria-label="t('atendimento.diagnostico.descricaoRotulo')"
                  :placeholder="t('atendimento.diagnostico.buscar')"
                  :readonly="somenteLeitura"
                  :disabled="somenteLeitura"
                  :invalid="faltaDiagnostico && !item.descricao.trim()"
                  @complete="buscar"
                  @update:model-value="digitar(item, $event)"
                  @option-select="escolher(item, $event.value)"
                >
                  <template #option="{ option }">
                    <span class="dg__opcao">
                      <span>{{ option.descricao }}</span>
                      <small class="ui-num">{{ option.codigo }}</small>
                    </span>
                  </template>
                </AutoComplete>
                <Button
                  v-if="!somenteLeitura"
                  type="button"
                  severity="secondary"
                  outlined
                  icon="ph ph-trash"
                  :aria-label="t('atendimento.diagnostico.remover')"
                  @click="remover(indice)"
                />
                <small v-if="item.codigo" class="dg__codigo ui-num">{{ item.codigo }}</small>
              </li>
            </ul>
            <p v-else class="sa__vazio">{{ t('atendimento.diagnostico.nenhum') }}</p>
            <small v-if="faltaDiagnostico" class="eg__invalido">{{
              t('atendimento.diagnostico.falta')
            }}</small>
            <Button
              v-if="!somenteLeitura && model.itens.length < ITENS_MAX"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-plus"
              class="dg__mais"
              :label="t('atendimento.diagnostico.adicionar')"
              @click="adicionar"
            />
          </template>
        </div>
      </section>

      <section class="sa__grupo" aria-labelledby="sa-diag-antecedentes">
        <div class="sa__sobre">
          <h3 id="sa-diag-antecedentes" class="sa__titulo">
            {{ t('atendimento.diagnostico.antecedentes') }}
          </h3>
          <p class="sa__descricao">{{ t('atendimento.diagnostico.antecedentesDica') }}</p>
        </div>
        <div class="sa__campos">
          <ul v-if="model.antecedentes.length" class="sa__lista">
            <li
              v-for="(item, indice) in model.antecedentes"
              :key="item.id ?? `novo-${indice}`"
              class="sa__item sa__item--tres"
            >
              <Select
                v-model="item.kind"
                :options="opcoesDeAntecedente"
                option-label="rotulo"
                option-value="valor"
                :aria-label="t('atendimento.diagnostico.antecedenteRotulo')"
                :disabled="somenteLeitura"
              />
              <InputText
                v-model="item.descricao"
                :aria-label="t('atendimento.diagnostico.antecedenteDescricao')"
                :readonly="somenteLeitura"
              />
              <InputText
                :model-value="item.quando ?? ''"
                :aria-label="t('atendimento.diagnostico.quando')"
                :placeholder="t('atendimento.diagnostico.quandoDica')"
                :readonly="somenteLeitura"
                @update:model-value="item.quando = String($event ?? '')"
              />
              <Button
                v-if="!somenteLeitura"
                type="button"
                severity="secondary"
                outlined
                icon="ph ph-trash"
                :aria-label="t('atendimento.diagnostico.removerAntecedente')"
                @click="removerAntecedente(indice)"
              />
            </li>
          </ul>
          <p v-else class="sa__vazio">{{ t('atendimento.diagnostico.semAntecedente') }}</p>
          <Button
            v-if="!somenteLeitura && model.antecedentes.length < ANTECEDENTES_MAX"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-plus"
            class="dg__mais"
            :label="t('atendimento.diagnostico.adicionarAntecedente')"
            @click="adicionarAntecedente"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dg__sem {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.dg__opcao {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dg__opcao small,
.dg__codigo {
  color: var(--tinta-2);
  font-size: 12px;
}

.dg__codigo {
  grid-column: 2;
}

.dg__mais {
  justify-self: start;
}
</style>
