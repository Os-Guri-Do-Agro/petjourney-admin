<script setup lang="ts">
/**
 * O exame físico do atendimento (E4-01): os sinais vitais, as mucosas e a hidratação, os sistemas
 * e a observação.
 *
 * O status de cada vital (abaixo, dentro, acima, sem referência) **vem do servidor**, pela faixa
 * do catálogo para a espécie, o porte e a idade na data do atendimento (guia e4 5.3): a tela não
 * calcula. Ele aparece quando o valor da tela é o que o servidor tem; enquanto a pessoa digita,
 * some. "Não aferido" é decisão do profissional: vira `NAO_AFERIDO`, nunca "dentro".
 *
 * O peso de casa da pré-consulta fica ao lado do peso, só para leitura: nunca vira peso aferido.
 */
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { Atendimento } from '@/service/parceiro/atendimentos-service'

import './secao.css'
import {
  CHAVES_DOS_VITAIS,
  LIMITES_DOS_VITAIS,
  SISTEMAS,
  type ChaveDoVital,
  type ExameNaTela,
  type Sistema,
  type StatusDoSistema,
} from './rascunho-do-atendimento'

const props = defineProps<{
  somenteLeitura: boolean
  /** O exame como o servidor tem (com o status e a faixa de cada vital). */
  servidor: Atendimento['exameFisico']
  pesoDeCasa: number | null
}>()
const model = defineModel<ExameNaTela>({ required: true })

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const MUCOSAS = [
  'NORMOCORADAS',
  'PALIDAS',
  'ICTERICAS',
  'CIANOTICAS',
  'CONGESTAS',
  'NAO_AVALIADO',
] as const
const HIDRATACAO = ['NORMAL', 'LEVE', 'MODERADA', 'GRAVE'] as const
const STATUS_DO_SISTEMA: readonly StatusDoSistema[] = ['NORMAL', 'ALTERADO', 'NAO_AVALIADO']

const opcoesDeMucosa = computed(() =>
  MUCOSAS.map((valor) => ({ valor, rotulo: t(`atendimento.exame.mucosas.${valor}`) })),
)
const opcoesDeHidratacao = computed(() =>
  HIDRATACAO.map((valor) => ({ valor, rotulo: t(`atendimento.exame.hidratacao.${valor}`) })),
)
const opcoesDoSistema = computed(() =>
  STATUS_DO_SISTEMA.map((valor) => ({
    valor,
    rotulo: t(`atendimento.exame.statusDoSistema.${valor}`),
  })),
)

/* ------------------------------------------------------------------------- os vitais */

const TOM: Record<string, string> = { ABAIXO: 'atencao', ACIMA: 'atencao', DENTRO: 'ok' }

function numero(valor: number, casas: number) {
  return new Intl.NumberFormat(intl.value, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor)
}

type FaixaLida = { min: number; max: number; unidade: string; precisao?: number }

/**
 * A faixa do vital. O OpenAPI declara `{ vital, faixa }`, mas a API em dev devolve a faixa direto
 * (`{ min, max, unidade, fonte }`, lacuna N32): a tela lê as duas formas.
 */
function faixaDo(lido: Atendimento['exameFisico']['vitais'][ChaveDoVital]): FaixaLida | null {
  const bruta = lido.faixa as unknown as (FaixaLida & { faixa?: FaixaLida | null }) | null
  if (!bruta) return null
  if (bruta.faixa) return bruta.faixa
  return typeof bruta.min === 'number' && typeof bruta.max === 'number' ? bruta : null
}

/** O status do servidor, só quando a tela mostra o mesmo valor que ele tem. */
function statusDo(chave: ChaveDoVital) {
  const lido = props.servidor.vitais[chave]
  const local = model.value.vitais[chave]
  if (lido.naoAferido !== local.naoAferido) return null
  if (!local.naoAferido && lido.valor !== local.valor) return null
  if (lido.status === 'NAO_AFERIDO' || (lido.valor === null && !lido.naoAferido)) return null
  const faixa = faixaDo(lido)
  const casas = faixa?.precisao ?? LIMITES_DOS_VITAIS[chave].casas
  return {
    texto: t(`atendimento.exame.status.${lido.status}`),
    tom: TOM[lido.status] ?? '',
    faixa: faixa
      ? t('atendimento.exame.faixa', {
          min: numero(faixa.min, casas),
          max: numero(faixa.max, casas),
          unidade: faixa.unidade,
        })
      : '',
  }
}

function naoAferir(chave: ChaveDoVital, valor: boolean) {
  const medida = model.value.vitais[chave]
  medida.naoAferido = valor
  if (valor) medida.valor = null
}

/* ------------------------------------------------------------------------ os sistemas */

function achadoDe(sistema: Sistema) {
  return model.value.sistemas.find((item) => item.sistema === sistema) ?? null
}

/** Sem escolha, o sistema não vai: vazio não é "não avaliado". */
function mudarSistema(sistema: Sistema, status: StatusDoSistema | null) {
  const lista = model.value.sistemas.filter((item) => item.sistema !== sistema)
  if (status) lista.push({ sistema, status, nota: achadoDe(sistema)?.nota ?? null })
  model.value.sistemas = SISTEMAS.flatMap((s) => lista.filter((item) => item.sistema === s))
}

function mudarNota(sistema: Sistema, nota: string) {
  const achado = achadoDe(sistema)
  if (achado) achado.nota = nota
}

const alterados = computed(
  () => model.value.sistemas.filter((item) => item.status === 'ALTERADO').length,
)
</script>

<template>
  <section class="ui-folha ui-cartao sa" aria-labelledby="sa-exame">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-heartbeat" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="sa-exame" class="ui-cartao__titulo">{{ t('atendimento.secao.EXAME_FISICO') }}</h2>
        <p class="ui-cartao__descricao">{{ t('atendimento.exame.descricao') }}</p>
      </span>
    </header>

    <div class="sa__form">
      <!-- Sinais vitais. -->
      <section class="sa__grupo" aria-labelledby="sa-exame-vitais">
        <div class="sa__sobre">
          <h3 id="sa-exame-vitais" class="sa__titulo">{{ t('atendimento.exame.vitais') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.exame.vitaisDica') }}</p>
        </div>
        <div class="sa__campos ex__vitais">
          <div v-for="chave in CHAVES_DOS_VITAIS" :key="chave" class="eg__secao ex__vital">
            <label class="eg__rotulo" :for="`ex-${chave}`">{{
              t(`atendimento.exame.vital.${chave}`)
            }}</label>
            <InputNumber
              v-model="model.vitais[chave].valor"
              :input-id="`ex-${chave}`"
              :min-fraction-digits="0"
              :max-fraction-digits="LIMITES_DOS_VITAIS[chave].casas"
              :min="LIMITES_DOS_VITAIS[chave].min"
              :max="LIMITES_DOS_VITAIS[chave].max"
              :suffix="` ${LIMITES_DOS_VITAIS[chave].unidade}`"
              :locale="intl"
              :readonly="somenteLeitura"
              :disabled="model.vitais[chave].naoAferido"
            />
            <label class="ex__nao" :for="`ex-${chave}-nao`">
              <Checkbox
                :model-value="model.vitais[chave].naoAferido"
                :input-id="`ex-${chave}-nao`"
                binary
                :disabled="somenteLeitura"
                @update:model-value="naoAferir(chave, Boolean($event))"
              />
              <span>{{ t('atendimento.exame.naoAferido') }}</span>
            </label>
            <p v-if="statusDo(chave)" class="ex__status">
              <span
                class="ui-selo"
                :class="statusDo(chave)?.tom ? `ui-selo--${statusDo(chave)?.tom}` : ''"
                >{{ statusDo(chave)?.texto }}</span
              >
              <small v-if="statusDo(chave)?.faixa">{{ statusDo(chave)?.faixa }}</small>
            </p>
            <p v-if="chave === 'peso' && pesoDeCasa" class="sa__sugestao">
              <i class="ph ph-house" aria-hidden="true" />
              {{ t('atendimento.exame.pesoDeCasa', { peso: rotulos.peso(pesoDeCasa) }) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Mucosas e hidratação. -->
      <section class="sa__grupo" aria-labelledby="sa-exame-mucosas">
        <div class="sa__sobre">
          <h3 id="sa-exame-mucosas" class="sa__titulo">
            {{ t('atendimento.exame.mucosasTitulo') }}
          </h3>
        </div>
        <div class="sa__campos sa__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="ex-mucosas">{{
              t('atendimento.exame.mucosasRotulo')
            }}</label>
            <Select
              v-model="model.mucosas"
              input-id="ex-mucosas"
              :options="opcoesDeMucosa"
              option-label="rotulo"
              option-value="valor"
              show-clear
              :placeholder="t('atendimento.exame.semRegistro')"
              :disabled="somenteLeitura"
            />
          </div>
          <div class="eg__secao">
            <span id="ex-hidratacao" class="eg__rotulo">{{
              t('atendimento.exame.hidratacaoRotulo')
            }}</span>
            <SelectButton
              v-model="model.hidratacao"
              :options="opcoesDeHidratacao"
              option-label="rotulo"
              option-value="valor"
              aria-labelledby="ex-hidratacao"
              :disabled="somenteLeitura"
            />
          </div>
        </div>
      </section>

      <!-- Sistemas. -->
      <section class="sa__grupo" aria-labelledby="sa-exame-sistemas">
        <div class="sa__sobre">
          <h3 id="sa-exame-sistemas" class="sa__titulo">{{ t('atendimento.exame.sistemas') }}</h3>
          <p class="sa__descricao">
            {{
              alterados
                ? t('atendimento.exame.alterados', { n: alterados }, alterados)
                : t('atendimento.exame.sistemasDica')
            }}
          </p>
        </div>
        <ul class="sa__campos sa__lista">
          <li v-for="sistema in SISTEMAS" :key="sistema" class="ex__sistema">
            <span :id="`ex-sis-${sistema}`" class="ex__sistema-nome">{{
              t(`atendimento.exame.sistema.${sistema}`)
            }}</span>
            <SelectButton
              :model-value="achadoDe(sistema)?.status ?? null"
              :options="opcoesDoSistema"
              option-label="rotulo"
              option-value="valor"
              :aria-labelledby="`ex-sis-${sistema}`"
              :disabled="somenteLeitura"
              @update:model-value="mudarSistema(sistema, $event)"
            />
            <InputText
              v-if="achadoDe(sistema)?.status === 'ALTERADO'"
              class="ex__nota"
              :model-value="achadoDe(sistema)?.nota ?? ''"
              :aria-label="
                t('atendimento.exame.notaDe', {
                  sistema: t(`atendimento.exame.sistema.${sistema}`),
                })
              "
              :placeholder="t('atendimento.exame.notaDica')"
              :readonly="somenteLeitura"
              @update:model-value="mudarNota(sistema, String($event ?? ''))"
            />
          </li>
        </ul>
      </section>

      <!-- Observação. -->
      <section class="sa__grupo" aria-labelledby="sa-exame-obs">
        <div class="sa__sobre">
          <h3 id="sa-exame-obs" class="sa__titulo">{{ t('atendimento.exame.observacao') }}</h3>
        </div>
        <div class="sa__campos">
          <Textarea
            v-model="model.observacao"
            rows="3"
            auto-resize
            :aria-label="t('atendimento.exame.observacao')"
            :readonly="somenteLeitura"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.ex__vitais {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
  gap: 18px 16px;
}

.ex__vital {
  align-content: start;
  gap: 6px;
}

.ex__nao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  cursor: pointer;
}

.ex__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
}

.ex__status small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/* A nota do sistema alterado entra embaixo da escolha, na largura da coluna. */
.ex__sistema {
  display: grid;
  grid-template-columns: minmax(8rem, 11rem) minmax(0, 1fr);
  align-items: center;
  gap: 8px 14px;
}

.ex__sistema .p-selectbutton {
  justify-self: start;
}

.ex__nota {
  grid-column: 2;
}

.ex__sistema-nome {
  color: var(--tinta);
  font-size: 14px;
}

@container secao-do-atendimento (max-width: 720px) {
  .ex__sistema {
    grid-template-columns: minmax(0, 1fr);
  }

  .ex__nota {
    grid-column: 1;
  }
}
</style>
