<script setup lang="ts">
/**
 * A anamnese do atendimento (E4-01): na ordem da conversa, o que trouxe o paciente, como está em
 * casa e a prevenção. A queixa é o que o finalizar cobra.
 *
 * A pré-consulta respondida no app chega como **sugestão** (guia e4 11.1): embaixo do campo, o que
 * o responsável disse e o "Usar". Usar grava o valor com a marca em `camposDaPreConsulta`; o
 * servidor só mantém a marca se o valor final for o da sugestão. Nada entra sozinho.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Atendimento } from '@/service/parceiro/atendimentos-service'

import './secao.css'
import type { AnamneseNaTela, CampoDaAnamnese } from './rascunho-do-atendimento'

const props = defineProps<{
  somenteLeitura: boolean
  preConsulta: Atendimento['preConsulta']
  /** A falta que o finalizar apontou nesta seção (a queixa). */
  faltaQueixa?: boolean
}>()
const model = defineModel<AnamneseNaTela>({ required: true })

const { t } = useI18n()

const DESDE_QUANDO = [
  'HOJE',
  'UM_A_DOIS_DIAS',
  'TRES_A_SETE_DIAS',
  'UMA_A_DUAS_SEMANAS',
  'MAIS_DE_DUAS_SEMANAS',
] as const
const EVOLUCAO = ['PIORANDO', 'ESTAVEL', 'MELHORANDO', 'VAI_E_VOLTA'] as const
const APETITE = ['MUITO', 'NORMAL', 'POUCO', 'NADA', 'RECUSOU', 'VOMITOU_APOS'] as const
const EVACUACAO = [
  'NORMAL',
  'MOLE',
  'PASTOSA',
  'DIARREIA',
  'RESSECADA',
  'COM_SANGUE',
  'COM_MUCO',
  'COM_VERMES',
  'ESCURA',
  'CLARA',
  'NAO_DEFECOU',
] as const
const MICCAO = [
  'NORMAL',
  'MUITO',
  'POUCO',
  'NADA',
  'COM_SANGUE',
  'ESCURA',
  'COM_DIFICULDADE',
  'COM_ODOR_FORTE',
] as const
const AMBIENTE = ['DOMICILIAR', 'EXTERNO', 'MISTO'] as const

/** O rótulo de cada valor, nos termos que a casa já usa no diário e na pré-consulta. */
const ROTULO: Record<string, (valor: string) => string> = {
  desdeQuando: (v) => t(`clinico.preConsulta.desdeQuando.${v}`),
  evolucao: (v) => t(`atendimento.anamnese.evolucao.${v}`),
  apetite: (v) => t(`clinico.diario.alimentacao.${v}`),
  evacuacao: (v) => t(`clinico.diario.fezes.${v}`),
  miccao: (v) => t(`clinico.diario.urina.${v}`),
  ambiente: (v) => t(`atendimento.anamnese.ambiente.${v}`),
}

function opcoes(campo: string, valores: readonly string[]) {
  return valores.map((valor) => ({ valor, rotulo: ROTULO[campo]!(valor) }))
}

const opcoesSimNao = computed(() => [
  { valor: true, rotulo: t('atendimento.anamnese.sim') },
  { valor: false, rotulo: t('atendimento.anamnese.nao') },
])

/* ------------------------------------------------------------------- a pré-consulta */

type CampoSugerido =
  | 'queixaPrincipal'
  | 'desdeQuando'
  | 'evolucao'
  | 'apetite'
  | 'evacuacao'
  | 'miccao'

function sugestao(campo: CampoSugerido) {
  const item = props.preConsulta?.campos?.[campo]
  if (!item) return null
  const valor = String(item.valor as unknown as string)
  return {
    valor,
    marca: item.marca as CampoDaAnamnese,
    doDiario: item.procedencia === 'DIARIO',
    rotulo: campo === 'queixaPrincipal' ? valor : ROTULO[campo]!(valor),
  }
}

/** O campo já tem o valor do app (com a marca): a sugestão vira só a procedência. */
function veioDoApp(campo: CampoSugerido) {
  const lida = sugestao(campo)
  return Boolean(
    lida &&
    model.value.camposDaPreConsulta.includes(lida.marca) &&
    String(model.value[campo] ?? '') === lida.valor,
  )
}

function usar(campo: CampoSugerido) {
  const lida = sugestao(campo)
  if (!lida || props.somenteLeitura) return
  ;(model.value as Record<CampoSugerido, string | null>)[campo] = lida.valor
  if (!model.value.camposDaPreConsulta.includes(lida.marca)) {
    model.value.camposDaPreConsulta = [...model.value.camposDaPreConsulta, lida.marca]
  }
}

/** Os campos vazios com sugestão: o "Usar o que está vazio" da caixa da pré-consulta. */
const vaziosComSugestao = computed(() =>
  (
    ['queixaPrincipal', 'desdeQuando', 'evolucao', 'apetite', 'evacuacao', 'miccao'] as const
  ).filter((campo) => sugestao(campo) && !model.value[campo]),
)

function usarVazios() {
  for (const campo of vaziosComSugestao.value) usar(campo)
}

defineExpose({ usarVazios, vaziosComSugestao })
</script>

<template>
  <section class="ui-folha ui-cartao sa" aria-labelledby="sa-anamnese">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-chats-circle" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="sa-anamnese" class="ui-cartao__titulo">{{ t('atendimento.secao.ANAMNESE') }}</h2>
        <p class="ui-cartao__descricao">{{ t('atendimento.anamnese.descricao') }}</p>
      </span>
    </header>

    <div class="sa__form">
      <!-- O que trouxe o paciente. -->
      <section class="sa__grupo" aria-labelledby="sa-anamnese-queixa">
        <div class="sa__sobre">
          <h3 id="sa-anamnese-queixa" class="sa__titulo">{{ t('atendimento.anamnese.motivo') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.anamnese.motivoDica') }}</p>
        </div>
        <div class="sa__campos">
          <div class="eg__secao">
            <label class="eg__rotulo" for="an-queixa">{{ t('atendimento.anamnese.queixa') }}</label>
            <InputText
              id="an-queixa"
              v-model="model.queixaPrincipal"
              :readonly="somenteLeitura"
              :invalid="faltaQueixa && !model.queixaPrincipal"
            />
            <small v-if="faltaQueixa && !model.queixaPrincipal" class="eg__invalido">{{
              t('atendimento.anamnese.queixaFalta')
            }}</small>
            <p v-if="sugestao('queixaPrincipal')" class="sa__sugestao">
              <i class="ph ph-device-mobile" aria-hidden="true" />
              <span v-if="veioDoApp('queixaPrincipal')">{{ t('atendimento.anamnese.doApp') }}</span>
              <template v-else>
                <span>{{
                  t('atendimento.anamnese.noApp', { valor: sugestao('queixaPrincipal')?.rotulo })
                }}</span>
                <Button
                  v-if="!somenteLeitura"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :label="t('atendimento.anamnese.usar')"
                  @click="usar('queixaPrincipal')"
                />
              </template>
            </p>
          </div>

          <div class="eg__secao">
            <label class="eg__rotulo" for="an-historia">
              {{ t('atendimento.anamnese.historia') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <Textarea
              id="an-historia"
              v-model="model.historia"
              rows="3"
              auto-resize
              :readonly="somenteLeitura"
            />
          </div>

          <div class="an__quando">
            <div class="eg__secao an__desde">
              <label class="eg__rotulo" for="an-desde">{{
                t('atendimento.anamnese.desdeQuando')
              }}</label>
              <Select
                v-model="model.desdeQuando"
                input-id="an-desde"
                :options="opcoes('desdeQuando', DESDE_QUANDO)"
                option-label="rotulo"
                option-value="valor"
                show-clear
                :placeholder="t('atendimento.anamnese.naoPerguntado')"
                :disabled="somenteLeitura"
              />
              <p v-if="sugestao('desdeQuando') && !veioDoApp('desdeQuando')" class="sa__sugestao">
                <i class="ph ph-device-mobile" aria-hidden="true" />
                <span>{{
                  t('atendimento.anamnese.noApp', { valor: sugestao('desdeQuando')?.rotulo })
                }}</span>
                <Button
                  v-if="!somenteLeitura"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :label="t('atendimento.anamnese.usar')"
                  @click="usar('desdeQuando')"
                />
              </p>
            </div>
            <div class="eg__secao">
              <span id="an-evolucao" class="eg__rotulo">{{
                t('atendimento.anamnese.evolucaoRotulo')
              }}</span>
              <SelectButton
                v-model="model.evolucao"
                :options="opcoes('evolucao', EVOLUCAO)"
                option-label="rotulo"
                option-value="valor"
                aria-labelledby="an-evolucao"
                :disabled="somenteLeitura"
              />
              <p v-if="sugestao('evolucao') && !veioDoApp('evolucao')" class="sa__sugestao">
                <i class="ph ph-device-mobile" aria-hidden="true" />
                <span>{{
                  t('atendimento.anamnese.noApp', { valor: sugestao('evolucao')?.rotulo })
                }}</span>
                <Button
                  v-if="!somenteLeitura"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :label="t('atendimento.anamnese.usar')"
                  @click="usar('evolucao')"
                />
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Como está em casa. -->
      <section class="sa__grupo" aria-labelledby="sa-anamnese-casa">
        <div class="sa__sobre">
          <h3 id="sa-anamnese-casa" class="sa__titulo">{{ t('atendimento.anamnese.emCasa') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.anamnese.emCasaDica') }}</p>
        </div>
        <div class="sa__campos">
          <div class="sa__linha">
            <div
              v-for="item in [
                { campo: 'apetite', valores: APETITE },
                { campo: 'evacuacao', valores: EVACUACAO },
                { campo: 'miccao', valores: MICCAO },
              ] as const"
              :key="item.campo"
              class="eg__secao"
            >
              <label class="eg__rotulo" :for="`an-${item.campo}`">{{
                t(`atendimento.anamnese.${item.campo}`)
              }}</label>
              <Select
                v-model="model[item.campo]"
                :input-id="`an-${item.campo}`"
                :options="opcoes(item.campo, item.valores)"
                option-label="rotulo"
                option-value="valor"
                show-clear
                :placeholder="t('atendimento.anamnese.naoPerguntado')"
                :disabled="somenteLeitura"
              />
              <p v-if="sugestao(item.campo)" class="sa__sugestao">
                <i class="ph ph-device-mobile" aria-hidden="true" />
                <span v-if="veioDoApp(item.campo)">{{
                  sugestao(item.campo)?.doDiario
                    ? t('atendimento.anamnese.doDiario')
                    : t('atendimento.anamnese.doApp')
                }}</span>
                <template v-else>
                  <span>{{
                    t('atendimento.anamnese.noApp', { valor: sugestao(item.campo)?.rotulo })
                  }}</span>
                  <Button
                    v-if="!somenteLeitura"
                    type="button"
                    size="small"
                    severity="secondary"
                    outlined
                    :label="t('atendimento.anamnese.usar')"
                    @click="usar(item.campo)"
                  />
                </template>
              </p>
            </div>
          </div>
          <div class="eg__secao">
            <span id="an-ambiente" class="eg__rotulo">{{
              t('atendimento.anamnese.ambienteRotulo')
            }}</span>
            <SelectButton
              v-model="model.ambiente"
              :options="opcoes('ambiente', AMBIENTE)"
              option-label="rotulo"
              option-value="valor"
              aria-labelledby="an-ambiente"
              :disabled="somenteLeitura"
            />
          </div>
        </div>
      </section>

      <!-- Prevenção. -->
      <section class="sa__grupo" aria-labelledby="sa-anamnese-prevencao">
        <div class="sa__sobre">
          <h3 id="sa-anamnese-prevencao" class="sa__titulo">
            {{ t('atendimento.anamnese.prevencao') }}
          </h3>
        </div>
        <div class="sa__campos sa__linha">
          <div class="eg__secao">
            <span id="an-vacinacao" class="eg__rotulo">{{
              t('atendimento.anamnese.vacinacao')
            }}</span>
            <SelectButton
              v-model="model.vacinacaoEmDia"
              :options="opcoesSimNao"
              option-label="rotulo"
              option-value="valor"
              aria-labelledby="an-vacinacao"
              :disabled="somenteLeitura"
            />
          </div>
          <div class="eg__secao">
            <span id="an-vermifugacao" class="eg__rotulo">{{
              t('atendimento.anamnese.vermifugacao')
            }}</span>
            <SelectButton
              v-model="model.vermifugacaoEmDia"
              :options="opcoesSimNao"
              option-label="rotulo"
              option-value="valor"
              aria-labelledby="an-vermifugacao"
              :disabled="somenteLeitura"
            />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
/* "Desde quando" e "Como está indo" lado a lado só quando cabem: a escolha de quatro não aperta. */
.an__quando {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px 24px;
}

.an__desde {
  flex: 1 1 14rem;
  max-width: 22rem;
}
</style>
